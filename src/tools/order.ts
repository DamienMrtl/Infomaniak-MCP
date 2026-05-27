import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../services/client.js";
import {
  PaginationSchema,
  ResponseFormatSchema,
} from "../schemas/common.js";
import { ResponseFormat } from "../types.js";
import {
  envelopeToPagination,
  runPaginatedTool,
  runTool,
} from "../services/format.js";

const ListOrderableInput = z
  .object({
    service_name: z
      .string()
      .optional()
      .describe(
        "Filter on a service slug: hosting, domain, mail_hosting, drive, jelastic, server, ...",
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListOrderableArgs = z.infer<typeof ListOrderableInput>;

const ListOrdersInput = z
  .object({
    account_id: z.number().int().positive().optional(),
    ...PaginationSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListOrdersArgs = z.infer<typeof ListOrdersInput>;

const GetOrderInput = z
  .object({
    order_id: z.number().int().positive(),
    response_format: ResponseFormatSchema,
  })
  .strict();
type GetOrderArgs = z.infer<typeof GetOrderInput>;

const CreateOrderProductSchema = z
  .object({
    product_id: z
      .number()
      .int()
      .positive()
      .describe(
        "Catalogue product ID, from infomaniak_list_orderable_products.",
      ),
    quantity: z.number().int().min(1).default(1),
    options: z
      .record(z.unknown())
      .optional()
      .describe("Product-specific options (domain name, plan duration, etc.)."),
  })
  .strict();

const CreateOrderInput = z
  .object({
    account_id: z
      .number()
      .int()
      .positive()
      .describe("Account that will be billed and own the new product."),
    products: z.array(CreateOrderProductSchema).min(1),
    payment_method: z
      .string()
      .optional()
      .describe(
        "Payment method slug. Falls back to the account's preferred method.",
      ),
    confirm: z
      .boolean()
      .default(false)
      .describe(
        "Must be true to actually place the order. False returns the prepared request (dry-run).",
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateOrderArgs = z.infer<typeof CreateOrderInput>;

export function register(server: McpServer, client: InfomaniakClient) {
  server.registerTool(
    "infomaniak_list_orderable_products",
    {
      title: "List orderable products (catalogue)",
      description: `List the products in the Infomaniak catalogue that can be ordered.

Args:
  - service_name (string, optional): catalogue slug to filter on.
  - response_format ('markdown'|'json').

Returns:
  Envelope with array of catalogue entries (id, slug, prices, options schema, ...).`,
      inputSchema: ListOrderableInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ service_name, response_format }: ListOrderableArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "Orderable products",
        () =>
          client.request("GET", "/1/order/product", {
            query: { service_name },
          }),
      ),
  );

  server.registerTool(
    "infomaniak_list_orders",
    {
      title: "List past orders",
      description: `List orders previously placed by the user (paginated).

Args:
  - account_id (number, optional).
  - page, per_page: pagination (defaults 1, 25).
  - response_format ('markdown'|'json').`,
      inputSchema: ListOrdersInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListOrdersArgs) => {
      const page = params.page ?? 1;
      const per_page = params.per_page ?? 25;
      return runPaginatedTool(
        params.response_format ?? ResponseFormat.MARKDOWN,
        "Orders",
        async () => {
          const env = await client.requestEnvelope<unknown[]>(
            "GET",
            "/1/order",
            {
              query: {
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
    "infomaniak_get_order",
    {
      title: "Get one order",
      description: `Get one previously-placed order by ID.

Args:
  - order_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: GetOrderInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ order_id, response_format }: GetOrderArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Order ${order_id}`,
        () => client.request("GET", `/1/order/${order_id}`),
      ),
  );

  server.registerTool(
    "infomaniak_create_order",
    {
      title: "Place a new order (PAID)",
      description: `Place a new order on the Infomaniak catalogue. PAID action: this will charge the account.

Args:
  - account_id (number).
  - products (array): each item { product_id, quantity, options }. Check infomaniak_list_orderable_products to discover product_id and the option schema.
  - payment_method (string, optional): falls back to the account default.
  - confirm (boolean): MUST be true to actually submit. False returns a dry-run preview.
  - response_format ('markdown'|'json').

Returns:
  If confirm=false: { dry_run: true, request: {...} }.
  If confirm=true: Envelope with the created order.

Error Handling:
  - 402: payment method declined or insufficient credit.
  - 422: product options invalid.`,
      inputSchema: CreateOrderInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      account_id,
      products,
      payment_method,
      confirm,
      response_format,
    }: CreateOrderArgs) => {
      const body = { account_id, products, payment_method };
      if (!confirm) {
        return runTool(
          response_format ?? ResponseFormat.MARKDOWN,
          "Dry-run order",
          async () => ({
            dry_run: true,
            message:
              "confirm=false: nothing ordered. Re-run with confirm=true to actually charge the account.",
            request: { method: "POST", path: "/1/order", body },
          }),
        );
      }
      return runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "Place order",
        () => client.request("POST", "/1/order", { body }),
      );
    },
  );
}
