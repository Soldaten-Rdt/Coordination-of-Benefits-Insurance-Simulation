"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const VARIANT_CLASSES: Record<
  ToastVariant,
  { border: string; iconColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  info: {
    border: "border-blue-200",
    iconColor: "text-blue-600",
    Icon: Info,
  },
  success: {
    border: "border-emerald-200",
    iconColor: "text-emerald-600",
    Icon: CheckCircle2,
  },
  warning: {
    border: "border-amber-200",
    iconColor: "text-amber-600",
    Icon: AlertTriangle,
  },
  error: {
    border: "border-rose-200",
    iconColor: "text-rose-600",
    Icon: AlertCircle,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const durationMs = item.durationMs ?? 4500;
      setItems((prev) => [...prev, { ...item, id }]);

      if (durationMs > 0) {
        window.setTimeout(() => {
          dismiss(id);
        }, durationMs);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
      >
        {items.map((item) => {
          const variant = item.variant ?? "info";
          const { border, iconColor, Icon } = VARIANT_CLASSES[variant];
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg",
                border
              )}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColor)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {item.title}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-slate-600">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Tutup notifikasi"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
