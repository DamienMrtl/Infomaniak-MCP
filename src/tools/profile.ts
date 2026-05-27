import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../services/client.js";
import { ResponseFormatSchema } from "../schemas/common.js";
import { ResponseFormat } from "../types.js";
import { runTool } from "../services/format.js";

const NoArgsInput = z.object({ response_format: ResponseFormatSchema }).strict();
type NoArgs = z.infer<typeof NoArgsInput>;

const AccountInput = z
  .object({
    account_id: z.number().int().positive().describe("Numeric account ID."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type AccountArgs = z.infer<typeof AccountInput>;

export function register(server: McpServer, client: InfomaniakClient) {
  server.registerTool(
    "infomaniak_get_profile",
    {
      title: "Get authenticated user's profile",
      description: `Return the authenticated user's Infomaniak profile (id, email, locale, organisation memberships).

Args:
  - response_format ('markdown'|'json'): output format (default 'markdown').

Returns:
  Envelope { result: 'success', data: {
    id: number,
    login: string,
    email: string,
    display_name: string,
    locale: string,
    phones: [...],
    ...
  } }

Examples:
  - Use when: you need the current user's identity, e-mail or default locale before performing other operations.
  - Don't use when: you need account-level info (use infomaniak_list_accounts instead).

Error Handling:
  - 401: token missing or invalid.`,
      inputSchema: NoArgsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }: NoArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "Infomaniak profile",
        () => client.request("GET", "/1/profile"),
      ),
  );

  server.registerTool(
    "infomaniak_list_accounts",
    {
      title: "List accessible Infomaniak accounts",
      description: `List Infomaniak accounts (Organisations) the authenticated user has access to.

Args:
  - response_format ('markdown'|'json'): output format (default 'markdown').

Returns:
  Envelope { result: 'success', data: [ { id: number, name: string, type: string, ... } ] }

Examples:
  - Use when: you need an account_id before calling list_products, list_hostings, etc.

Error Handling:
  - 401: token invalid.`,
      inputSchema: NoArgsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }: NoArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "Infomaniak accounts",
        () => client.request("GET", "/1/account"),
      ),
  );

  server.registerTool(
    "infomaniak_get_account",
    {
      title: "Get one Infomaniak account",
      description: `Get full details for a single Infomaniak account.

Args:
  - account_id (number, required): numeric account ID returned by infomaniak_list_accounts.
  - response_format ('markdown'|'json'): output format (default 'markdown').

Returns:
  Envelope { result: 'success', data: { id, name, type, customer_reference, ... } }

Error Handling:
  - 404: account ID does not exist or is not accessible to this token.`,
      inputSchema: AccountInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ account_id, response_format }: AccountArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Account ${account_id}`,
        () => client.request("GET", `/1/account/${account_id}`),
      ),
  );
}
