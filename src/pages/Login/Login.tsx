import { useEffect, useState } from "react";
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

  const [checkingSession, setCheckingSession] =
    useState(true);

  useEffect(() => {
    async function redirectAuthenticatedUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        navigate("/system", {
          replace: true,
        });
        return;
      }

      setCheckingSession(false);
    }

    void redirectAuthenticatedUser();
  }, [navigate]);

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF9F5]">
        <p className="text-sm text-slate-500">
          Checking session...
        </p>
      </div>
    );
  }

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

    if (userError) {
      console.error(
        "Supabase username lookup failed:",
        userError
      );
    }

    const loginEmail =
      typeof email === "string"
        ? email.trim()
        : "";

    if (userError || !loginEmail) {
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
        email: loginEmail,
        password,
      });

    setLoading(false);

    if (loginError) {
      console.error(
        "Supabase signInWithPassword failed:",
        {
          username: trimmedUsername,
          email: loginEmail,
          passwordProvided: password.length > 0,
          name: loginError.name,
          message: loginError.message,
          status: loginError.status,
          code: loginError.code,
        }
      );
      setError(
        "Invalid username or password."
      );
      return;
    }

    navigate("/system");
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#FBF9F4]">

      {/* ===================================================
          DECORATIVE BACKGROUND LAYER
      =================================================== */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-200/40 via-emerald-100/30 to-transparent blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-gradient-to-bl from-amber-200/40 via-orange-100/30 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-80 w-80 rounded-full bg-gradient-to-tr from-fuchsia-200/30 via-purple-100/20 to-transparent blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(#0f172a 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
      </div>

      {/* Left — Branding Panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-slate-200/70 bg-white/60 p-12 backdrop-blur-sm lg:flex">

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-lg font-bold text-white shadow-md shadow-emerald-900/20">
            E
          </div>
          <div>
            <span className="block text-lg font-bold leading-tight tracking-tight text-slate-900">
              Eclipse
            </span>
            <span className="block text-xs leading-tight text-slate-500">
              Food Trading OPC
            </span>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-200">
            Business Platform
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-900">
            Inventory & distribution,
            <br />
            <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">under one roof.</span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-slate-500">
            Track stock, manage products,
            and oversee every movement
            across your operations from a
            single, unified system.
          </p>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} Eclipse Food Trading OPC. All rights reserved.
        </p>
      </div>

      {/* Right — Form Panel */}
      <div className="relative flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20 xl:px-24">

        <div className="mx-auto w-full max-w-sm">

          {/* Mobile-only brand mark */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-lg font-bold text-white shadow-md shadow-emerald-900/20">
              E
            </div>
            <div>
              <span className="block text-lg font-bold leading-tight tracking-tight text-slate-900">
                Eclipse
              </span>
              <span className="block text-xs leading-tight text-slate-500">
                Food Trading OPC
              </span>
            </div>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Sign in with your account to access Eclipse.
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
              className="w-full !py-3 !bg-gradient-to-b !from-emerald-600 !to-emerald-700 !shadow-md !shadow-emerald-900/20 hover:!from-emerald-700 hover:!to-emerald-800 hover:!shadow-lg hover:!shadow-emerald-900/30"
            >
              {loading
                ? "Signing in..."
                : "Sign In"}
            </Button>

          </form>

          <p className="mt-10 text-center text-xs text-slate-500 lg:text-left">
            Eclipse Food Trading OPC — Internal use only.
          </p>

        </div>

      </div>

    </div>
  );
}