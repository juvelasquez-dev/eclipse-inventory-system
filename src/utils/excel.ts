import * as XLSX from "xlsx";

export interface ExcelStockRow {
  rowNumber: number;
  productCode: string;
  quantity: number;
  date?: string;
  remarks?: string;
}

export interface ExcelValidationResult
  extends ExcelStockRow {
  valid: boolean;
  errors: string[];
}

export function readStockExcel(
  file: File
): Promise<ExcelStockRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;

        if (!data) {
          reject(
            new Error(
              "Unable to read Excel file."
            )
          );
          return;
        }

        const workbook = XLSX.read(data, {
          type: "array",
          cellDates: true,
        });

        const sheetName =
          workbook.SheetNames[0];

        if (!sheetName) {
          reject(
            new Error(
              "Excel file does not contain a worksheet."
            )
          );
          return;
        }

        const sheet =
          workbook.Sheets[sheetName];

        const rows =
          XLSX.utils.sheet_to_json<
            Record<string, unknown>
          >(sheet, {
            defval: "",
            raw: false,
          });

        const result: ExcelStockRow[] =
          rows.map((row, index) => ({
            rowNumber: index + 2,

            productCode: String(
              row["Product Code"] ??
                row["productCode"] ??
                row["Code"] ??
                ""
            ).trim(),

            quantity: Number(
              row["Quantity"] ??
                row["quantity"] ??
                0
            ),

            date:
              String(
                row["Date"] ??
                  row["date"] ??
                  ""
              ).trim() || undefined,

            remarks:
              String(
                row["Remarks"] ??
                  row["remarks"] ??
                  ""
              ).trim() || undefined,
          }));

        resolve(result);
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error(
                "Failed to process Excel file."
              )
        );
      }
    };

    reader.onerror = () => {
      reject(
        new Error(
          "Failed to read Excel file."
        )
      );
    };

    reader.readAsArrayBuffer(file);
  });
}

export function validateStockRows(
  rows: ExcelStockRow[],
  products: {
    id: string;
    code: string;
  }[],
  mode: "IN" | "OUT",
  getProductStock: (
    productId: string
  ) => number
): ExcelValidationResult[] {
  const codeMap = new Map(
    products.map((product) => [
      product.code
        .trim()
        .toLowerCase(),
      product,
    ])
  );

  const quantityByProduct =
    new Map<string, number>();

  for (const row of rows) {
    const code =
      row.productCode
        .trim()
        .toLowerCase();

    quantityByProduct.set(
      code,
      (quantityByProduct.get(code) ??
        0) + row.quantity
    );
  }

  return rows.map((row) => {
    const errors: string[] = [];

    const code =
      row.productCode
        .trim()
        .toLowerCase();

    const product =
      codeMap.get(code);

    /*
     * Product validation
     */
    if (!row.productCode) {
      errors.push(
        "Product Code is required."
      );
    } else if (!product) {
      errors.push(
        "Product Code was not found."
      );
    }

    /*
     * Quantity validation
     */
    if (
      !Number.isFinite(
        row.quantity
      )
    ) {
      errors.push(
        "Quantity must be a valid number."
      );
    } else if (
      row.quantity <= 0
    ) {
      errors.push(
        "Quantity must be greater than 0."
      );
    }

    /*
     * Date validation
     */
    if (row.date) {
      const parsedDate =
        new Date(row.date);

      if (
        Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        errors.push(
          "Date is invalid."
        );
      }
    }

    /*
     * Stock Out availability
     */
    if (
      mode === "OUT" &&
      product &&
      Number.isFinite(
        row.quantity
      ) &&
      row.quantity > 0
    ) {
      const requestedQuantity =
        quantityByProduct.get(
          code
        ) ?? 0;

      const availableStock =
        getProductStock(
          product.id
        );

      if (
        requestedQuantity >
        availableStock
      ) {
        errors.push(
          `Insufficient stock. Available: ${availableStock}, requested: ${requestedQuantity}.`
        );
      }
    }

    return {
      ...row,
      valid:
        errors.length === 0,
      errors,
    };
  });
}

/*
 * =========================================================
 * EXPORT INVENTORY TO EXCEL
 * =========================================================
 */

export function exportInventoryToExcel(
  products: {
    id: string;
    code: string;
    name: string;
    category: string;
    unit: string;
    minimumStock: number;
  }[],
  inventory: {
    id: string;
    stock: number;
  }[],
  transactions: {
    productId: string;
    type:
      | "IN"
      | "OUT"
      | "ADJUSTMENT";
    quantity: number;
    date: string;
    remarks?: string;
  }[]
) {
  /*
   * =======================================================
   * INVENTORY DATA
   * =======================================================
   */

  const inventoryRows =
    products.map(
      (product) => {
        const inventoryItem =
          inventory.find(
            (item) =>
              item.id === product.id
          );

        const stock =
          inventoryItem?.stock ??
          0;

        let status =
          "In Stock";

        if (stock <= 0) {
          status =
            "Out of Stock";
        } else if (
          stock <=
          product.minimumStock
        ) {
          status =
            "Low Stock";
        }

        return {
          "Product Code":
            product.code,

          "Product Name":
            product.name,

          Category:
            product.category,

          Unit:
            product.unit,

          "Current Stock":
            stock,

          "Minimum Stock":
            product.minimumStock,

          Status:
            status,
        };
      }
    );

  /*
   * =======================================================
   * TRANSACTION DATA
   * =======================================================
   */

  const transactionRows =
    transactions.map(
      (transaction) => {
        const product =
          products.find(
            (product) =>
              product.id ===
              transaction.productId
          );

        return {
          "Product Code":
            product?.code ?? "",

          "Product Name":
            product?.name ?? "",

          Type:
            transaction.type,

          Quantity:
            transaction.quantity,

          Date:
            new Date(
              transaction.date
            ),

          Remarks:
            transaction.remarks ??
            "",
        };
      }
    );

  /*
   * =======================================================
   * CREATE WORKBOOK
   * =======================================================
   */

  const workbook =
    XLSX.utils.book_new();

  /*
   * =======================================================
   * INVENTORY SHEET
   * =======================================================
   */

  const inventorySheet =
    XLSX.utils.json_to_sheet(
      inventoryRows
    );

  XLSX.utils.book_append_sheet(
    workbook,
    inventorySheet,
    "Inventory"
  );

  /*
   * =======================================================
   * TRANSACTIONS SHEET
   * =======================================================
   */

  const transactionSheet =
    XLSX.utils.json_to_sheet(
      transactionRows
    );

  XLSX.utils.book_append_sheet(
    workbook,
    transactionSheet,
    "Transactions"
  );

  /*
   * =======================================================
   * AUTO WIDTH
   * =======================================================
   */

  inventorySheet["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
  ];

  transactionSheet["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 24 },
    { wch: 35 },
  ];

  /*
   * =======================================================
   * DOWNLOAD FILE
   * =======================================================
   */

  const date =
    new Date()
      .toISOString()
      .split("T")[0];

  XLSX.writeFile(
    workbook,
    `inventory-${date}.xlsx`
  );
}