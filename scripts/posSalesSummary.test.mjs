import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const sharedOutletIdA = "1c9a0351-b784-4f41-9b26-c15036aa98e7";
const sharedOutletIdB = "2c9a0351-b784-4f41-9b26-c15036aa98e8";
const rows = [
  ["east", "EFT", "EAST", "2026-01-31T15:59:59Z", 10, sharedOutletIdA],
  ["west", "EFT", "WEST", "2026-01-31T16:00:00Z", 20, sharedOutletIdB],
  ["lanao", "EFT", "LANAO", "2026-02-01T04:00:00Z", 30, null],
  ["bukidnon", "EFT", "BUKIDNON", "2026-02-02T04:00:00Z", 40, null],
  ["cgy", "EFT", "CGY", "2026-02-02T05:00:00Z", 50, null],
  ["legacy", "EFT", null, "2026-02-02T06:00:00Z", 60, null],
  ["iao", "IAO", null, "2026-02-02T07:00:00Z", 70, null],
  ["cbr", "CBR", null, "2026-02-02T08:00:00Z", 80, null],
  ["cancelled", "EFT", "EAST", "2026-02-02T09:00:00Z", 90, sharedOutletIdA],
].map(([id, area_code, eft_subarea_snapshot, created_at, total_amount, outlet_id]) => ({
  id,
  area_code,
  eft_subarea_snapshot,
  outlet_id,
  created_at,
  total_amount,
  transaction_status: id === "cancelled" ? "CANCELLED" : "COMPLETED",
  customer_name:
    id === "east" || id === "west" || id === "legacy"
      ? "Shared outlet"
      : id,
}));

const selects = [];
const equalityCalls = [];
const supabase = {
  from(table) {
    assert.equal(table, "pos_transactions");
    const predicates = [];
    let start = 0;
    let end = Infinity;
    const query = {
      select(columns) {
        selects.push(columns);
        return this;
      },
      eq(field, value) {
        equalityCalls.push([field, value]);
        predicates.push((row) => row[field] === value);
        return this;
      },
      is(field, value) {
        predicates.push((row) => row[field] === value);
        return this;
      },
      gte(field, value) {
        predicates.push((row) => Date.parse(row[field]) >= Date.parse(value));
        return this;
      },
      lt(field, value) {
        predicates.push((row) => Date.parse(row[field]) < Date.parse(value));
        return this;
      },
      order() {
        return this;
      },
      range(from, to) {
        start = from;
        end = to;
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve({
          data: rows.filter((row) => predicates.every((predicate) => predicate(row)))
            .slice(start, end + 1),
          error: null,
        }).then(resolve, reject);
      },
    };
    return query;
  },
};

function compile(source, filename, moduleRequire) {
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
  const module = { exports: {} };
  factory(moduleRequire, module, module.exports);
  return module.exports;
}

const businessDate = compile(
  await readFile(new URL("../src/utils/businessDate.ts", import.meta.url), "utf8"),
  "businessDate.ts",
  require
);
const reportHelpers = {
  async fetchItems(ids) {
    return ids.map((id) => ({ transaction_id: id, quantity: 2 }));
  },
  getReportFileName() {
    return "receipts-test.xlsx";
  },
  validateReportDateRange(start, end) {
    return start && end && start <= end ? null : "Invalid date range";
  },
};
const sales = compile(
  await readFile(new URL("../src/utils/posSalesSummary.ts", import.meta.url), "utf8"),
  "posSalesSummary.ts",
  (specifier) => {
    if (specifier === "xlsx") return XLSX;
    if (specifier === "../lib/supabase") return { supabase };
    if (specifier === "./businessDate") return businessDate;
    if (specifier === "./posTransactionReport") return reportHelpers;
    throw new Error(`Unexpected dependency: ${specifier}`);
  }
);

const filters = {
  startDate: "2026-01-31",
  endDate: "2026-02-02",
  area: "EFT",
  outletId: "ALL",
  outletLabel: "ALL",
  interval: "DAILY",
  subarea: "ALL",
};

