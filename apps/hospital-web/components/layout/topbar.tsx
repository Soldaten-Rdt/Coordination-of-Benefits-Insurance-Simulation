"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Menu, Plus, Search } from "lucide-react";
import type { SimulationMode } from "@/types/api";

export interface TopbarProps {
  onOpenMobileMenu: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  simulationMode: SimulationMode;
  notificationCount?: number;
}

export function Topbar({
  onOpenMobileMenu,
  searchQuery,
  onSearchChange,
  simulationMode,
  notificationCount = 3,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[50px] shrink-0 items-center justify-between gap-3 border-b border-[#E3EAF5] bg-white px-[18px] sm:px-[22px]">
      {/* Kiri: Breadcrumb */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Buka navigasi"
          className="flex h-[32px] w-[32px] items-center justify-center rounded-[8px] border border-[#E3EAF5] text-[#0B3A5B] hover:bg-[#EAF0FB] lg:hidden cursor-pointer"
        >
          <Menu className="h-4 w-4" />
        </button>

        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-[6px] text-[11px] whitespace-nowrap"
        >
          <span className="font-semibold text-[#0B3A5B]">Hospital Ops</span>
          <span className="text-[#5B6B7B]">&rsaquo;</span>
          <span className="font-medium text-[#5B6B7B]">Ruang Kerja</span>
        </nav>
      </div>

      {/* Tengah: Pencarian */}
      <div className="hidden flex-1 justify-center px-2 md:flex">
        <div className="relative w-full max-w-[360px]">
          <Search
            className="pointer-events-none absolute left-[10px] top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[#5B6B7B]"
            strokeWidth={1.8}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari pasien, ID kasus, atau tagihan..."
            className="h-[32px] w-full rounded-[8px] bg-[#EAF0FB] pl-[30px] pr-[12px] text-[11px] font-medium text-[#0B3A5B] placeholder:text-[#5B6B7B] focus:outline-none focus:ring-1 focus:ring-[#154B6B]/40"
          />
        </div>
      </div>

      {/* Kanan: Pill Mode, Notifikasi, + Buat Kasus */}
      <div className="flex shrink-0 items-center gap-[10px]">
        <span className="hidden items-center gap-[6px] rounded-full bg-[#EAF0FB] px-[10px] py-[5px] text-[10px] font-bold leading-none text-[#0B3A5B] xl:inline-flex">
          <span
            className="h-[5px] w-[5px] rounded-full bg-[#D0214F]"
            aria-hidden="true"
          />
          {simulationMode === "COB"
            ? "Simulasi Mode COB Aktif"
            : "Simulasi Mode Non-COB"}
        </span>

        <Link
          href="/notifications"
          prefetch={true}
          aria-label="Notifikasi"
          className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full text-[#5B6B7B] transition-colors hover:bg-[#EAF0FB] hover:text-[#0B3A5B]"
        >
          <Bell className="h-[15px] w-[15px]" strokeWidth={1.8} />
          {notificationCount > 0 && (
            <span className="absolute right-[1px] top-[1px] flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#D0214F] px-[3px] text-[8.5px] font-bold leading-none text-white">
              {notificationCount}
            </span>
          )}
        </Link>

        <Link
          href="/cases/new"
          prefetch={true}
          className="inline-flex h-[32px] items-center gap-[5px] rounded-[8px] bg-[#154B6B] px-[12px] text-[11px] font-bold text-white transition-colors hover:bg-[#0B3A5B]"
        >
          <Plus className="h-[13px] w-[13px]" strokeWidth={2.4} />
          <span>+ Buat Kasus</span>
        </Link>
      </div>
    </header>
  );
}
