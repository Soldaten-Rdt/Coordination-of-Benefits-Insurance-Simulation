"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, getSystemConfig } from "@/lib/api";
import {
  getBankReconciliation,
  getCase,
  getPaymentSummary,
  listCases,
  listNotifications,
  listPayments,
} from "@/lib/api/cases";
import {
  getAccessToken,
  getStoredSimulationMode,
  getStoredUser,
  setStoredSession,
} from "@/lib/auth/token";
import type { SimulationMode } from "@/types/api";
import type { AuthUser } from "@/types/auth";
import { Sidebar, SIDEBAR_NAV_ITEMS } from "./sidebar";
import { Topbar } from "./topbar";
import { WorkspaceContext } from "./workspace-context";

const EXTRA_PREFETCH_ROUTES = ["/patients/new", "/cases/new"];
let devRoutesWarmed = false;

export function HospitalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [simulationMode, setSimulationMode] =
    React.useState<SimulationMode>("COB");
  const [user, setUser] = React.useState<AuthUser | null>(null);

  // Eagerly prefetch all workspace routes (and warm Next.js dev compiler once) so menu transitions happen instantaneously
  React.useEffect(() => {
    const allRoutes = [
      ...SIDEBAR_NAV_ITEMS.map((item) => item.href),
      ...EXTRA_PREFETCH_ROUTES,
    ];

    const timer = window.setTimeout(() => {
      for (const route of allRoutes) {
        router.prefetch(route);
      }

      if (process.env.NODE_ENV === "development" && !devRoutesWarmed) {
        devRoutesWarmed = true;
        void (async () => {
          for (const route of allRoutes) {
            if (route === window.location.pathname) continue;
            try {
              await fetch(route, { credentials: "same-origin" });
            } catch {
              // Ignore background warmup errors
            }
          }
        })();
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [router]);

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

          // Warm GET cache for sibling menu pages in the background once backend is confirmed reachable
          void Promise.allSettled([
            listCases({ page: 1, limit: 10, tab: "ALL", status: "ALL", q: "" }),
            listCases({ page: 1, limit: 50, tab: "ALL", q: "" }).then(
              (casesRes) => {
                const firstId = casesRes.data?.[0]?.id;
                if (firstId) {
                  void getCase(firstId).catch(() => undefined);
                }
              }
            ),
            getPaymentSummary(),
            listPayments({
              page: 1,
              limit: 10,
              status: "ALL",
              payer: "ALL",
              q: "",
            }),
            getBankReconciliation({ page: 1, limit: 3 }),
            listNotifications(),
          ]);
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
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          user={user}
          notificationCount={3}
        />

        <div className="flex min-h-screen flex-col lg:pl-[212px]">
          <Topbar
            onOpenMobileMenu={() => setMobileOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            simulationMode={simulationMode}
            notificationCount={3}
          />

          <main className="flex-1 px-[18px] py-[20px] sm:px-[24px]">
            <div className="mx-auto w-full max-w-[1140px]">{children}</div>
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
