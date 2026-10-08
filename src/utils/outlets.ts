import * as XLSX from "xlsx";

import { todayBusinessKey } from "./businessDate";

import type {
  Outlet,
  OutletStatus,
} from "../types/inventory";

export type OutletAreaCode = "IAO" | "CBR" | "EFT";

export interface OutletImportRow {
  rowNumber: number;
  originalData?: Record<string, string>;
  outletName: string;
  contactPerson: string;
  degicNumber: string;
  contactNumber: string;
  completeAddress: string;
  areaCode: string;
  tin: string;
  idType: string;
  idNumber: string;
  status: string;
}

export interface OutletImportValidationResult extends OutletImportRow {
  valid: boolean;
  duplicate: boolean;
  errors: string[];
}

export interface OutletUpdateImportRow extends OutletImportRow {
  outletId: string;
}

export interface OutletUpdateValidationResult extends OutletUpdateImportRow {
  valid: boolean;
  duplicate: boolean;
  errors: string[];
  rowStatus: "changed" | "unchanged" | "failed" | "updated";
  changedFields: string[];
}

const VALID_AREAS = new Set<OutletAreaCode>(["IAO", "CBR", "EFT"]);

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function validateOutletIdentification({
  tin,
  idType,
  idNumber,
}: {
  tin?: string;
  idType?: string;
  idNumber?: string;
}): string {
  const normalizedTin = normalizeText(tin);
  const normalizedIdType = normalizeText(idType);
  const normalizedIdNumber = normalizeText(idNumber);
  if (normalizedTin) return "";
  if (!normalizedIdType && !normalizedIdNumber) {
    return "Please provide a TIN or a valid ID Type and ID Number.";
  }
  if (!normalizedIdType) return "ID Type is required when TIN is not provided.";
  if (!normalizedIdNumber) return "ID Number is required when TIN is not provided.";
  return "";
}

function normalizeAreaCode(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

export function normalizeOutletText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function normalizeOutletAddress(value: unknown): string {
  const tokens = normalizeOutletText(value)
    .split(" ")
    .flatMap((token) => {
      const attached = token.match(/^(blk|bk|bl|lt|ph|prk|l|p)(\d+[a-z]?)$/);
      return attached ? [attached[1], attached[2]] : [token];
    });

  return tokens
    .map((token, index) => {
      // Single letters are only abbreviations when directly followed by a number.
      if (NUMBER_ONLY_ABBREVIATIONS[token]) {
        return /^\d/.test(tokens[index + 1] ?? "")
          ? NUMBER_ONLY_ABBREVIATIONS[token]
          : token;
      }
      return ADDRESS_ABBREVIATIONS[token] ?? token;
    })
    .join(" ");
}

const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  blk: "block",
  bk: "block",
  bl: "block",
  lt: "lot",
  ph: "phase",
  prk: "purok",
  brgy: "barangay",
};

const NUMBER_ONLY_ABBREVIATIONS: Record<string, string> = {
  l: "lot",
  p: "phase",
};
export interface OutletIdentity {
  outletName: string;
  completeAddress: string;
}

export function isSameOutletNameAndAddress(
  a: Pick<OutletIdentity, "outletName" | "completeAddress">,
  b: Pick<OutletIdentity, "outletName" | "completeAddress">
): boolean {
  const name = normalizeOutletText(a.outletName);
  const address = normalizeOutletText(a.completeAddress);
  return (
    name !== "" &&
    address !== "" &&
    name === normalizeOutletText(b.outletName) &&
    address === normalizeOutletText(b.completeAddress)
  );
}

export const DUPLICATE_ADDRESS_MESSAGE =
  "Duplicate address: this outlet address matches an existing outlet.";

export function hasDuplicateOutletAddress(
  completeAddress: string,
  knownAddresses: Iterable<string>
): boolean {
  const address = normalizeOutletAddress(completeAddress);
  if (!address) return false;
  for (const known of knownAddresses) {
    if (normalizeOutletAddress(known) === address) return true;
  }
  return false;
}
function createOutletWorksheet(rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [{ hidden: true }];
  return worksheet;
}

