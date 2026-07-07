// Lightweight fetch wrapper with retry + timeout + typed JSON parsing.
// Use for calling backend endpoints (TanStack server routes under /api/*).

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  method?: ApiMethod;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Total attempts including the first one. Default 3. */
  retries?: number;
  /** Base delay in ms for exponential backoff. Default 400ms. */
  retryDelayMs?: number;
  /** Per-attempt timeout in ms. Default 15000. */
  timeoutMs?: number;
  /** Abort externally. */
  signal?: AbortSignal;
  /** Called on every state change — useful for loading UI. */
  onStateChange?: (state: ApiState) => void;
}

export type ApiState =
  | { status: "idle" }
  | { status: "loading"; attempt: number }
  | { status: "retrying"; attempt: number; error: ApiError }
  | { status: "success" }
  | { status: "error"; error: ApiError };

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry on network errors, timeouts, and idempotent-ish 5xx / 429.
function isRetryable(err: unknown, method: ApiMethod): boolean {
  if (err instanceof ApiError) {
    if (err.status === 429) return true;
    if (err.status >= 500 && err.status < 600) {
      return method === "GET" || method === "PUT" || method === "DELETE" || err.status === 503;
    }
    return false;
  }
  // Network failure / timeout / abort-due-to-timeout
  return true;
}

function buildUrl(path: string, query?: ApiRequestOptions["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    params.append(k, String(v));
  }
  const qs = params.toString();
  if (!qs) return path;
  return path + (path.includes("?") ? "&" : "?") + qs;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    query,
    retries = 3,
    retryDelayMs = 400,
    timeoutMs = 15_000,
    signal,
    onStateChange,
  } = options;

  const url = buildUrl(path, query);
  const isJsonBody = body !== undefined && !(body instanceof FormData);

  let lastError: ApiError | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    onStateChange?.({ status: "loading", attempt });

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);
    const onExternalAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onExternalAbort);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
          Accept: "application/json",
          ...headers,
        },
        body: isJsonBody ? JSON.stringify(body) : (body as BodyInit | undefined),
        signal: ctrl.signal,
      });

      // Parse body (json if possible, else text)
      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      if (!res.ok) {
        const message =
          (data && typeof data === "object" && "message" in data && typeof (data as any).message === "string"
            ? (data as any).message
            : null) || `Request failed with ${res.status}`;
        throw new ApiError(message, res.status, data);
      }

      onStateChange?.({ status: "success" });
      return data as T;
    } catch (err) {
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError(
              err instanceof Error ? err.message : "Network error",
              0,
              null,
            );
      lastError = apiErr;

      const externallyAborted = signal?.aborted ?? false;
      const canRetry = !externallyAborted && attempt < retries && isRetryable(apiErr, method);

      if (!canRetry) {
        onStateChange?.({ status: "error", error: apiErr });
        throw apiErr;
      }

      onStateChange?.({ status: "retrying", attempt, error: apiErr });
      // Exponential backoff with jitter.
      const delay = retryDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 150);
      await sleep(delay);
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  throw lastError ?? new ApiError("Unknown error", 0);
}

export const api = {
  get: <T = unknown>(path: string, opts?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown, opts?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "POST", body }),
  put: <T = unknown>(path: string, body?: unknown, opts?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "PUT", body }),
  patch: <T = unknown>(path: string, body?: unknown, opts?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T = unknown>(path: string, opts?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "DELETE" }),
};
