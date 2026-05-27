import { InfomaniakError } from "../client.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function jsonContent(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function textContent(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export async function safeCall(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = await fn();
    return jsonContent(result);
  } catch (err) {
    if (err instanceof InfomaniakError) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { status: err.status, error: err.data, message: err.message },
              null,
              2,
            ),
          },
        ],
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: "text", text: message }] };
  }
}