export function readOutletImportRows(file: File): Promise<OutletImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) {
          reject(new Error("Unable to read the outlet file."));
          return;
        }

        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error("The selected file does not contain a worksheet."));
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const headerRow = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        })[0] ?? [];
        const hasOutletId = headerRow.some((header) =>
          ["outlet id", "outletid", "outlet_id", "id"].includes(
            normalizeText(header).toLowerCase()
          )
        );

        if (hasOutletId) {
          reject(new Error("This file contains an Outlet ID. Use Update Existing Outlets instead."));
          return;
        }

        const rows = XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(sheet, {
          defval: "",
          raw: false,
        });

        const result: OutletImportRow[] = rows.map(
          (row, index) => ({
            rowNumber: index + 2,
            originalData: Object.fromEntries(
              Object.entries(row).map(([key, value]) => [
                key,
                String(value ?? ""),
              ])
            ),
            outletName: normalizeText(
              row["Outlet Name"] ??
                row["outletName"] ??
                row["Outlet"] ??
                row["outlet_name"]
            ),
            contactPerson: normalizeText(
              row["Contact Person"] ??
                row["contactPerson"] ??
                row["contact_person"]
            ),
            degicNumber: normalizeText(
              row["DEGIC Number"] ??
                row["degicNumber"] ??
                row["degic_number"]
            ),
            contactNumber: normalizeText(
              row["Contact Number"] ??
                row["contactNumber"] ??
                row["contact_number"]
            ),
            completeAddress: normalizeText(
              row["Complete Address"] ??
                row["completeAddress"] ??
                row["complete_address"]
            ),
            areaCode: normalizeAreaCode(
              row["Area Code"] ??
                row["areaCode"] ??
                row["area_code"]
            ),
            tin: normalizeText(
              row["TIN"] ?? row["tin"]
            ),
            idType: normalizeText(
              row["ID Type"] ??
                row["idType"] ??
                row["id_type"]
            ),
            idNumber: normalizeText(
              row["ID Number"] ??
                row["idNumber"] ??
                row["id_number"]
            ),
            status: normalizeText(
              row["Status"] ??
                row["status"]
            ),
          })
        );

        resolve(result);
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error(
                "Failed to process the outlet file."
              )
        );
      }
    };

    reader.onerror = () => {
      reject(
        new Error(
          "Failed to read the outlet file."
        )
      );
    };

    reader.readAsArrayBuffer(file);
  });
}

export function readOutletUpdateRows(
  file: File
): Promise<OutletUpdateImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;

        if (!data) {
          reject(new Error("Unable to read the outlet file."));
          return;
        }

        const workbook = XLSX.read(data, {
          type: "array",
          cellDates: true,
        });
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
          reject(new Error("The selected file does not contain a worksheet."));
          return;
        }

        const values = XLSX.utils.sheet_to_json<unknown[]>(
          workbook.Sheets[sheetName],
          { header: 1, defval: "", raw: false, blankrows: true }
        );
        const headers = (values[0] ?? []).map((header) =>
          normalizeText(header).toLowerCase()
        );
        const column = (...names: string[]) =>
          headers.findIndex((header) => names.includes(header));
        const readCell = (row: unknown[], ...names: string[]) => {
          const index = column(...names);
          return index < 0 ? "" : normalizeText(row[index]);
        };

        const rows = values.slice(1).flatMap((valuesRow, index) => {
          const row = valuesRow as unknown[];
          if (!row.some((cell) => normalizeText(cell))) return [];

          return [{
            rowNumber: index + 2,
            outletId: readCell(row, "outlet id", "outletid", "outlet_id", "id"),
            outletName: readCell(row, "outlet name", "outletname", "outlet", "outlet_name"),
            contactPerson: readCell(row, "contact person", "contactperson", "contact_person"),
            degicNumber: readCell(row, "degic number", "degicnumber", "degic_number"),
            contactNumber: readCell(row, "contact number", "contactnumber", "contact_number"),
            completeAddress: readCell(row, "complete address", "completeaddress", "complete_address"),
            areaCode: normalizeAreaCode(readCell(row, "area", "area code", "areacode", "area_code")),
            tin: readCell(row, "tin"),
            idType: readCell(row, "id type", "idtype", "id_type"),
            idNumber: readCell(row, "id number", "idnumber", "id_number"),
            status: readCell(row, "status"),
          }];
        });

        resolve(rows);
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("Failed to process the outlet file.")
        );
      }
    };

    reader.onerror = () => reject(new Error("Failed to read the outlet file."));
    reader.readAsArrayBuffer(file);
  });
}

