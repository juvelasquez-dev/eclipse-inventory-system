import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
import { supabase } from "../../lib/supabase";

interface AuditLogRow {
  id: string;
  createdAt: string;
  actorUsername: string | null;
  action: string;
  targetUsername: string | null;
  details: Record<string, unknown> | null;
}

const ACTION_OPTIONS = [
  { label: "All Actions", value: "ALL" },
  { label: "Role Changed", value: "USER_ROLE_CHANGED" },
  { label: "Area Changed", value: "USER_AREA_CHANGED" },
  { label: "Status Changed", value: "USER_STATUS_CHANGED" },
];

/*
 * Maps an audit_logs row (snake_case) to the frontend shape.
 */
function mapAuditLogRow(row: any): AuditLogRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    actorUsername: row.actor_username,
    action: row.action,
    targetUsername: row.target_username,
    details: row.details,
  };
}

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) {
    return "—";
  }

  return Object.entries(details)
    .map(([key, value]) => `${key}: ${value ?? "—"}`)
    .join(", ");
}

export default function AuditLogs() {
  const navigate = useNavigate();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [actionFilter, setActionFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  async function loadLogs() {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Unable to load audit logs:", error);
      setLoadError(
        "Unable to load audit logs. You may not have permission to view this page."
      );
      setLoading(false);
      return;
    }

    setLogs((data ?? []).map(mapAuditLogRow));
    setLoading(false);
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesAction =
        actionFilter === "ALL" || log.action === actionFilter;

      const matchesSearch =
        !searchTerm ||
        [log.actorUsername ?? "", log.targetUsername ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);

      return matchesAction && matchesSearch;
    });
  }, [logs, actionFilter, search]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF9F4]">
      <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white/70 px-6 py-5 backdrop-blur-md sm:px-10">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          <span>Back to Administration</span>
        </button>
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Audit Logs
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Review admin actions taken on user role, area, and status.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-56">
            <Select
              label="Action"
              options={ACTION_OPTIONS}
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            />
          </div>

          <div className="w-full sm:w-64">
            <Input
              label="Search username"
              placeholder="Actor or target username"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Loading audit logs...
            </div>
          ) : loadError ? (
            <div className="px-6 py-16 text-center text-sm text-red-600">
              {loadError}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No audit logs found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date/Time
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actor
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Target User
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Details
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>

                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {log.actorUsername ?? "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {log.action}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {log.targetUsername ?? "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDetails(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
