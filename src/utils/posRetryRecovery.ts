export const POS_RETRY_ATTEMPT_VERSION = 1;
export const POS_RETRY_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

export function createRetryAttemptTimestamp() {
  return Date.now();
}

export interface CheckoutItemPayload {
  product_id: string;
  quantity: number;
}

export interface CheckoutPayload {
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  amount_received: number;
  payment_method: "CASH" | "CHEQUE";
  area_code: "IAO" | "CBR" | "EFT";
  items: CheckoutItemPayload[];
}

export interface CheckoutRetryAttempt {
  version: number;
  requestId: string;
  userId: string;
  createdAt: number;
  canonicalPayload: string;
}

export interface CancellationRetryAttempt {
  version: number;
  requestId: string;
  userId: string;
  transactionId: string;
  reason: string;
  createdAt: number;
}

export type StoredAttemptResult<T> =
  | { status: "missing" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "valid" | "expired"; attempt: T };

export function checkoutRetryStorageKey(userId: string) {
  return `eidms:pos:checkout-retry:v1:${userId}`;
}

export function cancellationRetryStorageKey(userId: string) {
  return `eidms:pos:cancellation-retry:v1:${userId}`;
}

export function canonicalizeCheckoutPayload(payload: CheckoutPayload) {
  const items = new Map<string, number>();
  for (const { product_id, quantity } of payload.items) {
    items.set(product_id, (items.get(product_id) ?? 0) + quantity);
  }
  return JSON.stringify({
    customer_name: payload.customer_name,
    customer_address: payload.customer_address,
    customer_phone: payload.customer_phone,
    amount_received: payload.amount_received,
    payment_method: payload.payment_method,
    area_code: payload.area_code,
    items: Array.from(items, ([product_id, quantity]) => ({
      product_id,
      quantity,
    }))
      .sort((left, right) => left.product_id.localeCompare(right.product_id)),
  });
}

export function parseCheckoutPayload(
  canonicalPayload: string
): CheckoutPayload | null {
  try {
    const parsed: unknown = JSON.parse(canonicalPayload);
    if (!isCheckoutPayload(parsed)) return null;
    if (canonicalizeCheckoutPayload(parsed) !== canonicalPayload) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readCheckoutAttempt(
  userId: string,
  now = Date.now()
): StoredAttemptResult<CheckoutRetryAttempt> {
  return readAttempt(
    checkoutRetryStorageKey(userId),
    (value): value is CheckoutRetryAttempt =>
      isRecord(value) &&
      value.version === POS_RETRY_ATTEMPT_VERSION &&
      value.userId === userId &&
      isUuid(value.requestId) &&
      isFiniteTimestamp(value.createdAt) &&
      typeof value.canonicalPayload === "string" &&
      parseCheckoutPayload(value.canonicalPayload) !== null,
    now
  );
}

export function readCancellationAttempt(
  userId: string,
  now = Date.now()
): StoredAttemptResult<CancellationRetryAttempt> {
  return readAttempt(
    cancellationRetryStorageKey(userId),
    (value): value is CancellationRetryAttempt =>
      isRecord(value) &&
      value.version === POS_RETRY_ATTEMPT_VERSION &&
      value.userId === userId &&
      isUuid(value.requestId) &&
      typeof value.transactionId === "string" &&
      value.transactionId.length > 0 &&
      typeof value.reason === "string" &&
      isFiniteTimestamp(value.createdAt),
    now
  );
}

export function writeSessionAttempt(
  key: string,
  attempt: CheckoutRetryAttempt | CancellationRetryAttempt
) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(attempt));
    return true;
  } catch {
    return false;
  }
}

export function clearSessionAttempt(key: string) {
  try {
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readAttempt<T>(
  key: string,
  isAttempt: (value: unknown) => value is T,
  now: number
): StoredAttemptResult<T> {
  let serialized: string | null;
  try {
    serialized = window.sessionStorage.getItem(key);
  } catch {
    return { status: "unavailable" };
  }
  if (serialized === null) return { status: "missing" };

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return { status: "invalid" };
  }
  if (!isAttempt(value)) return { status: "invalid" };

  const createdAt = getCreatedAt(value);
  if (createdAt > now + 5 * 60 * 1000) return { status: "invalid" };
  return now - createdAt > POS_RETRY_ATTEMPT_TTL_MS
    ? { status: "expired", attempt: value }
    : { status: "valid", attempt: value };
}

function getCreatedAt(attempt: unknown) {
  return isRecord(attempt) && typeof attempt.createdAt === "number"
    ? attempt.createdAt
    : 0;
}

function isCheckoutPayload(value: unknown): value is CheckoutPayload {
  if (!isRecord(value)) return false;
  if (
    typeof value.customer_name !== "string" ||
    value.customer_name.trim() !== value.customer_name ||
    typeof value.customer_address !== "string" ||
    value.customer_address.trim() !== value.customer_address ||
    typeof value.customer_phone !== "string" ||
    value.customer_phone.trim() !== value.customer_phone ||
    typeof value.amount_received !== "number" ||
    !Number.isFinite(value.amount_received) ||
    value.amount_received < 0 ||
    Math.round(value.amount_received * 100) / 100 !== value.amount_received ||
    (value.payment_method !== "CASH" && value.payment_method !== "CHEQUE") ||
    (value.area_code !== "IAO" &&
      value.area_code !== "CBR" &&
      value.area_code !== "EFT") ||
    !Array.isArray(value.items) ||
    value.items.length === 0
  ) {
    return false;
  }

  return value.items.every(
    (item: unknown) =>
      isRecord(item) &&
      typeof item.product_id === "string" &&
      item.product_id.length > 0 &&
      item.product_id.trim() === item.product_id &&
      Number.isSafeInteger(item.quantity) &&
      (item.quantity as number) > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
