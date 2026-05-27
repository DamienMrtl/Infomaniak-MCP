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
  .describe("Numeric domain ID returned by infomaniak_list_domains.");

const ZoneSchema = z
  .string()
  .min(3)
  .transform((s) => s.replace(/\.+$/, ""))
  .describe(
    "DNS zone FQDN, e.g. 'example.ch'. A trailing dot is stripped automatically.",
  );

// Verified against the official Terraform provider
// (Infomaniak/terraform-provider-infomaniak: internal/apis/domain/models.go).
const DnsRecordType = z.enum([
  "A",
  "AAAA",
  "CAA",
  "CNAME",
  "DNAME",
  "DS",
  "DNSKEY",
  "HTTPS",
  "MX",
  "NS",
  "SMIMEA",
  "SRV",
  "SSHFP",
  "TLSA",
  "TXT",
]);

const RecordId = z
  .number()
  .int()
  .positive()
  .describe("Numeric DNS record ID (int64).");

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
    zone: ZoneSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListDnsRecordsArgs = z.infer<typeof ListDnsRecordsInput>;

const CreateDnsRecordInput = z
  .object({
    zone: ZoneSchema,
    type: DnsRecordType,
    source: z
      .string()
      .min(1)
      .describe("Sub-domain part. Use '@' for the apex, '*' for a wildcard."),
    target: z
      .string()
      .min(1)
      .describe(
        "Record value in zone-file format. For MX/SRV records embed the priority before the host, e.g. '10 mail.example.ch' for MX, '0 5 5060 sip.example.ch' for SRV. For A/AAAA pass the IP, for CNAME/NS pass the FQDN, for TXT pass the quoted text.",
      ),
    ttl: z
      .number()
      .int()
      .min(60)
      .max(86_400)
      .default(3600)
      .describe("TTL in seconds (60-86400, default 3600)."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateDnsRecordArgs = z.infer<typeof CreateDnsRecordInput>;

const UpdateDnsRecordInput = z
  .object({
    zone: ZoneSchema,
    record_id: RecordId,
    type: DnsRecordType,
    source: z.string().min(1),
    target: z.string().min(1),
    ttl: z.number().int().min(60).max(86_400).default(3600),
    response_format: ResponseFormatSchema,
  })
  .strict();
type UpdateDnsRecordArgs = z.infer<typeof UpdateDnsRecordInput>;

const DeleteDnsRecordInput = z
  .object({
    zone: ZoneSchema,
    record_id: RecordId,
    confirm: z
      .boolean()
      .default(false)
      .describe("Must be true to actually delete; false returns a dry-run."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type DeleteDnsRecordArgs = z.infer<typeof DeleteDnsRecordInput>;

const CheckDnsRecordInput = z
  .object({
    zone: ZoneSchema,
    record_id: RecordId,
    response_format: ResponseFormatSchema,
  })
  .strict();
type CheckDnsRecordArgs = z.infer<typeof CheckDnsRecordInput>;

const ZoneOnlyInput = z
  .object({
    zone: ZoneSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();
type ZoneOnlyArgs = z.infer<typeof ZoneOnlyInput>;

const CreateZoneInput = z
  .object({
    zone: ZoneSchema.describe(
      "FQDN of the new zone (e.g. 'example.ch'). The domain must already be in the account.",
    ),
    confirm: z
      .boolean()
      .default(false)
      .describe(
        "Must be true to actually create; false returns a dry-run preview.",
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateZoneArgs = z.infer<typeof CreateZoneInput>;

export function register(server: McpServer, client: InfomaniakClient) {
  server.registerTool(
    "infomaniak_list_domains",
    {
      title: "List owned domains",
      description: `List domain names owned by the user (paginated). Endpoint: GET /1/domain.

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
      description: `Get details for a single domain by ID. Endpoint: GET /1/domain/{domain_id}.

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
      description: `Check availability and pricing for one or several FQDNs. Endpoint: POST /1/domain/search.

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
      title: "List DNS records for a zone",
      description: `List DNS records for a zone. Endpoint: GET /2/zones/{zone}/records.

The {zone} parameter is the FQDN of the zone (e.g. 'example.ch'), not the numeric domain ID. Look up the FQDN via infomaniak_list_domains.

Args:
  - zone (string): zone FQDN.
  - response_format ('markdown'|'json').`,
      inputSchema: ListDnsRecordsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ zone, response_format }: ListDnsRecordsArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `DNS records for ${zone}`,
        () =>
          client.request("GET", `/2/zones/${encodeURIComponent(zone)}/records`),
      ),
  );

  server.registerTool(
    "infomaniak_get_zone",
    {
      title: "Get one DNS zone",
      description: `Get a DNS zone by FQDN. Endpoint: GET /2/zones/{zone}.

Args:
  - zone (string): zone FQDN (trailing dot stripped automatically).
  - response_format ('markdown'|'json').

Returns:
  Envelope with { id, fqdn, dnssec, nameservers, records?, cluster_records?, ... }.`,
      inputSchema: ZoneOnlyInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ zone, response_format }: ZoneOnlyArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Zone ${zone}`,
        () => client.request("GET", `/2/zones/${encodeURIComponent(zone)}`),
      ),
  );

  server.registerTool(
    "infomaniak_create_zone",
    {
      title: "Create a DNS zone",
      description: `Create a DNS zone for an owned domain. Endpoint: POST /2/zones/{zone}.

Args:
  - zone (string): FQDN of the new zone (the domain must already be on the account).
  - confirm (boolean): must be true to actually create; false returns a dry-run.
  - response_format ('markdown'|'json').`,
      inputSchema: CreateZoneInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ zone, confirm, response_format }: CreateZoneArgs) => {
      const path = `/2/zones/${encodeURIComponent(zone)}`;
      if (!confirm) {
        return runTool(
          response_format ?? ResponseFormat.MARKDOWN,
          "Dry-run create zone",
          async () => ({
            dry_run: true,
            message:
              "confirm=false: nothing created. Re-run with confirm=true.",
            request: { method: "POST", path },
          }),
        );
      }
      return runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Create zone ${zone}`,
        () => client.request("POST", path),
      );
    },
  );

  server.registerTool(
    "infomaniak_delete_zone",
    {
      title: "Delete a DNS zone",
      description: `Delete a DNS zone. DESTRUCTIVE. Endpoint: DELETE /2/zones/{zone}.

Args:
  - zone (string).
  - confirm (boolean): must be true to actually delete.
  - response_format ('markdown'|'json').`,
      inputSchema: CreateZoneInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ zone, confirm, response_format }: CreateZoneArgs) => {
      const path = `/2/zones/${encodeURIComponent(zone)}`;
      if (!confirm) {
        return runTool(
          response_format ?? ResponseFormat.MARKDOWN,
          "Dry-run delete zone",
          async () => ({
            dry_run: true,
            message:
              "confirm=false: nothing deleted. Re-run with confirm=true.",
            request: { method: "DELETE", path },
          }),
        );
      }
      return runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Delete zone ${zone}`,
        () => client.request("DELETE", path),
      );
    },
  );

  server.registerTool(
    "infomaniak_create_dns_record",
    {
      title: "Create a DNS record",
      description: `Create a DNS record on a zone. Endpoint: POST /2/zones/{zone}/records.

Request body (verified against Infomaniak/terraform-provider-infomaniak):
  { "type": "...", "source": "...", "target": "...", "ttl": 3600 }

Args:
  - zone (string): zone FQDN, e.g. 'example.ch'.
  - type: 'A'|'AAAA'|'CAA'|'CNAME'|'DNAME'|'DS'|'DNSKEY'|'HTTPS'|'MX'|'NS'|'SMIMEA'|'SRV'|'SSHFP'|'TLSA'|'TXT'.
  - source (string): sub-domain part. '@' for apex, '*' for wildcard.
  - target (string): zone-file value. For MX prefix with priority ("10 mail.example.ch"), for SRV with priority/weight/port ("0 5 5060 sip.example.ch"), for A/AAAA the bare IP, for CNAME/NS the FQDN, for TXT the quoted text.
  - ttl (number, optional, default 3600): seconds, 60-86400.
  - response_format ('markdown'|'json').

Returns:
  Envelope with { id, type, source, target, ttl, ... }.`,
      inputSchema: CreateDnsRecordInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      zone,
      type,
      source,
      target,
      ttl,
      response_format,
    }: CreateDnsRecordArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Create DNS record in ${zone}`,
        () =>
          client.request(
            "POST",
            `/2/zones/${encodeURIComponent(zone)}/records`,
            { body: { type, source, target, ttl } },
          ),
      ),
  );

  server.registerTool(
    "infomaniak_update_dns_record",
    {
      title: "Update a DNS record",
      description: `Update an existing DNS record. Endpoint: PUT /2/zones/{zone}/records/{record_id}.

Same body as create: { type, source, target, ttl }. All four fields must be supplied.

Args:
  - zone (string).
  - record_id (number).
  - type, source, target, ttl: same as create.
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
      zone,
      record_id,
      type,
      source,
      target,
      ttl,
      response_format,
    }: UpdateDnsRecordArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Update DNS record ${record_id} in ${zone}`,
        () =>
          client.request(
            "PUT",
            `/2/zones/${encodeURIComponent(zone)}/records/${record_id}`,
            { body: { type, source, target, ttl } },
          ),
      ),
  );

  server.registerTool(
    "infomaniak_delete_dns_record",
    {
      title: "Delete a DNS record",
      description: `Delete a DNS record. DESTRUCTIVE. Endpoint: DELETE /2/zones/{zone}/records/{record_id}.

Args:
  - zone (string).
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
      zone,
      record_id,
      confirm,
      response_format,
    }: DeleteDnsRecordArgs) => {
      const path = `/2/zones/${encodeURIComponent(zone)}/records/${record_id}`;
      if (!confirm) {
        return runTool(
          response_format ?? ResponseFormat.MARKDOWN,
          "Dry-run delete DNS record",
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
        `Delete DNS record ${record_id}`,
        () => client.request("DELETE", path),
      );
    },
  );

  server.registerTool(
    "infomaniak_check_dns_record",
    {
      title: "Check a DNS record propagation/status",
      description: `Check status/propagation of a DNS record. Endpoint: GET /2/zones/{zone}/records/{record_id}/check.

Args:
  - zone (string).
  - record_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: CheckDnsRecordInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ zone, record_id, response_format }: CheckDnsRecordArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Check DNS record ${record_id} in ${zone}`,
        () =>
          client.request(
            "GET",
            `/2/zones/${encodeURIComponent(zone)}/records/${record_id}/check`,
          ),
      ),
  );
}
