import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../client.js";
import { safeCall } from "./util.js";

export function register(server: McpServer, client: InfomaniakClient) {
  server.tool(
    "infomaniak_get_profile",
    "Return the authenticated user's Infomaniak profile.",
    {},
    async () => safeCall(() => client.request("GET", "/1/profile")),
  );

  server.tool(
    "infomaniak_list_accounts",
    "List the Infomaniak accounts (Organisations) the user has access to.",
    {},
    async () => safeCall(() => client.request("GET", "/1/account")),
  );

  server.tool(
    "infomaniak_get_account",
    "Get details for one Infomaniak account by ID.",
    {
      account_id: z.number().int().describe("Numeric account ID"),
    },
    async ({ account_id }) =>
      safeCall(() => client.request("GET", `/1/account/${account_id}`)),
  );
}
