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

const DomainId = z
  .number()
  .int()
  .positive()
  .describe("Numeric domain ID.");

const DnsRecordType = z.enum([
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SRV",
  "CAA",
  "TLSA",
  "PTR",
  "ALIAS",
]);

const ListDomainsInput = z
  .object({
    account_id: z.number().int().positive().optional(),
    search: z.string().optional().describe("Substring filter on domain name."),
    ...PaginationSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListDomainsArgs = z.infer<typeof ListDomainsInput>;

const GetDomainInput = z
  .object({
    domain_id: DomainId,
    response_format: ResponseFormatSchema,
  })
  .strict();
type GetDomainArgs = z.infer<typeof GetDomainInput>;

const SearchDomainInput = z
  .object({
    domains: z
      .array(z.string().min(3))
      .min(1)
      .max(20)
      .describe("Fully-qualified domain names to check (max 20)."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type SearchDomainArgs = z.infer<typeof SearchDomainInput>;

const ListDnsRecordsInput = z
  .object({
    domain_id: DomainId,
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListDnsRecordsArgs = z.infer<typeof ListDnsRecordsInput>;

const CreateDnsRecordInput = z
  .object({
    domain_id: DomainId,
    type: DnsRecordType,
    source: z
      .string()
      .min(1)
      .describe("Sub-domain part. Use '@' for the apex, '*' for a wildcard."),
    target: z.string().min(1).describe("Record value (IP, host, text...)."),
    ttl: z
      .number()
      .int()
      .min(60)
      .max(86_400)
      .optional()
      .describe("TTL in seconds (60-86400)."),
    priority: z
      .number()
      .int()
      .min(0)
      .max(65_535)
      .optional()
      .describe("Priority (MX/SRV only)."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateDnsRecordArgs = z.infer<typeof CreateDnsRecordInput>;

const UpdateDnsRecordInput = z
  .object({
    domain_id: DomainId,
    record_id: z.number().int().positive().describe("DNS record ID."),
    type: DnsRecordType.optional(),
    source: z.string().min(1).optional(),
    target: z.string().min(1).optional(),
    ttl: z.number().int().min(60).max(86_400).optional(),
    priority: z.number().int().min(0).max(65_535).optional(),
    response_format: ResponseFormatSchema,
  })
  .strict();
type UpdateDnsRecordArgs = z.infer<typeof UpdateDnsRecordInput>;

const DeleteDnsRecordInput = z
  .object({
    domain_id: DomainId,
    record_id: z.number().int().positive(),
    confirm: z
      .boolean()
      .default(false)
      .describe("Must be true to actually delete; false returns a dry-run."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type DeleteDnsRecordArgs = z.infer<typeof DeleteDnsRecordInput>;

export function register(server: McpServer, client: InfomaniakClient) {
  server.registerTool(
    "infomaniak_list_domains",
    {
      title: "List owned domains",
      description: `List domain names owned by the user (paginated).

Args:
  - account_id (number, optional).
  - search (string, optional): substring filter.
  - page, per_page (number): pagination (defaults 1, 25).
  - response_format ('markdown'|'json').

Returns:
  Pagination payload with items shaped like { id, customer_name, account_id, expires_at, ... }.`,
      inputSchema: ListDomainsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListDomainsArgs) => {
      const page = params.page ?? 1;
      const per_page = params.per_page ?? 25;
      return runPaginatedTool(
        params.response_format ?? ResponseFormat.MARKDOWN,
        "Domains",
        async () => {
          const env = await client.requestEnvelope<unknown[]>(
            "GET",
            "/1/domain",
            {
              query: {
                account_id: params.account_id,
                search: params.search,
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
    "infomaniak_get_domain",
    {
      title: "Get one domain",
      description: `Get details for a single domain by ID.

Args:
  - domain_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: GetDomainInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domain_id, response_format }: GetDomainArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Domain ${domain_id}`,
        () => client.request("GET", `/1/domain/${domain_id}`),
      ),
  );

  server.registerTool(
    "infomaniak_search_domain",
    {
      title: "Check domain availability and price",
      description: `Check availability and pricing for one or several FQDNs.

Args:
  - domains (string[], 1-20).
  - response_format ('markdown'|'json').

Returns:
  Envelope with { data: [ { domain, available, prices: {...} } ] }.`,
      inputSchema: SearchDomainInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domains, response_format }: SearchDomainArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "Domain availability",
        () => client.request("POST", "/1/domain/search", { body: { domains } }),
      ),
  );

  server.registerTool(
    "infomaniak_list_dns_records",
    {
      title: "List DNS records for a domain",
      description: `List DNS records for a domain.

Args:
  - domain_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: ListDnsRecordsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ domain_id, response_format }: ListDnsRecordsArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `DNS records for domain ${domain_id}`,
        () => client.request("GET", `/1/domain/${domain_id}/dns/record`),
      ),
  );

  server.registerTool(
    "infomaniak_create_dns_record",
    {
      title: "Create a DNS record",
      description: `Create a DNS record on a domain.

Args:
  - domain_id (number).
  - type ('A'|'AAAA'|'CNAME'|'MX'|'TXT'|'NS'|'SRV'|'CAA'|'TLSA'|'PTR'|'ALIAS').
  - source (string): sub-domain part. '@' for apex, '*' for wildcard.
  - target (string): record value.
  - ttl (number, optional): seconds, 60-86400.
  - priority (number, optional): MX/SRV only.
  - response_format ('markdown'|'json').`,
      inputSchema: CreateDnsRecordInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      domain_id,
      type,
      source,
      target,
      ttl,
      priority,
      response_format,
    }: CreateDnsRecordArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Create DNS record on domain ${domain_id}`,
        () =>
          client.request("POST", `/1/domain/${domain_id}/dns/record`, {
            body: { type, source, target, ttl, priority },
          }),
      ),
  );

  server.registerTool(
    "infomaniak_update_dns_record",
    {
      title: "Update a DNS record",
      description: `Update an existing DNS record. All fields except domain_id and record_id are optional; supply only those you want to change.

Args:
  - domain_id (number).
  - record_id (number).
  - type, source, target, ttl, priority: optional patches.
  - response_format ('markdown'|'json').`,
      inputSchema: UpdateDnsRecordInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      domain_id,
      record_id,
      response_format,
      ...patch
    }: UpdateDnsRecordArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Update DNS record ${record_id}`,
        () =>
          client.request(
            "PUT",
            `/1/domain/${domain_id}/dns/record/${record_id}`,
            { body: patch },
          ),
      ),
  );

  server.registerTool(
    "infomaniak_delete_dns_record",
    {
      title: "Delete a DNS record",
      description: `Delete a DNS record. DESTRUCTIVE.

Args:
  - domain_id (number).
  - record_id (number).
  - confirm (boolean): must be true to actually delete; false returns a dry-run.
  - response_format ('markdown'|'json').`,
      inputSchema: DeleteDnsRecordInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      domain_id,
      record_id,
      confirm,
      response_format,
    }: DeleteDnsRecordArgs) => {
      if (!confirm) {
        return runTool(
          response_format ?? ResponseFormat.MARKDOWN,
          "Dry-run delete DNS record",
          async () => ({
            dry_run: true,
            message:
              "confirm=false: nothing deleted. Re-run with confirm=true to actually delete.",
            request: {
              method: "DELETE",
              path: `/1/domain/${domain_id}/dns/record/${record_id}`,
            },
          }),
        );
      }
      return runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Delete DNS record ${record_id}`,
        () =>
          client.request(
            "DELETE",
            `/1/domain/${domain_id}/dns/record/${record_id}`,
          ),
      );
    },
  );
}
