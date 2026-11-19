import { createClient } from "@supabase/supabase-js";

import { supabase } from "./supabase";
import {
  parseAdminMaintenanceStatus,
  parseMaintenanceStatus,
  type AdminMaintenanceStatus,
} from "../utils/maintenance";

const publicClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "eclipse-maintenance-public",
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  },
);

export async function fetchMaintenanceStatus(signal: AbortSignal) {
  const { data, error } = await publicClient.rpc("get_system_maintenance").abortSignal(signal);
  if (error) throw error;
  return parseMaintenanceStatus(data);
}

export async function fetchAdminMaintenance(signal: AbortSignal): Promise<AdminMaintenanceStatus> {
  const { data, error } = await supabase.rpc("admin_get_system_maintenance").abortSignal(signal);
  if (error) throw error;
  return parseAdminMaintenanceStatus(data);
}
