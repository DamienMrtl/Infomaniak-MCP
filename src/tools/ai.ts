import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../services/client.js";
import { ResponseFormatSchema } from "../schemas/common.js";
import { ResponseFormat, type ToolTextResponse } from "../types.js";
import { runTool } from "../services/format.js";

const ProductIdSchema = z
  .string()
  .uuid()
  .optional()
  .describe(
    "AI Tools product UUID. Falls back to the INFOMANIAK_AI_PRODUCT_ID env var when omitted.",
  );

const ListAiInput = z.object({ response_format: ResponseFormatSchema }).strict();
type ListAiArgs = z.infer<typeof ListAiInput>;

const ChatInput = z
  .object({
    product_id: ProductIdSchema,
    model: z
      .string()
      .min(1)
      .describe(
        "Model name exposed by the product (e.g. mixtral, llama3, granite).",
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
    max_tokens: z.number().int().positive().max(8_192).optional(),
    response_format: ResponseFormatSchema,
  })
  .strict();
type ChatArgs = z.infer<typeof ChatInput>;

const ListModelsInput = z
  .object({
    product_id: ProductIdSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListModelsArgs = z.infer<typeof ListModelsInput>;

function missingProductId(): ToolTextResponse {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: "Error: no AI product_id supplied. Pass product_id explicitly or set INFOMANIAK_AI_PRODUCT_ID.",
      },
    ],
  };
}

export function register(
  server: McpServer,
  client: InfomaniakClient,
  defaultAiProductId?: string,
) {
  server.registerTool(
    "infomaniak_list_ai_products",
    {
      title: "List AI Tools products",
      description: `List Infomaniak AI Tools products available to the user (LLM, OCR, ...).

Args:
  - response_format ('markdown'|'json').

Returns:
  Envelope with array of { id (uuid), service_name: 'ai_tools', ... }.`,
      inputSchema: ListAiInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }: ListAiArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "AI Tools products",
        () =>
          client.request("GET", "/1/products", {
            query: { service_name: "ai_tools" },
          }),
      ),
  );

  server.registerTool(
    "infomaniak_ai_list_models",
    {
      title: "List models on an AI Tools product",
      description: `List models exposed by an Infomaniak AI Tools product (OpenAI-compatible /v1/models).

Args:
  - product_id (string, optional uuid): falls back to INFOMANIAK_AI_PRODUCT_ID.
  - response_format ('markdown'|'json').`,
      inputSchema: ListModelsInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ product_id, response_format }: ListModelsArgs) => {
      const id = product_id ?? defaultAiProductId;
      if (!id) return missingProductId();
      return runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Models for AI product ${id}`,
        () => client.request("GET", `/1/ai/${id}/openai/models`),
      );
    },
  );

  server.registerTool(
    "infomaniak_ai_chat",
    {
      title: "Chat completion on AI Tools",
      description: `Run an OpenAI-compatible chat completion on Infomaniak AI Tools.

Args:
  - product_id (uuid, optional): falls back to INFOMANIAK_AI_PRODUCT_ID.
  - model (string): model name (see infomaniak_ai_list_models).
  - messages (array): { role: 'system'|'user'|'assistant'|'tool', content: string }, 1+.
  - temperature (number, optional, 0-2).
  - max_tokens (number, optional, up to 8192).
  - response_format ('markdown'|'json').

Returns:
  OpenAI-style completion payload { id, object, choices: [...], usage: {...} }.

Error Handling:
  - 404: unknown product_id.
  - 422: invalid model name for this product.
  - 429: rate-limited.`,
      inputSchema: ChatInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      product_id,
      model,
      messages,
      temperature,
      max_tokens,
      response_format,
    }: ChatArgs) => {
      const id = product_id ?? defaultAiProductId;
      if (!id) return missingProductId();
      return runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `AI chat (${model})`,
        () =>
          client.request("POST", `/1/ai/${id}/openai/chat/completions`, {
            body: { model, messages, temperature, max_tokens, stream: false },
          }),
      );
    },
  );
}
