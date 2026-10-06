import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Plus } from "lucide-react";

import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import ConfirmModal from "../../components/ui/ConfirmModal";
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

interface NewUserForm {
  username: string;
  email: string;
  password: string;
  role: "ADMIN" | "STAFF";
  areaCode: string;
  status: "ACTIVE" | "INACTIVE";
}

interface PasswordResetTarget {
  username: string;
  role: "ADMIN" | "STAFF";
}

const EMPTY_NEW_USER: NewUserForm = {
  username: "",
  email: "",
  password: "",
  role: "STAFF",
  areaCode: "IAO",
  status: "ACTIVE",
};

const ROLE_OPTIONS = [
  { label: "ADMIN", value: "ADMIN" },
  { label: "STAFF", value: "STAFF" },
];

const STATUS_OPTIONS = [
  { label: "ACTIVE", value: "ACTIVE" },
  { label: "INACTIVE", value: "INACTIVE" },
];

type PendingChange =
  | { kind: "role"; username: string; from: string; to: "ADMIN" | "STAFF" }
  | { kind: "status"; username: string; from: string; to: "ACTIVE" | "INACTIVE" }
  | { kind: "area"; username: string; from: string; to: string };

const FILTER_ALL = "ALL";

const ROLE_FILTER_OPTIONS = [{ label: "All roles", value: FILTER_ALL }, ...ROLE_OPTIONS];
const STATUS_FILTER_OPTIONS = [{ label: "All statuses", value: FILTER_ALL }, ...STATUS_OPTIONS];

const AREA_OPTIONS = [
  { label: "IAO", value: "IAO" },
  { label: "CBR", value: "CBR" },
  { label: "EFT", value: "EFT" },
];

