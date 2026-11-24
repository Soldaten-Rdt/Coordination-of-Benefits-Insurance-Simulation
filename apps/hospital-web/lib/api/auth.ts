import { apiClient } from "./client";
import type {
  ApiActionResponse,
  ApiSuccessResponse,
  SimulationMode,
} from "@/types/api";
import type {
  AuthUser,
  LoginPayload,
  LoginResponse,
  SystemConfig,
} from "@/types/auth";

export async function loginHospital(
  payload: LoginPayload
): Promise<ApiSuccessResponse<LoginResponse>> {
  return apiClient.post<ApiSuccessResponse<LoginResponse>>(
    "/api/auth/login",
    payload,
    { skipAuth: true }
  );
}

export async function logoutHospital(): Promise<ApiActionResponse> {
  return apiClient.post<ApiActionResponse>("/api/auth/logout");
}

export async function getCurrentUser(): Promise<ApiSuccessResponse<AuthUser>> {
  return apiClient.get<ApiSuccessResponse<AuthUser>>("/api/me");
}

export async function getSystemConfig(): Promise<
  ApiSuccessResponse<SystemConfig>
> {
  return apiClient.get<ApiSuccessResponse<SystemConfig>>("/api/system/config");
}

export async function updateSimulationMode(
  simulationMode: SimulationMode,
  defaultSplitPreset?: string
): Promise<ApiSuccessResponse<SystemConfig>> {
  return apiClient.patch<ApiSuccessResponse<SystemConfig>>(
    "/api/system/simulation-mode",
    {
      simulation_mode: simulationMode,
      default_split_preset: defaultSplitPreset,
    }
  );
}
