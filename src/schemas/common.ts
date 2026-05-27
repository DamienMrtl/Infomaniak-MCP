import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";
import { ResponseFormat } from "../types.js";

export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe(
    "Output format: 'markdown' for human-readable output, 'json' for machine-readable structured payload.",
  );

export const PaginationSchema = {
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("1-based page index."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(
      `Page size, 1-${MAX_PAGE_SIZE} (default ${DEFAULT_PAGE_SIZE}).`,
    ),
} as const;

export const AccountIdSchema = z
  .number()
  .int()
  .positive()
  .describe("Numeric Infomaniak account (Organisation) ID.");
