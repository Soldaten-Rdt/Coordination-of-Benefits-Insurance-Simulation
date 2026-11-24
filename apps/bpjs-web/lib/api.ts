import { ApiError, type ApiEnvelope, type ApiList } from "@/types";

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8082").replace(/\/$/, "");
const tokenKey = "kapj_bpjs_access_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(tokenKey);
}

export function setToken(token: string): void {
  window.localStorage.setItem(tokenKey, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(tokenKey);
}

async function request<T>(path: string, init: RequestInit = {}, publicRequest = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!publicRequest) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Tidak dapat terhubung ke layanan BPJS. Pastikan backend berjalan.", 0);
  }

  const payload = await response.json().catch(() => null) as ApiEnvelope<unknown> | ApiList<unknown> | { error?: { message?: string; code?: string } } | null;
  if (!response.ok) {
    if (response.status === 401 && !publicRequest) clearToken();
    throw new ApiError(payload && "error" in payload ? payload.error?.message || `Permintaan gagal (${response.status})` : `Permintaan gagal (${response.status})`, response.status, payload && "error" in payload ? payload.error?.code : undefined);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  login: <T>(body: unknown) => request<T>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }, true),
};
