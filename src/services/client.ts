import axios, { type AxiosInstance, type Method } from "axios";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../constants.js";
import type { InfomaniakEnvelope } from "../types.js";

export interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Override the base URL for a single call. */
  baseUrl?: string;
}

export class InfomaniakClient {
  private readonly axios: AxiosInstance;

  constructor(
    token: string,
    private readonly baseUrl: string = API_BASE_URL,
  ) {
    if (!token) {
      throw new Error("Infomaniak API token is required");
    }
    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  }

  async request<T = unknown>(
    method: Method,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const res = await this.axios.request<T>({
      method,
      url: path,
      baseURL: opts.baseUrl ?? this.baseUrl,
      params: serializeQuery(opts.query),
      data: opts.body,
      headers: opts.headers,
    });
    return res.data;
  }

  /**
   * Helper for Infomaniak-style responses wrapped in `{result, data, ...}`.
   * Returns the inner `data` field plus the pagination metadata when present.
   */
  async requestEnvelope<T = unknown>(
    method: Method,
    path: string,
    opts: RequestOptions = {},
  ): Promise<InfomaniakEnvelope<T>> {
    return this.request<InfomaniakEnvelope<T>>(method, path, opts);
  }
}

function serializeQuery(
  query: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!query) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      out[`${key}[]`] = value.map(String).join(",");
    } else if (typeof value === "object") {
      out[key] = JSON.stringify(value);
    } else {
      out[key] = value as string | number | boolean;
    }
  }
  return out;
}
