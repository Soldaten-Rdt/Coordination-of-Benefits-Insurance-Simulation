"use client";

import * as React from "react";
import { getCurrentUser, getSystemConfig } from "@/lib/api";
import {
  getAccessToken,
  getStoredSimulationMode,
  getStoredUser,
  setStoredSession,
} from "@/lib/auth/token";
import type { SimulationMode } from "@/types/api";
import type { AuthUser } from "@/types/auth";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { WorkspaceContext } from "./workspace-context";

export function HospitalShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [simulationMode, setSimulationMode] =
    React.useState<SimulationMode>("COB");
  const [user, setUser] = React.useState<AuthUser | null>(null);

  React.useEffect(() => {
    setUser(getStoredUser());
    setSimulationMode(getStoredSimulationMode());

    const token = getAccessToken();
    if (!token) return;

    let cancelled = false;
    Promise.allSettled([getCurrentUser(), getSystemConfig()]).then(
      ([meRes, cfgRes]) => {
        if (cancelled) return;
        let nextUser = getStoredUser();
        let nextMode = getStoredSimulationMode();

        if (meRes.status === "fulfilled" && meRes.value.data) {
          nextUser = meRes.value.data;
          setUser(nextUser);
        }
        if (
          cfgRes.status === "fulfilled" &&
          cfgRes.value.data?.simulation_mode
        ) {
          nextMode =
            cfgRes.value.data.simulation_mode === "NON_COB" ? "NON_COB" : "COB";
          setSimulationMode(nextMode);
        }
        if (nextUser) {
          setStoredSession(nextUser, nextMode);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        simulationMode,
        setSimulationMode,
        user,
        notificationCount: 3,
      }}
    >
      <div className="min-h-screen bg-[#F6F8FE] text-[#0B3A5B]">
        <Topbar
          onOpenMobileMenu={() => setMobileOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          simulationMode={simulationMode}
          notificationCount={3}
        />

        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          user={user}
          notificationCount={3}
        />

        <div className="min-h-[calc(100vh-50px)] lg:pl-[250px]">
          <main className="px-[18px] py-[20px] sm:px-[24px]">
            <div className="mx-auto w-full max-w-[1140px]">{children}</div>
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
