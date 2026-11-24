"use client";

import * as React from "react";
import type { SimulationMode } from "@/types/api";
import type { AuthUser } from "@/types/auth";

export interface WorkspaceContextValue {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  simulationMode: SimulationMode;
  setSimulationMode: (mode: SimulationMode) => void;
  user: AuthUser | null;
  notificationCount: number;
}

export const WorkspaceContext =
  React.createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside HospitalShell");
  }
  return ctx;
}
