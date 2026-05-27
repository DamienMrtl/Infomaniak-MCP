#!/usr/bin/env node
/**
 * MCP server for the Infomaniak public API.
 *
 * Exposes hosting, domains, DNS, kDrive, mail and AI Tools as MCP tools so
 * that LLM clients (Claude Desktop, Claude Code, ...) can manage an
 * Infomaniak account end-to-end. Transports: stdio (default) or streamable
 * HTTP (set TRANSPORT=http).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { InfomaniakClient } from "./services/client.js";
import { API_BASE_URL } from "./constants.js";
import * as ai from "./tools/ai.js";
import * as domain from "./tools/domain.js";
import * as generic from "./tools/generic.js";
import * as hosting from "./tools/hosting.js";
import * as kdrive from "./tools/kdrive.js";
import * as mail from "./tools/mail.js";
import * as order from "./tools/order.js";
import * as products from "./tools/products.js";
import * as profile from "./tools/profile.js";

const SERVER_NAME = "infomaniak-mcp-server";
const SERVER_VERSION = "1.0.0";

function buildServer(): McpServer {
  const token = process.env.INFOMANIAK_API_TOKEN;
  if (!token) {
    console.error(
      "ERROR: INFOMANIAK_API_TOKEN is not set. Create a Personal API Token " +
        "at https://manager.infomaniak.com → API Token Manager and export it.",
    );
    process.exit(1);
  }

  const aiProductId = process.env.INFOMANIAK_AI_PRODUCT_ID;
  const client = new InfomaniakClient(token, API_BASE_URL);

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
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

  return server;
}

async function runStdio() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running via stdio`);
}

async function runHttp() {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const host = process.env.HOST ?? "127.0.0.1";

  const app = express();
  app.use(express.json({ limit: "4mb" }));

  app.post("/mcp", async (req, res) => {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.listen(port, host, () => {
    console.error(
      `${SERVER_NAME} v${SERVER_VERSION} running on http://${host}:${port}/mcp`,
    );
  });
}

const transport = (process.env.TRANSPORT ?? "stdio").toLowerCase();
if (transport === "http") {
  runHttp().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