test("filters by saved EFT snapshots, including historical unassigned sales", async () => {
  equalityCalls.length = 0;
  const all = await sales.loadSalesTransactions(filters);
  assert.deepEqual(all.map((row) => row.id), ["east", "west", "lanao", "bukidnon", "cgy", "legacy"]);
  assert.match(selects.at(-1), /area_code, outlet_id, eft_subarea_snapshot/);
  assert.ok(all.some((row) => row.id === "legacy"));
  for (const [subarea, id] of [
    ["EAST", "east"], ["WEST", "west"], ["LANAO", "lanao"],
    ["BUKIDNON", "bukidnon"], ["CGY", "cgy"], ["UNASSIGNED", "legacy"],
  ]) {
    const result = await sales.loadSalesTransactions({ ...filters, subarea });
    assert.deepEqual(result.map((row) => row.id), [id]);
  }
  assert.equal(all.find((row) => row.id === "legacy").eftSubareaSnapshot, null);
  await assert.rejects(
    sales.loadSalesTransactions({ ...filters, area: "ALL", subarea: "UNASSIGNED" }),
    /Select EFT/
  );
  await assert.rejects(
    sales.loadSalesTransactions({ ...filters, area: "IAO", subarea: "EAST" }),
    /Select EFT/
  );
});

test("filters same-named outlets by ID and excludes unassigned legacy sales", async () => {
  equalityCalls.length = 0;
  const firstOutlet = await sales.loadSalesTransactions({
    ...filters,
    outletId: sharedOutletIdA,
    outletLabel: "Shared outlet — East address",
  });
  assert.deepEqual(firstOutlet.map((row) => row.id), ["east"]);
  assert.ok(equalityCalls.some(([field, value]) => field === "outlet_id" && value === sharedOutletIdA));

  equalityCalls.length = 0;
  const secondOutlet = await sales.loadSalesTransactions({
    ...filters,
    outletId: sharedOutletIdB,
    outletLabel: "Shared outlet — West address",
  });
  assert.deepEqual(secondOutlet.map((row) => row.id), ["west"]);
  assert.ok(equalityCalls.some(([field, value]) => field === "outlet_id" && value === sharedOutletIdB));
  assert.ok(!secondOutlet.some((row) => row.id === "legacy"));

  await assert.rejects(
    sales.loadSalesTransactions({ ...filters, outletId: "Shared outlet" }),
    /valid outlet/
  );
});

test("preserves date, completed status and non-EFT area filtering", async () => {
  const february = await sales.loadSalesTransactions({
    ...filters, startDate: "2026-02-01", outletId: sharedOutletIdB,
  });
  assert.deepEqual(february.map((row) => row.id), ["west"]);
  const allOutlets = await sales.loadSalesTransactions({
    ...filters,
    startDate: "2026-02-01",
  });
  assert.deepEqual(allOutlets.map((row) => row.id), ["west", "lanao", "bukidnon", "cgy", "legacy"]);
  assert.ok(allOutlets.some((row) => row.id === "legacy"));
  const iao = await sales.loadSalesTransactions({ ...filters, area: "IAO" });
  const cbr = await sales.loadSalesTransactions({ ...filters, area: "CBR" });
  assert.deepEqual(iao.map((row) => row.id), ["iao"]);
  assert.deepEqual(cbr.map((row) => row.id), ["cbr"]);
  assert.equal(sales.aggregateSales(iao, "DAILY").summary.totalCents, 7000);
  assert.equal(sales.aggregateSales(cbr, "DAILY").summary.totalCents, 8000);
});

test("daily, weekly, and monthly totals reconcile with EFT subareas", async () => {
  const transactions = await sales.loadSalesTransactions(filters);
  const subareas = sales.aggregateEftSubareas(transactions, "ALL");
  assert.deepEqual(subareas.map((row) => [row.subarea, row.count, row.totalCents]), [
    ["EAST", 1, 1000], ["WEST", 1, 2000], ["LANAO", 1, 3000],
    ["BUKIDNON", 1, 4000], ["CGY", 1, 5000], ["UNASSIGNED", 1, 6000],
  ]);
  for (const [interval, expected] of [
    ["DAILY", [["2026-01-31", 1000], ["2026-02-01", 5000], ["2026-02-02", 15000]]],
    ["WEEKLY", [["2026-01-25", 1000], ["2026-02-01", 20000]]],
    ["MONTHLY", [["2026-01-01", 1000], ["2026-02-01", 20000]]],
  ]) {
    const { summary, periods } = sales.aggregateSales(transactions, interval, filters);
    assert.deepEqual(periods.map((period) => [period.key, period.totalCents]), expected);
    assert.equal(summary.totalCents, 21000);
    assert.equal(summary.count, 6);
    assert.equal(summary.quantity, 12);
    assert.equal(subareas.reduce((sum, row) => sum + row.totalCents, 0), summary.totalCents);
    assert.equal(subareas.reduce((sum, row) => sum + row.count, 0), summary.count);
  }
  const allAreas = await sales.loadSalesTransactions({ ...filters, area: "ALL" });
  assert.deepEqual(sales.aggregateEftSubareas(allAreas, "ALL"), subareas);
  assert.equal(sales.aggregateSales(allAreas, "DAILY").summary.totalCents, 36000);
});

