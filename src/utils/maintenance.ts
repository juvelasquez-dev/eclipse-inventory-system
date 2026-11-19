export interface MaintenanceStatus {
  enabled: boolean;
  announcement: string;
  expected_end_at: string | null;
}

export interface AdminMaintenanceStatus extends MaintenanceStatus {
  version: number;
  updated_at: string;
  updated_by_username: string | null;
}

export function parseMaintenanceStatus(value: unknown): MaintenanceStatus {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid maintenance status");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.enabled !== "boolean" ||
    typeof row.announcement !== "string" ||
    Array.from(row.announcement).length > 500 ||
    !(row.expected_end_at === null ||
      (typeof row.expected_end_at === "string" && Number.isFinite(Date.parse(row.expected_end_at))))
  ) {
    throw new Error("Invalid maintenance status");
  }
  return {
    enabled: row.enabled,
    announcement: row.announcement,
    expected_end_at: row.expected_end_at,
  };
}

export function parseAdminMaintenanceStatus(value: unknown): AdminMaintenanceStatus {
  const status = parseMaintenanceStatus(value);
  const row = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(row.version) ||
    typeof row.version !== "number" ||
    row.version < 0 ||
    typeof row.updated_at !== "string" ||
    !Number.isFinite(Date.parse(row.updated_at)) ||
    !(row.updated_by_username === null || typeof row.updated_by_username === "string")
  ) {
    throw new Error("Invalid administrator maintenance status");
  }
  return {
    ...status,
    version: row.version,
    updated_at: row.updated_at,
    updated_by_username: row.updated_by_username,
  };
}

export function formatManilaTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function toManilaInput(value: string | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function fromManilaInput(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Enter a valid expected return time.");
  }
  const date = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(date.getTime()) || toManilaInput(date.toISOString()) !== value) {
    throw new Error("Enter a valid expected return time.");
  }
  return date.toISOString();
}

export function createSerialRefresh<T>(
  load: (signal: AbortSignal) => Promise<T>,
  onSuccess: (value: T) => void,
  onError: (error: unknown) => void,
  timeoutMs = 10000,
) {
  let running = false;
  let queued = false;
  let disposed = false;
  let generation = 0;
  let controller: AbortController | null = null;

  async function run() {
    running = true;
    do {
      queued = false;
      const current = generation;
      const request = new AbortController();
      controller = request;
      const timer = setTimeout(() => request.abort(), timeoutMs);
      try {
        const value = await load(request.signal);
        if (!disposed && current === generation) onSuccess(value);
      } catch (error) {
        if (!disposed && current === generation) onError(error);
      } finally {
        clearTimeout(timer);
        controller = null;
      }
    } while (queued && !disposed);
    running = false;
  }

  return {
    refresh() {
      if (disposed) return;
      generation += 1;
      if (running) {
        queued = true;
      } else {
        void run();
      }
    },
    dispose() {
      disposed = true;
      generation += 1;
      controller?.abort();
    },
  };
}
