// CSV as RFC 4180 writes it (comma-separated, CRLF line ends, text in double
// quotes with inner quotes doubled), safe to open in a spreadsheet.
//
// Text comes from the user (card, group and stage names), so a cell that a
// spreadsheet would read as a formula (one starting with =, +, -, @, a tab or a
// carriage return; OWASP's "CSV injection") gets a leading apostrophe and is
// shown as text. Numbers are written as they are: the app computes them, and a
// spreadsheet should add them up.
export type Cell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export const toCsv = (rows: Cell[][]) => rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
