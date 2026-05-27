import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../services/client.js";
import {
  PaginationSchema,
  ResponseFormatSchema,
} from "../schemas/common.js";
import { ResponseFormat, type InfomaniakEnvelope } from "../types.js";
import {
  envelopeToPagination,
  runPaginatedTool,
  runTool,
} from "../services/format.js";

const ServiceNameSchema = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Service slug filter, e.g. hosting, domain, mail_hosting, drive, jelastic, server, ai_tools.",
  );

const ListProductsInput = z
  .object({
    service_name: ServiceNameSchema,
    account_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Restrict to a single account."),
    ...PaginationSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListArgs = z.infer<typeof ListProductsInput>;

const GetProductInput = z
  .object({
    product_id: z.number().int().positive().describe("Numeric product ID."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type GetArgs = z.infer<typeof GetProductInput>;

export function register(server: McpServer, client: InfomaniakClient) {
  server.registerTool(
    "infomaniak_list_products",
    {
      title: "List owned Infomaniak products",
      description: `List the products (services) owned across every account the user has access to, optionally filtered by service or account.

Args:
  - service_name (string, optional): filter on a service slug (hosting, domain, mail_hosting, drive, jelastic, server, ai_tools, ...).
  - account_id (number, optional): restrict to one account.
  - page (number): 1-based page index (default 1).
  - per_page (number): items per page, 1-100 (default 25).
  - response_format ('markdown'|'json'): output format (default 'markdown').

Returns:
  Pagination payload:
  {
    total: number,
    count: number,
    page: number,
    per_page: number,
    items: [ { id, service_name, customer_name, account_id, ... } ],
    has_more: boolean,
    next_page?: number
  }

Examples:
  - List all hostings I own: { service_name: 'hosting' }
  - List products on one account: { account_id: 12345 }

Error Handling:
  - 401: invalid token.
  - 422: unknown service_name slug.`,
      inputSchema: ListProductsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListArgs) => {
      const page = params.page ?? 1;
      const per_page = params.per_page ?? 25;
      return runPaginatedTool(
        params.response_format ?? ResponseFormat.MARKDOWN,
        "Infomaniak products",
        async () => {
          const env = await client.requestEnvelope<unknown[]>(
            "GET",
            "/1/products",
            {
              query: {
                service_name: params.service_name,
                account_id: params.account_id,
                page,
                per_page,
              },
            },
          );
          return envelopeToPagination(env, page, per_page);
        },
      );
    },
  );

  server.registerTool(
    "infomaniak_get_product",
    {
      title: "Get one owned product",
      description: `Get details for one owned product (any service).

Args:
  - product_id (number, required): numeric product ID returned by infomaniak_list_products.
  - response_format ('markdown'|'json'): output format (default 'markdown').

Returns:
  Envelope { result: 'success', data: { id, service_name, ... } }.

Error Handling:
  - 404: unknown product, or product not in any of the user's accounts.`,
      inputSchema: GetProductInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ product_id, response_format }: GetArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Product ${product_id}`,
        () => client.request("GET", `/1/products/${product_id}`),
      ),
  );
}

// Helper kept exported in case other tools want to reuse envelope handling.
export type { InfomaniakEnvelope };
