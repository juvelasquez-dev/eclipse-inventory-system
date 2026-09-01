import { useNavigate } from "react-router-dom";
import {
  Package,
  ShoppingCart,
  Store,
  ArrowRight,
  LogOut,
  Boxes,
  Receipt,
  MapPin,
  Truck,
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#FBF9F4]">

      {/* ===================================================
          DECORATIVE BACKGROUND LAYER
      =================================================== */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        {/* Large organic color blobs */}
        <div className="absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-emerald-200/50 via-emerald-100/40 to-transparent blur-3xl" />

        <div className="absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-gradient-to-bl from-amber-200/50 via-orange-100/40 to-transparent blur-3xl" />

        <div className="absolute -bottom-40 left-1/4 h-[26rem] w-[26rem] rounded-full bg-gradient-to-tr from-fuchsia-200/40 via-purple-100/30 to-transparent blur-3xl" />

        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-gradient-to-tl from-sky-200/40 via-cyan-100/30 to-transparent blur-3xl" />

        {/* Faint dot texture */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(#0f172a 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        {/* Large faded watermark icons — logistics/retail motif */}
        <Package
          size={280}
          strokeWidth={1}
          className="absolute -left-16 top-24 -rotate-12 text-emerald-900/[0.035]"
        />

        <ShoppingCart
          size={220}
          strokeWidth={1}
          className="absolute right-0 top-[38%] rotate-6 text-amber-900/[0.04]"
        />

        <Store
          size={240}
          strokeWidth={1}
          className="absolute bottom-0 left-[8%] rotate-3 text-fuchsia-900/[0.035]"
        />

        <Truck
          size={160}
          strokeWidth={1}
          className="absolute bottom-10 right-[12%] -rotate-6 text-sky-900/[0.04]"
        />

        {/* Soft wave divider near the top */}
        <svg
          className="absolute left-0 top-0 w-full text-white/60"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
        >
          <path
            fill="currentColor"
            d="M0,96 C240,160 480,32 720,64 C960,96 1200,180 1440,120 L1440,0 L0,0 Z"
          />
        </svg>

      </div>

      {/* ===================================================
          TOP BRAND BAR
      =================================================== */}

      <div className="relative flex items-center gap-3 border-b border-slate-200/70 bg-white/70 px-6 py-5 backdrop-blur-md sm:px-10">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-base font-bold text-white shadow-sm shadow-emerald-900/20">
          E
        </div>

        <div>
          <span className="block text-sm font-bold leading-tight tracking-tight text-slate-900">
            Eclipse
          </span>
          <span className="block text-xs leading-tight text-slate-500">
            Food Trading OPC
          </span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>

      </div>

      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">

        <div className="mx-auto w-full max-w-6xl">

          {/* Header */}
          <div className="text-center">

            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-200">
              <Truck size={13} />
              Business Platform
            </span>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                Eclipse
              </span>
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 sm:text-base">
              Manage your business operations from one platform.
            </p>

          </div>

          {/* System Options */}
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">

            {/* Inventory */}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="group relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/40 p-8 text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-900/10"
            >

              {/* Decorative watermark icon */}
              <Boxes
                size={140}
                strokeWidth={1}
                className="pointer-events-none absolute -bottom-6 -right-6 text-emerald-600/[0.08] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
              />

              {/* Corner gradient glow */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-300/0 to-emerald-300/0 blur-2xl transition-all duration-300 group-hover:from-emerald-300/30 group-hover:to-teal-200/20" />

              <div className="relative">

                <div className="flex items-start justify-between">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-900/20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                    <Package size={26} />
                  </div>

                  <ArrowRight
                    size={20}
                    className="text-emerald-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-600"
                  />

                </div>

                <h2 className="mt-7 text-xl font-bold tracking-tight text-slate-900">
                  Inventory
                </h2>

                <p className="mt-2.5 text-sm leading-6 text-slate-500">
                  Manage products, stock in,
                  stock out, inventory levels,
                  and transaction history.
                </p>

                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
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
              onClick={() => navigate("/pos")}
              className="group relative overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-b from-white to-amber-50/40 p-8 text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-900/10"
            >

              <Receipt
                size={140}
                strokeWidth={1}
                className="pointer-events-none absolute -bottom-6 -right-6 text-amber-600/[0.08] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
              />

              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-amber-300/0 to-orange-300/0 blur-2xl transition-all duration-300 group-hover:from-amber-300/30 group-hover:to-orange-200/20" />

              <div className="relative">

                <div className="flex items-start justify-between">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-900/20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                    <ShoppingCart size={26} />
                  </div>

                  <ArrowRight
                    size={20}
                    className="text-amber-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-amber-600"
                  />

                </div>

                <h2 className="mt-7 text-xl font-bold tracking-tight text-slate-900">
                  POS
                </h2>

                <p className="mt-2.5 text-sm leading-6 text-slate-500">
                  Handle product distribution,
                  sales transactions, and
                  customer receipts.
                </p>

                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                  Open POS

                  <ArrowRight
                    size={14}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />

                </div>

              </div>

            </button>

            {/* Outlet Management */}
            <button
              type="button"
              onClick={() => navigate("/outlets")}
              className="group relative overflow-hidden rounded-3xl border border-fuchsia-100 bg-gradient-to-b from-white to-fuchsia-50/40 p-8 text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-fuchsia-300 hover:shadow-xl hover:shadow-fuchsia-900/10"
            >

              <MapPin
                size={140}
                strokeWidth={1}
                className="pointer-events-none absolute -bottom-6 -right-6 text-fuchsia-600/[0.08] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
              />

              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-fuchsia-300/0 to-purple-300/0 blur-2xl transition-all duration-300 group-hover:from-fuchsia-300/30 group-hover:to-purple-200/20" />

              <div className="relative">

                <div className="flex items-start justify-between">

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-md shadow-fuchsia-900/20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                    <Store size={26} />
                  </div>

                  <ArrowRight
                    size={20}
                    className="text-fuchsia-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-fuchsia-600"
                  />

                </div>

                <h2 className="mt-7 text-xl font-bold tracking-tight text-slate-900">
                  Outlets
                </h2>

                <p className="mt-2.5 text-sm leading-6 text-slate-500">
                  Manage customer outlets,
                  contact information, addresses,
                  TIN, and area assignments.
                </p>

                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-fuchsia-600">
                  Manage Outlets

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

      {/* ===================================================
          FOOTER
      =================================================== */}

      <p className="relative border-t border-slate-200/70 bg-white/70 py-5 text-center text-xs text-slate-500 backdrop-blur-md">
        Eclipse Food Trading OPC
      </p>

    </div>
  );
}