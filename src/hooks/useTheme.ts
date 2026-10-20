import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

// Keep in sync with the inline script in index.html.
const STORAGE_KEY = "eidms-theme";

const listeners = new Set<() => void>();

function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

let currentTheme: Theme = readStoredTheme();
applyTheme(currentTheme);

function notify() {
  listeners.forEach((listener) => listener());
}

function setThemeValue(theme: Theme) {
  if (theme === currentTheme) return;
  currentTheme = theme;
  applyTheme(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable; the theme still applies for this session.
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Keep other open tabs in sync.
  function handleStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    currentTheme = event.newValue === "dark" ? "dark" : "light";
    applyTheme(currentTheme);
    notify();
  }
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

const getSnapshot = () => currentTheme;
const getServerSnapshot = (): Theme => "light";

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setTheme = useCallback((next: Theme) => setThemeValue(next), []);
  const toggleTheme = useCallback(
    () => setThemeValue(currentTheme === "dark" ? "light" : "dark"),
    []
  );

  return { theme, setTheme, toggleTheme };
}
