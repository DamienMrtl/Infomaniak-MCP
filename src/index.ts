#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { InfomaniakClient } from "./client.js";
import * as generic from "./tools/generic.js";
import * as profile from "./tools/profile.js";
import * as products from "./tools/products.js";
import * as hosting from "./tools/hosting.js";
import * as domain from "./tools/domain.js";
import * as order from "./tools/order.js";
import * as kdrive from "./tools/kdrive.js";
import * as mail from "./tools/mail.js";
import * as ai from "./tools/ai.js";

async function main() {
  const token = process.env.INFOMANIAK_API_TOKEN;
  if (!token) {
    console.error(
      "ERROR: INFOMANIAK_API_TOKEN is not set. Create a Personal API Token at " +
        "https://manager.infomaniak.com → API Token Manager and export it.",
    );
    process.exit(1);
  }

  const baseUrl = process.env.INFOMANIAK_API_BASE_URL;
  const aiProductId = process.env.INFOMANIAK_AI_PRODUCT_ID;
  const client = new InfomaniakClient(token, baseUrl);

  const server = new McpServer({
    name: "infomaniak-mcp",
    version: "0.1.0",
  });

  generic.register(server, client);
  profile.register(server, client);
  products.register(server, client);
  hosting.register(server, client);
  domain.register(server, client);
  order.register(server, client);
  kdrive.register(server, client);
  mail.register(server, client);
  ai.register(server, client, aiProductId);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("infomaniak-mcp server listening on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
