import { createContext, useContext } from "react";

export const MaintenanceRefreshContext = createContext<() => void>(() => {});

export function useMaintenanceRefresh() {
  return useContext(MaintenanceRefreshContext);
}
