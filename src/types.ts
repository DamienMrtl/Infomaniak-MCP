export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export interface InfomaniakEnvelope<T = unknown> {
  result: "success" | "error";
  data?: T;
  error?: {
    code: string;
    description?: string;
    context?: Record<string, unknown>;
    errors?: Array<{ code: string; description?: string }>;
  };
  page?: number;
  pages?: number;
  total?: number;
  items_per_page?: number;
}

export interface PaginationOutput<T> {
  total: number;
  count: number;
  page: number;
  per_page: number;
  items: T[];
  has_more: boolean;
  next_page?: number;
  truncated?: boolean;
  truncation_message?: string;
}

export interface ToolTextResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
