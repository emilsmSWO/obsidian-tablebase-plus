import { MarkdownTableRow, TableColumn, TableFilterState } from "../types";
import { evaluateFilterStateOnRow } from "./filter-engine";
import { sortRowsByRules } from "./sort-engine";

/** Rows that pass the filters; the table view also applies the sort rules, the board does not. */
export function getVisibleRows(
  rows: MarkdownTableRow[],
  filterState: TableFilterState | undefined,
  columns: TableColumn[],
  applySort = false
): MarkdownTableRow[] {
  if (!filterState) return rows;
  const filtered = rows.filter((row) => evaluateFilterStateOnRow(row, filterState, columns));
  return applySort ? sortRowsByRules(filtered, filterState.sortRules ?? [], columns) : filtered;
}
