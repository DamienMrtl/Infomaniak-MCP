import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../client.js";
import { safeCall } from "./util.js";

export function register(server: McpServer, client: InfomaniakClient) {
  server.tool(
    "infomaniak_list_orderable_products",
    "List the products that can be ordered (catalogue), optionally filtered by service.",
    {
      service_name: z
        .string()
        .optional()
        .describe(
          "Service slug to filter on, e.g. hosting, domain, mail_hosting, drive, jelastic, server.",
        ),
    },
    async ({ service_name }) =>
      safeCall(() =>
        client.request("GET", "/1/order/product", {
          query: { service_name },
        }),
      ),
  );

  server.tool(
    "infomaniak_list_orders",
    "List orders previously placed by the user.",
    {
      account_id: z.number().int().optional(),
    },
    async ({ account_id }) =>
      safeCall(() =>
        client.request("GET", "/1/order", { query: { account_id } }),
      ),
  );

  server.tool(
    "infomaniak_get_order",
    "Get details about one order.",
    {
      order_id: z.number().int(),
    },
    async ({ order_id }) =>
      safeCall(() => client.request("GET", `/1/order/${order_id}`)),
  );

  server.tool(
    "infomaniak_create_order",
    "Place a new order on the Infomaniak catalogue. The payload depends on the targeted product; check infomaniak_list_orderable_products first. Be careful: this can be a paid action.",
    {
      account_id: z
        .number()
        .int()
        .describe("Account that will be billed and own the new product."),
      products: z
        .array(
          z.object({
            product_id: z
              .number()
              .int()
              .describe("Catalogue product ID returned by list_orderable_products."),
            quantity: z.number().int().min(1).default(1),
            options: z
              .record(z.unknown())
              .optional()
              .describe(
                "Product-specific options (domain name, plan duration, etc.).",
              ),
          }),
        )
        .min(1),
      payment_method: z
        .string()
        .optional()
        .describe(
          "Payment method slug. Defaults to the account's preferred method when omitted.",
        ),
      confirm: z
        .boolean()
        .default(false)
        .describe(
          "Must be set to true to actually submit the order. When false this tool simulates and returns the request body only.",
        ),
    },
    async ({ account_id, products, payment_method, confirm }) => {
      const body = { account_id, products, payment_method };
      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  dry_run: true,
                  message:
                    "confirm=false: order NOT placed. Re-run with confirm=true to actually submit.",
                  request: { method: "POST", path: "/1/order", body },
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      return safeCall(() => client.request("POST", "/1/order", { body }));
    },
  );
}
