import type { SimulationMode } from "./api";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role_title: string;
  role: string;
  hospital_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
  simulation_mode: SimulationMode;
}

export interface SystemConfig {
  simulation_mode: SimulationMode;
  default_split_preset?: string;
  [key: string]: string | undefined;
}