export function validateOutletUpdateRows(
  rows: OutletUpdateImportRow[],
  existingOutlets: Outlet[]
): OutletUpdateValidationResult[] {
  const seenIdentities: Pick<OutletIdentity, "outletName" | "completeAddress">[] = [];
  const seenIds = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    const outletId = row.outletId.trim();
    const outletName = row.outletName.trim();
    const contactPerson = row.contactPerson.trim();
    const degicNumber = row.degicNumber.trim();
    const contactNumber = row.contactNumber.trim();
    const completeAddress = row.completeAddress.trim();
    const areaCode = row.areaCode.trim().toUpperCase();
    const tin = row.tin.trim();
    const idType = row.idType.trim();
    const idNumber = row.idNumber.trim();
    const statusText = row.status.trim();
    const statusLower = statusText.toLowerCase();
    const status = statusLower === "active"
      ? "Active"
      : statusLower === "inactive"
        ? "Inactive"
        : "";
    const existingOutlet = existingOutlets.find(
      (outlet) => outlet.id === outletId
    );

    if (!outletId || !existingOutlet) {
      return {
        ...row,
        outletId,
        valid: false,
        duplicate: false,
        errors: [outletId ? "Outlet ID not found." : "Outlet ID is required."],
        rowStatus: "failed",
        changedFields: [],
      };
    }

    if (outletId && seenIds.has(outletId)) {
      errors.push("Outlet ID appears more than once in the update file.");
    }
    if (outletId) seenIds.add(outletId);

    if (!outletName) errors.push("Outlet Name is required.");
    if (!contactPerson) errors.push("Contact Person is required.");
    if (!contactNumber) errors.push("Contact Number is required.");
    if (!completeAddress) errors.push("Complete Address is required.");
    if (!areaCode) {
      errors.push("Area is required.");
    } else if (!VALID_AREAS.has(areaCode as OutletAreaCode)) {
      errors.push("Area must be one of: IAO, CBR, EFT.");
    }
    if (!status) errors.push("Status must be Active or Inactive.");

    const identificationError = validateOutletIdentification({ tin, idType, idNumber });
    if (identificationError) errors.push(identificationError);

    const candidateIdentity = { outletName, completeAddress };
    const duplicateExists =
      existingOutlets.some((outlet) =>
        outlet.id !== outletId && isSameOutletNameAndAddress(outlet, candidateIdentity)
      ) || seenIdentities.some((seen) => isSameOutletNameAndAddress(seen, candidateIdentity));

    if (duplicateExists) {
      errors.push("Duplicate Outlet Name + Address.");
    }
    seenIdentities.push(candidateIdentity);

    const changedFields: string[] = [];
    const fieldComparisons: [string, string | undefined, string | undefined][] = [
      ["Outlet Name", outletName, existingOutlet.outletName],
      ["Contact Person", contactPerson, existingOutlet.contactPerson],
      ["Contact Number", contactNumber, existingOutlet.contactNumber],
      ["Complete Address", completeAddress, existingOutlet.completeAddress],
      ["Area", areaCode.toUpperCase(), existingOutlet.areaCode?.trim().toUpperCase()],
      ["TIN", tin, existingOutlet.tin],
      ["ID Type", idType, existingOutlet.idType],
      ["ID Number", idNumber, existingOutlet.idNumber],
      ["DEGIC Number", degicNumber, existingOutlet.degicNumber],
      ["Status", status.toLowerCase(), existingOutlet.status?.toLowerCase()],
    ];

    for (const [label, uploadedValue, currentValue] of fieldComparisons) {
      if (normalizeText(uploadedValue) !== normalizeText(currentValue)) {
        changedFields.push(label);
      }
    }

    return {
      ...row,
      outletId,
      outletName,
      contactPerson,
      degicNumber,
      contactNumber,
      completeAddress,
      areaCode,
      tin,
      idType,
      idNumber,
      status: status || statusText,
      valid: errors.length === 0,
      duplicate: duplicateExists,
      errors,
      rowStatus: errors.length > 0
        ? "failed"
        : changedFields.length > 0
          ? "changed"
          : "unchanged",
      changedFields,
    };
  });
}

