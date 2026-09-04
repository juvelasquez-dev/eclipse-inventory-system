import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Download,
  FileText,
  MapPin,
  Plus,
  RefreshCw,
  Store,
  Upload,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "../../components/ui/Button";
import { useInventoryContext } from "../../context/InventoryContext";
import type { Outlet } from "../../types/inventory";
import { exportOutletsExcel } from "../../utils/outlets";

const AREA_CODES = ["IAO", "CBR", "EFT"] as const;
const RECENT_DAYS = 30;

type OutletIssue = {
  label: string;
  outlets: Outlet[];
};

function hasText(value?: string) {
  return Boolean(value?.trim());
}

function getOutletIssues(outlet: Outlet): string[] {
  const issues: string[] = [];

  if (!hasText(outlet.degicNumber)) {
    issues.push("Missing DEGIC Number");
  }

  if (
    !hasText(outlet.tin) &&
    !(hasText(outlet.idType) && hasText(outlet.idNumber))
  ) {
    issues.push("Missing TIN / ID");
  }

  if (!hasText(outlet.contactPerson) || !hasText(outlet.contactNumber)) {
    issues.push("Incomplete Contact Information");
  }

  if (
    !hasText(outlet.outletName) ||
    !hasText(outlet.completeAddress) ||
    !hasText(outlet.areaCode)
  ) {
    issues.push("Incomplete Outlet Information");
  }

  return issues;
}

function formatDate(value?: string) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getIssueTone(label: string) {
  if (label === "Missing DEGIC Number") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }

  if (label === "Missing TIN / ID") {
    return "bg-violet-50 text-violet-700 ring-violet-200";
  }

  if (label === "Incomplete Contact Information") {
    return "bg-sky-50 text-sky-700 ring-sky-200";
  }

  return "bg-rose-50 text-rose-700 ring-rose-200";
}

