import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResponseFormatSchema } from "../schemas/common.js";
import { ResponseFormat } from "../types.js";
import {
  DOCS_CATALOGUE_URL,
  DOCS_INDEX,
  docsUrl as buildDocsUrl,
} from "../services/docs.js";
import { runTool } from "../services/format.js";

const NoArgsInput = z.object({ response_format: ResponseFormatSchema }).strict();
type NoArgsArgs = z.infer<typeof NoArgsInput>;

const DescribeInput = z
  .object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z
      .string()
      .min(1)
      .describe(
        "Path template, e.g. /1/hosting/{hosting_id}/site or /2/ai/{product_id}/openai/v1/chat/completions. Use {placeholder} for variables.",
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();
type DescribeArgs = z.infer<typeof DescribeInput>;

const FetchCatalogueInput = z
  .object({
    package_filter: z
      .string()
      .optional()
      .describe(
        "Optional substring filter on top-level package names (case-insensitive) to keep the response small.",
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();
type FetchCatalogueArgs = z.infer<typeof FetchCatalogueInput>;

export function register(server: McpServer) {
  server.registerTool(
    "infomaniak_docs",
    {
      title: "Pointers to the live Infomaniak API documentation",
      description: `Return curated URLs into developer.infomaniak.com plus the live methods catalogue location. Use this when a wrapped tool fails with a 4xx/5xx so you can re-read the current spec and retry via 'infomaniak_request' with the corrected shape.

Args:
  - response_format ('markdown'|'json').

Returns:
  {
    portal: 'https://developer.infomaniak.com',
    getting_started: '...',
    api_reference: 'https://developer.infomaniak.com/docs/api',
    methods_catalogue_json: 'https://api.infomaniak.com/doc/methods_by_package.json',
    services: { profile, account, products, hosting, hosting_site, domain,
                dns_records_legacy, dns_zones_modern, kdrive, mail_hostings,
                order, ai_models, ai_chat_completions }
  }`,
      inputSchema: NoArgsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ response_format }: NoArgsArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "Infomaniak API documentation index",
        async () => DOCS_INDEX,
      ),
  );

  server.registerTool(
    "infomaniak_describe_endpoint",
    {
      title: "Build the doc URL for one (method, path) pair",
      description: `Resolve the developer-portal URL for a specific (method, path-template) pair. Useful before calling 'infomaniak_request' on an unfamiliar endpoint.

Args:
  - method ('GET'|'POST'|'PUT'|'PATCH'|'DELETE').
  - path (string): path template with {placeholders} for parameters.
  - response_format ('markdown'|'json').

Returns:
  { method, path, docs_url, catalogue_url }`,
      inputSchema: DescribeInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ method, path, response_format }: DescribeArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Docs for ${method} ${path}`,
        async () => ({
          method,
          path,
          docs_url: buildDocsUrl(method, path),
          catalogue_url: DOCS_CATALOGUE_URL,
        }),
      ),
  );

  server.registerTool(
    "infomaniak_fetch_docs_catalogue",
    {
      title: "Download the live Infomaniak API methods catalogue",
      description: `Fetch the JSON catalogue at ${DOCS_CATALOGUE_URL} (no auth required) which lists every documented method grouped by package. Use this as ground truth when a wrapped tool 404s or 422s — it reveals the real current paths and request shapes.

Args:
  - package_filter (string, optional): case-insensitive substring filter on package names to shrink the response.
  - response_format ('markdown'|'json').

Returns:
  { source_url, package_count, packages: { [name]: <method list> } }
  When filtered, only matching packages are included.

Error Handling:
  - Network failure: ensure outbound HTTPS to api.infomaniak.com is allowed in your environment.`,
      inputSchema: FetchCatalogueInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ package_filter, response_format }: FetchCatalogueArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "Infomaniak API methods catalogue",
        async () => {
          const res = await fetch(DOCS_CATALOGUE_URL, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(30_000),
          });
          if (!res.ok) {
            throw new Error(
              `Catalogue fetch failed: ${res.status} ${res.statusText}`,
            );
          }
          const raw = (await res.json()) as Record<string, unknown>;
          const allNames = Object.keys(raw);
          const filtered = package_filter
            ? allNames.filter((n) =>
                n.toLowerCase().includes(package_filter.toLowerCase()),
              )
            : allNames;
          const packages: Record<string, unknown> = {};
          for (const name of filtered) packages[name] = raw[name];
          return {
            source_url: DOCS_CATALOGUE_URL,
            package_count: allNames.length,
            filtered_count: filtered.length,
            packages,
          };
        },
      ),
  );
}
