export const TIKTOK_REPORT_MAX_CHUNK_DAYS = 30;

export type DateRangeChunk = {
  dateFrom: string;
  dateTo: string;
};

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseIsoDateUtc(value: string) {
  if (!isIsoDate(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function buildDateRangeChunks(
  dateFrom: string,
  dateTo: string,
  maxDays = TIKTOK_REPORT_MAX_CHUNK_DAYS,
): DateRangeChunk[] {
  const start = parseIsoDateUtc(dateFrom);
  const end = parseIsoDateUtc(dateTo);

  if (!start || !end) {
    throw new Error("date_from and date_to must be YYYY-MM-DD.");
  }

  if (start.getTime() > end.getTime()) {
    throw new Error("date_from must be on or before date_to.");
  }

  if (!Number.isInteger(maxDays) || maxDays <= 0) {
    throw new Error("maxDays must be a positive integer.");
  }

  const chunks: DateRangeChunk[] = [];
  let chunkStart = start;

  while (chunkStart.getTime() <= end.getTime()) {
    const maxChunkEnd = addUtcDays(chunkStart, maxDays - 1);
    const chunkEnd = maxChunkEnd.getTime() < end.getTime() ? maxChunkEnd : end;

    chunks.push({
      dateFrom: formatIsoDateUtc(chunkStart),
      dateTo: formatIsoDateUtc(chunkEnd),
    });

    chunkStart = addUtcDays(chunkEnd, 1);
  }

  return chunks;
}
