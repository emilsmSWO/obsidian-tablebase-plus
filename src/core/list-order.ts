/** Saved option order of select and multi-select columns: table id -> column name -> option names. */
export type ListOrders = Record<string, Record<string, string[]>>;

/**
 * Saved order first, then new options in the order the table has them. Saved options the table
 * no longer uses are dropped unless `keepUnused` is set.
 */
export function mergeListOrder(saved: string[], current: string[], keepUnused = false): string[] {
  const inUse = new Set(current);
  const kept = keepUnused ? saved : saved.filter((name) => inUse.has(name));
  const keptSet = new Set(kept);
  return [...kept, ...current.filter((name) => !keptSet.has(name))];
}

function pathMatches(tableId: string, path: string): boolean {
  return tableId.startsWith(`tbl_${path}_`) || tableId.startsWith(`tbl_${path}/`);
}

/**
 * Follows a renamed note or folder (`newPath`) or drops the entries of a deleted one (`null`).
 * Returns null when no entry is affected.
 */
export function moveListOrders(
  orders: ListOrders,
  oldPath: string,
  newPath: string | null
): ListOrders | null {
  const next: ListOrders = {};
  let changed = false;
  for (const [tableId, columns] of Object.entries(orders)) {
    if (!pathMatches(tableId, oldPath)) {
      next[tableId] = columns;
      continue;
    }
    changed = true;
    if (newPath !== null) next[`tbl_${newPath}${tableId.slice(4 + oldPath.length)}`] = columns;
  }
  return changed ? next : null;
}

/** Drops the entries of notes that no longer exist. Returns null when nothing is dropped. */
export function pruneListOrders(
  orders: ListOrders,
  exists: (path: string) => boolean
): ListOrders | null {
  const next: ListOrders = {};
  let changed = false;
  for (const [tableId, columns] of Object.entries(orders)) {
    const rest = tableId.startsWith("tbl_") ? tableId.slice(4) : "";
    let found = false;
    for (let i = rest.indexOf("_"); i > 0 && !found; i = rest.indexOf("_", i + 1)) {
      found = exists(rest.slice(0, i));
    }
    if (found) next[tableId] = columns;
    else changed = true;
  }
  return changed ? next : null;
}
