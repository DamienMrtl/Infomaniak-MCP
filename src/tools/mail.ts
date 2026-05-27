import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../services/client.js";
import { ResponseFormatSchema } from "../schemas/common.js";
import { ResponseFormat } from "../types.js";
import { runTool } from "../services/format.js";

const MailHostingId = z
  .number()
  .int()
  .positive()
  .describe("Mail Hosting product ID.");

const MailboxName = z
  .string()
  .min(1)
  .describe("Local part of the mailbox address (before the @).");

const ListMailHostingsInput = z
  .object({
    account_id: z.number().int().positive().optional(),
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListMailHostingsArgs = z.infer<typeof ListMailHostingsInput>;

const GetMailHostingInput = z
  .object({
    mail_hosting_id: MailHostingId,
    response_format: ResponseFormatSchema,
  })
  .strict();
type GetMailHostingArgs = z.infer<typeof GetMailHostingInput>;

const MailHostingScoped = GetMailHostingInput;
type MailHostingScopedArgs = z.infer<typeof MailHostingScoped>;

const CreateMailboxInput = z
  .object({
    mail_hosting_id: MailHostingId,
    mailbox_name: MailboxName,
    password: z.string().min(8),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateMailboxArgs = z.infer<typeof CreateMailboxInput>;

const DeleteMailboxInput = z
  .object({
    mail_hosting_id: MailHostingId,
    mailbox_name: MailboxName,
    confirm: z
      .boolean()
      .default(false)
      .describe("Must be true to actually delete; false returns a dry-run."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type DeleteMailboxArgs = z.infer<typeof DeleteMailboxInput>;

const MailboxAliasScoped = z
  .object({
    mail_hosting_id: MailHostingId,
    mailbox_name: MailboxName,
    response_format: ResponseFormatSchema,
  })
  .strict();
type MailboxAliasScopedArgs = z.infer<typeof MailboxAliasScoped>;

const CreateAliasInput = z
  .object({
    mail_hosting_id: MailHostingId,
    mailbox_name: MailboxName,
    alias: z.string().min(1).describe("Alias local part."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateAliasArgs = z.infer<typeof CreateAliasInput>;

export function register(server: McpServer, client: InfomaniakClient) {
  server.registerTool(
    "infomaniak_list_mail_hostings",
    {
      title: "List Mail Hosting products",
      description: `List Mail Hosting products (containers of mailboxes attached to a domain).

Args:
  - account_id (number, optional).
  - response_format ('markdown'|'json').`,
      inputSchema: ListMailHostingsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ account_id, response_format }: ListMailHostingsArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "Mail Hostings",
        () =>
          client.request("GET", "/1/mail_hostings", {
            query: { account_id },
          }),
      ),
  );

  server.registerTool(
    "infomaniak_get_mail_hosting",
    {
      title: "Get one Mail Hosting product",
      description: `Get details for one Mail Hosting product.

Args:
  - mail_hosting_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: GetMailHostingInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ mail_hosting_id, response_format }: GetMailHostingArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Mail Hosting ${mail_hosting_id}`,
        () =>
          client.request("GET", `/1/mail_hostings/${mail_hosting_id}`),
      ),
  );

  server.registerTool(
    "infomaniak_list_mailboxes",
    {
      title: "List mailboxes",
      description: `List mailboxes inside a Mail Hosting product.

Args:
  - mail_hosting_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: MailHostingScoped.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ mail_hosting_id, response_format }: MailHostingScopedArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Mailboxes for ${mail_hosting_id}`,
        () =>
          client.request(
            "GET",
            `/1/mail_hostings/${mail_hosting_id}/mailboxes`,
          ),
      ),
  );

  server.registerTool(
    "infomaniak_create_mailbox",
    {
      title: "Create a mailbox",
      description: `Create a mailbox inside a Mail Hosting product.

Args:
  - mail_hosting_id (number).
  - mailbox_name (string): local part of the new address.
  - password (string, 8+ chars).
  - first_name (string, optional).
  - last_name (string, optional).
  - response_format ('markdown'|'json').

Error Handling:
  - 409: mailbox already exists.
  - 422: password fails the policy.`,
      inputSchema: CreateMailboxInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      mail_hosting_id,
      mailbox_name,
      password,
      first_name,
      last_name,
      response_format,
    }: CreateMailboxArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Create mailbox ${mailbox_name}`,
        () =>
          client.request(
            "POST",
            `/1/mail_hostings/${mail_hosting_id}/mailboxes`,
            { body: { mailbox_name, password, first_name, last_name } },
          ),
      ),
  );

  server.registerTool(
    "infomaniak_delete_mailbox",
    {
      title: "Delete a mailbox",
      description: `Delete a mailbox. DESTRUCTIVE: emails are removed.

Args:
  - mail_hosting_id (number).
  - mailbox_name (string).
  - confirm (boolean): must be true; false returns a dry-run.
  - response_format ('markdown'|'json').`,
      inputSchema: DeleteMailboxInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      mail_hosting_id,
      mailbox_name,
      confirm,
      response_format,
    }: DeleteMailboxArgs) => {
      const path = `/1/mail_hostings/${mail_hosting_id}/mailboxes/${encodeURIComponent(mailbox_name)}`;
      if (!confirm) {
        return runTool(
          response_format ?? ResponseFormat.MARKDOWN,
          "Dry-run delete mailbox",
          async () => ({
            dry_run: true,
            message:
              "confirm=false: nothing deleted. Re-run with confirm=true to actually delete.",
            request: { method: "DELETE", path },
          }),
        );
      }
      return runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Delete mailbox ${mailbox_name}`,
        () => client.request("DELETE", path),
      );
    },
  );

  server.registerTool(
    "infomaniak_list_mailbox_aliases",
    {
      title: "List mailbox aliases",
      description: `List the aliases attached to a mailbox.

Args:
  - mail_hosting_id (number).
  - mailbox_name (string).
  - response_format ('markdown'|'json').`,
      inputSchema: MailboxAliasScoped.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      mail_hosting_id,
      mailbox_name,
      response_format,
    }: MailboxAliasScopedArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Aliases of ${mailbox_name}`,
        () =>
          client.request(
            "GET",
            `/1/mail_hostings/${mail_hosting_id}/mailboxes/${encodeURIComponent(mailbox_name)}/aliases`,
          ),
      ),
  );

  server.registerTool(
    "infomaniak_create_mailbox_alias",
    {
      title: "Create a mailbox alias",
      description: `Create an alias on a mailbox.

Args:
  - mail_hosting_id (number).
  - mailbox_name (string).
  - alias (string): local part of the alias.
  - response_format ('markdown'|'json').`,
      inputSchema: CreateAliasInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      mail_hosting_id,
      mailbox_name,
      alias,
      response_format,
    }: CreateAliasArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Create alias ${alias}`,
        () =>
          client.request(
            "POST",
            `/1/mail_hostings/${mail_hosting_id}/mailboxes/${encodeURIComponent(mailbox_name)}/aliases`,
            { body: { alias } },
          ),
      ),
  );
}
