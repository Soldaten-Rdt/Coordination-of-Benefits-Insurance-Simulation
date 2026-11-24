import type { ApiErrorResponse, ApiValidationDetail } from "@/types/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth/token";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8081";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiValidationDetail[];

  constructor(
    message: string,
    status: number,
    code = "UNKNOWN_ERROR",
    details: ApiValidationDetail[] = []
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * Maps backend `error.details[]` into a field -> message dictionary
   * so forms can highlight and show field-level errors directly.
   */
  get fieldErrors(): Record<string, string> {
    return this.details.reduce<Record<string, string>>((acc, item) => {
      if (item.field && !acc[item.field]) {
        acc[item.field] = item.message;
      }
      return acc;
    }, {});
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { body, query, skipAuth = false, headers: customHeaders, ...rest } = options;

  const headers = new Headers(customHeaders);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (!isFormData && body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) {
      clearAccessToken();
    }

    const errorBody = payload as ApiErrorResponse | null;
    const message =
      errorBody?.error?.message ||
      `Permintaan gagal dengan status ${response.status}`;
    const code = errorBody?.error?.code || `HTTP_${response.status}`;
    const details = errorBody?.error?.details ?? [];

    throw new ApiClientError(message, response.status, code, details);
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),

  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) => apiRequest<T>(path, { ...options, method: "POST", body }),

  patch: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) => apiRequest<T>(path, { ...options, method: "PATCH", body }),

  put: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) => apiRequest<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(
    path: string,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ) => apiRequest<T>(path, { ...options, method: "DELETE" }),
};