export default function OutletDashboard() {
  const navigate = useNavigate();
  const { outlets } = useInventoryContext();

  const outletIssues = useMemo(
    () =>
      outlets.map((outlet) => ({
        outlet,
        issues: getOutletIssues(outlet),
      })),
    [outlets]
  );

  const issueGroups = useMemo<OutletIssue[]>(() => {
    const labels = [
      "Missing DEGIC Number",
      "Missing TIN / ID",
      "Incomplete Contact Information",
      "Incomplete Outlet Information",
    ];

    return labels
      .map((label) => ({
        label,
        outlets: outletIssues
          .filter((item) => item.issues.includes(label))
          .map((item) => item.outlet),
      }))
      .filter((group) => group.outlets.length > 0);
  }, [outletIssues]);

  const needsAttention = useMemo(
    () =>
      outletIssues
        .filter((item) => item.issues.length > 0)
        .map((item) => item.outlet),
    [outletIssues]
  );

  const recentCutoff = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - RECENT_DAYS);
    return date;
  }, []);

  const recentlyUpdated = useMemo(
    () =>
      outlets
        .filter((outlet) => {
          if (!outlet.updatedAt) {
            return false;
          }

          const updatedAt = new Date(outlet.updatedAt);
          return !Number.isNaN(updatedAt.getTime()) && updatedAt >= recentCutoff;
        })
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? 0).getTime() -
            new Date(a.updatedAt ?? 0).getTime()
        ),
    [outlets, recentCutoff]
  );

  const inactiveOutlets = useMemo(
    () =>
      outlets
        .filter((outlet) => outlet.status === "Inactive")
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
            new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
        ),
    [outlets]
  );

  const areaOperations = useMemo(
    () =>
      AREA_CODES.map((area) => {
        const areaOutlets = outlets.filter((outlet) => outlet.areaCode === area);

        return {
          area,
          active: areaOutlets.filter((outlet) => outlet.status === "Active").length,
          inactive: areaOutlets.filter((outlet) => outlet.status === "Inactive").length,
          needsAttention: areaOutlets.filter(
            (outlet) => getOutletIssues(outlet).length > 0
          ).length,
        };
      }),
    [outlets]
  );

  const cards = [
    {
      title: "Active Outlets",
      value: outlets.filter((outlet) => outlet.status === "Active").length,
      icon: Activity,
      tone: "emerald",
    },
    {
      title: "Inactive Outlets",
      value: inactiveOutlets.length,
      icon: Users,
      tone: "amber",
    },
    {
      title: "Needs Attention",
      value: needsAttention.length,
      icon: AlertTriangle,
      tone: "rose",
    },
    {
      title: "Recently Updated",
      value: recentlyUpdated.length,
      icon: RefreshCw,
      tone: "sky",
    },
  ];

  function openOutlets() {
    navigate("/outlets");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Outlet Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage outlet records and review information that needs attention.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={openOutlets} className="gap-2">
            <Plus size={16} />
            Add Outlet
          </Button>
          <Button type="button" variant="secondary" onClick={openOutlets} className="gap-2">
            <Upload size={16} />
            Import Outlets
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => exportOutletsExcel(outlets)}
            className="gap-2"
          >
            <Download size={16} />
            Export Outlets
          </Button>
        </div>
      </div>

      {outlets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <Store className="mx-auto text-slate-300" size={32} />
          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            No outlet records yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add or import an outlet to begin managing your network.
          </p>
          <Button type="button" onClick={openOutlets} className="mt-5 gap-2">
            <Plus size={16} />
            Add Outlet
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ title, value, icon: Icon, tone }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{title}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                      {value}
                    </p>
                  </div>
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${
                      tone === "emerald"
                        ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
                        : tone === "amber"
                          ? "bg-amber-50 text-amber-600 ring-amber-100"
                          : tone === "rose"
                            ? "bg-rose-50 text-rose-600 ring-rose-100"
                            : "bg-sky-50 text-sky-600 ring-sky-100"
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-rose-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-rose-100 bg-rose-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Needs Attention</h2>
                  <p className="text-xs text-slate-500">
                    Review incomplete outlet records before they cause follow-up work.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openOutlets}
                className="inline-flex items-center gap-1 text-sm font-semibold text-rose-700 hover:text-rose-800"
              >
                View All <ArrowRight size={15} />
              </button>
            </div>

            {issueGroups.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-emerald-700">
                All outlet records contain the currently required information.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
                {issueGroups.map((group) => (
                  <div key={group.label} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getIssueTone(group.label)}`}>
                        {group.label}
                      </span>
                      <span className="text-sm font-semibold text-slate-500">
                        {group.outlets.length}
                      </span>
                    </div>
                    <div className="mt-3 divide-y divide-slate-100">
                      {group.outlets.slice(0, 3).map((outlet) => (
                        <div key={outlet.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{outlet.outletName}</p>
                            <p className="text-xs text-slate-500">{outlet.areaCode || "No area"}</p>
                          </div>
                          <button
                            type="button"
                            onClick={openOutlets}
                            aria-label={`Open ${outlet.outletName} in Outlet Management`}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            Manage <ArrowRight size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {group.outlets.length > 3 && (
                      <button type="button" onClick={openOutlets} className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800">
                        + {group.outlets.length - 3} more
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Area Operations</h2>
                  <p className="mt-1 text-xs text-slate-500">Current records and review workload by area.</p>
                </div>
                <MapPin className="text-emerald-600" size={19} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Area</th>
                      <th className="px-5 py-3 text-right font-semibold">Active</th>
                      <th className="px-5 py-3 text-right font-semibold">Inactive</th>
                      <th className="px-5 py-3 text-right font-semibold">Needs Attention</th>
                      <th className="px-5 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {areaOperations.map((row) => (
                      <tr key={row.area} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-semibold text-slate-800">{row.area}</td>
                        <td className="px-5 py-3 text-right text-emerald-700">{row.active}</td>
                        <td className="px-5 py-3 text-right text-amber-700">{row.inactive}</td>
                        <td className="px-5 py-3 text-right font-semibold text-rose-700">{row.needsAttention}</td>
                        <td className="px-5 py-3 text-right">
                          <button type="button" onClick={openOutlets} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                            View <ArrowRight className="ml-1 inline" size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Inactive Outlets</h2>
                  <p className="mt-1 text-xs text-slate-500">Based on the current status field.</p>
                </div>
                <button type="button" onClick={openOutlets} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">View All</button>
              </div>
              {inactiveOutlets.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">No inactive outlets.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {inactiveOutlets.slice(0, 5).map((outlet) => (
                    <div key={outlet.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{outlet.outletName}</p>
                        <p className="truncate text-xs text-slate-500">{outlet.areaCode} · {outlet.contactPerson}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-500">Last updated</p>
                        <p className="text-xs font-medium text-slate-700">{formatDate(outlet.updatedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Recently Updated</h2>
                <p className="mt-1 text-xs text-slate-500">Outlets updated within the last {RECENT_DAYS} days.</p>
              </div>
              <button type="button" onClick={openOutlets} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
                View All <ArrowRight size={15} />
              </button>
            </div>
            {recentlyUpdated.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">No outlets have been updated recently.</div>
            ) : (
              <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                {recentlyUpdated.slice(0, 6).map((outlet) => (
                  <div key={outlet.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{outlet.outletName}</p>
                      <p className="text-xs text-slate-500">{outlet.areaCode}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${outlet.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {outlet.status}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(outlet.updatedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={openOutlets} className="gap-2">
              <FileText size={16} />
              Review Incomplete
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
