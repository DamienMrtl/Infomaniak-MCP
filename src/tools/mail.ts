import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../client.js";
import { safeCall } from "./util.js";

export function register(server: McpServer, client: InfomaniakClient) {
  server.tool(
    "infomaniak_list_mail_hostings",
    "List Mail Hosting products (mailbox containers attached to a domain).",
    {
      account_id: z.number().int().optional(),
    },
    async ({ account_id }) =>
      safeCall(() =>
        client.request("GET", "/1/mail_hostings", {
          query: { account_id },
        }),
      ),
  );

  server.tool(
    "infomaniak_get_mail_hosting",
    "Get details for a Mail Hosting product.",
    {
      mail_hosting_id: z.number().int(),
    },
    async ({ mail_hosting_id }) =>
      safeCall(() =>
        client.request("GET", `/1/mail_hostings/${mail_hosting_id}`),
      ),
  );

  server.tool(
    "infomaniak_list_mailboxes",
    "List mailboxes inside a Mail Hosting product.",
    {
      mail_hosting_id: z.number().int(),
    },
    async ({ mail_hosting_id }) =>
      safeCall(() =>
        client.request(
          "GET",
          `/1/mail_hostings/${mail_hosting_id}/mailboxes`,
        ),
      ),
  );

  server.tool(
    "infomaniak_create_mailbox",
    "Create a mailbox inside a Mail Hosting product.",
    {
      mail_hosting_id: z.number().int(),
      mailbox_name: z
        .string()
        .describe("Local part of the address (before the @)."),
      password: z.string(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
    },
    async ({
      mail_hosting_id,
      mailbox_name,
      password,
      first_name,
      last_name,
    }) =>
      safeCall(() =>
        client.request(
          "POST",
          `/1/mail_hostings/${mail_hosting_id}/mailboxes`,
          {
            body: { mailbox_name, password, first_name, last_name },
          },
        ),
      ),
  );

  server.tool(
    "infomaniak_delete_mailbox",
    "Delete a mailbox from a Mail Hosting product.",
    {
      mail_hosting_id: z.number().int(),
      mailbox_name: z.string(),
    },
    async ({ mail_hosting_id, mailbox_name }) =>
      safeCall(() =>
        client.request(
          "DELETE",
          `/1/mail_hostings/${mail_hosting_id}/mailboxes/${encodeURIComponent(mailbox_name)}`,
        ),
      ),
  );

  server.tool(
    "infomaniak_list_mailbox_aliases",
    "List the aliases attached to a mailbox.",
    {
      mail_hosting_id: z.number().int(),
      mailbox_name: z.string(),
    },
    async ({ mail_hosting_id, mailbox_name }) =>
      safeCall(() =>
        client.request(
          "GET",
          `/1/mail_hostings/${mail_hosting_id}/mailboxes/${encodeURIComponent(mailbox_name)}/aliases`,
        ),
      ),
  );

  server.tool(
    "infomaniak_create_mailbox_alias",
    "Create an alias on a mailbox.",
    {
      mail_hosting_id: z.number().int(),
      mailbox_name: z.string(),
      alias: z
        .string()
        .describe("Local part of the alias (before the @)."),
    },
    async ({ mail_hosting_id, mailbox_name, alias }) =>
      safeCall(() =>
        client.request(
          "POST",
          `/1/mail_hostings/${mail_hosting_id}/mailboxes/${encodeURIComponent(mailbox_name)}/aliases`,
          { body: { alias } },
        ),
      ),
  );
}
