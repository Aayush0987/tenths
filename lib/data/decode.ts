/**
 * Expanding the tuple tables on disk into objects.
 *
 * The saving that makes nine seasons fit in ~15 MB is that rows are arrays,
 * not objects — which means field order carries meaning, and a pipeline change
 * that reorders a table would otherwise shift every value silently into the
 * wrong property. So each table is decoded against the `schema` the file
 * itself carries, and a mismatch throws.
 */

export class SchemaMismatchError extends Error {
  constructor(table: string, expected: readonly string[], actual: readonly string[]) {
    super(
      `Data file's "${table}" schema does not match what this build expects.\n` +
        `  expected: ${expected.join(", ")}\n` +
        `  in file:  ${actual.join(", ")}\n` +
        `Regenerate the data, or update the decoder to match.`,
    );
    this.name = "SchemaMismatchError";
  }
}

type Row = readonly unknown[];

/**
 * Decode one tuple table.
 *
 * The schema is compared field by field before any row is read, so the failure
 * is a clear error at load rather than nonsense values in a chart.
 */
export function decodeTable<T>(
  table: string,
  fields: readonly string[],
  schema: Record<string, string[]> | undefined,
  rows: Row[] | undefined,
  build: (get: (field: string) => unknown) => T,
): T[] {
  if (!rows || rows.length === 0) return [];

  const actual = schema?.[table];
  if (!actual) throw new SchemaMismatchError(table, fields, []);
  if (actual.length !== fields.length || actual.some((f, i) => f !== fields[i])) {
    throw new SchemaMismatchError(table, fields, actual);
  }

  const index = new Map(actual.map((f, i) => [f, i]));
  return rows.map((row) => build((field) => row[index.get(field)!]));
}

export const str = (v: unknown): string => (v == null ? "" : String(v));
export const strOrNull = (v: unknown): string | null => (v == null ? null : String(v));
export const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
export const numOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);
export const boolOrNull = (v: unknown): boolean | null =>
  v == null ? null : Boolean(v);
