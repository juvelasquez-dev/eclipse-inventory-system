import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import { useToast } from "../../context/ToastContext";
import { supabase } from "../../lib/supabase";

interface AdminUserRow {
  username: string;
  email: string;
  role: "ADMIN" | "STAFF";
  status: "ACTIVE" | "INACTIVE";
  areaCode: string | null;
}

const ROLE_OPTIONS = [
  { label: "ADMIN", value: "ADMIN" },
  { label: "STAFF", value: "STAFF" },
];

const STATUS_OPTIONS = [
  { label: "ACTIVE", value: "ACTIVE" },
  { label: "INACTIVE", value: "INACTIVE" },
];

const AREA_OPTIONS = [
  { label: "IAO", value: "IAO" },
  { label: "CBR", value: "CBR" },
  { label: "EFT", value: "EFT" },
];

/*
 * Maps the admin_list_users RPC row (snake_case) to the frontend shape.
 */
function mapUserRow(row: any): AdminUserRow {
  return {
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    areaCode: row.area_code ?? null,
  };
}

export default function UserManagement() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingUsername, setSavingUsername] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase.rpc("admin_list_users");

    if (error) {
      console.error("Unable to load users:", error);
      setLoadError(
        "Unable to load users. You may not have permission to view this page."
      );
      setLoading(false);
      return;
    }

    setUsers((data ?? []).map(mapUserRow));
    setLoading(false);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleRoleChange(
    username: string,
    nextRole: "ADMIN" | "STAFF"
  ) {
    setSavingUsername(username);

    const { error } = await supabase.rpc("admin_set_user_role", {
      p_username: username,
      p_role: nextRole,
    });

    setSavingUsername(null);

    if (error) {
      console.error("Unable to update role:", error);
      showToast("Unable to update role. Please try again.", "error");
      return;
    }

    setUsers((current) =>
      current.map((user) =>
        user.username === username
          ? { ...user, role: nextRole }
          : user
      )
    );

    showToast(`Updated ${username}'s role to ${nextRole}.`, "success");
  }

  async function handleAreaChange(username: string, nextArea: string) {
    setSavingUsername(username);

    const { error } = await supabase.rpc("admin_set_user_area", {
      p_username: username,
      p_area_code: nextArea,
    });

    setSavingUsername(null);

    if (error) {
      console.error("Unable to update area assignment:", error);
      showToast(
        "Unable to update area assignment. Please try again.",
        "error"
      );
      return;
    }

    setUsers((current) =>
      current.map((user) =>
        user.username === username
          ? { ...user, areaCode: nextArea }
          : user
      )
    );

    showToast(`Updated ${username}'s area to ${nextArea}.`, "success");
  }

  async function handleStatusChange(
    username: string,
    nextStatus: "ACTIVE" | "INACTIVE"
  ) {
    setSavingUsername(username);

    const { error } = await supabase.rpc("admin_set_user_status", {
      p_username: username,
      p_status: nextStatus,
    });

    setSavingUsername(null);

    if (error) {
      console.error("Unable to update status:", error);
      showToast(
        error.message || "Unable to update status. Please try again.",
        "error"
      );
      return;
    }

    setUsers((current) =>
      current.map((user) =>
        user.username === username
          ? { ...user, status: nextStatus }
          : user
      )
    );

    showToast(`Updated ${username}'s status to ${nextStatus}.`, "success");
  }

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
          User Management
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          View system users and manage their role and area assignment.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Loading users...
            </div>
          ) : loadError ? (
            <div className="px-6 py-16 text-center text-sm text-red-600">
              {loadError}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Username
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Role
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assigned Area
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr
                      key={user.username}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {user.username}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {user.email}
                      </td>

                      <td className="px-6 py-4">
                        <Select
                          options={ROLE_OPTIONS}
                          value={user.role}
                          disabled={savingUsername === user.username}
                          onChange={(event) =>
                            handleRoleChange(
                              user.username,
                              event.target.value as "ADMIN" | "STAFF"
                            )
                          }
                        />
                      </td>

                      <td className="px-6 py-4">
                        <Select
                          options={STATUS_OPTIONS}
                          value={user.status}
                          disabled={savingUsername === user.username}
                          onChange={(event) =>
                            handleStatusChange(
                              user.username,
                              event.target.value as "ACTIVE" | "INACTIVE"
                            )
                          }
                        />
                      </td>

                      <td className="px-6 py-4">
                        <Select
                          options={[
                            {
                              label: user.areaCode ? user.areaCode : "Unassigned",
                              value: "",
                            },
                            ...AREA_OPTIONS,
                          ]}
                          value={user.areaCode ?? ""}
                          disabled={savingUsername === user.username}
                          onChange={(event) => {
                            if (!event.target.value) {
                              return;
                            }
                            handleAreaChange(user.username, event.target.value);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <Button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
