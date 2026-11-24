"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#154B6B] text-white hover:bg-[#0F3C57] active:bg-[#0B3A5B] focus-visible:ring-[#154B6B]",
  secondary:
    "bg-[#EAF0FB] text-[#0B3A5B] hover:bg-[#DCE6F7] active:bg-[#CEDCF4] focus-visible:ring-[#0B3A5B]",
  outline:
    "border border-[#E3EAF5] bg-white text-[#0B3A5B] hover:bg-[#F6F8FE] active:bg-[#EAF0FB] focus-visible:ring-[#154B6B]",
  ghost:
    "bg-transparent text-[#5B6B7B] hover:bg-[#EAF0FB] hover:text-[#0B3A5B] focus-visible:ring-[#5B6B7B]",
  danger:
    "bg-[#D0214F] text-white hover:bg-[#B41B43] active:bg-[#991538] focus-visible:ring-[#D0214F]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-[6px]",
  md: "h-[34px] px-4 text-[11px] gap-2 rounded-[6px]",
  lg: "h-10 px-5 text-xs gap-2 rounded-[6px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      type = "button",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-bold transition-colors cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
