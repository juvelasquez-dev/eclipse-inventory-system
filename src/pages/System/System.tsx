import { useNavigate } from "react-router-dom";
import {
  Package,
  ShoppingCart,
  ArrowRight,
  LogOut,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

export default function System() {
  const navigate = useNavigate();

  async function handleLogout() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Logout failed:",
        error
      );
      return;
    }

    navigate("/login", {
      replace: true,
    });
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950">

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Top brand bar */}
      <div className="relative flex items-center gap-3 px-6 py-8 sm:px-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-base font-bold text-white shadow-lg shadow-emerald-500/30">
          E
        </div>
        <span className="text-base font-semibold tracking-tight text-white">
          Eclipse
        </span>

        <button
          type="button"
          onClick={handleLogout}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-emerald-400/40 hover:bg-white/[0.06] hover:text-white"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>

      {/* Main content */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 pb-16 sm:px-6">

        <div className="mx-auto w-full max-w-4xl">

          <div className="text-center">
            <span className="inline-flex items-center rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
              Business Platform
            </span>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Welcome to Eclipse
            </h1>

            <p className="mt-3 text-sm text-slate-400 sm:text-base">
              Choose a system to continue.
            </p>
          </div>

          {/* System Options */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">

            {/* Inventory */}
            <button
              type="button"
              onClick={() =>
                navigate("/")
              }
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.06]"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/0 blur-2xl transition-all duration-300 group-hover:bg-emerald-400/10" />

              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                    <Package size={26} />
                  </div>

                  <ArrowRight
                    size={20}
                    className="text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-300"
                  />
                </div>

                <h2 className="mt-7 text-2xl font-semibold tracking-tight text-white">
                  Inventory
                </h2>

                <p className="mt-2.5 text-sm leading-6 text-slate-400">
                  Manage products, stock in,
                  stock out, inventory levels,
                  and transaction history.
                </p>

                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                  Open Inventory
                  <ArrowRight
                    size={14}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </div>
              </div>
            </button>

            {/* POS */}
            <button
              type="button"
              onClick={() =>
                navigate("/pos")
              }
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.06]"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/0 blur-2xl transition-all duration-300 group-hover:bg-emerald-400/10" />

              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                    <ShoppingCart size={26} />
                  </div>

                  <ArrowRight
                    size={20}
                    className="text-slate-600 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-300"
                  />
                </div>

                <h2 className="mt-7 text-2xl font-semibold tracking-tight text-white">
                  POS
                </h2>

                <p className="mt-2.5 text-sm leading-6 text-slate-400">
                  Handle product distribution,
                  sales transactions, and
                  customer receipts.
                </p>

                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                  Open POS
                  <ArrowRight
                    size={14}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </div>
              </div>
            </button>

          </div>

        </div>

      </div>

      {/* Footer */}
      <p className="relative pb-8 text-center text-xs text-slate-500">
        Eclipse Food Trading OPC
      </p>

    </div>
  );
}