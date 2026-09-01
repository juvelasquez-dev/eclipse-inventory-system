import { useMemo } from "react";
import {
  MapPin,
  Store,
  Users,
  Activity,
} from "lucide-react";

import { useInventoryContext } from "../../context/InventoryContext";

export default function OutletDashboard() {
  const { outlets } = useInventoryContext();

  const summary = useMemo(() => {
    const activeCount = outlets.filter(
      (outlet) => outlet.status === "Active"
    ).length;

    const inactiveCount = outlets.filter(
      (outlet) => outlet.status === "Inactive"
    ).length;

    const areaCount = new Set(
      outlets
        .map((outlet) => outlet.areaCode)
        .filter(Boolean)
    ).size;

    return {
      total: outlets.length,
      active: activeCount,
      inactive: inactiveCount,
      areaCount,
    };
  }, [outlets]);

  const cards = [
    {
      title: "Total Outlets",
      value: summary.total,
      icon: Store,
      tone: "emerald",
    },
    {
      title: "Active",
      value: summary.active,
      icon: Activity,
      tone: "sky",
    },
    {
      title: "Inactive",
      value: summary.inactive,
      icon: Users,
      tone: "amber",
    },
    {
      title: "Areas Covered",
      value: summary.areaCount,
      icon: MapPin,
      tone: "violet",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Outlet Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of outlet coverage and account status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, icon: Icon, tone }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
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
    </div>
  );
}
