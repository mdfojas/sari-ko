// Builds a Postgres `SET col = $1, ...` fragment from a plain object, skipping
// any key whose value is `undefined` (a field the caller didn't ask to update).
export function buildSetClause(fields: Record<string, unknown>): { setClause: string; values: unknown[] } {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    values.push(value);
    columns.push(`${column} = $${values.length}`);
  }

  return { setClause: columns.join(', '), values };
}
