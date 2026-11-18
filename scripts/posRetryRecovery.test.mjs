import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/utils/posRetryRecovery.ts", import.meta.url),
  "utf8"
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const retry = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const {
  canonicalizeCheckoutPayload,
  cancellationRetryStorageKey,
  checkoutRetryStorageKey,
  parseCheckoutPayload,
  POS_RETRY_ATTEMPT_VERSION,
  readCancellationAttempt,
  readCheckoutAttempt,
} = retry;

const userId = "9caa4ffb-51b0-4ea6-96d2-d2621873d554";
const requestId = "8c2ed056-2479-4aca-9046-f6a28d7e4c2b";
const outletId = "1c9a0351-b784-4f41-9b26-c15036aa98e7";
const legacyPayload = {
  customer_name: "Outlet",
  customer_address: "Address",
  customer_phone: "09170000000",
  amount_received: 100,
  payment_method: "CASH",
  area_code: "EFT",
  items: [{ product_id: "product-1", quantity: 1 }],
};

function installSessionStorage(t) {
  const previousWindow = globalThis.window;
  const entries = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    },
  };
  t.after(() => {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  });
  return entries;
}

test("legacy v1 checkout payloads remain canonical and recoverable", (t) => {
  const entries = installSessionStorage(t);
  const canonicalPayload = canonicalizeCheckoutPayload(legacyPayload);
  const storedPayload = JSON.stringify({
    customer_name: "Outlet",
    customer_address: "Address",
    customer_phone: "09170000000",
    amount_received: 100,
    payment_method: "CASH",
    area_code: "EFT",
    items: [{ product_id: "product-1", quantity: 1 }],
  });

  assert.equal(canonicalPayload, storedPayload);
  assert.deepEqual(parseCheckoutPayload(storedPayload), legacyPayload);

  entries.set(
    checkoutRetryStorageKey(userId),
    JSON.stringify({
      version: POS_RETRY_ATTEMPT_VERSION,
      requestId,
      userId,
      createdAt: 1_000,
      canonicalPayload: storedPayload,
    })
  );
  const attempt = readCheckoutAttempt(userId, 1_000);
  assert.equal(attempt.status, "valid");
  if (attempt.status === "valid") {
    assert.deepEqual(
      parseCheckoutPayload(attempt.attempt.canonicalPayload),
      legacyPayload
    );
  }
});

test("v2 checkout payload preserves an outlet ID and allows free-text sales", (t) => {
  const entries = installSessionStorage(t);
  const payload = {
    ...legacyPayload,
    payload_version: 2,
    outlet_id: outletId,
  };
  const canonicalPayload = canonicalizeCheckoutPayload(payload);

  assert.deepEqual(parseCheckoutPayload(canonicalPayload), payload);
  assert.deepEqual(
    parseCheckoutPayload(
      canonicalizeCheckoutPayload({ ...payload, outlet_id: null })
    ),
    { ...payload, outlet_id: null }
  );
  assert.equal(
    parseCheckoutPayload(
      canonicalPayload.replace(outletId, "not-a-valid-uuid")
    ),
    null
  );

  entries.set(
    checkoutRetryStorageKey(userId),
    JSON.stringify({
      version: POS_RETRY_ATTEMPT_VERSION,
      requestId,
      userId,
      createdAt: 1_000,
      canonicalPayload,
    })
  );
  assert.equal(readCheckoutAttempt(userId, 1_000).status, "valid");
});

test("v1 cancellation retries remain valid", (t) => {
  const entries = installSessionStorage(t);
  entries.set(
    cancellationRetryStorageKey(userId),
    JSON.stringify({
      version: POS_RETRY_ATTEMPT_VERSION,
      requestId,
      userId,
      transactionId: "transaction-1",
      reason: "Correction",
      createdAt: 1_000,
    })
  );

  assert.equal(readCancellationAttempt(userId, 1_000).status, "valid");
});