export function exportMissingDegicOutlets(outlets: Outlet[]) {
  const rows = outlets.map((outlet) => ({
    "Outlet ID": outlet.id,
    "Outlet Name": outlet.outletName,
    "Contact Person": outlet.contactPerson,
    "Contact Number": outlet.contactNumber,
    "Complete Address": outlet.completeAddress,
    Area: outlet.areaCode,
    TIN: outlet.tin || "",
    "ID Type": outlet.idType || "",
    "ID Number": outlet.idNumber || "",
    "DEGIC Number": "",
    Status: outlet.status,
  }));
  const workbook = XLSX.utils.book_new();
  const worksheet = createOutletWorksheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Missing DEGIC");
  XLSX.writeFile(workbook, `outlets-missing-degic-${todayBusinessKey()}.xlsx`);
}

export function downloadFailedOutletUpdates(
  rows: OutletUpdateValidationResult[]
) {
  const failedRows = rows.filter((row) => row.rowStatus === "failed");
  const workbookRows = failedRows.map((row) => ({
    "Excel Row": row.rowNumber,
    "Outlet ID": row.outletId,
    "Outlet Name": row.outletName,
    "Contact Person": row.contactPerson,
    "Contact Number": row.contactNumber,
    "Complete Address": row.completeAddress,
    Area: row.areaCode,
    TIN: row.tin,
    "ID Type": row.idType,
    "ID Number": row.idNumber,
    "DEGIC Number": row.degicNumber,
    Status: row.status,
    "Error / Reason": row.errors.join("; "),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(workbookRows), "Failed Updates");
  XLSX.writeFile(workbook, `outlet-update-failures-${todayBusinessKey()}.xlsx`);
}

export function validateOutletImportRows(
  rows: OutletImportRow[],
  existingOutlets: Outlet[]
): OutletImportValidationResult[] {
  const seenAddresses: string[] = [];

  return rows.map((row) => {
    const errors: string[] = [];

    const outletName = row.outletName.trim();
    const contactPerson = row.contactPerson.trim();
    const degicNumber = row.degicNumber.trim();
    const contactNumber = row.contactNumber.trim();
    const completeAddress = row.completeAddress.trim();
    const areaCode = row.areaCode.trim().toUpperCase();
    const tin = row.tin.trim();
    const idType = row.idType.trim();
    const idNumber = row.idNumber.trim();
    const status = row.status.trim() || "Active";

    if (!outletName) {
      errors.push(
        "Outlet Name is required."
      );
    }

    if (!contactPerson) {
      errors.push(
        "Contact Person is required."
      );
    }

    if (!contactNumber) {
      errors.push(
        "Contact Number is required."
      );
    }

    if (!completeAddress) {
      errors.push(
        "Complete Address is required."
      );
    }

    if (!areaCode) {
      errors.push(
        "Area Code is required."
      );
    } else if (
      !VALID_AREAS.has(
        areaCode as OutletAreaCode
      )
    ) {
      errors.push(
        "Area Code must be one of: IAO, CBR, EFT."
      );
    }

    if (
      status !== "Active" &&
      status !== "Inactive"
    ) {
      errors.push(
        "Status must be Active or Inactive."
      );
    }

    const identificationError = validateOutletIdentification({
      tin,
      idType,
      idNumber,
    });

    if (identificationError) {
      errors.push(identificationError);
    }

    const normalizedStatus =
      status === "Inactive"
        ? "Inactive"
        : "Active";

    const duplicateExists = hasDuplicateOutletAddress(completeAddress, [
      ...existingOutlets.map((outlet) => outlet.completeAddress),
      ...seenAddresses,
    ]);

    if (duplicateExists) {
      errors.push(DUPLICATE_ADDRESS_MESSAGE);
    }

    seenAddresses.push(completeAddress);
    return {
      rowNumber: row.rowNumber,
      originalData: row.originalData,
      outletName,
      contactPerson,
      degicNumber,
      contactNumber,
      completeAddress,
      areaCode: areaCode || "",
      tin,
      idType,
      idNumber,
      status: normalizedStatus,
      valid: errors.length === 0,
      duplicate: duplicateExists,
      errors,
    };
  });

}

export function exportFailedOutletImportsWorkbook(
  rows: OutletImportValidationResult[]
): XLSX.WorkBook {
  const failedRows = rows.filter((row) => !row.valid);
  const workbookRows = failedRows.map((row) => ({
    "Excel Row": row.rowNumber,
    ...(row.originalData ?? {
      "Outlet Name": row.outletName,
      "Contact Person": row.contactPerson,
      "DEGIC Number": row.degicNumber,
      "Contact Number": row.contactNumber,
      "Complete Address": row.completeAddress,
      "Area Code": row.areaCode,
      TIN: row.tin,
      "ID Type": row.idType,
      "ID Number": row.idNumber,
      Status: row.status,
    }),
    "Error / Reason": row.errors.join("; "),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(workbookRows),
    "Failed Imports"
  );
  return workbook;
}

export function downloadFailedOutletImports(
  rows: OutletImportValidationResult[]
) {
  XLSX.writeFile(
    exportFailedOutletImportsWorkbook(rows),
    `outlet-import-failures-${todayBusinessKey()}.xlsx`
  );
}

export function exportOutletsWorkbook(
  outlets: Outlet[]
): XLSX.WorkBook {
  const rows = outlets.map((outlet) => ({
    "Outlet ID": outlet.id,
    "Outlet Name": outlet.outletName,
    "Contact Person": outlet.contactPerson,
    "DEGIC Number": outlet.degicNumber || "",
    "Contact Number": outlet.contactNumber,
    "Complete Address": outlet.completeAddress,
    "Area Code": outlet.areaCode,
    TIN: outlet.tin || "",
    "ID Type": outlet.idType || "",
    "ID Number": outlet.idNumber || "",
    Status: outlet.status,
    "Date Created": outlet.createdAt
      ? new Date(outlet.createdAt).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "N/A",
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    createOutletWorksheet(rows),
    "Outlets"
  );
  return workbook;
}

export async function importValidatedOutletRows(
  rows: OutletImportValidationResult[],
  addOutlet: (
    outlet: Omit<Outlet, "id" | "createdAt" | "updatedAt">
  ) => Promise<{ success: boolean; message?: string }>
): Promise<{
  importedCount: number;
  failedRows: OutletImportValidationResult[];
}> {
  let importedCount = 0;
  const failedRows = rows
    .filter((row) => !row.valid)
    .map((row) => ({ ...row, errors: [...row.errors] }));
  for (const row of rows.filter((item) => item.valid)) {
    try {
      const result = await addOutlet({
        outletName: row.outletName,
        contactPerson: row.contactPerson,
        degicNumber: row.degicNumber,
        contactNumber: row.contactNumber,
        completeAddress: row.completeAddress,
        areaCode: row.areaCode,
        tin: row.tin,
        idType: row.idType,
        idNumber: row.idNumber,
        status: parseOutletStatus(row.status),
      });
      if (result.success) {
        importedCount += 1;
      } else {
        failedRows.push({
          ...row,
          valid: false,
          errors: [...row.errors, result.message || "Failed to import."],
        });
      }
    } catch (error) {
      failedRows.push({
        ...row,
        valid: false,
        errors: [
          ...row.errors,
          error instanceof Error ? error.message : "Failed to import.",
        ],
      });
    }
  }
  return { importedCount, failedRows };
}

export function exportOutletsExcel(outlets: Outlet[]) {
  XLSX.writeFile(
    exportOutletsWorkbook(outlets),
    `outlets-${todayBusinessKey()}.xlsx`
  );
}

export function downloadOutletTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([{
    "Outlet Name": "Sample Outlet",
    "Contact Person": "Juan Dela Cruz",
    "DEGIC Number": "DEGIC-0001",
    "Contact Number": "09171234567",
    "Complete Address": "123 Main St, Cebu City",
    "Area Code": "IAO",
    TIN: "123-456-789",
    "ID Type": "Driver's License",
    "ID Number": "N01-123456",
    Status: "Active",
  }]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Template");
  XLSX.writeFile(workbook, "outlet-import-template.xlsx");
}

export function exportOutletReportWorkbook(
  outlets: Outlet[]
): XLSX.WorkBook {
  const areaOrder: OutletAreaCode[] = [
    "IAO",
    "CBR",
    "EFT",
  ];

  const summary = {
    "Total Outlets": outlets.length,
    "Active Outlets": outlets.filter(
      (outlet) => outlet.status === "Active"
    ).length,
    "Inactive Outlets": outlets.filter(
      (outlet) => outlet.status === "Inactive"
    ).length,
    "Outlets Without TIN": outlets.filter(
      (outlet) => !outlet.tin || !outlet.tin.trim()
    ).length,
    "Outlets Missing Identification": outlets.filter(
      (outlet) =>
        !outlet.tin?.trim() &&
        !(outlet.idType?.trim() && outlet.idNumber?.trim())
    ).length,
  };

  const areaDistribution = areaOrder.map((area) => {
    const areaOutlets = outlets.filter(
      (outlet) => outlet.areaCode === area
    );

    return {
      Area: area,
      Active: areaOutlets.filter(
        (outlet) => outlet.status === "Active"
      ).length,
      Inactive: areaOutlets.filter(
        (outlet) => outlet.status === "Inactive"
      ).length,
      Total: areaOutlets.length,
    };
  });

  const totalRow = {
    Area: "Total",
    Active: areaDistribution.reduce(
      (sum, item) => sum + item.Active,
      0
    ),
    Inactive: areaDistribution.reduce(
      (sum, item) => sum + item.Inactive,
      0
    ),
    Total: areaDistribution.reduce(
      (sum, item) => sum + item.Total,
      0
    ),
  };

  const recentOutlets = [...outlets]
    .sort((a, b) => {
      const aDate = a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0;
      const bDate = b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0;

      return bDate - aDate;
    })
    .slice(0, 5)
    .map((outlet) => ({
      "Outlet Name": outlet.outletName,
      Area: outlet.areaCode,
      "Contact Person": outlet.contactPerson,
      Status: outlet.status,
      "Date Added": outlet.createdAt
        ? new Date(
            outlet.createdAt
          ).toLocaleDateString(
            "en-PH",
            {
              year: "numeric",
              month: "short",
              day: "numeric",
            }
          )
        : "N/A",
      "Contact Number": outlet.contactNumber,
      "Complete Address": outlet.completeAddress,
      TIN: outlet.tin || "",
      "ID Type": outlet.idType || "",
      "ID Number": outlet.idNumber || "",
    }));

  const summarySheet = XLSX.utils.json_to_sheet([
    { Metric: "Total Outlets", Value: summary["Total Outlets"] },
    { Metric: "Active Outlets", Value: summary["Active Outlets"] },
    { Metric: "Inactive Outlets", Value: summary["Inactive Outlets"] },
    { Metric: "Outlets Without TIN", Value: summary["Outlets Without TIN"] },
    { Metric: "Outlets Missing Identification", Value: summary["Outlets Missing Identification"] },
  ]);

  const areaSheet = XLSX.utils.json_to_sheet([
    ...areaDistribution,
    totalRow,
  ]);

  const recentSheet = XLSX.utils.json_to_sheet(
    recentOutlets
  );

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    "Summary"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    areaSheet,
    "Area Distribution"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    recentSheet,
    "Recently Added"
  );

  return workbook;
}

export function exportOutletReportExcel(
  outlets: Outlet[]
) {
  const workbook = exportOutletReportWorkbook(outlets);

  XLSX.writeFile(
    workbook,
    `outlet-report-${todayBusinessKey()}.xlsx`
  );
}

export function parseOutletStatus(
  value: string
): OutletStatus {
  const normalized = value.trim();

  return normalized === "Inactive" ? "Inactive" : "Active";
}
