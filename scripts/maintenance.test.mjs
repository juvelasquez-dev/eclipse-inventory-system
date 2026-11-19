import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/maintenance.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const {
  createSerialRefresh,
  fromManilaInput,
  parseAdminMaintenanceStatus,
  parseMaintenanceStatus,
  toManilaInput,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("status parsing fails closed on missing or malformed public and admin data", () => {
  const valid = { enabled: true, announcement: "Maintenance", expected_end_at: null };
  assert.deepEqual(parseMaintenanceStatus(valid), valid);
  for (const invalid of [null, {}, { ...valid, enabled: "false" }, { ...valid, expected_end_at: "invalid" }, { ...valid, announcement: "a".repeat(501) }]) {
    assert.throws(() => parseMaintenanceStatus(invalid));
  }
  assert.throws(() => parseAdminMaintenanceStatus(valid));
  assert.equal(parseAdminMaintenanceStatus({
    ...valid, version: 1, updated_at: "2026-11-19T00:00:00Z", updated_by_username: "admin",
  }).version, 1);
});

test("expected return is converted to Manila time independently of browser timezone", () => {
  assert.equal(toManilaInput("2026-11-20T04:30:45Z"), "2026-11-20T12:30");
  assert.equal(fromManilaInput("2026-11-20T12:30"), "2026-11-20T04:30:00.000Z");
  assert.equal(fromManilaInput(""), null);
  assert.throws(() => fromManilaInput("2026-02-30T12:00"));
});

test("refreshes are serialized, stale responses discarded, and failures surfaced", async () => {
  const requests = [];
  const values = [];
  const errors = [];
  const checker = createSerialRefresh(
    () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    (value) => values.push(value),
    (error) => errors.push(error.message),
  );
  checker.refresh();
  checker.refresh();
  checker.refresh();
  assert.equal(requests.length, 1);
  requests[0].resolve("stale");
  await tick();
  assert.equal(requests.length, 2);
  assert.deepEqual(values, []);
  requests[1].resolve("current");
  await tick();
  assert.deepEqual(values, ["current"]);
  checker.refresh();
  requests[2].reject(new Error("offline"));
  await tick();
  assert.deepEqual(errors, ["offline"]);
  checker.refresh();
  checker.dispose();
  requests[3].resolve("after disposal");
  await tick();
  assert.deepEqual(values, ["current"]);
});

test("a timed-out status check fails closed and remains retryable", async () => {
  const errors = [];
  let calls = 0;
  const checker = createSerialRefresh(
    (signal) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("timed out")));
      });
    },
    () => assert.fail("A timed-out check must not succeed"),
    (error) => errors.push(error.message),
    10,
  );
  checker.refresh();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(errors, ["timed out"]);
  checker.refresh();
  assert.equal(calls, 2);
  checker.dispose();
});

test("migration keeps maintenance writes admin-authorized and audited with concurrency checks", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261119193000_add_system_maintenance.sql", import.meta.url), "utf8");
  const publicRead = sql.match(/CREATE FUNCTION public\.get_system_maintenance\(\)[\s\S]*?\$function\$;/)?.[0];
  const adminRead = sql.match(/CREATE FUNCTION public\.admin_get_system_maintenance\(\)[\s\S]*?\$function\$;/)?.[0];
  const update = sql.match(/CREATE FUNCTION public\.admin_update_system_maintenance\([\s\S]*?\$function\$;/)?.[0];
  assert.ok(publicRead && adminRead && update);
  assert.match(sql, /REVOKE ALL ON TABLE public\.system_maintenance_settings FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_system_maintenance\(\) TO anon, authenticated/i);
  assert.doesNotMatch(publicRead, /updated_by|version|updated_at/);
  assert.match(adminRead, /PERFORM public\.require_active_admin\(\)/i);
  assert.match(update, /PERFORM public\.require_active_admin\(\)/i);
  assert.match(update, /FOR UPDATE/i);
  assert.match(update, /v_previous\.version <> p_version/i);
  assert.match(update, /INSERT INTO public\.audit_logs/i);
  assert.match(update, /auth\.uid\(\)/i);
  assert.match(update, /MAINTENANCE_ENABLED/);
  assert.match(update, /MAINTENANCE_DISABLED/);
});

test("in-flight POS completions retain recovery records after their page unmounts", async () => {
  for (const [file, ref, key] of [
    ["POS.tsx", "checkoutUserIdRef", "checkoutRetryStorageKey"],
    ["POSHistory.tsx", "cancellationUserIdRef", "cancellationRetryStorageKey"],
  ]) {
    const source = await readFile(new URL(`../src/pages/POS/${file}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(`${ref}\\.current = null;\\s*authListener\\.subscription\\.unsubscribe\\(\\)`));
    assert.match(source, new RegExp(`if \\(${ref}\\.current !== attempt\\.userId\\) return;\\s*(?:void refreshInventory\\([^;]+;\\s*)?const cleared = clearSessionAttempt\\(\\s*${key}\\(attempt\\.userId\\)`));
  }
});
