import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../client.js";
import { safeCall } from "./util.js";

export function register(server: McpServer, client: InfomaniakClient) {
  server.tool(
    "infomaniak_list_products",
    "List all products (services) owned by the user across every account.",
    {
      service_name: z
        .string()
        .optional()
        .describe(
          "Filter on a specific service, e.g. hosting, domain, drive, mail_hosting, jelastic, server, ai_tools.",
        ),
      account_id: z
        .number()
        .int()
        .optional()
        .describe("Restrict to a single Infomaniak account ID."),
    },
    async ({ service_name, account_id }) =>
      safeCall(() =>
        client.request("GET", "/1/products", {
          query: { service_name, account_id },
        }),
      ),
  );

  server.tool(
    "infomaniak_get_product",
    "Get details for one owned product.",
    {
      product_id: z.number().int().describe("Numeric product ID"),
    },
    async ({ product_id }) =>
      safeCall(() => client.request("GET", `/1/products/${product_id}`)),
  );
}
