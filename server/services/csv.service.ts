import csv from "csv-parser";
import { Readable } from "stream";

/**
 * Basic heuristic to verify the uploaded buffer is likely a CSV text file.
 * - Rejects if it contains NUL bytes (binary files)
 * - Requires at least one newline (to have rows)
 * - Accepts files with traditional delimiters (comma, semicolon, tab) OR plain text lines
 * - Ensures the content appears to be structured text data
 */
export function isProbablyCsv(fileBuffer: Buffer): boolean {
  if (!fileBuffer || fileBuffer.length === 0) return false;

  const sample = fileBuffer.subarray(0, Math.min(4096, fileBuffer.length));
  // Hard reject binary-like files
  if (sample.includes(0)) return false;

  const text = sample.toString("utf8");
  const hasNewline = /\r?\n/.test(text);
  
  // Accept if it has newlines and appears to be structured text
  // This allows both traditional CSV (with delimiters) and single-column text files
  if (!hasNewline) return false;
  
  // Basic sanity check: ensure it's not just whitespace
  const nonWhitespaceLines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  return nonWhitespaceLines.length >= 1;
}

/**
 * Stream-parse CSV to extract headers and row count without holding the
 * entire dataset in memory. Supports traditional CSV with delimiters and
 * single-column text files (like question lists).
 *
 * Additionally normalizes header values by:
 * - Trimming surrounding whitespace
 * - Removing a UTF-8 BOM from the first header if present
 */
export async function extractCsvMetadata(
  fileBuffer: Buffer,
): Promise<{ headers: string[]; rowCount: number }> {
  return new Promise((resolve, reject) => {
    const text = fileBuffer.toString("utf8");
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      resolve({ headers: [], rowCount: 0 });
      return;
    }

    // Check if this is a traditional CSV with delimiters
    const hasDelimiters = /[,;\t]/.test(text);
    
    if (hasDelimiters) {
      // Use traditional CSV parsing for files with delimiters
      const stream = Readable.from(fileBuffer);
      let headers: string[] = [];
      let rowCount = 0;

      const parser = csv();

      parser
        .on("headers", (h: string[]) => {
          // Normalize header names by trimming whitespace; do not alter case
          const trimmed = h.map((s) => (typeof s === "string" ? s.trim() : s));
          // Remove BOM (\uFEFF) from first header if present
          if (
            trimmed.length > 0 &&
            typeof trimmed[0] === "string" &&
            trimmed[0].charCodeAt(0) === 0xfeff
          ) {
            trimmed[0] = trimmed[0].slice(1);
          }
          headers = trimmed.filter((s) => typeof s === "string" && s.length > 0) as string[];
        })
        .on("data", () => {
          rowCount += 1;
        })
        .on("end", () => {
          resolve({ headers, rowCount });
        })
        .on("error", (err: unknown) => {
          reject(err);
        });

      stream.pipe(parser);
    } else {
      // Handle single-column text files (like question lists)
      let firstLine = lines[0].trim();
      
      // Remove BOM (\uFEFF) from first line if present
      if (firstLine.charCodeAt(0) === 0xfeff) {
        firstLine = firstLine.slice(1);
      }
      
      const headers = [firstLine];
      const rowCount = lines.length - 1; // All lines except the header
      
      resolve({ headers, rowCount });
    }
  });
}
