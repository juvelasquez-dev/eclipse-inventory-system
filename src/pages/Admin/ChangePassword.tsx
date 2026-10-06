import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { useToast } from "../../context/ToastContext";
import { supabase } from "../../lib/supabase";

// Same minimum enforced when admins create users (admin-create-user).
// Supabase Auth remains the final authority on password strength.
const MIN_PASSWORD_LENGTH = 8;

/*
 * Verifies the current password without touching the app's session:
 * a throwaway, non-persisting client signs in and is discarded.
 */
async function verifyCurrentPassword(email: string, password: string) {
  const verifier = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "eidms-password-verifier",
      },
    }
  );

  const { error } = await verifier.auth.signInWithPassword({ email, password });
  return !error;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  disabled,
  helperText,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  disabled: boolean;
  helperText?: string;
}) {
  return (
    <div>
      <Input
        id={id}
        label={label}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        helperText={helperText}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="mt-1 inline-flex items-center gap-1 rounded px-1 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        disabled={disabled}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        {visible ? "Hide password" : "Show password"}
      </button>
    </div>
  );
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user.email;

      if (!email) {
        setError("Your session could not be verified. Please sign in again.");
        return;
      }

      const currentIsValid = await verifyCurrentPassword(email, currentPassword);

      if (!currentIsValid) {
        setError("Your current password is incorrect.");
        setCurrentPassword("");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        const code = (updateError as { code?: string }).code ?? "";
        const message = updateError.message.toLowerCase();

        if (code === "same_password" || message.includes("different from the old")) {
          setError("New password must be different from your current password.");
        } else if (code === "weak_password" || message.includes("password")) {
          setError("The new password does not meet the password requirements.");
        } else {
          setError("Unable to change your password. Please try again.");
        }
        clearFields();
        return;
      }

      clearFields();
      setSuccess("Your password has been changed successfully.");
      showToast("Password changed successfully.", "success");
    } catch {
      setError("Unable to change your password. Please try again.");
      clearFields();
    } finally {
      setSubmitting(false);
    }
  };

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

      <div className="flex flex-1 flex-col items-center px-4 py-16 sm:px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-900/20">
          <KeyRound size={30} />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
          Change My Password
        </h1>

        <p className="mt-2 max-w-md text-center text-sm text-slate-500">
          Update the password for your own account. This does not affect any other user.
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <PasswordField
            id="current-password"
            label="Current Password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            visible={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            disabled={submitting}
          />

          <PasswordField
            id="new-password"
            label="New Password"
            autoComplete="new-password"
            helperText={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
            value={newPassword}
            onChange={setNewPassword}
            visible={showNew}
            onToggle={() => setShowNew((v) => !v)}
            disabled={submitting}
          />

          <PasswordField
            id="confirm-new-password"
            label="Confirm New Password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            disabled={submitting}
          />

          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Changing password..." : "Change Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
