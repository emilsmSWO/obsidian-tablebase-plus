import { describe, it, expect } from "vitest";
import { getVisibleRows } from "../src/core/visible-rows";
import { MarkdownTableRow, TableColumn, TableFilterState } from "../src/types";

const columns: TableColumn[] = [{ name: "Name", index: 0, type: "text" }];
const rows: MarkdownTableRow[] = ["Cherry", "Apple", "Banana"].map((name, i) => ({
  rowIndex: i,
  rawLine: "",
  cells: [name],
}));
const state = {
  tableId: "t",
  conjunction: "AND",
  rules: [],
  sortRules: [{ column: "Name", columnIndex: 0, direction: "asc" }],
  searchQuery: "an",
  isFilterOpen: false,
  isSortOpen: false,
} as TableFilterState;

describe("getVisibleRows", () => {
  it("returns all rows without a filter state", () => {
    expect(getVisibleRows(rows, undefined, columns, true)).toBe(rows);
  });

  it("filters and keeps the row order unless sorting is requested", () => {
    expect(getVisibleRows(rows, state, columns).map((r) => r.cells[0])).toEqual(["Banana"]);
    const all = { ...state, searchQuery: "" };
    expect(getVisibleRows(rows, all, columns).map((r) => r.cells[0])).toEqual(["Cherry", "Apple", "Banana"]);
    expect(getVisibleRows(rows, all, columns, true).map((r) => r.cells[0])).toEqual(["Apple", "Banana", "Cherry"]);
  });
});