test("workbook exports the calculated EFT breakdown and retains existing filters", async () => {
  const transactions = await sales.loadSalesTransactions(filters);
  const { summary, periods } = sales.aggregateSales(transactions, filters.interval, filters);
  const subareas = sales.aggregateEftSubareas(transactions, filters.subarea);
  const workbook = sales.buildSalesSummaryWorkbook(filters, summary, periods, subareas);
  const exported = XLSX.utils.sheet_to_json(workbook.Sheets["EFT Subareas"], { header: 1 });
  assert.deepEqual(exported.slice(1, -1), subareas.map((row) => [
    sales.subareaLabel(row.subarea), row.totalCents / 100, row.count,
  ]));
  assert.deepEqual(exported.at(-1), ["EFT Total", summary.totalCents / 100, summary.count]);
  const summaryRows = XLSX.utils.sheet_to_json(workbook.Sheets.Summary, { header: 1 });
  for (const expected of [
    ["Start Date", filters.startDate], ["End Date", filters.endDate],
    ["Area", "EFT"], ["Outlet", "All"], ["Grouping", "Daily"],
    ["EFT Subarea", "All Subareas"], ["Total Sales", 210],
  ]) {
    assert.ok(summaryRows.some((row) => JSON.stringify(row) === JSON.stringify(expected)));
  }
  const unassignedFilters = { ...filters, subarea: "UNASSIGNED" };
  const unassigned = await sales.loadSalesTransactions(unassignedFilters);
  const result = sales.aggregateSales(unassigned, "DAILY", filters);
  const selected = sales.aggregateEftSubareas(unassigned, "UNASSIGNED");
  const selectedWorkbook = sales.buildSalesSummaryWorkbook(unassignedFilters, result.summary, result.periods, selected);
  assert.deepEqual(
    XLSX.utils.sheet_to_json(selectedWorkbook.Sheets["EFT Subareas"], { header: 1 }).slice(1),
    [["Unassigned", 60, 1], ["Filtered EFT Total", 60, 1]]
  );
  const allAreas = await sales.loadSalesTransactions({ ...filters, area: "ALL" });
  const allResult = sales.aggregateSales(allAreas, "DAILY", filters);
  const allWorkbook = sales.buildSalesSummaryWorkbook(
    { ...filters, area: "ALL" },
    allResult.summary,
    allResult.periods,
    sales.aggregateEftSubareas(allAreas, "ALL")
  );
  assert.deepEqual(
    XLSX.utils.sheet_to_json(allWorkbook.Sheets["EFT Subareas"], { header: 1 }).at(-1),
    ["EFT Total", 210, 6]
  );
  const iao = await sales.loadSalesTransactions({ ...filters, area: "IAO" });
  const iaoResult = sales.aggregateSales(iao, "DAILY", filters);
  const iaoWorkbook = sales.buildSalesSummaryWorkbook(
    { ...filters, area: "IAO" }, iaoResult.summary, iaoResult.periods, []
  );
  assert.deepEqual(iaoWorkbook.SheetNames, ["Summary", "Breakdown"]);
  assert.equal(iaoWorkbook.Sheets.Summary.B7.v, 70);
});

test("EFT total labels match the filter in the shared label and workbook", async () => {
  for (const [subarea, label, total, count] of [
    ["ALL", "EFT Total", 210, 6],
    ["EAST", "Filtered EFT Total", 10, 1],
    ["UNASSIGNED", "Filtered EFT Total", 60, 1],
  ]) {
    const selectedFilters = { ...filters, subarea };
    const transactions = await sales.loadSalesTransactions(selectedFilters);
    const { summary, periods } = sales.aggregateSales(transactions, "DAILY", filters);
    const subareas = sales.aggregateEftSubareas(transactions, subarea);
    const workbook = sales.buildSalesSummaryWorkbook(selectedFilters, summary, periods, subareas);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets["EFT Subareas"], { header: 1 });
    assert.equal(sales.eftTotalLabel(subarea), label);
    assert.deepEqual(rows.at(-1), [label, total, count]);
  }
});
