/**
 * Minimal RFC 4180 CSV reader. GTFS files quote any field containing a comma —
 * `route_desc` in particular is full of prose — so splitting on commas is not
 * an option.
 */

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

export type CsvRow = Record<string, string>;

/** Parses a whole CSV document. Fine for every GTFS file except stop_times,
 *  which is streamed line-by-line instead. */
export function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.trim().replace(/^﻿/, ''));
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!);
    const row: CsvRow = {};
    header.forEach((key, idx) => {
      row[key] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

/** Builds a column-index lookup so a streamed file can be read without
 *  allocating an object per row. */
export function headerIndex(headerLine: string): Record<string, number> {
  const cols = parseCsvLine(headerLine).map((h) => h.trim().replace(/^﻿/, ''));
  const idx: Record<string, number> = {};
  cols.forEach((c, i) => {
    idx[c] = i;
  });
  return idx;
}

/** GTFS times can exceed 24:00:00 for trips that run past midnight. */
export function gtfsTimeToSeconds(value: string): number | null {
  const parts = value.split(':');
  if (parts.length !== 3) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const s = Number(parts[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return null;
  return h * 3600 + m * 60 + s;
}
