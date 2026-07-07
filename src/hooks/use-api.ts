import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, type ApiRequestOptions, type ApiError } from "@/lib/api-client";

export interface UseApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  retrying: boolean;
  attempt: number;
}

/**
 * Imperative API hook — call `execute()` to fire a request.
 * Tracks loading, retrying, attempt count, error, and data.
 */
export function useApi<T = unknown>(path: string, baseOptions: ApiRequestOptions = {}) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    loading: false,
    retrying: false,
    attempt: 0,
  });
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const execute = useCallback(
    async (overrides: ApiRequestOptions = {}): Promise<T | null> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const data = await apiRequest<T>(path, {
          ...baseOptions,
          ...overrides,
          signal: ctrl.signal,
          onStateChange: (s) => {
            if (!mountedRef.current) return;
            if (s.status === "loading") {
              setState((p) => ({ ...p, loading: true, retrying: false, error: null, attempt: s.attempt }));
            } else if (s.status === "retrying") {
              setState((p) => ({ ...p, loading: true, retrying: true, attempt: s.attempt, error: s.error }));
            }
          },
        });
        if (mountedRef.current) {
          setState({ data, error: null, loading: false, retrying: false, attempt: 0 });
        }
        return data;
      } catch (err) {
        if (mountedRef.current) {
          setState((p) => ({ ...p, loading: false, retrying: false, error: err as ApiError }));
        }
        return null;
      }
    },
    // path + serialized baseOptions identity is up to the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(
    () => setState({ data: null, error: null, loading: false, retrying: false, attempt: 0 }),
    [],
  );

  return { ...state, execute, cancel, reset };
}
