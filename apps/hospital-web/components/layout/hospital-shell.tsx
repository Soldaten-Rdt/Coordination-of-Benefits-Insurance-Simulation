"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { getCurrentUser, getSystemConfig } from "@/lib/api";
import {
  getAccessToken,
  getStoredSimulationMode,
  getStoredUser,
  setStoredSession,
} from "@/lib/auth/token";
import { cn } from "@/lib/utils/cn";
import type { SimulationMode } from "@/types/api";
import type { AuthUser } from "@/types/auth";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { WorkspaceContext } from "./workspace-context";

export function HospitalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPatientCreateRoute = pathname === "/patients/new";
  const isPatientProfileRoute =
    pathname.startsWith("/patients/") && pathname !== "/patients/new";
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
      <div className="relative min-h-screen bg-[#F6F8FE] text-[#0B3A5B]">
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          user={user}
          notificationCount={3}
        />

        <div
          className={cn(
            "flex min-h-screen flex-col",
            isPatientCreateRoute ? "lg:pl-[198px]" : "lg:pl-[212px]"
          )}
        >
          <Topbar
            onOpenMobileMenu={() => setMobileOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            simulationMode={simulationMode}
            notificationCount={3}
          />

          <main
            className={cn(
              "flex-1",
              isPatientCreateRoute
                ? "px-[18px] py-[18px] sm:px-[20px]"
                : isPatientProfileRoute
                  ? "px-[18px] pb-[24px] pt-[12px] sm:px-[22px]"
                  : "px-[18px] py-[20px] sm:px-[24px]"
            )}
          >
            <div
              className={cn(
                "mx-auto w-full",
                isPatientCreateRoute
                  ? "max-w-[1040px]"
                  : isPatientProfileRoute
                    ? "max-w-[900px]"
                    : "max-w-[1140px]"
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
