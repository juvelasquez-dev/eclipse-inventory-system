import { useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Store,
  MapPin,
  ListFilter,
  Upload,
} from "lucide-react";

import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Select from "../../components/ui/Select";

import OutletForm, {
  type OutletFormData,
} from "../../components/outlets/OutletForm";

import OutletTable from "../../components/outlets/OutletTable";

import {
  useInventoryContext,
} from "../../context/InventoryContext";
import { useToast } from "../../context/ToastContext";

import type {
  Outlet,
} from "../../types/inventory";

import {
  downloadOutletTemplate,
  exportOutletsExcel,
  parseOutletStatus,
  readOutletImportRows,
  validateOutletImportRows,
  type OutletImportValidationResult,
} from "../../utils/outlets";

export default function Outlets() {
  const { showToast } = useToast();

  const {
    outlets,
    addOutlet,
    updateOutlet,
    deleteOutlet,
  } = useInventoryContext();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] =
    useState("");

  const [areaFilter, setAreaFilter] =
    useState("ALL");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] =
    useState(false);

  const [selectedOutlet, setSelectedOutlet] =
    useState<Outlet | undefined>();

  const [formError, setFormError] =
    useState("");

  const [importRows, setImportRows] =
    useState<OutletImportValidationResult[]>([]);

  const [isImportModalOpen, setIsImportModalOpen] =
    useState(false);

  const [importLoading, setImportLoading] =
    useState(false);

  const filteredOutlets = useMemo(() => {
    const searchTerm =
      search.trim().toLowerCase();

    return outlets.filter((outlet) => {
      const matchesSearch =
        !searchTerm ||
        [
          outlet.outletName,
          outlet.contactPerson,
          outlet.contactNumber,
          outlet.completeAddress,
          outlet.tin,
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);

      const matchesArea =
        areaFilter === "ALL" ||
        outlet.areaCode === areaFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        outlet.status === statusFilter;

      return (
        matchesSearch &&
        matchesArea &&
        matchesStatus
      );
    });
  }, [outlets, search, areaFilter, statusFilter]);

  /*
   * Summary figures derived from the
   * existing outlets/filteredOutlets data.
   * Purely presentational — no new data source.
   */
  const totalOutlets = outlets.length;

  const uniqueAreaCount = useMemo(() => {
    return new Set(
      outlets
        .map((outlet) => outlet.areaCode)
        .filter(Boolean)
    ).size;
  }, [outlets]);

  const hasSearch = search.trim() !== "";

  function clearSearch() {
    setSearch("");
  }

  function handleAdd() {
    setSelectedOutlet(undefined);
    setFormError("");
    setIsModalOpen(true);
  }

  function handleEdit(outlet: Outlet) {
    setSelectedOutlet(outlet);
    setFormError("");
    setIsModalOpen(true);
  }

  function handleDelete(outlet: Outlet) {
    setSelectedOutlet(outlet);
    setIsDeleteModalOpen(true);
  }

  async function handleSubmit(
    data: OutletFormData
  ) {
    setFormError("");

    if (selectedOutlet) {
      const result = await updateOutlet({
        ...selectedOutlet,
        ...data,
      });

      if (!result.success) {
        setFormError(
          result.message ||
            "Failed to update outlet."
        );
        return;
      }
    } else {
      const result = await addOutlet({
        ...data,
      });

      if (!result.success) {
        setFormError(
          result.message ||
            "Failed to add outlet."
        );
        return;
      }
    }

    setIsModalOpen(false);
    setSelectedOutlet(undefined);
    setFormError("");
  }

  async function confirmDelete() {
    if (!selectedOutlet) {
      return;
    }

    await deleteOutlet(
      selectedOutlet.id
    );

    setIsDeleteModalOpen(false);
    setSelectedOutlet(undefined);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setSelectedOutlet(undefined);
    setFormError("");
  }

  function closeImportModal() {
    setIsImportModalOpen(false);
    setImportRows([]);
  }

  async function handleImportFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImportLoading(true);

    try {
      const rows = await readOutletImportRows(file);
      const validatedRows = validateOutletImportRows(
        rows,
        outlets
      );

      setImportRows(validatedRows);
      setIsImportModalOpen(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to import outlet file.";

      showToast(message, "error");
    } finally {
      setImportLoading(false);
      event.target.value = "";
    }
  }

  async function confirmImport() {
    const validRows = importRows.filter(
      (row) => row.valid
    );

    if (validRows.length === 0) {
      showToast(
        "No valid outlet rows were found to import.",
        "error"
      );
      return;
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (const row of validRows) {
      const result = await addOutlet({
        outletName: row.outletName,
        contactPerson: row.contactPerson,
        contactNumber: row.contactNumber,
        completeAddress: row.completeAddress,
        areaCode: row.areaCode,
        tin: row.tin,
        status: parseOutletStatus(row.status),
      });

      if (result.success) {
        importedCount += 1;
      } else {
        errors.push(
          `${row.outletName || "Row " + row.rowNumber}: ${result.message || "Failed to import."}`
        );
      }
    }

    if (importedCount > 0) {
      showToast(
        `${importedCount} outlet${importedCount === 1 ? "" : "s"} imported successfully.`
      );
    }

    if (errors.length > 0) {
      showToast(errors.join(" | "), "error");
    }

    if (importedCount === validRows.length) {
      closeImportModal();
      return;
    }

    const remainingRows = validRows.filter(
      (row) =>
        !errors.some((error) =>
          error.startsWith(
            `${row.outletName || "Row " + row.rowNumber}:`
          )
        )
    );

    setImportRows((current) =>
      current.filter(
        (row) =>
          !remainingRows.some(
            (remaining) =>
              remaining.rowNumber === row.rowNumber
          )
      )
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-5 lg:px-6">

        {/* Header */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">

          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-60 blur-2xl" />

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="min-w-0">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                Customers
              </span>

              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                Outlets
              </h1>

              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Manage customer outlets and their contact information.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={() => exportOutletsExcel(outlets)}
                className="gap-2"
              >
                <Download size={16} />
                Export
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => downloadOutletTemplate()}
                className="gap-2"
              >
                <FileSpreadsheet size={16} />
                Template
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload size={16} />
                {importLoading ? "Reading..." : "Import"}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleImportFileChange}
              />

              <Button
                onClick={handleAdd}
                className="gap-2"
              >
                <Plus size={18} />
                Add Outlet
              </Button>
            </div>

          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
                <Store size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">
                  Total Outlets
                </p>
                <h3 className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                  {totalOutlets}
                </h3>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">
                  Areas Covered
                </p>
                <h3 className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                  {uniqueAreaCount}
                </h3>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100">
                <ListFilter size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">
                  {hasSearch ? "Search Results" : "Showing"}
                </p>
                <h3 className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                  {filteredOutlets.length}
                </h3>
              </div>
            </div>
          </div>

        </div>

        {/* Outlets Content */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">

          {/* Search */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="relative w-full xl:flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search outlets by name, contact, address..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[28rem]">
                <Select
                  label="Area"
                  value={areaFilter}
                  onChange={(e) =>
                    setAreaFilter(e.target.value)
                  }
                  options={[
                    { label: "All Areas", value: "ALL" },
                    { label: "IAO", value: "IAO" },
                    { label: "CBR", value: "CBR" },
                    { label: "EFT", value: "EFT" },
                  ]}
                />

                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                  options={[
                    { label: "All Status", value: "ALL" },
                    { label: "Active", value: "Active" },
                    { label: "Inactive", value: "Inactive" },
                  ]}
                />
              </div>

              {hasSearch && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="self-start text-xs font-medium text-slate-500 transition hover:text-slate-800 xl:self-center"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>

          {/* Table / Empty States */}
          {outlets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Store size={22} />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-600">
                No outlets yet.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Add your first outlet to get started.
              </p>
              <Button
                onClick={handleAdd}
                className="mt-4"
              >
                <Plus size={18} />
                Add Outlet
              </Button>
            </div>
          ) : filteredOutlets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Search size={20} />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-600">
                No outlets found.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Try adjusting your search.
              </p>
              <button
                type="button"
                onClick={clearSearch}
                className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <OutletTable
              outlets={filteredOutlets}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}

        </div>

      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={
          selectedOutlet
            ? "Edit Outlet"
            : "Add Outlet"
        }
      >
        <OutletForm
          initialValues={selectedOutlet}
          externalError={formError}
          onClearError={() => setFormError("")}
          onSubmit={handleSubmit}
        />
      </Modal>

      {/* Import Confirmation */}
      <Modal
        open={isImportModalOpen}
        onClose={closeImportModal}
        title="Import Outlets"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="font-semibold text-slate-900">
                  {importRows.length}
                </span>{" "}
                rows
              </div>

              <div className="text-emerald-600">
                <span className="font-semibold">
                  {importRows.filter((row) => row.valid).length}
                </span>{" "}
                valid
              </div>

              <div className="text-red-600">
                <span className="font-semibold">
                  {importRows.filter((row) => !row.valid).length}
                </span>{" "}
                errors
              </div>
            </div>
          </div>

          {importRows.length > 0 ? (
            <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Row</th>
                    <th className="px-3 py-2 font-semibold">Outlet</th>
                    <th className="px-3 py-2 font-semibold">Area</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {importRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-3 py-2 text-slate-500">
                        {row.rowNumber}
                      </td>

                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">
                          {row.outletName || "—"}
                        </div>
                        {row.errors.length > 0 && (
                          <div className="mt-1 text-xs text-red-600">
                            {row.errors[0]}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 text-slate-700">
                        {row.areaCode || "—"}
                      </td>

                      <td className="px-3 py-2">
                        {row.valid ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            {row.status}
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                            Invalid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
              No rows to preview.
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={closeImportModal}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={confirmImport}
              disabled={
                importRows.filter((row) => row.valid)
                  .length === 0
              }
            >
              Import Valid Rows
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={isDeleteModalOpen}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setSelectedOutlet(undefined);
        }}
        onConfirm={confirmDelete}
        title="Delete Outlet"
        message={`Are you sure you want to delete "${selectedOutlet?.outletName}"? This action cannot be undone.`}
      />

    </div>
  );
}