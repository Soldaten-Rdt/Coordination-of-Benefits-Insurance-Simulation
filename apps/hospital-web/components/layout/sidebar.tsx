"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  CheckCircle2,
  FileText,
  HelpCircle,
  LayoutGrid,
  LogOut,
  MoreVertical,
  Settings,
  Users,
  X,
} from "lucide-react";
import { logoutHospital } from "@/lib/api";
import { clearAccessToken } from "@/lib/auth/token";
import { cn } from "@/lib/utils/cn";
import type { AuthUser } from "@/types/auth";

interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: number;
}

const NAV_ITEMS: SidebarNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Data Pasien", href: "/patients", icon: Users },
  { label: "Kasus Perawatan", href: "/cases", icon: FileText },
  { label: "Koordinasi Klaim", href: "/claims", icon: ArrowLeftRight },
  { label: "Pembayaran", href: "/payments", icon: Banknote },
  { label: "Notifikasi", href: "/notifications", icon: Bell, badge: 3 },
];

export interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  user: AuthUser | null;
  notificationCount?: number;
}

function SidebarBody({
  user,
  notificationCount = 3,
  onNavigate,
}: {
  user: AuthUser | null;
  notificationCount?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const displayName = user?.full_name || "Siti Rahmawati, S.Kep";
  const displayRole = user?.role_title
    ? user.role_title.includes("Admin Billing")
      ? "Admin Billing RS"
      : user.role_title
    : "Admin Billing RS";

  const handleLogout = async () => {
    try {
      await logoutHospital();
    } catch {
      // Proceed to clear client session regardless of network state
    } finally {
      clearAccessToken();
      router.push("/login");
    }
  };

  return (
    <div className="flex h-full flex-col bg-white text-[#0B3A5B]">
      <div className="px-[12px] pt-[12px]">
        <div className="flex items-center justify-between gap-[6px] rounded-[8px] bg-[#EAF0FB] px-[10px] py-[8px]">
          <div className="flex min-w-0 items-center gap-[6px]">
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#0B3A5B]"
              aria-hidden="true"
            />
            <span className="truncate text-[10.5px] font-bold text-[#0B3A5B]">
              KAPJ Flow &middot; Hospital Ops
            </span>
          </div>
          <CheckCircle2
            className="h-[13px] w-[13px] shrink-0 text-[#5B6B7B]"
            strokeWidth={1.8}
          />
        </div>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="mt-[12px] flex-1 space-y-[4px] overflow-y-auto px-[12px]"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badgeValue =
            item.href === "/notifications" ? notificationCount : item.badge;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex h-[34px] items-center gap-[9px] rounded-[6px] px-[10px] text-[11.5px] transition-colors",
                isActive
                  ? "bg-[#154B6B] font-bold text-white"
                  : "font-medium text-[#5B6B7B] hover:bg-[#EAF0FB]/70 hover:text-[#0B3A5B]"
              )}
            >
              <Icon
                className={cn(
                  "h-[15px] w-[15px] shrink-0",
                  isActive ? "text-white" : "text-[#5B6B7B]"
                )}
                strokeWidth={1.8}
              />
              <span className="truncate">{item.label}</span>
              {badgeValue !== undefined && badgeValue > 0 && (
                <span className="ml-auto flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#D0214F] px-[4px] text-[9px] font-bold leading-none text-white">
                  {badgeValue}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-[2px] px-[12px] pb-[10px] pt-[12px]">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-[30px] w-full items-center gap-[9px] rounded-[6px] px-[10px] text-[11px] font-medium text-[#5B6B7B] transition-colors hover:bg-[#EAF0FB]/70 hover:text-[#0B3A5B] cursor-pointer"
          >
            <Settings
              className="h-[14px] w-[14px] shrink-0"
              strokeWidth={1.8}
            />
            <span>Pengaturan Akun</span>
          </button>
          <button
            type="button"
            className="flex h-[30px] w-full items-center gap-[9px] rounded-[6px] px-[10px] text-[11px] font-medium text-[#5B6B7B] transition-colors hover:bg-[#EAF0FB]/70 hover:text-[#0B3A5B] cursor-pointer"
          >
            <HelpCircle
              className="h-[14px] w-[14px] shrink-0"
              strokeWidth={1.8}
            />
            <span>Bantuan</span>
          </button>
      </div>

      {/* e. Garis pemisah tipis + Profil */}
      <div className="relative border-t border-[#E3EAF5] px-[12px] py-[11px]">
        {menuOpen && (
          <div className="absolute bottom-[58px] left-[10px] right-[10px] z-30 rounded-[8px] border border-[#E3EAF5] bg-white p-1.5 shadow-[0_8px_24px_rgba(11,58,91,0.12)]">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-[11px] font-semibold text-[#D0214F] transition-colors hover:bg-[#FCE4EA]/60 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Keluar Portal</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-[8px]">
          <div className="relative shrink-0">
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-gradient-to-br from-[#154B6B] to-[#0B3A5B] text-[10px] font-bold text-white">
              SR
            </div>
            <span
              className="absolute -bottom-[1px] -right-[1px] h-[8px] w-[8px] rounded-full bg-emerald-500 ring-[1.5px] ring-white"
              aria-label="Online"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold leading-[1.25] text-[#0B3A5B]">
              {displayName}
            </p>
            <p className="truncate text-[9.5px] font-medium leading-[1.25] text-[#5B6B7B]">
              {displayRole}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Menu profil"
            className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[6px] text-[#5B6B7B] transition-colors hover:bg-[#EAF0FB] hover:text-[#0B3A5B] cursor-pointer"
          >
            <MoreVertical className="h-[14px] w-[14px]" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  user,
  notificationCount,
}: SidebarProps) {
  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:fixed lg:bottom-0 lg:left-0 lg:top-[50px] lg:z-30 lg:block lg:w-[250px] lg:border-r lg:border-[#E3EAF5] lg:bg-white">
        <SidebarBody user={user} notificationCount={notificationCount} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-[#0B3A5B]/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full w-[240px] max-w-[82vw] flex-col bg-white shadow-xl">
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Tutup menu"
              className="absolute left-3 top-3 z-20 rounded-md p-1 text-[#5B6B7B] hover:bg-[#EAF0FB] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody
              user={user}
              notificationCount={notificationCount}
              onNavigate={onCloseMobile}
            />
          </aside>
        </div>
      )}
    </>
  );
}
