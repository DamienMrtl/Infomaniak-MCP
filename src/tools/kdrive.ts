import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../client.js";
import { safeCall } from "./util.js";

export function register(server: McpServer, client: InfomaniakClient) {
  server.tool(
    "infomaniak_list_kdrives",
    "List kDrives the user has access to.",
    {},
    async () => safeCall(() => client.request("GET", "/2/drive")),
  );

  server.tool(
    "infomaniak_list_kdrive_files",
    "List the children of a directory on a kDrive. Use parent_id=1 for the root.",
    {
      drive_id: z.number().int(),
      parent_id: z.number().int().default(1),
      order: z.enum(["asc", "desc"]).default("asc"),
      order_by: z
        .enum(["type", "name", "size", "last_modified_at"])
        .default("name"),
      page: z.number().int().min(1).default(1),
      per_page: z.number().int().min(1).max(1000).default(50),
    },
    async ({ drive_id, parent_id, order, order_by, page, per_page }) =>
      safeCall(() =>
        client.request(
          "GET",
          `/2/drive/${drive_id}/files/${parent_id}/files`,
          { query: { order, order_by, page, per_page } },
        ),
      ),
  );

  server.tool(
    "infomaniak_get_kdrive_file",
    "Get metadata for a single file or directory on a kDrive.",
    {
      drive_id: z.number().int(),
      file_id: z.number().int(),
    },
    async ({ drive_id, file_id }) =>
      safeCall(() =>
        client.request("GET", `/2/drive/${drive_id}/files/${file_id}`),
      ),
  );

  server.tool(
    "infomaniak_create_kdrive_directory",
    "Create a directory on a kDrive.",
    {
      drive_id: z.number().int(),
      parent_id: z.number().int().default(1),
      name: z.string(),
    },
    async ({ drive_id, parent_id, name }) =>
      safeCall(() =>
        client.request(
          "POST",
          `/2/drive/${drive_id}/files/${parent_id}/directory`,
          { body: { name } },
        ),
      ),
  );

  server.tool(
    "infomaniak_delete_kdrive_file",
    "Move a file or directory to the kDrive trash.",
    {
      drive_id: z.number().int(),
      file_id: z.number().int(),
    },
    async ({ drive_id, file_id }) =>
      safeCall(() =>
        client.request("DELETE", `/2/drive/${drive_id}/files/${file_id}`),
      ),
  );

  server.tool(
    "infomaniak_share_kdrive_file",
    "Create a public share link for a file or directory.",
    {
      drive_id: z.number().int(),
      file_id: z.number().int(),
      permission: z
        .enum(["read", "write"])
        .default("read")
        .describe("Permission granted to the link."),
      password: z
        .string()
        .optional()
        .describe("Optional password protecting the link."),
      valid_until: z
        .number()
        .int()
        .optional()
        .describe("Unix timestamp at which the link expires."),
    },
    async ({ drive_id, file_id, permission, password, valid_until }) =>
      safeCall(() =>
        client.request("POST", `/2/drive/${drive_id}/files/${file_id}/link`, {
          body: { permission, password, valid_until },
        }),
      ),
  );
}