const AREA_FILTER_OPTIONS = [{ label: "All areas", value: FILTER_ALL }, ...AREA_OPTIONS];
const MIN_PASSWORD_LENGTH = 8;

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

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let password = "";

  while (password.length < 20) {
    const randomValues = new Uint8Array(32);
    crypto.getRandomValues(randomValues);

    for (const value of randomValues) {
      if (value < limit) {
        password += alphabet[value % alphabet.length];
        if (password.length === 20) {
          break;
        }
      }
    }
  }

  return password;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingUsername, setSavingUsername] = useState<string | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>(EMPTY_NEW_USER);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL);
  const [areaFilter, setAreaFilter] = useState(FILTER_ALL);
  const [resetTarget, setResetTarget] = useState<PasswordResetTarget | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState("");
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

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

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setCurrentEmail(data.session?.user.email?.trim().toLowerCase() ?? "");
    });
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !term ||
        user.username.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term);

      return (
        matchesSearch &&
        (roleFilter === FILTER_ALL || user.role === roleFilter) &&
        (statusFilter === FILTER_ALL || user.status === statusFilter) &&
        (areaFilter === FILTER_ALL || user.areaCode === areaFilter)
      );
    });
  }, [users, search, roleFilter, statusFilter, areaFilter]);

  const hasActiveFilters =
    search.trim() !== "" ||
    roleFilter !== FILTER_ALL ||
    statusFilter !== FILTER_ALL ||
    areaFilter !== FILTER_ALL;

  function clearFilters() {
    setSearch("");
    setRoleFilter(FILTER_ALL);
    setStatusFilter(FILTER_ALL);
    setAreaFilter(FILTER_ALL);
  }

  function isCurrentUser(user: AdminUserRow) {
    return (
      currentEmail !== null &&
      currentEmail !== "" &&
      user.email.trim().toLowerCase() === currentEmail
    );
  }

  function openPasswordReset(user: AdminUserRow) {
    if (isCurrentUser(user)) {
      return;
    }

    setResetTarget({ username: user.username, role: user.role });
    setResetPassword("");
    setConfirmResetPassword("");
    setShowResetPassword(false);
    setResetError("");
    setConfirmResetOpen(false);
  }

  function closePasswordReset() {
    if (resettingPassword) {
      return;
    }

    setResetTarget(null);
    setResetPassword("");
    setConfirmResetPassword("");
    setShowResetPassword(false);
    setResetError("");
    setConfirmResetOpen(false);
  }

  function preparePasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetError("");

    if (!resetTarget || !resetPassword || !confirmResetPassword) {
      setResetError("Enter and confirm a temporary password.");
      return;
    }

    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setResetError(`Temporary passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (resetPassword !== confirmResetPassword) {
      setResetError("The temporary password and confirmation do not match.");
      return;
    }

    setConfirmResetOpen(true);
  }

  async function confirmPasswordReset() {
    if (!resetTarget || resettingPassword) {
      return;
    }

    setConfirmResetOpen(false);
    setResettingPassword(true);

    try {
      const { error } = await supabase.functions.invoke(
        "admin-reset-user-password",
        {
          body: {
            username: resetTarget.username,
            temporaryPassword: resetPassword,
          },
        }
      );

      if (error) {
        let message = "Unable to reset the password. Please try again.";
        const context = (error as { context?: unknown }).context;

        if (context instanceof Response) {
          const responseBody = (await context.clone().json().catch(() => null)) as
            | { error?: unknown }
            | null;

          if (typeof responseBody?.error === "string") {
            message = responseBody.error;
          }
        }

        showToast(message, "error");
        return;
      }

      showToast(`Password reset successfully for ${resetTarget.username}.`, "success");
    } catch {
      showToast("Unable to reset the password. Please try again.", "error");
    } finally {
      setResettingPassword(false);
      setResetTarget(null);
      setResetPassword("");
      setConfirmResetPassword("");
      setShowResetPassword(false);
      setResetError("");
      setConfirmResetOpen(false);
    }
  }

  function getPasswordResetConfirmation() {
    if (!resetTarget) {
      return {
        title: "Confirm Password Reset",
        message: "Confirm the password reset.",
      };
    }

    if (resetTarget.role === "ADMIN") {
      return {
        title: "Reset Another Administrator's Password",
        message:
          `You are resetting ${resetTarget.username}'s ADMIN password. ` +
          "The new password will remain active until it is changed in a future reset. " +
          "Share it with them through a secure channel.",
      };
    }

    return {
      title: "Confirm Password Reset",
      message:
        `Reset ${resetTarget.username}'s password? The new password will remain active until it is changed ` +
        "in a future reset. Share it with them through a secure channel.",
    };
  }

  function getConfirmContent(change: PendingChange) {
    if (change.kind === "role") {
      return {
        title: "Change Role",
        message: `Change ${change.username}'s role from ${change.from} to ${change.to}?`,
      };
    }

    if (change.kind === "status") {
      return {
        title: change.to === "INACTIVE" ? "Deactivate User" : "Activate User",
        message:
          change.to === "INACTIVE"
            ? `Change ${change.username}'s status from ${change.from} to INACTIVE? They will no longer be able to access the system.`
            : `Change ${change.username}'s status from ${change.from} to ACTIVE? They will be able to access the system again.`,
      };
    }

    return {
      title: "Change Area",
      message: `Change ${change.username}'s area from ${change.from} to ${change.to}?`,
    };
  }

  async function confirmPendingChange() {
    const change = pendingChange;

    if (!change) {
      return;
    }

    setPendingChange(null);

    if (change.kind === "role") {
      await handleRoleChange(change.username, change.to);
    } else if (change.kind === "status") {
      await handleStatusChange(change.username, change.to);
    } else {
      await handleAreaChange(change.username, change.to);
    }
  }

  function closeAddUserModal() {
    if (creatingUser) {
      return;
    }

    setAddUserOpen(false);
    setNewUser(EMPTY_NEW_USER);
    setShowTemporaryPassword(false);
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const username = newUser.username.trim();
    const email = newUser.email.trim();

    if (!username || !email || !newUser.password || !newUser.areaCode) {
      setNewUser((current) => ({ ...current, password: "" }));
      setShowTemporaryPassword(false);
      showToast("Complete all fields before creating the user.", "error");
      return;
    }

    setCreatingUser(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-create-user",
        {
          body: {
            username,
            email,
            temporaryPassword: newUser.password,
            role: newUser.role,
            area: newUser.areaCode,
            status: newUser.status,
          },
        }
      );

      if (error) {
        let message = "Unable to create user. Please try again.";
        const context = (error as { context?: unknown }).context;

        if (context instanceof Response) {
          const responseBody = (await context.clone().json().catch(() => null)) as
            | { error?: unknown }
            | null;

          if (typeof responseBody?.error === "string") {
            message = responseBody.error;
          }
        }

        showToast(message, "error");
        return;
      }

      if ((data as { pending?: boolean } | null)?.pending) {
        setNewUser((current) => ({ ...current, password: "" }));
        showToast(
          "Creation could not be confirmed. Verify the Auth account before retrying.",
          "error"
        );
        return;
      }

      setNewUser(EMPTY_NEW_USER);
      setShowTemporaryPassword(false);
      setAddUserOpen(false);
      showToast("User created successfully.", "success");
      await loadUsers();
    } catch {
      showToast("Unable to create user. Please try again.", "error");
    } finally {
      setCreatingUser(false);
      setNewUser((current) => ({ ...current, password: "" }));
      setShowTemporaryPassword(false);
    }
  }

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
      showToast(error.message || "Unable to update role. Please try again.", "error");
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
        error.message || "Unable to update area assignment. Please try again.",
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            User Management
          </h1>
          <Button
            type="button"
            onClick={() => setAddUserOpen(true)}
            disabled={loading}
          >
            <Plus size={16} className="mr-2" />
            Add User
          </Button>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          View system users and manage their role, status, and area assignment.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div className="lg:col-span-2">
            <Input
              label="Search"
              placeholder="Username or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            label="Role"
            options={ROLE_FILTER_OPTIONS}
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          />
          <Select
            label="Status"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
          <Select
            label="Area"
            options={AREA_FILTER_OPTIONS}
            value={areaFilter}
            onChange={(event) => setAreaFilter(event.target.value)}
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Loading users...
            </div>
          ) : loadError ? (
            <div className="px-6 py-16 text-center text-sm text-red-600">
              {loadError}
            </div>
          ) : users.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No users found.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="space-y-4 px-6 py-16 text-center text-sm text-slate-500">
              <p>No users match the current filters.</p>
              {hasActiveFilters && (
                <Button type="button" variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
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

                    <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.username}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {user.username}
                        {isCurrentUser(user) && (
                          <span className="ml-2 text-xs font-semibold text-indigo-600">
                            (You)
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {user.email}
                      </td>

                      <td className="px-6 py-4">
                        <Select
                          options={ROLE_OPTIONS}
                          value={user.role}
                          disabled={
                            savingUsername === user.username || isCurrentUser(user)
                          }
                          title={
                            isCurrentUser(user)
                              ? "You cannot change your own role."
                              : undefined
                          }
                          onChange={(event) =>
                            setPendingChange({
                              kind: "role",
                              username: user.username,
                              from: user.role,
                              to: event.target.value as "ADMIN" | "STAFF",
                            })
                          }
                        />
                      </td>

                      <td className="px-6 py-4">
                        <Select
                          options={STATUS_OPTIONS}
                          value={user.status}
                          disabled={
                            savingUsername === user.username || isCurrentUser(user)
                          }
                          title={
                            isCurrentUser(user)
                              ? "You cannot change your own status."
                              : undefined
                          }
                          onChange={(event) =>
                            setPendingChange({
                              kind: "status",
                              username: user.username,
                              from: user.status,
                              to: event.target.value as "ACTIVE" | "INACTIVE",
                            })
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
                            setPendingChange({
                              kind: "area",
                              username: user.username,
                              from: user.areaCode ?? "Unassigned",
                              to: event.target.value,
                            });
                          }}
                        />
                      </td>

                      <td className="px-6 py-4">
                        <Button
                          type="button"
                          variant="secondary"
                          className="gap-2 whitespace-nowrap"
                          onClick={() => openPasswordReset(user)}
                          disabled={
                            currentEmail === null ||
                            isCurrentUser(user) ||
                            resettingPassword
                          }
                          title={
                            isCurrentUser(user)
                              ? "Use Change My Password for your own account."
                              : currentEmail === null
                                ? "Checking current account..."
                              : `Reset ${user.username}'s password`
                          }
                        >
                          <KeyRound size={15} />
                          Reset Password
                        </Button>
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

      <ConfirmModal
        open={pendingChange !== null}
        title={pendingChange ? getConfirmContent(pendingChange).title : ""}
        message={pendingChange ? getConfirmContent(pendingChange).message : ""}
        onCancel={() => setPendingChange(null)}
        onConfirm={() => void confirmPendingChange()}
      />

      <Modal
        open={addUserOpen}
        title="Add User"
        onClose={closeAddUserModal}
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            id="new-user-username"
            label="Username"
            autoComplete="username"
            required
            value={newUser.username}
            onChange={(event) =>
              setNewUser((current) => ({ ...current, username: event.target.value }))
            }
            disabled={creatingUser}
          />

          <Input
            id="new-user-email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={newUser.email}
            onChange={(event) =>
              setNewUser((current) => ({ ...current, email: event.target.value }))
            }
            disabled={creatingUser}
          />

          <div>
            <Input
              id="new-user-temporary-password"
              label="Temporary Password"
              type={showTemporaryPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              helperText="Use at least 8 characters."
              value={newUser.password}
              onChange={(event) =>
                setNewUser((current) => ({ ...current, password: event.target.value }))
              }
              disabled={creatingUser}
            />
            <button
              type="button"
              onClick={() => setShowTemporaryPassword((visible) => !visible)}
              aria-label={showTemporaryPassword ? "Hide password" : "Show password"}
              title={showTemporaryPassword ? "Hide password" : "Show password"}
              className="mt-1 inline-flex items-center gap-1 rounded px-1 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              disabled={creatingUser}
            >
              {showTemporaryPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              {showTemporaryPassword ? "Hide password" : "Show password"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select
              id="new-user-role"
              label="Role"
              options={ROLE_OPTIONS}
              value={newUser.role}
              onChange={(event) =>
                setNewUser((current) => ({
                  ...current,
                  role: event.target.value as NewUserForm["role"],
                }))
              }
              disabled={creatingUser}
            />
            <Select
              id="new-user-area"
              label="Area"
              options={AREA_OPTIONS}
              value={newUser.areaCode}
              onChange={(event) =>
                setNewUser((current) => ({ ...current, areaCode: event.target.value }))
              }
              disabled={creatingUser}
              required
            />
            <Select
              id="new-user-status"
              label="Status"
              options={STATUS_OPTIONS}
              value={newUser.status}
              onChange={(event) =>
                setNewUser((current) => ({
                  ...current,
                  status: event.target.value as NewUserForm["status"],
                }))
              }
              disabled={creatingUser}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeAddUserModal}
              disabled={creatingUser}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creatingUser}>
              {creatingUser ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={resetTarget !== null}
        title="Reset Password"
        onClose={closePasswordReset}
      >
        {resetTarget && (
          <form onSubmit={preparePasswordReset} className="space-y-4">
            <p className="text-sm text-slate-600">
              Set a temporary password for{" "}
              <span className="font-semibold text-slate-900">{resetTarget.username}</span>
              {" "}({resetTarget.role}). This resets another user's Supabase Auth password.
            </p>

            <p className="text-sm text-amber-700">
              This password will remain active until another reset. Share it through a secure channel before submitting.
              It will be cleared from this form when the reset finishes.
            </p>

            {resetError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {resetError}
              </div>
            )}

            <div>
              <Input
                id="reset-temporary-password"
                label="Temporary Password"
                type={showResetPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                helperText={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                disabled={resettingPassword}
              />
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetPassword((visible) => !visible)}
                  aria-label={showResetPassword ? "Hide password" : "Show password"}
                  title={showResetPassword ? "Hide password" : "Show password"}
                  className="inline-flex items-center gap-1 rounded px-1 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  disabled={resettingPassword}
                >
                  {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  {showResetPassword ? "Hide password" : "Show password"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetPassword(generateTemporaryPassword());
                    setConfirmResetPassword("");
                    setResetError("");
                    setShowResetPassword(true);
                  }}
                  className="rounded px-1 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800"
                  disabled={resettingPassword}
                >
                  Generate Password
                </button>
              </div>
            </div>

            <Input
              id="confirm-reset-temporary-password"
              label="Confirm Temporary Password"
              type={showResetPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmResetPassword}
              onChange={(event) => setConfirmResetPassword(event.target.value)}
              disabled={resettingPassword}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={closePasswordReset}
                disabled={resettingPassword}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={resettingPassword}>
                Continue
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {(() => {
        const confirmation = getPasswordResetConfirmation();
        return (
          <ConfirmModal
            open={confirmResetOpen}
            title={confirmation.title}
            message={confirmation.message}
            confirmText="Reset Password"
            onCancel={() => setConfirmResetOpen(false)}
            onConfirm={() => void confirmPasswordReset()}
          />
        );
      })()}
    </div>
  );
}
