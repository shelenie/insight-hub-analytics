export type DateChunk = {
  dateFrom: string;
  dateTo: string;
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDateAsUtc(value: string): Date {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  return date;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function createDateChunks(
  dateFrom: string,
  dateTo: string,
  maxDays: number,
): DateChunk[] {
  if (!Number.isInteger(maxDays) || maxDays < 1) {
    throw new Error("maxDays must be a positive integer");
  }

  const start = parseIsoDateAsUtc(dateFrom);
  const end = parseIsoDateAsUtc(dateTo);

  if (start.getTime() > end.getTime()) {
    throw new Error("date_from must be on or before date_to");
  }

  const chunks: DateChunk[] = [];
  let chunkStart = start;

  while (chunkStart.getTime() <= end.getTime()) {
    const maxChunkEnd = addUtcDays(chunkStart, maxDays - 1);
    const chunkEnd = maxChunkEnd.getTime() < end.getTime() ? maxChunkEnd : end;

    chunks.push({
      dateFrom: formatIsoDate(chunkStart),
      dateTo: formatIsoDate(chunkEnd),
    });

    chunkStart = addUtcDays(chunkEnd, 1);
  }

  return chunks;
}
