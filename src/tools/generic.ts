import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../services/client.js";
import { ResponseFormatSchema } from "../schemas/common.js";
import { ResponseFormat } from "../types.js";
import { runTool } from "../services/format.js";

const GenericRequestInput = z
  .object({
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .describe("HTTP verb."),
    path: z
      .string()
      .min(1)
      .describe(
        "API path beginning with /, e.g. /1/profile, /1/hosting, /2/drive/123/files/1.",
      ),
    query: z
      .record(z.unknown())
      .optional()
      .describe("Query string parameters as a JSON object."),
    body: z
      .unknown()
      .optional()
      .describe("JSON body. Omit for GET/DELETE."),
    headers: z
      .record(z.string())
      .optional()
      .describe(
        "Extra HTTP headers (merged on top of Authorization/Accept).",
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();

type Input = z.infer<typeof GenericRequestInput>;

export function register(server: McpServer, client: InfomaniakClient) {
  server.registerTool(
    "infomaniak_request",
    {
      title: "Generic Infomaniak API call",
      description: `Escape hatch: invoke ANY Infomaniak public API endpoint when no dedicated tool covers your need. The full API reference lives at https://developer.infomaniak.com.

Args:
  - method ('GET'|'POST'|'PUT'|'PATCH'|'DELETE'): HTTP verb.
  - path (string): API path beginning with '/' (e.g. '/1/profile', '/1/hosting').
  - query (object, optional): JSON object of query-string parameters.
  - body (any, optional): JSON body. Omit for GET/DELETE.
  - headers (object<string,string>, optional): extra HTTP headers.
  - response_format ('markdown'|'json'): output format (default 'markdown').

Returns:
  Raw JSON payload returned by the Infomaniak API (rendered as code-fenced JSON in markdown mode). For Infomaniak-style envelopes this is typically:
  {
    "result": "success" | "error",
    "data": <endpoint-specific payload>,
    "page"?: number,
    "pages"?: number,
    "total"?: number
  }

Examples:
  - Inspect profile: { method: 'GET', path: '/1/profile' }
  - List hosting: { method: 'GET', path: '/1/hosting', query: { with: ['site'] } }
  - Custom DELETE: { method: 'DELETE', path: '/1/hosting/12345/site/678' }

Error Handling:
  - 401: missing/expired INFOMANIAK_API_TOKEN.
  - 403: token lacks scope for that endpoint.
  - 404: path or ID is wrong.
  - 429: rate-limited, back off.`,
      inputSchema: GenericRequestInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: Input) =>
      runTool(
        params.response_format ?? ResponseFormat.MARKDOWN,
        `${params.method} ${params.path}`,
        () =>
          client.request(params.method, params.path, {
            query: params.query as Record<string, unknown> | undefined,
            body: params.body,
            headers: params.headers,
          }),
      ),
  );
}
