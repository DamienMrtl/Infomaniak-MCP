import { CHARACTER_LIMIT } from "../constants.js";
import {
  type InfomaniakEnvelope,
  type PaginationOutput,
  ResponseFormat,
  type ToolTextResponse,
} from "../types.js";
import { handleApiError } from "./errors.js";

interface FormatOptions {
  format: ResponseFormat;
  title?: string;
  renderMarkdown?: (data: unknown) => string;
}

export function buildResponse(
  data: unknown,
  options: FormatOptions,
): ToolTextResponse {
  const structured = toRecord(data);
  let text: string;
  if (options.format === ResponseFormat.MARKDOWN) {
    text = options.renderMarkdown
      ? options.renderMarkdown(data)
      : defaultMarkdown(options.title, data);
  } else {
    text = JSON.stringify(data, null, 2);
  }
  return enforceLimit({
    content: [{ type: "text", text }],
    ...(structured ? { structuredContent: structured } : {}),
  });
}

export function buildPaginatedResponse<T>(
  payload: PaginationOutput<T>,
  options: FormatOptions,
): ToolTextResponse {
  let text: string;
  if (options.format === ResponseFormat.MARKDOWN) {
    text = options.renderMarkdown
      ? options.renderMarkdown(payload)
      : defaultPaginatedMarkdown(options.title, payload);
  } else {
    text = JSON.stringify(payload, null, 2);
  }
  return enforceLimit({
    content: [{ type: "text", text }],
    structuredContent: payload as unknown as Record<string, unknown>,
  });
}

export function buildErrorResponse(error: unknown): ToolTextResponse {
  return {
    isError: true,
    content: [{ type: "text", text: handleApiError(error) }],
  };
}

/**
 * Run an async API call and wrap the outcome as an MCP tool response.
 * Use this for non-paginated endpoints. Catches errors and produces a
 * consistent error envelope.
 */
export async function runTool(
  format: ResponseFormat,
  title: string,
  call: () => Promise<unknown>,
  renderMarkdown?: (data: unknown) => string,
): Promise<ToolTextResponse> {
  try {
    const data = await call();
    return buildResponse(data, { format, title, renderMarkdown });
  } catch (err) {
    return buildErrorResponse(err);
  }
}

/**
 * Run a paginated API call. The caller supplies the page+per_page along with
 * a transform turning the upstream envelope into a PaginationOutput.
 */
export async function runPaginatedTool<T>(
  format: ResponseFormat,
  title: string,
  call: () => Promise<{
    items: T[];
    total?: number;
    page: number;
    per_page: number;
  }>,
  renderMarkdown?: (payload: PaginationOutput<T>) => string,
): Promise<ToolTextResponse> {
  try {
    const { items, total, page, per_page } = await call();
    const offset = (page - 1) * per_page;
    const has_more =
      total !== undefined
        ? offset + items.length < total
        : items.length === per_page;
    const payload: PaginationOutput<T> = {
      total: total ?? offset + items.length,
      count: items.length,
      page,
      per_page,
      items,
      has_more,
      ...(has_more ? { next_page: page + 1 } : {}),
    };
    return buildPaginatedResponse(payload, {
      format,
      title,
      renderMarkdown: renderMarkdown
        ? (p) => renderMarkdown(p as PaginationOutput<T>)
        : undefined,
    });
  } catch (err) {
    return buildErrorResponse(err);
  }
}

export function envelopeToPagination<T>(
  envelope: InfomaniakEnvelope<T[]>,
  page: number,
  per_page: number,
): { items: T[]; total?: number; page: number; per_page: number } {
  const items = Array.isArray(envelope.data) ? envelope.data : [];
  return {
    items,
    total: envelope.total,
    page: envelope.page ?? page,
    per_page: envelope.items_per_page ?? per_page,
  };
}

function defaultMarkdown(title: string | undefined, data: unknown): string {
  const heading = title ? `# ${title}\n\n` : "";
  return `${heading}\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

function defaultPaginatedMarkdown<T>(
  title: string | undefined,
  payload: PaginationOutput<T>,
): string {
  const lines: string[] = [];
  if (title) lines.push(`# ${title}`, "");
  lines.push(
    `Page ${payload.page} · ${payload.count}/${payload.total} items` +
      (payload.has_more
        ? ` · next_page=${payload.next_page ?? payload.page + 1}`
        : " · last page"),
    "",
  );
  if (payload.items.length === 0) {
    lines.push("_No results._");
  } else {
    lines.push("```json");
    lines.push(JSON.stringify(payload.items, null, 2));
    lines.push("```");
  }
  return lines.join("\n");
}

function toRecord(data: unknown): Record<string, unknown> | undefined {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  if (Array.isArray(data)) {
    return { items: data };
  }
  return undefined;
}

function enforceLimit(response: ToolTextResponse): ToolTextResponse {
  const text = response.content[0]?.text ?? "";
  if (text.length <= CHARACTER_LIMIT) return response;

  const truncated = text.slice(0, CHARACTER_LIMIT - 200);
  const notice =
    `\n\n... [truncated: response was ${text.length} chars, capped at ` +
    `${CHARACTER_LIMIT}. Use pagination (page/per_page) or filters to ` +
    `narrow results, or call infomaniak_request directly to stream a ` +
    `specific endpoint.]`;
  return {
    ...response,
    content: [{ type: "text", text: truncated + notice }],
    structuredContent: response.structuredContent
      ? { ...response.structuredContent, truncated: true }
      : { truncated: true },
  };
}
