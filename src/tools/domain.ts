import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../client.js";
import { safeCall } from "./util.js";

const dnsRecordType = z.enum([
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

export function register(server: McpServer, client: InfomaniakClient) {
  server.tool(
    "infomaniak_list_domains",
    "List domain names owned by the user.",
    {
      account_id: z.number().int().optional(),
      search: z.string().optional().describe("Filter by substring."),
    },
    async ({ account_id, search }) =>
      safeCall(() =>
        client.request("GET", "/1/domain", {
          query: { account_id, search },
        }),
      ),
  );

  server.tool(
    "infomaniak_get_domain",
    "Get details for one domain by ID.",
    {
      domain_id: z.number().int(),
    },
    async ({ domain_id }) =>
      safeCall(() => client.request("GET", `/1/domain/${domain_id}`)),
  );

  server.tool(
    "infomaniak_search_domain",
    "Check availability and price for one or more domain names.",
    {
      domains: z
        .array(z.string())
        .min(1)
        .describe("Fully qualified domains, e.g. ['example.ch','example.com']."),
    },
    async ({ domains }) =>
      safeCall(() =>
        client.request("POST", "/1/domain/search", { body: { domains } }),
      ),
  );

  server.tool(
    "infomaniak_list_dns_records",
    "List DNS records for a domain.",
    {
      domain_id: z.number().int(),
    },
    async ({ domain_id }) =>
      safeCall(() =>
        client.request("GET", `/1/domain/${domain_id}/dns/record`),
      ),
  );

  server.tool(
    "infomaniak_create_dns_record",
    "Create a DNS record on a domain.",
    {
      domain_id: z.number().int(),
      type: dnsRecordType,
      source: z
        .string()
        .describe("Sub-domain part. Use @ for the apex, * for a wildcard."),
      target: z.string().describe("Record value (IP, hostname, text…)."),
      ttl: z.number().int().optional().describe("TTL in seconds."),
      priority: z
        .number()
        .int()
        .optional()
        .describe("Priority (MX/SRV records only)."),
    },
    async ({ domain_id, type, source, target, ttl, priority }) =>
      safeCall(() =>
        client.request("POST", `/1/domain/${domain_id}/dns/record`, {
          body: { type, source, target, ttl, priority },
        }),
      ),
  );

  server.tool(
    "infomaniak_update_dns_record",
    "Update an existing DNS record.",
    {
      domain_id: z.number().int(),
      record_id: z.number().int(),
      type: dnsRecordType.optional(),
      source: z.string().optional(),
      target: z.string().optional(),
      ttl: z.number().int().optional(),
      priority: z.number().int().optional(),
    },
    async ({ domain_id, record_id, ...patch }) =>
      safeCall(() =>
        client.request(
          "PUT",
          `/1/domain/${domain_id}/dns/record/${record_id}`,
          { body: patch },
        ),
      ),
  );

  server.tool(
    "infomaniak_delete_dns_record",
    "Delete a DNS record.",
    {
      domain_id: z.number().int(),
      record_id: z.number().int(),
    },
    async ({ domain_id, record_id }) =>
      safeCall(() =>
        client.request(
          "DELETE",
          `/1/domain/${domain_id}/dns/record/${record_id}`,
        ),
      ),
  );
}
