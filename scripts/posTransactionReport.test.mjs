import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const transactionRows = [
  ["east", "EFT", "EAST"],
  ["west", "EFT", "WEST"],
  ["lanao", "EFT", "LANAO"],
  ["bukidnon", "EFT", "BUKIDNON"],
  ["cgy", "EFT", "CGY"],
  ["legacy", "EFT", null],
  ["iao", "IAO", null],
  ["cbr", "CBR", null],
].map(([key, areaCode, subarea], index) => ({
  id: `transaction-${key}`,
  delivery_receipt_sequence: null,
  area_code: areaCode,
  receipt_number: index + 1,
  created_by: null,
  customer_name: `Outlet ${key}`,
  customer_address: `Address ${key}`,
  customer_phone: `0917000000${index}`,
  eft_subarea_snapshot: subarea,
  subtotal: 100 + index,
  payment_method: "CASH",
  created_at: "2026-06-01T02:00:00.000Z",
}));

const outletRows = transactionRows.map((row) => ({
  outlet_name: row.customer_name,
  contact_person: `Contact ${row.customer_name}`,
  complete_address: row.customer_address,
  eft_subarea_code: "WEST",
}));

const selectCalls = [];
const tableResponses = {
  pos_transactions: transactionRows,
  pos_transaction_items: [
    {
      transaction_id: "transaction-east",
      product_name_snapshot: "East product",
      unit_price: 100,
      quantity: 1,
      line_amount: 100,
    },
  ],
  outlets: outletRows,
};

const supabase = {
  from(table) {
    const query = {
      select(columns) {
        selectCalls.push({ table, columns });
        return this;
      },
      eq() {
        return this;
      },
      gte() {
        return this;
      },
      lt() {
        return this;
      },
      order() {
        return this;
      },
      range() {
        return this;
      },
      in() {
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve({
          data: tableResponses[table] ?? [],
          error: null,
        }).then(resolve, reject);
      },
    };
    return query;
  },
  async rpc() {
    return { data: [], error: null };
  },
};

function compileTypeScriptModule(source, filename, moduleRequire) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const factory = runInThisContext(
    `(function (require, module, exports) {\n${outputText}\n})`,
    { filename }
  );
  const compiledModule = { exports: {} };
  factory(moduleRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}

const receiptPartiesSource = await readFile(
  new URL("../src/utils/receiptParties.ts", import.meta.url),
  "utf8"
);
const receiptParties = compileTypeScriptModule(
  receiptPartiesSource,
  "receiptParties.ts",
  require
);
const reportSource = await readFile(
  new URL("../src/utils/posTransactionReport.ts", import.meta.url),
  "utf8"
);
const report = compileTypeScriptModule(
  reportSource,
  "posTransactionReport.ts",
  (specifier) => {
    if (specifier === "xlsx") return XLSX;
    if (specifier === "../lib/supabase") return { supabase };
    if (specifier === "./businessDate") {
      return {
        BUSINESS_TIMEZONE: "Asia/Manila",
        addBusinessDays(key, days) {
          const date = new Date(`${key}T00:00:00Z`);
          date.setUTCDate(date.getUTCDate() + days);
          return date.toISOString().slice(0, 10);
        },
        businessDayStart(key) {
          return new Date(`${key}T00:00:00+08:00`);
        },
      };
    }
    if (specifier === "./receiptParties") return receiptParties;
    throw new Error(`Unexpected report module dependency: ${specifier}`);
  }
);

test("exports transaction snapshots, blank legacy values, and existing receipt data", async () => {
  selectCalls.length = 0;
  const receipts = await report.loadPOSTransactionReport(
    "2026-06-01",
    "2026-06-30"
  );

  assert.equal(receipts.length, transactionRows.length);
  const transactionSelect = selectCalls.find(
    (call) => call.table === "pos_transactions"
  );
  assert.match(transactionSelect.columns, /eft_subarea_snapshot/);
  const outletSelect = selectCalls.find((call) => call.table === "outlets");
  assert.doesNotMatch(outletSelect.columns, /eft_subarea_code/);

  const workbook = report.buildPOSTransactionWorkbook(receipts);
  const expectations = new Map([
    ["EFT-0001", "EAST"],
    ["EFT-0002", "WEST"],
    ["EFT-0003", "LANAO"],
    ["EFT-0004", "BUKIDNON"],
    ["EFT-0005", "CGY"],
    ["EFT-0006", ""],
    ["IAO-0007", ""],
    ["CBR-0008", ""],
  ]);
  const worksheetNames = ["receipts", "receiptsWithItems"];

  for (const worksheetName of worksheetNames) {
    const rows = XLSX.utils.sheet_to_json(
      workbook.Sheets[worksheetName],
      { header: 1, defval: "" }
    );
    const [headers, ...dataRows] = rows;
    const receiptIdIndex = headers.indexOf("ReceiptId");
    const subareaIndex = headers.indexOf("Subarea");
    const contactPersonIndex = headers.indexOf("ContactPerson");
    const totalIndex = headers.indexOf("Total");

    assert.notEqual(subareaIndex, -1, `${worksheetName} includes Subarea`);
    assert.notEqual(contactPersonIndex, -1, `${worksheetName} keeps ContactPerson`);
    const totalCell = workbook.Sheets[worksheetName][
      XLSX.utils.encode_cell({ r: 1, c: totalIndex })
    ];
    assert.equal(totalCell.z, '"₱"#,##0.00');

    for (const [receiptId, expectedSubarea] of expectations) {
      const row = dataRows.find((candidate) => candidate[receiptIdIndex] === receiptId);
      assert.ok(row, `${worksheetName} contains ${receiptId}`);
      assert.equal(row[subareaIndex] ?? "", expectedSubarea);
      assert.match(row[contactPersonIndex], /^Contact Outlet /);
    }

    for (const [receiptId, expectedTotal] of [
      ["IAO-0007", 106],
      ["CBR-0008", 107],
    ]) {
      const row = dataRows.find((candidate) => candidate[receiptIdIndex] === receiptId);
      assert.equal(row[totalIndex], expectedTotal);
    }

    const itemTypeIndex = headers.indexOf("EntryType");
    if (itemTypeIndex !== -1) {
      const itemRow = dataRows.find(
        (candidate) => candidate[itemTypeIndex] === "Item"
      );
      assert.ok(itemRow);
      assert.equal(itemRow[subareaIndex] ?? "", "");
    }
  }
});
