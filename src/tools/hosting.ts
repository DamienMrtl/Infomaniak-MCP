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

const HostingId = z
  .number()
  .int()
  .positive()
  .describe("Numeric Web Hosting product ID.");

const ListHostingsInput = z
  .object({
    account_id: z.number().int().positive().optional(),
    with: z
      .array(z.string())
      .optional()
      .describe(
        "Relations to embed in each hosting, e.g. ['site','tags','statistics'].",
      ),
    ...PaginationSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListHostingsArgs = z.infer<typeof ListHostingsInput>;

const GetHostingInput = z
  .object({
    hosting_id: HostingId,
    with: z.array(z.string()).optional(),
    response_format: ResponseFormatSchema,
  })
  .strict();
type GetHostingArgs = z.infer<typeof GetHostingInput>;

const HostingScoped = z
  .object({
    hosting_id: HostingId,
    response_format: ResponseFormatSchema,
  })
  .strict();
type HostingScopedArgs = z.infer<typeof HostingScoped>;

const GetSiteInput = z
  .object({
    hosting_id: HostingId,
    site_id: z.number().int().positive().describe("Numeric site (vhost) ID."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type GetSiteArgs = z.infer<typeof GetSiteInput>;

const CreateSiteInput = z
  .object({
    hosting_id: HostingId,
    domain_id: z
      .number()
      .int()
      .positive()
      .describe("ID of the domain to attach to the new site."),
    directory: z
      .string()
      .min(1)
      .describe("Directory on disk under /sites that holds the site files."),
    type: z
      .enum(["main", "alias", "redirect"])
      .default("main")
      .describe("Site type."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateSiteArgs = z.infer<typeof CreateSiteInput>;

const DeleteSiteInput = z
  .object({
    hosting_id: HostingId,
    site_id: z.number().int().positive(),
    confirm: z
      .boolean()
      .default(false)
      .describe("Must be true to actually delete; false returns a dry-run."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type DeleteSiteArgs = z.infer<typeof DeleteSiteInput>;

const CreateDatabaseInput = z
  .object({
    hosting_id: HostingId,
    name: z.string().min(1).describe("Database name."),
    user_name: z.string().min(1).describe("MySQL user name."),
    password: z.string().min(8).describe("MySQL user password (8+ chars)."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateDatabaseArgs = z.infer<typeof CreateDatabaseInput>;

const CreateFtpAccountInput = z
  .object({
    hosting_id: HostingId,
    name: z.string().min(1).describe("FTP/SFTP login."),
    password: z.string().min(8),
    home_directory: z
      .string()
      .min(1)
      .describe("Chroot directory, relative to the hosting root."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateFtpAccountArgs = z.infer<typeof CreateFtpAccountInput>;

export function register(server: McpServer, client: InfomaniakClient) {
  server.registerTool(
    "infomaniak_list_hostings",
    {
      title: "List Web Hosting plans",
      description: `List Web Hosting plans owned by the user (paginated).

Args:
  - account_id (number, optional): restrict to one Infomaniak account.
  - with (string[], optional): embed relations, e.g. ['site','statistics'].
  - page, per_page (number): pagination (defaults 1, 25).
  - response_format ('markdown'|'json'): default 'markdown'.

Returns:
  Pagination payload with items shaped like:
  { id, customer_name, account_id, tags: [...], (site: [...] when embedded), ... }

Examples:
  - { account_id: 12345, with: ['site'] }`,
      inputSchema: ListHostingsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListHostingsArgs) => {
      const page = params.page ?? 1;
      const per_page = params.per_page ?? 25;
      return runPaginatedTool(
        params.response_format ?? ResponseFormat.MARKDOWN,
        "Web Hosting plans",
        async () => {
          const env = await client.requestEnvelope<unknown[]>(
            "GET",
            "/1/hosting",
            {
              query: {
                account_id: params.account_id,
                with: params.with,
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
    "infomaniak_get_hosting",
    {
      title: "Get one Web Hosting plan",
      description: `Get details for one Web Hosting plan.

Args:
  - hosting_id (number, required).
  - with (string[], optional): embed relations.
  - response_format ('markdown'|'json').`,
      inputSchema: GetHostingInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ hosting_id, with: relations, response_format }: GetHostingArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Hosting ${hosting_id}`,
        () =>
          client.request("GET", `/1/hosting/${hosting_id}`, {
            query: { with: relations },
          }),
      ),
  );

  server.registerTool(
    "infomaniak_list_hosting_sites",
    {
      title: "List sites on a Web Hosting plan",
      description: `List sites (vhosts) attached to a Web Hosting plan.

Args:
  - hosting_id (number, required).
  - response_format ('markdown'|'json').

Returns:
  Envelope with array of { id, hostname, type, ssl, directory, ... }.`,
      inputSchema: HostingScoped.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ hosting_id, response_format }: HostingScopedArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Sites on hosting ${hosting_id}`,
        () => client.request("GET", `/1/hosting/${hosting_id}/site`),
      ),
  );

  server.registerTool(
    "infomaniak_get_hosting_site",
    {
      title: "Get one site on a Web Hosting plan",
      description: `Get one site (vhost) by ID.

Args:
  - hosting_id (number).
  - site_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: GetSiteInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ hosting_id, site_id, response_format }: GetSiteArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Site ${site_id} on hosting ${hosting_id}`,
        () =>
          client.request("GET", `/1/hosting/${hosting_id}/site/${site_id}`),
      ),
  );

  server.registerTool(
    "infomaniak_create_hosting_site",
    {
      title: "Create a site on a Web Hosting plan",
      description: `Create a new site (vhost) on an existing Web Hosting plan. The domain must already belong to the account.

Args:
  - hosting_id (number).
  - domain_id (number): ID of the domain that will serve the site.
  - directory (string): directory under /sites that holds the files.
  - type ('main'|'alias'|'redirect'): site type (default 'main').
  - response_format ('markdown'|'json').

Returns:
  Envelope with the freshly created site object.

Error Handling:
  - 409: directory already in use.
  - 422: domain_id not attached to this account.`,
      inputSchema: CreateSiteInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      hosting_id,
      domain_id,
      directory,
      type,
      response_format,
    }: CreateSiteArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Create site on hosting ${hosting_id}`,
        () =>
          client.request("POST", `/1/hosting/${hosting_id}/site`, {
            body: { domain_id, directory, type },
          }),
      ),
  );

  server.registerTool(
    "infomaniak_delete_hosting_site",
    {
      title: "Delete a site from a Web Hosting plan",
      description: `Delete a site (vhost) from a Web Hosting plan. DESTRUCTIVE: the site disk content is removed too.

Args:
  - hosting_id (number).
  - site_id (number).
  - confirm (boolean): must be true to actually delete. False returns a dry-run preview.
  - response_format ('markdown'|'json').

Returns:
  If confirm=false: { dry_run: true, request: {method, path} }.
  If confirm=true: Envelope from the API.`,
      inputSchema: DeleteSiteInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      hosting_id,
      site_id,
      confirm,
      response_format,
    }: DeleteSiteArgs) => {
      if (!confirm) {
        return runTool(
          response_format ?? ResponseFormat.MARKDOWN,
          "Dry-run delete site",
          async () => ({
            dry_run: true,
            message:
              "confirm=false: nothing deleted. Re-run with confirm=true to actually delete.",
            request: {
              method: "DELETE",
              path: `/1/hosting/${hosting_id}/site/${site_id}`,
            },
          }),
        );
      }
      return runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Delete site ${site_id}`,
        () =>
          client.request(
            "DELETE",
            `/1/hosting/${hosting_id}/site/${site_id}`,
          ),
      );
    },
  );

  server.registerTool(
    "infomaniak_list_hosting_databases",
    {
      title: "List MySQL databases on a Web Hosting plan",
      description: `List MySQL databases on a Web Hosting plan.

Args:
  - hosting_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: HostingScoped.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ hosting_id, response_format }: HostingScopedArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Databases on hosting ${hosting_id}`,
        () => client.request("GET", `/1/hosting/${hosting_id}/database`),
      ),
  );

  server.registerTool(
    "infomaniak_create_hosting_database",
    {
      title: "Create a MySQL database on a Web Hosting plan",
      description: `Create a MySQL database on a Web Hosting plan.

Args:
  - hosting_id (number).
  - name (string).
  - user_name (string).
  - password (string, min 8 chars).
  - response_format ('markdown'|'json').

Error Handling:
  - 409: a database with that name already exists.
  - 422: password too weak.`,
      inputSchema: CreateDatabaseInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      hosting_id,
      name,
      user_name,
      password,
      response_format,
    }: CreateDatabaseArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Create database on hosting ${hosting_id}`,
        () =>
          client.request("POST", `/1/hosting/${hosting_id}/database`, {
            body: { name, user_name, password },
          }),
      ),
  );

  server.registerTool(
    "infomaniak_list_hosting_ftp_accounts",
    {
      title: "List FTP/SFTP accounts on a Web Hosting plan",
      description: `List FTP/SFTP accounts on a Web Hosting plan.

Args:
  - hosting_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: HostingScoped.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ hosting_id, response_format }: HostingScopedArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `FTP accounts on hosting ${hosting_id}`,
        () => client.request("GET", `/1/hosting/${hosting_id}/ftp_account`),
      ),
  );

  server.registerTool(
    "infomaniak_create_hosting_ftp_account",
    {
      title: "Create an FTP/SFTP account on a Web Hosting plan",
      description: `Create a new FTP/SFTP account on a Web Hosting plan.

Args:
  - hosting_id (number).
  - name (string): FTP login.
  - password (string, 8+ chars).
  - home_directory (string): chroot directory relative to the hosting root.
  - response_format ('markdown'|'json').`,
      inputSchema: CreateFtpAccountInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      hosting_id,
      name,
      password,
      home_directory,
      response_format,
    }: CreateFtpAccountArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Create FTP account on hosting ${hosting_id}`,
        () =>
          client.request("POST", `/1/hosting/${hosting_id}/ftp_account`, {
            body: { name, password, home_directory },
          }),
      ),
  );
}
