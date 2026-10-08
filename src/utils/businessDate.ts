export const BUSINESS_TIMEZONE = "Asia/Manila";

// The Philippines does not observe DST, so a fixed offset is safe.
const BUSINESS_UTC_OFFSET = "+08:00";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getParts(
  formatter: Intl.DateTimeFormat,
  date: Date
): Record<string, string> {
  const parts: Record<string, string> = {};

  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }

  return parts;
}

/** YYYY-MM-DD of the instant as seen in Asia/Manila. */
export function toBusinessDateKey(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input);
  const parts = getParts(dateKeyFormatter, date);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function todayBusinessKey(): string {
  return toBusinessDateKey(new Date());
}

/** Midnight (Asia/Manila) at the start of the YYYY-MM-DD business day. */
export function businessDayStart(key: string): Date {
  return new Date(`${key}T00:00:00${BUSINESS_UTC_OFFSET}`);
}

function keyToUtcDate(key: string): Date {
  const match = DATE_KEY_PATTERN.exec(key);

  if (!match) {
    return new Date(Number.NaN);
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

function utcDateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addBusinessDays(key: string, days: number): string {
  const date = keyToUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);

  return utcDateToKey(date);
}

/** Sunday-based week start, matching the previous getDay() behaviour. */
export function businessWeekStartKey(key: string): string {
  return addBusinessDays(key, -keyToUtcDate(key).getUTCDay());
}

export function businessMonthStartKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/**
 * Converts a calendar date typed in a spreadsheet to a YYYY-MM-DD key.
 * ISO dates are used as-is; other formats are parsed with the browser's
 * calendar interpretation and read back as the same calendar day.
 */
export function calendarDateToBusinessKey(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(trimmed);

  if (isoMatch) {
    return Number.isNaN(keyToUtcDate(isoMatch[1]).getTime())
      ? null
      : isoMatch[1];
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${parsed.getFullYear()}-${month}-${day}`;
}

/** The given business date combined with the Manila clock time of `time`. */
export function combineBusinessDateAndTime(key: string, time: Date): Date {
  const parts = getParts(timeFormatter, time);
  const ms = String(time.getMilliseconds()).padStart(3, "0");

  return new Date(
    `${key}T${parts.hour}:${parts.minute}:${parts.second}.${ms}${BUSINESS_UTC_OFFSET}`
  );
}
