import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const variants = {
  primary:
    "bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-sm shadow-blue-900/10 hover:from-blue-700 hover:to-blue-800 hover:shadow-md hover:shadow-blue-900/20 focus-visible:ring-blue-500 active:from-blue-800 active:to-blue-800",

  secondary:
    "bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow-md focus-visible:ring-slate-400 active:bg-slate-100",

  danger:
    "bg-gradient-to-b from-red-600 to-red-700 text-white shadow-sm shadow-red-900/10 hover:from-red-700 hover:to-red-800 hover:shadow-md hover:shadow-red-900/20 focus-visible:ring-red-500 active:from-red-800 active:to-red-800",
};

export default function Button({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}