import "server-only";

/** Escape a single CSV field (RFC 4180): quote if it contains , " \n \r. */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const head = headers.map(csvCell).join(",");
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return `${head}\n${body}\n`;
}
