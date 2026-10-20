import { Moon, Sun } from "lucide-react";

import { useTheme } from "../../hooks/useTheme";

/*
 * Arbitrary hex values are used on purpose: the global dark theme remaps
 * Tailwind's palette variables, which would otherwise recolor this control.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className="relative inline-flex h-8 w-[3.75rem] shrink-0 items-center rounded-full border border-[#bfdbfe] bg-[#e0f2fe] shadow-inner transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 motion-reduce:transition-none dark:border-[#334155] dark:bg-[#1e293b]"
    >
      <Sun
        size={13}
        aria-hidden="true"
        className="absolute left-2 text-[#f59e0b] opacity-0 transition-opacity duration-300 motion-reduce:transition-none dark:opacity-60"
      />
      <Moon
        size={13}
        aria-hidden="true"
        className="absolute right-2 text-[#64748b] opacity-60 transition-opacity duration-300 motion-reduce:transition-none dark:opacity-0"
      />

      <span
        aria-hidden="true"
        className={`absolute left-[3px] top-[3px] flex h-6 w-6 items-center justify-center rounded-full bg-[#ffffff] shadow-md shadow-[#0f172a]/20 transition-transform duration-300 ease-out motion-reduce:transition-none dark:bg-[#475569] ${
          isDark ? "translate-x-7" : "translate-x-0"
        }`}
      >
        {isDark ? (
          <Moon size={14} className="text-[#e2e8f0]" />
        ) : (
          <Sun size={14} className="text-[#f59e0b]" />
        )}
      </span>
    </button>
  );
}
