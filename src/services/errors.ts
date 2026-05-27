import axios, { AxiosError } from "axios";
import {
  DEVELOPER_PORTAL,
  DOCS_CATALOGUE_URL,
  docsUrl,
  inferTemplate,
} from "./docs.js";

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return formatAxiosError(error);
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

function formatAxiosError(error: AxiosError): string {
  if (error.code === "ECONNABORTED") {
    return "Error: request to Infomaniak API timed out. Retry, or narrow the query.";
  }
  if (!error.response) {
    return `Error: network failure reaching Infomaniak API (${error.message}).`;
  }
  const { status, data } = error.response;
  const detail = extractInfomaniakDetail(data);
  const head = headline(status, detail, error.message);
  return head + docsFooter(error, status);
}

function headline(
  status: number,
  detail: string | undefined,
  fallback: string,
): string {
  switch (status) {
    case 400:
      return `Error 400: invalid request. ${detail ?? "Check parameter types and required fields."}`;
    case 401:
      return "Error 401: authentication failed. Verify INFOMANIAK_API_TOKEN is set and not expired.";
    case 403:
      return `Error 403: permission denied. ${detail ?? "The token is missing the required scope for this endpoint."}`;
    case 404:
      return `Error 404: resource not found. ${detail ?? "The path may be deprecated or the ID is wrong."}`;
    case 405:
      return `Error 405: method not allowed. ${detail ?? "The endpoint exists but not for this HTTP verb."}`;
    case 409:
      return `Error 409: conflict. ${detail ?? "Resource already exists or state prevents the change."}`;
    case 422:
      return `Error 422: validation failed. ${detail ?? "Payload shape may have changed; check the live spec."}`;
    case 429:
      return "Error 429: rate limit exceeded on Infomaniak API (60 req/min). Retry with backoff.";
    case 500:
    case 502:
    case 503:
    case 504:
      return `Error ${status}: Infomaniak API is currently unavailable. Retry shortly.`;
    default:
      return `Error ${status}: ${detail ?? fallback}`;
  }
}

/**
 * For 4xx and 5xx errors, append pointers to the live API docs so the
 * agent driving this MCP can self-heal: re-read the spec, retry via the
 * generic `infomaniak_request` tool with the corrected shape, or propose
 * a code patch to this MCP.
 */
function docsFooter(error: AxiosError, status: number): string {
  if (status < 400) return "";
  const method = (error.config?.method ?? "get").toUpperCase();
  const rawPath = extractPath(error);
  const template = rawPath ? inferTemplate(rawPath) : "";
  const lines = [
    "",
    "Self-healing pointers:",
    template
      ? `  • Doc page (best-effort): ${docsUrl(method, template)}`
      : `  • API reference index: ${DEVELOPER_PORTAL}/docs/api`,
    `  • Live methods catalogue (JSON): ${DOCS_CATALOGUE_URL}`,
    `  • Run the 'infomaniak_fetch_docs_catalogue' tool to download the live schema, then retry via 'infomaniak_request' with the corrected path/body.`,
  ];
  return "\n" + lines.join("\n");
}

function extractPath(error: AxiosError): string | undefined {
  const url = error.config?.url;
  if (!url) return undefined;
  try {
    return new URL(url, "http://placeholder").pathname;
  } catch {
    return url.startsWith("/") ? url : `/${url}`;
  }
}

function extractInfomaniakDetail(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const obj = data as Record<string, unknown>;
  const err = obj.error;
  if (!err || typeof err !== "object") return undefined;
  const e = err as Record<string, unknown>;
  const code = typeof e.code === "string" ? e.code : undefined;
  const desc = typeof e.description === "string" ? e.description : undefined;
  return [code, desc].filter(Boolean).join(" — ") || undefined;
}
