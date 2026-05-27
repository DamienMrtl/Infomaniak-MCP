import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../client.js";
import { safeCall } from "./util.js";

export function register(
  server: McpServer,
  client: InfomaniakClient,
  defaultAiProductId?: string,
) {
  server.tool(
    "infomaniak_list_ai_products",
    "List AI Tools products available to the user (Infomaniak LLM, OCR, etc.).",
    {},
    async () =>
      safeCall(() =>
        client.request("GET", "/1/products", {
          query: { service_name: "ai_tools" },
        }),
      ),
  );

  server.tool(
    "infomaniak_ai_chat",
    "Run an OpenAI-compatible chat completion on Infomaniak AI Tools.",
    {
      product_id: z
        .string()
        .optional()
        .describe(
          "AI product UUID. Falls back to the INFOMANIAK_AI_PRODUCT_ID env var when omitted.",
        ),
      model: z
        .string()
        .describe(
          "Model name as exposed by the product (e.g. mixtral, llama3, granite).",
        ),
      messages: z
        .array(
          z.object({
            role: z.enum(["system", "user", "assistant", "tool"]),
            content: z.string(),
          }),
        )
        .min(1),
      temperature: z.number().min(0).max(2).optional(),
      max_tokens: z.number().int().positive().optional(),
      stream: z
        .boolean()
        .default(false)
        .describe("Streaming is not supported by this tool; keep it false."),
    },
    async ({ product_id, model, messages, temperature, max_tokens, stream }) => {
      const id = product_id ?? defaultAiProductId;
      if (!id) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "No AI product ID supplied. Pass product_id or set INFOMANIAK_AI_PRODUCT_ID.",
            },
          ],
        };
      }
      return safeCall(() =>
        client.request(
          "POST",
          `/1/ai/${id}/openai/chat/completions`,
          {
            body: { model, messages, temperature, max_tokens, stream },
          },
        ),
      );
    },
  );

  server.tool(
    "infomaniak_ai_list_models",
    "List the models exposed by an Infomaniak AI Tools product.",
    {
      product_id: z
        .string()
        .optional()
        .describe(
          "AI product UUID. Falls back to INFOMANIAK_AI_PRODUCT_ID when omitted.",
        ),
    },
    async ({ product_id }) => {
      const id = product_id ?? defaultAiProductId;
      if (!id) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "No AI product ID supplied. Pass product_id or set INFOMANIAK_AI_PRODUCT_ID.",
            },
          ],
        };
      }
      return safeCall(() =>
        client.request("GET", `/1/ai/${id}/openai/models`),
      );
    },
  );
}
