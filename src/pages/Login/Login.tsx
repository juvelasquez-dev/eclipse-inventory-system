import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");

    const trimmedUsername =
      username.trim();

    if (!trimmedUsername) {
      setError(
        "Please enter your username."
      );
      return;
    }

    if (!password) {
      setError(
        "Please enter your password."
      );
      return;
    }

    setLoading(true);

    /*
     * Find the account associated
     * with the username.
     */
    const { data: email, error: userError } =
            await supabase.rpc(
                "get_login_email",
                {
                p_username: trimmedUsername,
                }
            );

    if (
  userError ||
  !email
) {
      setLoading(false);
      setError(
        "Invalid username or password."
      );
      return;
    }

    /*
     * Sign in using the email stored
     * internally in the users table.
     *
     * The user only provides a username.
     */
    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    setLoading(false);

    if (loginError) {
      setError(
        "Invalid username or password."
      );
      return;
    }

    navigate("/system");
  }

  return (
    <div className="flex min-h-screen bg-white">

      {/* Left — Branding Panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-950 p-12 lg:flex">

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-lg font-bold text-white shadow-lg shadow-emerald-500/30">
            E
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            Eclipse
          </span>
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
            Business Platform
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-white">
            Inventory & distribution,
            <br />
            under one roof.
          </h1>

          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Track stock, manage products,
            and oversee every movement
            across your operations from a
            single, unified system.
          </p>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} Eclipse Food Trading OPC.
          All rights reserved.
        </p>
      </div>

      {/* Right — Form Panel */}
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20 xl:px-24">

        <div className="mx-auto w-full max-w-sm">

          {/* Mobile-only brand mark */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg font-bold text-white shadow-sm shadow-emerald-900/20">
              E
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Eclipse
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Sign in with your account to
            access the system.
          </p>

          {error && (
            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm0 3a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >

            {/* Username */}
            <Input
              label="Username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }
              autoComplete="username"
            />

            {/* Password */}
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              autoComplete="current-password"
            />

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full !py-3"
            >
              {loading
                ? "Signing in..."
                : "Sign In"}
            </Button>

          </form>

          <p className="mt-10 text-center text-xs text-slate-400 lg:text-left">
            Eclipse Food Trading OPC — Internal
            use only.
          </p>

        </div>

      </div>

    </div>
  );
}