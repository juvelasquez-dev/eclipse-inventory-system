import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Store,
  MapPin,
  ListFilter,
  Upload,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
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
  OutletStatus,
} from "../../types/inventory";

import {
  downloadOutletTemplate,
  downloadFailedOutletImports,
  downloadFailedOutletUpdates,
  exportOutletsExcel,
  importValidatedOutletRows,
  readOutletImportRows,
  readOutletUpdateRows,
  validateOutletImportRows,
  validateOutletUpdateRows,
  type OutletImportValidationResult,
  type OutletUpdateValidationResult,
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
  const updateFileInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] =
    useState("");

  const [areaFilter, setAreaFilter] =
    useState("ALL");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(10);

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

  const [importComplete, setImportComplete] =
    useState(false);

  const [importedCount, setImportedCount] =
    useState(0);

  const [updateRows, setUpdateRows] =
    useState<OutletUpdateValidationResult[]>([]);

  const [isUpdateModalOpen, setIsUpdateModalOpen] =
    useState(false);

  const [updateLoading, setUpdateLoading] =
    useState(false);

  const [updateComplete, setUpdateComplete] =
    useState(false);

  const [updatedCount, setUpdatedCount] =
    useState(0);

  const [unchangedCount, setUnchangedCount] =
    useState(0);

  const filteredOutlets = useMemo(() => {
    const searchTerm =
      search.trim().toLowerCase();

    return outlets.filter((outlet) => {
      const matchesSearch =
        !searchTerm ||
        [
          outlet.outletName,
          outlet.contactPerson,
          outlet.degicNumber,
          outlet.contactNumber,
          outlet.completeAddress,
          outlet.tin ?? "",
          outlet.idType ?? "",
          outlet.idNumber ?? "",
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

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOutlets.length / pageSize)
  );

  const paginatedOutlets = useMemo(() => {
    const startIndex =
      (currentPage - 1) * pageSize;

    return filteredOutlets.slice(
      startIndex,
      startIndex + pageSize
    );
  }, [filteredOutlets, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage((page) =>
      Math.min(page, totalPages)
    );
  }, [totalPages]);

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

  const pageNumbers = Array.from(
    { length: totalPages },
    (_, index) => index + 1
  );

  const showingStart =
    filteredOutlets.length === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(
    currentPage * pageSize,
    filteredOutlets.length
  );

  function clearSearch() {
    setSearch("");
    setCurrentPage(1);
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

    try {
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
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to save outlet."
      );
    }
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
    setImportComplete(false);
    setImportedCount(0);
  }

  function closeUpdateModal() {
    setIsUpdateModalOpen(false);
    setUpdateRows([]);
    setUpdateComplete(false);
    setUpdatedCount(0);
    setUnchangedCount(0);
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
      setImportComplete(false);
      setImportedCount(0);
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

  async function handleUpdateFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUpdateLoading(true);

    try {
      const rows = await readOutletUpdateRows(file);
      setUpdateRows(validateOutletUpdateRows(rows, outlets));
      setUpdateComplete(false);
      setUpdatedCount(0);
      setUnchangedCount(0);
      setIsUpdateModalOpen(true);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Unable to read the outlet update file.",
        "error"
      );
    } finally {
      setUpdateLoading(false);
      event.target.value = "";
    }
  }

  async function confirmUpdateImport() {
    setUpdateLoading(true);
    let successfulUpdates = 0;
    const results = updateRows.map((row) => ({
      ...row,
      errors: [...row.errors],
    }));

    for (const row of results) {
      if (row.rowStatus !== "changed") continue;

      const existingOutlet = outlets.find(
        (outlet) => outlet.id === row.outletId
      );

      if (!existingOutlet) {
        row.valid = false;
        row.rowStatus = "failed";
        row.errors.push("Outlet ID not found.");
        continue;
      }

      try {
        const result = await updateOutlet({
          ...existingOutlet,
          id: existingOutlet.id,
          outletName: row.outletName,
          contactPerson: row.contactPerson,
          degicNumber: row.degicNumber,
          contactNumber: row.contactNumber,
          completeAddress: row.completeAddress,
          areaCode: row.areaCode,
          tin: row.tin,
          idType: row.idType,
          idNumber: row.idNumber,
          status: row.status as OutletStatus,
        });

        if (result.success) {
          successfulUpdates += 1;
          row.rowStatus = "updated";
        } else {
          row.valid = false;
          row.rowStatus = "failed";
          row.errors.push(result.message || "Failed to update outlet.");
        }
      } catch (error) {
        row.valid = false;
        row.rowStatus = "failed";
        row.errors.push(
          error instanceof Error ? error.message : "Failed to update outlet."
        );
      }
    }

    setUpdateRows(results);
    setUpdatedCount(successfulUpdates);
    setUnchangedCount(
      results.filter((row) => row.rowStatus === "unchanged").length
    );
    setUpdateComplete(true);
    setUpdateLoading(false);
  }

  async function confirmImport() {
    setImportLoading(true);
    const result = await importValidatedOutletRows(importRows, addOutlet);
    setImportRows(result.failedRows);
    setImportedCount(result.importedCount);
    setImportComplete(true);
    setImportLoading(false);
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
                {importLoading ? "Reading..." : "Import Outlets"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => updateFileInputRef.current?.click()}
                className="gap-2"
              >
                <RefreshCw size={16} />
                {updateLoading ? "Processing..." : "Update Existing Outlets"}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleImportFileChange}
              />

              <input
                ref={updateFileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleUpdateFileChange}
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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search outlets by name, contact, address..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[28rem]">
                <Select
                  label="Area"
                  value={areaFilter}
                  onChange={(e) => {
                    setAreaFilter(e.target.value);
                    setCurrentPage(1);
                  }}
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
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
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
            <>
              <OutletTable
                outlets={paginatedOutlets}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-slate-500">
                  Showing {showingStart}–{showingEnd} of {filteredOutlets.length} outlets
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    label="Per page"
                    value={String(pageSize)}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    options={[
                      { label: "10 / page", value: "10" },
                      { label: "20 / page", value: "20" },
                      { label: "50 / page", value: "50" },
                    ]}
                  />

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => page - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {totalPages > 1 && pageNumbers.map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          aria-label={`Go to page ${page}`}
                          aria-current={currentPage === page ? "page" : undefined}
                          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium transition ${
                            currentPage === page
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                          }`}
                        >
                          {page}
                        </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => page + 1)}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
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
        title={importComplete ? "Import Complete" : "Import Outlets"}
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {importComplete ? (
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-emerald-700">
                  {importedCount} outlet{importedCount === 1 ? "" : "s"} imported successfully
                </p>
                <p className="font-semibold text-red-600">
                  {importRows.length} outlet{importRows.length === 1 ? "" : "s"} failed
                </p>
                {importRows.length === 0 && (
                  <p className="pt-2 text-slate-600">All rows were imported successfully.</p>
                )}
              </div>
            ) : (
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
            )}
          </div>

          {importComplete ? (
            importRows.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Failed Outlets</h3>
                <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Excel Row</th>
                        <th className="px-3 py-2 font-semibold">Outlet Name</th>
                        <th className="px-3 py-2 font-semibold">Area</th>
                        <th className="px-3 py-2 font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {row.outletName || row.originalData?.["Outlet Name"] || "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {row.areaCode || row.originalData?.Area || row.originalData?.["Area Code"] || "—"}
                          </td>
                          <td className="px-3 py-2 text-red-600">{row.errors.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null
          ) : importRows.length > 0 ? (
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

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
            {importComplete ? (
              <>
                {importRows.length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => downloadFailedOutletImports(importRows)}
                    className="gap-2"
                  >
                    <Download size={16} /> Download Invalid Rows
                  </Button>
                )}
                <Button type="button" onClick={closeImportModal}>Close</Button>
              </>
            ) : (
              <>
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
                  disabled={importLoading || importRows.length === 0}
                >
                  {importLoading ? "Importing..." : "Import Valid Rows"}
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Update Existing Outlets */}
      <Modal
        open={isUpdateModalOpen}
        onClose={closeUpdateModal}
        title={updateComplete ? "Update Complete" : "Update Existing Outlets"}
      >
        <div className="space-y-5">
          {updateComplete ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-emerald-700">
                {updatedCount} outlet{updatedCount === 1 ? "" : "s"} updated
              </p>
              <p className="mt-1 text-slate-600">
                {unchangedCount} outlet{unchangedCount === 1 ? "" : "s"} unchanged
              </p>
              <p className="mt-1 text-red-600">
                {updateRows.filter((row) => row.rowStatus === "failed").length} failed
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>{updateRows.length} rows</span>
                <span className="text-amber-700">
                  {updateRows.filter((row) => row.rowStatus === "changed").length} changed
                </span>
                <span className="text-slate-600">
                  {updateRows.filter((row) => row.rowStatus === "unchanged").length} unchanged
                </span>
                <span className="text-red-600">
                  {updateRows.filter((row) => row.rowStatus === "failed").length} failed
                </span>
              </div>
            </div>
          )}

          {!updateComplete && (
            <p className="text-sm text-slate-600">
              Only rows with an existing Outlet ID will be updated. This workflow never creates outlets.
            </p>
          )}

          <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Row</th>
                  <th className="px-3 py-2 font-semibold">Outlet</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {updateRows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.outletId}`}>
                      <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.outletName || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                          row.rowStatus === "failed"
                            ? "bg-red-50 text-red-700"
                            : row.rowStatus === "changed"
                              ? "bg-amber-50 text-amber-700"
                              : row.rowStatus === "updated"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                        }`}>
                          {row.rowStatus === "updated"
                            ? "Updated"
                            : row.rowStatus.charAt(0).toUpperCase() + row.rowStatus.slice(1)}
                        </span>
                      </td>
                      <td className={`px-3 py-2 ${row.rowStatus === "failed" ? "text-red-600" : "text-slate-600"}`}>
                        {row.rowStatus === "failed"
                          ? row.errors.join(" ")
                          : row.rowStatus === "unchanged"
                            ? "No changes"
                            : row.changedFields.join(", ")}
                      </td>
                    </tr>
                  ))}
                {!updateComplete && updateRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                      No data rows found in the selected file.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            {updateComplete && updateRows.some((row) => row.rowStatus === "failed") && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => downloadFailedOutletUpdates(updateRows)}
                className="gap-2"
              >
                <Download size={16} /> Download Invalid Rows
              </Button>
            )}
            {!updateComplete ? (
              <>
                <Button type="button" variant="secondary" onClick={closeUpdateModal}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={confirmUpdateImport}
                  disabled={updateLoading || !updateRows.some((row) => row.rowStatus === "changed")}
                >
                  {updateLoading
                    ? "Updating..."
                    : updateRows.some((row) => row.rowStatus === "changed")
                      ? `Update ${updateRows.filter((row) => row.rowStatus === "changed").length} Outlet${updateRows.filter((row) => row.rowStatus === "changed").length === 1 ? "" : "s"}`
                      : "No Changes to Update"}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={closeUpdateModal}>Close</Button>
            )}
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