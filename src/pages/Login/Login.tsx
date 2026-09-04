import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IceCream2, AlertCircle, Heart, Sparkles } from "lucide-react";

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
      <div className="flex min-h-screen items-center justify-center bg-[#FBF9F4]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-pink-200 border-t-pink-500" />
          <p className="text-sm text-slate-500">
            Checking session...
          </p>
        </div>
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
        {/* Soft pastel color washes */}
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-gradient-to-br from-pink-200/50 via-rose-100/30 to-transparent blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-gradient-to-bl from-emerald-200/40 via-teal-100/30 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-gradient-to-tr from-violet-200/40 via-purple-100/20 to-transparent blur-3xl" />
        <div className="absolute right-1/4 top-0 h-72 w-72 rounded-full bg-gradient-to-b from-sky-200/30 to-transparent blur-3xl" />

        {/* Subtle dot texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(#0f172a 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        {/* Sprinkle confetti, scattered + subtle */}
        <Sprinkle className="left-[8%] top-[14%] rotate-[18deg] bg-pink-300/70" />
        <Sprinkle className="left-[14%] top-[62%] -rotate-[24deg] bg-emerald-300/70" />
        <Sprinkle className="left-[46%] top-[6%] rotate-[52deg] bg-amber-300/70" />
        <Sprinkle className="right-[10%] top-[20%] rotate-[10deg] bg-violet-300/70" />
        <Sprinkle className="right-[18%] top-[70%] -rotate-[36deg] bg-sky-300/70" />
        <Sprinkle className="right-[6%] top-[46%] rotate-[70deg] bg-pink-300/70" />
      </div>

      {/* Left — Branding Panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-pink-100/70 bg-white/50 p-16 backdrop-blur-sm lg:flex">

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-md shadow-pink-900/20">
            <IceCream2 className="h-7 w-7" strokeWidth={2.25} />
          </div>
          <div>
            <span className="block text-xl font-bold leading-tight tracking-tight text-slate-900">
              Eclipse
            </span>
            <span className="block text-sm leading-tight text-slate-500">
              Food Trading OPC
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-pink-600 shadow-sm ring-1 ring-inset ring-pink-200">
            <Sparkles className="h-4 w-4" />
            Inventory & POS Platform
          </span>

          <h1 className="mt-7 text-5xl font-bold leading-tight tracking-tight text-slate-900">
            Smooth operations,
            <br />
            <span className="bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">sweet results.</span>
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-500">
            Track stock, manage products, and oversee every
            movement across your operations — from a single,
            delightfully simple system.
          </p>
        </div>

        {/* Decorative illustration cluster */}
        <div className="relative z-10 flex items-end gap-8">
          <ConeIllustration className="h-48 w-34 drop-shadow-xl" />
          <BowlIllustration className="mb-1 h-36 w-40 drop-shadow-xl" />
          <CupIllustration className="mb-3 h-32 w-24 drop-shadow-xl" />
          
        </div>
      </div>

      {/* Right — Form Panel */}
      <div className="relative z-10 flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20 xl:px-24">

        <div className="mx-auto w-full max-w-sm">

          {/* Mobile-only brand mark */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-md shadow-pink-900/20">
              <IceCream2 className="h-6 w-6" strokeWidth={2.25} />
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

          <div className="rounded-3xl border border-pink-100 bg-white/90 p-8 shadow-xl shadow-pink-900/[0.06] backdrop-blur-sm sm:p-10">

            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-violet-100 ring-1 ring-inset ring-pink-200/70">
                <IceCream2 className="h-8 w-8 text-pink-500" strokeWidth={2} />
              </div>
            </div>

            <h2 className="mt-5 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome back!
            </h2>

            <p className="mt-2 text-center text-sm text-slate-500">
              Sign in to continue to Eclipse.
            </p>

            {error && (
              <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
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
                className="!rounded-xl !border-slate-200 focus:!border-pink-400 focus:!ring-pink-100"
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
                className="!rounded-xl !border-slate-200 focus:!border-pink-400 focus:!ring-pink-100"
              />

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full !rounded-xl !py-3 !bg-gradient-to-b !from-pink-500 !to-rose-500 !shadow-md !shadow-pink-900/20 hover:!from-pink-600 hover:!to-rose-600 hover:!shadow-lg hover:!shadow-pink-900/25 disabled:!opacity-70"
              >
                {loading
                  ? "Signing in..."
                  : "Sign In"}
              </Button>

            </form>

          </div>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400 lg:justify-start">
            <Heart className="h-3.5 w-3.5 text-pink-300" fill="currentColor" />
            Eclipse Food Trading OPC — Internal use only.
          </p>
          <br />
          

        </div>

      </div>

    </div>
  );
}

/* =====================================================
   Lightweight decorative SVG illustrations
   (no external assets / dependencies)
===================================================== */

function Sprinkle({ className = "" }: { className?: string }) {
  return (
    <span
      className={`absolute h-7 w-2 rounded-full opacity-90 ${className}`}
    />
  );
}

function ConeIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 110 160" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="55" cy="42" r="34" fill="#F9A8C9" />
      <circle cx="34" cy="30" r="4" fill="#7C4A2D" opacity="0.6" />
      <circle cx="66" cy="24" r="3.5" fill="#7C4A2D" opacity="0.6" />
      <circle cx="76" cy="44" r="4" fill="#7C4A2D" opacity="0.6" />
      <circle cx="46" cy="56" r="3" fill="#7C4A2D" opacity="0.5" />
      <path d="M28 52 L82 52 L58 152 Q55 158 52 152 Z" fill="#E8B978" stroke="#C98F4E" strokeWidth="1.5" />
      <path d="M31 66 L79 66 M33 82 L77 82 M36 98 L74 98 M39 114 L71 114 M42 130 L68 130" stroke="#C98F4E" strokeWidth="1.2" opacity="0.6" />
    </svg>
  );
}

function BowlIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 120" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* bowl */}
      <path d="M18 66 Q70 118 122 66 L114 88 Q70 108 26 88 Z" fill="#BFE3F0" stroke="#8FC7DD" strokeWidth="2" />
      <ellipse cx="70" cy="66" rx="52" ry="14" fill="#DCF0F7" stroke="#8FC7DD" strokeWidth="2" />
      <circle cx="42" cy="62" r="3" fill="#8FC7DD" opacity="0.5" />
      <circle cx="98" cy="62" r="3" fill="#8FC7DD" opacity="0.5" />
      <circle cx="70" cy="78" r="3" fill="#8FC7DD" opacity="0.5" />
      {/* scoops */}
      <circle cx="46" cy="44" r="22" fill="#A7E8D0" />
      <circle cx="72" cy="36" r="24" fill="#FDE7A8" />
      <circle cx="98" cy="46" r="21" fill="#B08163" />
      <circle cx="38" cy="36" r="2.5" fill="#5C8F79" opacity="0.6" />
      <circle cx="52" cy="50" r="2.5" fill="#5C8F79" opacity="0.6" />
      <circle cx="92" cy="38" r="2.5" fill="#7C4A2D" opacity="0.5" />
      <circle cx="104" cy="52" r="2.5" fill="#7C4A2D" opacity="0.5" />
      {/* wafer stick */}
      <rect x="66" y="14" width="6" height="20" rx="1.5" fill="#E8B978" stroke="#C98F4E" strokeWidth="1" transform="rotate(-10 69 24)" />
    </svg>
  );
}

function CupIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 120" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* cherry */}
      <path d="M46 18 Q42 6 49 2" fill="none" stroke="#7C4A2D" strokeWidth="2" strokeLinecap="round" />
      <circle cx="49" cy="2" r="3.5" fill="#5C8F5C" />
      <circle cx="45" cy="20" r="7" fill="#E0556B" />
      {/* scoop on top */}
      <circle cx="45" cy="34" r="20" fill="#F9A8C9" />
      <circle cx="36" cy="28" r="2.2" fill="#B4577A" opacity="0.5" />
      <circle cx="54" cy="32" r="2.2" fill="#B4577A" opacity="0.5" />
      {/* cup */}
      <path d="M20 46 L70 46 L62 104 Q61 110 55 110 L35 110 Q29 110 28 104 Z" fill="#BFE3D8" stroke="#93CFC0" strokeWidth="2" />
      <path d="M23.5 58 Q45 64 66.5 58 M25.5 76 Q45 82 64.5 76 M27.5 94 Q45 99 62.5 94" stroke="#93CFC0" strokeWidth="1.4" opacity="0.7" fill="none" />
    </svg>
  );
}
