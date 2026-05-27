import axios, { AxiosError } from "axios";

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
  switch (status) {
    case 400:
      return `Error 400: invalid request. ${detail ?? "Check parameter types and required fields."}`;
    case 401:
      return "Error 401: authentication failed. Verify INFOMANIAK_API_TOKEN is set and not expired.";
    case 403:
      return `Error 403: permission denied. ${detail ?? "The token is missing the required scope for this endpoint."}`;
    case 404:
      return `Error 404: resource not found. ${detail ?? "Double-check IDs in the path."}`;
    case 409:
      return `Error 409: conflict. ${detail ?? "Resource already exists or state prevents the change."}`;
    case 422:
      return `Error 422: validation failed. ${detail ?? "Adjust the payload."}`;
    case 429:
      return "Error 429: rate limit exceeded on Infomaniak API. Retry with backoff.";
    case 500:
    case 502:
    case 503:
    case 504:
      return `Error ${status}: Infomaniak API is currently unavailable. Retry shortly.`;
    default:
      return `Error ${status}: ${detail ?? error.message}`;
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
