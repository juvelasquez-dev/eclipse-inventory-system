import { useMemo } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Activity,
  Building2,
  Download,
  FileText,
  MapPin,
  ShieldAlert,
  Store,
} from "lucide-react";

import { useInventoryContext } from "../../context/InventoryContext";
import Button from "../../components/ui/Button";
import { exportOutletReportExcel } from "../../utils/outlets";

const AREAS = ["IAO", "CBR", "EFT"] as const;

export default function OutletReports() {
  const { outlets } = useInventoryContext();

  const summary = useMemo(() => {
    const total = outlets.length;
    const active = outlets.filter(
      (outlet) => outlet.status === "Active"
    ).length;
    const inactive = outlets.filter(
      (outlet) => outlet.status === "Inactive"
    ).length;
    const withoutTin = outlets.filter(
      (outlet) => !outlet.tin || !outlet.tin.trim()
    ).length;

    return {
      total,
      active,
      inactive,
      withoutTin,
    };
  }, [outlets]);

  const areaData = useMemo(
    () =>
      AREAS.map((area) => {
        const areaOutlets = outlets.filter(
          (outlet) => outlet.areaCode === area
        );

        return {
          area,
          active: areaOutlets.filter(
            (outlet) => outlet.status === "Active"
          ).length,
          inactive: areaOutlets.filter(
            (outlet) => outlet.status === "Inactive"
          ).length,
          total: areaOutlets.length,
        };
      }),
    [outlets]
  );

  const statusData = useMemo(
    () => [
      {
        name: "Active",
        value: summary.active,
        color: "#10b981",
      },
      {
        name: "Inactive",
        value: summary.inactive,
        color: "#94a3b8",
      },
    ],
    [summary.active, summary.inactive]
  );

  const summaryTable = useMemo(() => {
    const totals = areaData.reduce(
      (acc, item) => {
        acc.active += item.active;
        acc.inactive += item.inactive;
        acc.total += item.total;
        return acc;
      },
      { active: 0, inactive: 0, total: 0 }
    );

    return [
      ...areaData,
      {
        area: "Total",
        active: totals.active,
        inactive: totals.inactive,
        total: totals.total,
      },
    ];
  }, [areaData]);

  const recentOutlets = useMemo(
    () =>
      [...outlets]
        .sort((a, b) => {
          const aDate = a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;
          const bDate = b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;

          return bDate - aDate;
        })
        .slice(0, 5),
    [outlets]
  );

  const cards = [
    {
      title: "Total Outlets",
      value: summary.total,
      icon: Store,
      tone: "emerald",
    },
    {
      title: "Active Outlets",
      value: summary.active,
      icon: Activity,
      tone: "sky",
    },
    {
      title: "Inactive Outlets",
      value: summary.inactive,
      icon: ShieldAlert,
      tone: "amber",
    },
    {
      title: "Outlets Without TIN",
      value: summary.withoutTin,
      icon: FileText,
      tone: "violet",
    },
  ];

  if (outlets.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Outlet Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Reporting overview for outlet operations and coverage.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Building2 size={22} />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-700">
            No outlet data available
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Add outlets to see sales and coverage reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Outlet Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Reporting overview for outlet operations and coverage.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => exportOutletReportExcel(outlets)}
          className="gap-2"
        >
          <Download size={16} />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, icon: Icon, tone }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">
                  {title}
                </p>
                <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                  {value}
                </h3>
              </div>

              <div
                className={
                  "flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset " +
                  (tone === "emerald"
                    ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
                    : tone === "sky"
                      ? "bg-sky-50 text-sky-600 ring-sky-100"
                      : tone === "amber"
                        ? "bg-amber-50 text-amber-600 ring-amber-100"
                        : "bg-violet-50 text-violet-600 ring-violet-100")
                }
              >
                <Icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
              <MapPin size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Outlets by Area
              </h2>
              <p className="text-xs text-slate-500">
                Distribution across IAO, CBR, and EFT
              </p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="area" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(15, 23, 42, 0.03)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                  }}
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100">
              <Activity size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Outlet Status Distribution
              </h2>
              <p className="text-xs text-slate-500">
                Active vs inactive outlet count
              </p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={86}
                  paddingAngle={4}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center justify-center gap-6 text-sm">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-slate-600">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
                <span className="font-semibold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Outlet Distribution by Area
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Area
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Active
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Inactive
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {summaryTable.map((row) => (
                  <tr key={row.area} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {row.area}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-700">
                      {row.active}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-700">
                      {row.inactive}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Recently Added Outlets
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Outlet Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Area
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date Added
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {recentOutlets.map((outlet) => (
                  <tr key={outlet.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {outlet.outletName}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {outlet.areaCode}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {outlet.contactPerson}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-1 text-xs font-medium " +
                          (outlet.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                            : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200")
                        }
                      >
                        {outlet.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {outlet.createdAt
                        ? new Date(outlet.createdAt).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
