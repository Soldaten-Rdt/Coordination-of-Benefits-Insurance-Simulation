import type { SimulationMode } from "@/types/api";
import type { AuthUser } from "@/types/auth";

const TOKEN_STORAGE_KEY = "kapj_hospital_access_token";
const USER_STORAGE_KEY = "kapj_hospital_user";
const MODE_STORAGE_KEY = "kapj_hospital_simulation_mode";
const TOKEN_COOKIE_KEY = "kapj_hospital_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(TOKEN_STORAGE_KEY) ??
      window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function setAccessToken(token: string, remember = true): void {
  if (typeof window === "undefined") return;
  try {
    if (remember) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    const maxAge = remember ? "; max-age=604800" : "";
    document.cookie = `${TOKEN_COOKIE_KEY}=${encodeURIComponent(token)}; path=/${maxAge}; SameSite=Lax`;
  } catch {
    // Ignore storage errors
  }
}

export function setStoredSession(
  user: AuthUser,
  simulationMode?: SimulationMode,
  remember = true
): void {
  if (typeof window === "undefined") return;
  try {
    const storage = remember ? window.localStorage : window.sessionStorage;
    storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    if (simulationMode) {
      storage.setItem(MODE_STORAGE_KEY, simulationMode);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem(USER_STORAGE_KEY) ??
      window.sessionStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getStoredSimulationMode(): SimulationMode {
  if (typeof window === "undefined") return "COB";
  try {
    const raw =
      window.localStorage.getItem(MODE_STORAGE_KEY) ??
      window.sessionStorage.getItem(MODE_STORAGE_KEY);
    return raw === "NON_COB" ? "NON_COB" : "COB";
  } catch {
    return "COB";
  }
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    window.localStorage.removeItem(MODE_STORAGE_KEY);
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(USER_STORAGE_KEY);
    window.sessionStorage.removeItem(MODE_STORAGE_KEY);
    document.cookie = `${TOKEN_COOKIE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  } catch {
    // Ignore storage errors
  }
}
