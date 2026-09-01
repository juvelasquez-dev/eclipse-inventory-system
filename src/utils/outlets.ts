import * as XLSX from "xlsx";

import type {
  Outlet,
  OutletStatus,
} from "../types/inventory";

export type OutletAreaCode =
  | "IAO"
  | "CBR"
  | "EFT";

export interface OutletImportRow {
  rowNumber: number;
  outletName: string;
  contactPerson: string;
  contactNumber: string;
  completeAddress: string;
  areaCode: string;
  tin: string;
  status: string;
}

export interface OutletImportValidationResult
  extends OutletImportRow {
  valid: boolean;
  duplicate: boolean;
  errors: string[];
}

const VALID_AREAS = new Set<OutletAreaCode>([
  "IAO",
  "CBR",
  "EFT",
]);

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown): string {
  const text = normalizeText(value).toLowerCase();

  if (text === "inactive") {
    return "Inactive";
  }

  return "Active";
}

function normalizeAreaCode(value: unknown): string {
  const text = normalizeText(value).toUpperCase();

  return VALID_AREAS.has(text as OutletAreaCode)
    ? text
    : text;
}

function normalizeOutletKey(value: string): string {
  return value.trim().toLowerCase();
}

export function readOutletImportRows(
  file: File
): Promise<OutletImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;

        if (!data) {
          reject(
            new Error(
              "Unable to read the outlet file."
            )
          );
          return;
        }

        const workbook = XLSX.read(data, {
          type: "array",
          cellDates: true,
        });

        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
          reject(
            new Error(
              "The selected file does not contain a worksheet."
            )
          );
          return;
        }

        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(sheet, {
          defval: "",
          raw: false,
        });

        const result: OutletImportRow[] = rows.map(
          (row, index) => ({
            rowNumber: index + 2,
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
              row["TIN"] ??
                row["tin"]
            ),
            status: normalizeStatus(
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

export function validateOutletImportRows(
  rows: OutletImportRow[],
  existingOutlets: Outlet[]
): OutletImportValidationResult[] {
  const seenKeys = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];

    const outletName = row.outletName.trim();
    const contactPerson = row.contactPerson.trim();
    const contactNumber = row.contactNumber.trim();
    const completeAddress = row.completeAddress.trim();
    const areaCode = row.areaCode.trim().toUpperCase();
    const tin = row.tin.trim();
    const status =
      row.status.trim() || "Active";

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

    const normalizedStatus =
      status === "Inactive"
        ? "Inactive"
        : "Active";

    const duplicateKey =
      outletName && completeAddress
        ? `${normalizeOutletKey(
            outletName
          )}|${normalizeOutletKey(
            completeAddress
          )}`
        : "";

    const duplicateExists =
      duplicateKey !== "" &&
      (existingOutlets.some(
        (outlet) =>
          normalizeOutletKey(
            outlet.outletName
          ) ===
            normalizeOutletKey(
              outletName
            ) &&
          normalizeOutletKey(
            outlet.completeAddress
          ) ===
            normalizeOutletKey(
              completeAddress
            )
      ) ||
        seenKeys.has(duplicateKey));

    if (duplicateExists) {
      errors.push(
        "Duplicate outlet detected using the same Outlet Name and Complete Address."
      );
    }

    if (duplicateKey) {
      seenKeys.add(duplicateKey);
    }

    return {
      rowNumber: row.rowNumber,
      outletName,
      contactPerson,
      contactNumber,
      completeAddress,
      areaCode: areaCode || "",
      tin,
      status: normalizedStatus,
      valid: errors.length === 0,
      duplicate: duplicateExists,
      errors,
    };
  });
}

export function exportOutletsWorkbook(
  outlets: Outlet[]
): XLSX.WorkBook {
  const rows = outlets.map((outlet) => ({
    "Outlet Name": outlet.outletName,
    "Contact Person": outlet.contactPerson,
    "Contact Number": outlet.contactNumber,
    "Complete Address": outlet.completeAddress,
    "Area Code": outlet.areaCode,
    TIN: outlet.tin || "",
    Status: outlet.status,
    "Date Created": outlet.createdAt
      ? new Date(outlet.createdAt).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "N/A",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    "Outlets"
  );

  return workbook;
}

export function exportOutletsExcel(
  outlets: Outlet[]
) {
  const workbook = exportOutletsWorkbook(outlets);

  XLSX.writeFile(
    workbook,
    `outlets-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`
  );
}

export function downloadOutletTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([
    {
      "Outlet Name": "Sample Outlet",
      "Contact Person": "Juan Dela Cruz",
      "Contact Number": "09171234567",
      "Complete Address": "123 Main St, Cebu City",
      "Area Code": "IAO",
      TIN: "123-456-789",
      Status: "Active",
    },
  ]);

  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    "Template"
  );

  XLSX.writeFile(
    workbook,
    "outlet-import-template.xlsx"
  );
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
    }));

  const summarySheet = XLSX.utils.json_to_sheet([
    { Metric: "Total Outlets", Value: summary["Total Outlets"] },
    { Metric: "Active Outlets", Value: summary["Active Outlets"] },
    { Metric: "Inactive Outlets", Value: summary["Inactive Outlets"] },
    { Metric: "Outlets Without TIN", Value: summary["Outlets Without TIN"] },
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
    `outlet-report-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`
  );
}

export function parseOutletStatus(
  value: string
): OutletStatus {
  const normalized = value.trim();

  return normalized === "Inactive" ? "Inactive" : "Active";
}
