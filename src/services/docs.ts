/**
 * Helpers to point the agent at the live Infomaniak API documentation when
 * something goes wrong, so it can self-heal via the `infomaniak_request`
 * escape hatch even if upstream renamed an endpoint or changed a payload.
 */

export const DEVELOPER_PORTAL = "https://developer.infomaniak.com";
export const DOCS_BASE = `${DEVELOPER_PORTAL}/docs/api`;
export const DOCS_CATALOGUE_URL =
  "https://api.infomaniak.com/doc/methods_by_package.json";

/**
 * Build the developer-portal URL for one (method, path) pair.
 * Path placeholders are encoded as %7Bname%7D — the convention used by
 * developer.infomaniak.com.
 *
 * Example: docsUrl("POST", "/2/ai/{product_id}/openai/v1/chat/completions")
 *   → https://developer.infomaniak.com/docs/api/post/2/ai/%7Bproduct_id%7D/openai/v1/chat/completions
 */
export function docsUrl(method: string, pathTemplate: string): string {
  const m = method.toLowerCase();
  const clean = pathTemplate
    .replace(/^\//, "")
    .replace(/\{([^}]+)\}/g, (_, name) => `%7B${name}%7D`);
  return `${DOCS_BASE}/${m}/${clean}`;
}

/**
 * Heuristic: turn a resolved path back into a template by replacing every
 * digit-only segment with {id}. Used when only a resolved path is in
 * scope (e.g. from an Axios error config). Not perfect — UUIDs and string
 * keys stay as-is — but good enough to guide the agent toward the right
 * doc page.
 */
export function inferTemplate(path: string): string {
  return path
    .split("/")
    .map((seg, i) => {
      // Preserve leading empty segment and API version (segments 0-1).
      if (i <= 1) return seg;
      return /^\d+$/.test(seg) ? "{id}" : seg;
    })
    .join("/");
}

/**
 * Curated map of high-level documentation URLs by service. Pointers, not
 * exhaustive — the agent should call infomaniak_fetch_docs_catalogue to
 * discover everything when needed.
 */
export const DOCS_INDEX = {
  portal: DEVELOPER_PORTAL,
  getting_started: `${DEVELOPER_PORTAL}/getting-started`,
  api_reference: `${DEVELOPER_PORTAL}/docs/api`,
  methods_catalogue_json: DOCS_CATALOGUE_URL,
  services: {
    profile: `${DOCS_BASE}/get/1/profile`,
    account: `${DOCS_BASE}/get/1/account`,
    products: `${DOCS_BASE}/get/1/products`,
    web_hosting_list: `${DOCS_BASE}/get/1/web`,
    web_hosting_get: `${DOCS_BASE}/get/1/web/%7Bid%7D`,
    web_hosting_sites: `${DOCS_BASE}/get/1/web/%7Bid%7D/site`,
    web_hosting_databases: `${DOCS_BASE}/get/1/web/%7Bid%7D/database`,
    domain: `${DOCS_BASE}/get/1/domain`,
    dns_zones: `${DOCS_BASE}/get/2/zones/%7Bzone%7D/records`,
    dns_create: `${DOCS_BASE}/post/2/zones/%7Bzone%7D/records`,
    dns_update: `${DOCS_BASE}/put/2/zones/%7Bzone%7D/records/%7Brecord%7D`,
    dns_check: `${DOCS_BASE}/get/2/zones/%7Bzone%7D/records/%7Brecord%7D/check`,
    kdrive_list: `${DOCS_BASE}/get/2/drive`,
    kdrive_get_drive: `${DOCS_BASE}/get/2/drive/%7Bdrive_id%7D`,
    kdrive_get_file: `${DOCS_BASE}/get/3/drive/%7Bdrive_id%7D/files/%7Bfile_id%7D`,
    kdrive_list_files: `${DOCS_BASE}/get/3/drive/%7Bdrive_id%7D/files/%7Bfile_id%7D/files`,
    kdrive_files_exist: `${DOCS_BASE}/post/2/drive/%7Bdrive_id%7D/files/exists`,
    kdrive_my_shared: `${DOCS_BASE}/get/3/drive/%7Bdrive_id%7D/files/my_shared`,
    mail_hostings: `${DOCS_BASE}/get/1/mail_hostings`,
    mail_mailboxes_list: `${DOCS_BASE}/get/1/mail_hostings/%7Bmail_hosting_id%7D/mailboxes`,
    mail_mailbox_create: `${DOCS_BASE}/post/1/mail_hostings/%7Bmail_hosting_id%7D/mailboxes`,
    mail_mailbox_update: `${DOCS_BASE}/patch/1/mail_hostings/%7Bmail_hosting_id%7D/mailboxes/%7Bmailbox_name%7D`,
    mail_aliases_list: `${DOCS_BASE}/get/1/mail_hostings/%7Bmail_hosting_id%7D/mailboxes/%7Bmailbox_name%7D/aliases`,
    mail_users_list: `${DOCS_BASE}/get/1/mail_hostings/%7Bmail_hosting_id%7D/users`,
    order: `${DOCS_BASE}/post/1/order`,
    ai_models: `${DOCS_BASE}/get/1/ai/models`,
    ai_product_models: `${DOCS_BASE}/get/2/ai/%7Bproduct_id%7D/openai/v1/models`,
    ai_chat_completions: `${DOCS_BASE}/post/2/ai/%7Bproduct_id%7D/openai/v1/chat/completions`,
  },
} as const;
