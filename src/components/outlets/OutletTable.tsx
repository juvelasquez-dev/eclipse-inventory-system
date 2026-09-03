import Button from "../ui/Button";

import type { Outlet } from "../../types/inventory";

interface OutletTableProps {
  outlets: Outlet[];
  onEdit: (outlet: Outlet) => void;
  onDelete: (outlet: Outlet) => void;
}

function getIdentificationLabel(outlet: Outlet) {
  const tin = outlet.tin?.trim();

  if (tin) {
    return `TIN: ${tin}`;
  }

  const idType = outlet.idType?.trim();
  const idNumber = outlet.idNumber?.trim();

  if (idType && idNumber) {
    return `${idType}: ${idNumber}`;
  }

  return "No identification";
}

export default function OutletTable({
  outlets,
  onEdit,
  onDelete,
}: OutletTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Outlet
              </th>

              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Contact Person
              </th>

              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                DEGIC Number
              </th>

              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Contact Number
              </th>

              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Area
              </th>

              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Identification
              </th>

              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>

              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {outlets.map((outlet) => (
                <tr
                  key={outlet.id}
                  className="transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-900">
                      {outlet.outletName}
                    </div>

                    <div className="mt-1 max-w-xs truncate text-sm text-slate-500">
                      {outlet.completeAddress}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-sm text-slate-600">
                    {outlet.contactPerson}
                  </td>

                  <td className="px-4 py-3.5 text-sm text-slate-600">
                    {outlet.degicNumber || "-"}
                  </td>

                  <td className="px-4 py-3.5 text-sm text-slate-600">
                    {outlet.contactNumber}
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      {outlet.areaCode}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-sm text-slate-600">
                    <span className="max-w-[12rem] truncate">
                      {getIdentificationLabel(outlet)}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                        outlet.status === "Active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {outlet.status}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          onEdit(outlet)
                        }
                      >
                        Edit
                      </Button>

                      <Button
                        variant="danger"
                        onClick={() =>
                          onDelete(outlet)
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
            ))}

            {outlets.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No outlets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}