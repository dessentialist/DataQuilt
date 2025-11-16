import csv from "csv-parser";

/**
 * Normalize a CSV header value consistently across the app.
 * - Trims surrounding whitespace
 * - Removes UTF-8 BOM from the first header if present
 * - Preserves original case
 */
export function normalizeHeaderValue(header: string, isFirstHeader: boolean): string {
  let value = typeof header === "string" ? header.trim() : String(header);
  if (isFirstHeader && value.charCodeAt(0) === 0xfeff) {
    value = value.slice(1);
  }
  return value;
}

/**
 * Create a csv-parser instance that normalizes headers (trim + BOM strip on first).
 * Use this everywhere we parse CSV rows so keys match the metadata headers.
 */
export function createNormalizedCsvParser() {
  return csv({
    mapHeaders: ({ header, index }) => normalizeHeaderValue(header, index === 0),
  });
}

/**
 * Serialize rows to CSV text with optional headers and BOM.
 * - When headers are not provided, builds a union of keys across rows preserving insertion order
 * - Escapes quotes and wraps fields containing comma/newline/quote in quotes
 */
export function serializeRowsToCsv(data: any[], headers?: string[], includeBom: boolean = true): Buffer {
  let resolvedHeaders = headers && headers.length ? [...headers] : [] as string[];

  if (resolvedHeaders.length === 0) {
    const headerSet = new Set<string>();
    for (const row of data) {
      for (const key of Object.keys(row)) headerSet.add(key);
    }
    resolvedHeaders = Array.from(headerSet);
  }

  const rows: string[] = [];
  if (resolvedHeaders.length > 0) {
    rows.push(resolvedHeaders.join(","));
  }

  for (const row of data) {
    const line = resolvedHeaders
      .map((header) => {
        const value = row[header] ?? "";
        const str = typeof value === "string" ? value : JSON.stringify(value);
        const escaped = str.replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
      })
      .join(",");
    rows.push(line);
  }

  const csvText = (includeBom ? "\uFEFF" : "") + rows.join("\n");
  return Buffer.from(csvText, "utf8");
}


