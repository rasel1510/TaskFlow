/**
 * src/api/client.ts
 *
 * Centralised, typed HTTP client for all FlowSync API calls.
 *
 * Usage (client-side):
 *   import { apiClient } from '@/api/client';
 *   const result = await apiClient.get<Task[]>('/api/tasks');
 *   if (result.success) console.log(result.data);
 *
 * Features:
 *  - Standard ApiResponse<T> envelope with success/error discrimination
 *  - JSON serialisation / deserialisation
 *  - Uniform error shape regardless of HTTP status code
 *  - Works in both browser and Node.js (Next.js Server Actions / Route Handlers)
 */

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

export type ApiMeta = {
  hasMore?: boolean;
  nextCursor?: string | null;
  limit?: number;
  total?: number;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: ApiMeta;
  status: number;
};

export type ApiError = {
  success: false;
  message: string;
  status: number;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---------------------------------------------------------------------------
// Request options
// ---------------------------------------------------------------------------

export interface RequestOptions {
  /** Additional headers merged with the defaults. */
  headers?: Record<string, string>;
  /** AbortController signal for cancellation. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    };

    const init: RequestInit = {
      method,
      headers,
      signal: options?.signal,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    // Attempt to parse JSON — gracefully handle empty bodies
    let data: unknown;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        if (typeof obj.message === 'string') message = obj.message;
        else if (typeof obj.error === 'object' && obj.error !== null && 'message' in obj.error) {
          message = String((obj.error as Record<string, unknown>).message);
        }
      }
      return { success: false, message, status: res.status };
    }

    if (typeof data === 'object' && data !== null && 'success' in data && 'data' in data) {
      const envelope = data as { success: boolean; data: T; meta?: ApiMeta };
      return {
        success: true,
        data: envelope.data,
        meta: envelope.meta,
        status: res.status,
      };
    }

    return { success: true, data: data as T, status: res.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    return { success: false, message, status: 0 };
  }
}

// ---------------------------------------------------------------------------
// Public API client
// ---------------------------------------------------------------------------

export const apiClient = {
  get: <T>(url: string, options?: RequestOptions) =>
    request<T>('GET', url, undefined, options),

  post: <T>(url: string, body: unknown, options?: RequestOptions) =>
    request<T>('POST', url, body, options),

  patch: <T>(url: string, body: unknown, options?: RequestOptions) =>
    request<T>('PATCH', url, body, options),

  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>('DELETE', url, undefined, options),
};
