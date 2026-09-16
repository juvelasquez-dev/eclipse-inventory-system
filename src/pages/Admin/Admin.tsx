import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ScrollText, ShieldCheck, Users } from "lucide-react";

export default function Admin() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF9F4]">
      <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white/70 px-6 py-5 backdrop-blur-md sm:px-10">
        <button
          type="button"
          onClick={() => navigate("/system")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          <span>Back to Systems</span>
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center px-4 py-16 sm:px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-900/20">
          <ShieldCheck size={30} />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
          Administration
        </h1>

        <p className="mt-2 max-w-md text-center text-sm text-slate-500">
          Manage system-wide settings and administrative operations.
        </p>

        <div className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="group relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/40 p-8 text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-900/10"
          >
            <Users
              size={140}
              strokeWidth={1}
              className="pointer-events-none absolute -bottom-6 -right-6 text-indigo-600/[0.08] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
            />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-900/20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                  <Users size={26} />
                </div>

                <ArrowRight
                  size={20}
                  className="text-indigo-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-indigo-600"
                />
              </div>

              <h2 className="mt-7 text-xl font-bold tracking-tight text-slate-900">
                User Management
              </h2>

              <p className="mt-2.5 text-sm leading-6 text-slate-500">
                View system users and manage their
                role and area assignment.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/admin/audit-logs")}
            className="group relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-b from-white to-indigo-50/40 p-8 text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-900/10"
          >
            <ScrollText
              size={140}
              strokeWidth={1}
              className="pointer-events-none absolute -bottom-6 -right-6 text-indigo-600/[0.08] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
            />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-900/20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                  <ScrollText size={26} />
                </div>

                <ArrowRight
                  size={20}
                  className="text-indigo-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-indigo-600"
                />
              </div>

              <h2 className="mt-7 text-xl font-bold tracking-tight text-slate-900">
                Audit Logs
              </h2>

              <p className="mt-2.5 text-sm leading-6 text-slate-500">
                Review admin actions on user
                role, area, and status.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
