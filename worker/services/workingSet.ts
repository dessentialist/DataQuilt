export type RowRecord = Record<string, any>;

/**
 * WorkingSet composes immutable input rows with a sparse outputs overlay.
 * - inputRows: the full set of normalized CSV rows (authoritative length)
 * - outputsOverlay: Map<rowIndex, { [outputColumn]: value }>
 * - outputColumns: declared output columns for the job (stable during a run)
 *
 * This abstraction ensures resume-safe processing by avoiding mutation of
 * input rows and by composing a row view on demand for variable substitution
 * and CSV materialization.
 */
export class WorkingSet {
  private readonly inputRows: RowRecord[];
  private readonly outputColumns: string[];
  private readonly outputsOverlay: Map<number, RowRecord>;

  constructor(inputRows: RowRecord[], outputColumns: string[]) {
    this.inputRows = inputRows;
    this.outputColumns = Array.from(new Set(outputColumns.filter(Boolean)));
    this.outputsOverlay = new Map();
  }

  /**
   * Merge a previously saved partial CSV. Only overlays declared output columns
   * for indices present in the partial. Input columns remain sourced from the
   * authoritative inputRows.
   */
  mergePartial(partialRows: RowRecord[]): void {
    if (!Array.isArray(partialRows) || partialRows.length === 0) return;
    const limit = Math.min(partialRows.length, this.inputRows.length);
    for (let i = 0; i < limit; i++) {
      const partial = partialRows[i] || {};
      for (const col of this.outputColumns) {
        if (Object.prototype.hasOwnProperty.call(partial, col)) {
          this.setOutput(i, col, partial[col]);
        }
      }
    }
  }

  /** Get a composed read-only view for a given row index. */
  getRowView(index: number): RowRecord {
    const base = this.inputRows[index];
    const overlay = this.outputsOverlay.get(index);
    if (!overlay) return base;
    // Compose a shallow view to avoid accidental mutation of input rows
    return { ...base, ...overlay };
  }

  /** Set or update an output cell value in the sparse overlay. */
  setOutput(index: number, column: string, value: any): void {
    let rowOverlay = this.outputsOverlay.get(index);
    if (!rowOverlay) {
      rowOverlay = {};
      this.outputsOverlay.set(index, rowOverlay);
    }
    rowOverlay[column] = value;
  }

  /** Returns materialized rows for [0, endExclusive). */
  materializeSlice(endExclusive: number): RowRecord[] {
    const end = Math.min(endExclusive, this.inputRows.length);
    const out: RowRecord[] = new Array(end);
    for (let i = 0; i < end; i++) out[i] = this.getRowView(i);
    return out;
  }

  /** Returns materialized rows for the full dataset. */
  materializeAll(): RowRecord[] {
    return this.materializeSlice(this.inputRows.length);
  }

  /** Stable header order: input headers followed by declared output columns (de-duplicated). */
  getHeaders(): string[] {
    const inputHeaders = this.inputRows.length > 0 ? Object.keys(this.inputRows[0]) : [];
    const set = new Set<string>(inputHeaders);
    for (const col of this.outputColumns) if (!set.has(col)) set.add(col);
    return Array.from(set);
  }

  /**
   * Stats for observability after resume.
   */
  getStats(): {
    inputRows: number;
    overlayRows: number;
    outputColumns: string[];
  } {
    return {
      inputRows: this.inputRows.length,
      overlayRows: this.outputsOverlay.size,
      outputColumns: [...this.outputColumns],
    };
  }
}


