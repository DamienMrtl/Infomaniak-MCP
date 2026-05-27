import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../client.js";
import { safeCall } from "./util.js";

export function register(server: McpServer, client: InfomaniakClient) {
  server.tool(
    "infomaniak_request",
    "Escape hatch: call ANY Infomaniak API endpoint. Use this when no dedicated tool covers what you need. The full reference lives at https://developer.infomaniak.com.",
    {
      method: z
        .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
        .describe("HTTP verb"),
      path: z
        .string()
        .describe(
          "API path starting with /, e.g. /1/profile, /1/hosting, /2/drive/{drive_id}/files/1",
        ),
      query: z
        .record(z.unknown())
        .optional()
        .describe("Query string parameters as a JSON object."),
      body: z
        .unknown()
        .optional()
        .describe("Request body, serialized as JSON. Omit for GET/DELETE."),
      headers: z
        .record(z.string())
        .optional()
        .describe("Extra headers to merge on top of Authorization/Accept."),
    },
    async ({ method, path, query, body, headers }) =>
      safeCall(() =>
        client.request(method, path, {
          query: query as Record<string, unknown> | undefined,
          body,
          headers,
        }),
      ),
  );
}
