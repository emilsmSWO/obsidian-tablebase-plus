import { MarkdownTableRow, SortDirection, SortRule, TableColumn } from "../types";
import { parseCellTags } from "./tag-parser";
import { compareDateStrings } from "./date-utils";
import { compareDatetimeStrings } from "./datetime-utils";
import { stripCodeSpans } from "../utils/link-renderer";

const CHECKED_VALUES = new Set<string>([
  "[x]",
  "x",
  "true",
  "yes",
  "1",
  "✓",
  "✔",
]);

const CURRENCY_AND_PERCENT = /[$€£¥₽%]/g;
const WHITESPACE = /\s+/g;
const NON_NUMERIC = /[^\d.-]/g;

export function isCellChecked(cell: string): boolean {
  return CHECKED_VALUES.has((cell || "").trim().toLowerCase());
}

export function parseCellNumber(cell: string): number {
  if (!cell) return NaN;
  let s = cell.trim().replace(CURRENCY_AND_PERCENT, "").replace(WHITESPACE, "");

  if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  } else if (s.includes(",") && s.includes(".")) {
    if (s.indexOf(",") < s.indexOf(".")) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/\./g, "").replace(",", ".");
    }
  }

  return parseFloat(s.replace(NON_NUMERIC, ""));
}

function isEmptyCell(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "-";
}

function compareByType(
  valA: string,
  valB: string,
  columnType: TableColumn["type"],
  datetimeFormat?: string
): number {
  switch (columnType) {
    case "number": {
      const numA = parseCellNumber(valA);
      const numB = parseCellNumber(valB);
      if (isNaN(numA) && isNaN(numB)) return 0;
      if (isNaN(numA)) return 1;
      if (isNaN(numB)) return -1;
      return numA - numB;
    }

    case "checkbox": {
      return (isCellChecked(valA) ? 1 : 0) - (isCellChecked(valB) ? 1 : 0);
    }

    case "multi-select": {
      const tagsA = parseCellTags(valA);
      const tagsB = parseCellTags(valB);
      const nameA = tagsA.length > 0 ? tagsA[0].name.toLowerCase() : "";
      const nameB = tagsB.length > 0 ? tagsB[0].name.toLowerCase() : "";
      return nameA.localeCompare(nameB);
    }

    case "date": {
      return compareDateStrings(valA, valB);
    }

    case "datetime": {
      return compareDatetimeStrings(valA, valB, datetimeFormat);
    }

    case "text":
    case "select":
    default: {
      return valA.localeCompare(valB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }
  }
}

interface SortKey {
  value: string;
  empty: boolean;
}

function toSortKey(row: MarkdownTableRow, columnIndex: number): SortKey {
  const value = stripCodeSpans(row.cells[columnIndex] || "");
  return { value, empty: isEmptyCell(value) };
}

function compareSortKeys(
  a: SortKey,
  b: SortKey,
  direction: SortDirection,
  columnType: TableColumn["type"],
  datetimeFormat?: string
): number {
  if (a.empty && b.empty) return 0;
  if (a.empty) return 1;
  if (b.empty) return -1;

  const factor = direction === "asc" ? 1 : -1;
  return compareByType(a.value, b.value, columnType, datetimeFormat) * factor;
}

export function sortRowsByRules(
  rows: MarkdownTableRow[],
  sortRules: SortRule[],
  columns: TableColumn[]
): MarkdownTableRow[] {
  if (!sortRules || sortRules.length === 0) {
    return rows;
  }

  // Sort keys are computed once per row instead of on every comparison.
  const keyed = rows.map((row) => ({
    row,
    keys: sortRules.map((rule) => toSortKey(row, rule.columnIndex)),
  }));

  keyed.sort((a, b) => {
    for (let i = 0; i < sortRules.length; i++) {
      const rule = sortRules[i];
      const column = columns[rule.columnIndex];
      const result = compareSortKeys(
        a.keys[i],
        b.keys[i],
        rule.direction,
        column ? column.type : "text",
        column?.datetimeFormat
      );
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  });
  return keyed.map((entry) => entry.row);
}
