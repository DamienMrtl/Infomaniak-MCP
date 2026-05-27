export interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Override the base URL for a single call (e.g. when the endpoint lives on a sub-API). */
  baseUrl?: string;
}

export class InfomaniakError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(message);
    this.name = "InfomaniakError";
  }
}

export class InfomaniakClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl: string = "https://api.infomaniak.com",
  ) {
    if (!token) {
      throw new Error("Infomaniak API token is required");
    }
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const base = opts.baseUrl ?? this.baseUrl;
    const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
    if (opts.query) {
      for (const [key, value] of Object.entries(opts.query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) url.searchParams.append(`${key}[]`, String(v));
        } else if (typeof value === "object") {
          url.searchParams.set(key, JSON.stringify(value));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
      ...opts.headers,
    };

    let body: BodyInit | undefined;
    if (opts.body !== undefined && opts.body !== null) {
      if (typeof opts.body === "string" || opts.body instanceof Uint8Array) {
        body = opts.body as BodyInit;
      } else {
        headers["Content-Type"] ??= "application/json";
        body = JSON.stringify(opts.body);
      }
    }

    const res = await fetch(url, { method, headers, body });
    const raw = await res.text();
    let data: unknown = raw;
    if (raw.length > 0) {
      try {
        data = JSON.parse(raw);
      } catch {
        // Keep raw text payload (e.g. file download metadata).
      }
    }

    if (!res.ok) {
      const message =
        typeof data === "object" && data !== null && "error" in data
          ? JSON.stringify((data as Record<string, unknown>).error)
          : typeof data === "string"
            ? data
            : JSON.stringify(data);
      throw new InfomaniakError(
        `Infomaniak API ${method} ${path} → ${res.status} ${res.statusText}: ${message}`,
        res.status,
        data,
      );
    }

    return data as T;
  }
}
