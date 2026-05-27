import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../client.js";
import { safeCall } from "./util.js";

export function register(server: McpServer, client: InfomaniakClient) {
  server.tool(
    "infomaniak_list_hostings",
    "List Web Hosting plans owned by the user.",
    {
      account_id: z.number().int().optional(),
      with: z
        .array(z.string())
        .optional()
        .describe("Relations to embed, e.g. ['site','tags']."),
    },
    async ({ account_id, with: relations }) =>
      safeCall(() =>
        client.request("GET", "/1/hosting", {
          query: { account_id, with: relations },
        }),
      ),
  );

  server.tool(
    "infomaniak_get_hosting",
    "Get details for a Web Hosting plan.",
    {
      hosting_id: z.number().int(),
      with: z.array(z.string()).optional(),
    },
    async ({ hosting_id, with: relations }) =>
      safeCall(() =>
        client.request("GET", `/1/hosting/${hosting_id}`, {
          query: { with: relations },
        }),
      ),
  );

  server.tool(
    "infomaniak_list_hosting_sites",
    "List the sites (vhosts) attached to a Web Hosting plan.",
    {
      hosting_id: z.number().int(),
    },
    async ({ hosting_id }) =>
      safeCall(() =>
        client.request("GET", `/1/hosting/${hosting_id}/site`),
      ),
  );

  server.tool(
    "infomaniak_get_hosting_site",
    "Get one site (vhost) on a Web Hosting plan.",
    {
      hosting_id: z.number().int(),
      site_id: z.number().int(),
    },
    async ({ hosting_id, site_id }) =>
      safeCall(() =>
        client.request("GET", `/1/hosting/${hosting_id}/site/${site_id}`),
      ),
  );

  server.tool(
    "infomaniak_create_hosting_site",
    "Create a new site (vhost) on an existing Web Hosting plan. The domain must already be assigned to the account.",
    {
      hosting_id: z.number().int(),
      domain_id: z
        .number()
        .int()
        .describe("ID of the domain that will host the site."),
      directory: z
        .string()
        .describe("Directory on disk under /sites that holds the site files."),
      type: z
        .enum(["main", "alias", "redirect"])
        .default("main")
        .describe("Site type. Defaults to main."),
    },
    async ({ hosting_id, domain_id, directory, type }) =>
      safeCall(() =>
        client.request("POST", `/1/hosting/${hosting_id}/site`, {
          body: { domain_id, directory, type },
        }),
      ),
  );

  server.tool(
    "infomaniak_delete_hosting_site",
    "Delete a site (vhost) from a Web Hosting plan.",
    {
      hosting_id: z.number().int(),
      site_id: z.number().int(),
    },
    async ({ hosting_id, site_id }) =>
      safeCall(() =>
        client.request("DELETE", `/1/hosting/${hosting_id}/site/${site_id}`),
      ),
  );

  server.tool(
    "infomaniak_list_hosting_databases",
    "List MySQL databases on a Web Hosting plan.",
    {
      hosting_id: z.number().int(),
    },
    async ({ hosting_id }) =>
      safeCall(() =>
        client.request("GET", `/1/hosting/${hosting_id}/database`),
      ),
  );

  server.tool(
    "infomaniak_create_hosting_database",
    "Create a MySQL database on a Web Hosting plan.",
    {
      hosting_id: z.number().int(),
      name: z.string().describe("Database name."),
      user_name: z.string().describe("Database user."),
      password: z.string().describe("Database user password."),
    },
    async ({ hosting_id, name, user_name, password }) =>
      safeCall(() =>
        client.request("POST", `/1/hosting/${hosting_id}/database`, {
          body: { name, user_name, password },
        }),
      ),
  );

  server.tool(
    "infomaniak_list_hosting_ftp_accounts",
    "List FTP/SFTP accounts on a Web Hosting plan.",
    {
      hosting_id: z.number().int(),
    },
    async ({ hosting_id }) =>
      safeCall(() =>
        client.request("GET", `/1/hosting/${hosting_id}/ftp_account`),
      ),
  );

  server.tool(
    "infomaniak_create_hosting_ftp_account",
    "Create a new FTP/SFTP account on a Web Hosting plan.",
    {
      hosting_id: z.number().int(),
      name: z.string().describe("Account login."),
      password: z.string(),
      home_directory: z
        .string()
        .describe(
          "Chroot directory for the FTP user, relative to the hosting root.",
        ),
    },
    async ({ hosting_id, name, password, home_directory }) =>
      safeCall(() =>
        client.request("POST", `/1/hosting/${hosting_id}/ftp_account`, {
          body: { name, password, home_directory },
        }),
      ),
  );
}
