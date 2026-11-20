import {
  CalculationType,
  ColumnAlignment,
  ColumnType,
  DateFormatOption,
  MarkdownTableData,
  MarkdownTableRow,
  TableColumn,
} from "../types";
import { isCalculationAllowedFor } from "./calculation-engine";
import { clampColumnWidth, parseWidthParam } from "./column-width";
import { DEFAULT_DATETIME_FORMAT, formatDatetime, parseDatetimeParams } from "./datetime-utils";
import { parseDictParam } from "./dictionary";
import { formatDateByOption, parseDateByOption } from "./date-utils";
import { formatColumnAlignmentToken } from "./markdown-parser";

export function applyCellUpdate(
  tableData: MarkdownTableData,
  rowIndex: number,
  colIndex: number,
  newValue: string
): void {
  if (tableData.rows[rowIndex]) {
    tableData.rows[rowIndex].cells[colIndex] = newValue;
  }
}

/**
 * Writes the current time into the row's "datetime:autoupdate" columns, except
 * `skipColIndex` (the column being edited by hand). Returns what was written so
 * a document-level save can repeat it.
 */
export function applyAutoUpdateStamps(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  rowIndex: number,
  defaultFormat: string,
  skipColIndex?: number,
  now: Date = new Date()
): Array<{ colIndex: number; value: string }> {
  const row = tableData.rows[rowIndex];
  if (!row) return [];

  const stamps: Array<{ colIndex: number; value: string }> = [];
  for (const col of columns) {
    if (col.type !== "datetime" || !col.autoUpdate || col.index === skipColIndex) continue;
    const value = formatDatetime(now, col.datetimeFormat || defaultFormat);
    row.cells[col.index] = value;
    stamps.push({ colIndex: col.index, value });
  }
  return stamps;
}

export function applyAddRow(
  tableData: MarkdownTableData,
  columnCount: number,
  atIndex?: number,
  prefilledCells?: string[]
): MarkdownTableRow {
  const newRowCells: string[] =
    prefilledCells && prefilledCells.length === columnCount
      ? [...prefilledCells]
      : new Array<string>(columnCount).fill("");

  const insertIdx =
    atIndex !== undefined && atIndex >= 0 && atIndex <= tableData.rows.length
      ? atIndex
      : tableData.rows.length;

  const newRow: MarkdownTableRow = {
    rowIndex: insertIdx,
    rawLine: "",
    cells: newRowCells,
  };

  tableData.rows.splice(insertIdx, 0, newRow);
  tableData.rows.forEach((r, idx) => (r.rowIndex = idx));
  return newRow;
}

export function applyDuplicateRow(
  tableData: MarkdownTableData,
  rowIndex: number
): MarkdownTableRow | null {
  const source = tableData.rows[rowIndex];
  if (!source) return null;

  const duplicatedCells = [...source.cells];
  const insertIdx = rowIndex + 1;
  const newRow: MarkdownTableRow = {
    rowIndex: insertIdx,
    rawLine: "",
    cells: duplicatedCells,
  };

  tableData.rows.splice(insertIdx, 0, newRow);
  tableData.rows.forEach((r, idx) => (r.rowIndex = idx));
  return newRow;
}

export function applyDeleteRow(
  tableData: MarkdownTableData,
  rowIndex: number
): MarkdownTableRow | null {
  if (rowIndex < 0 || rowIndex >= tableData.rows.length) return null;
  const [removed] = tableData.rows.splice(rowIndex, 1);
  tableData.rows.forEach((r, idx) => (r.rowIndex = idx));
  return removed || null;
}

export const TYPE_ANNOTATION_REGEX =
  /\s*\[(text|multi-select|select|number|checkbox|datetime|date)(?::([^\]]+))?\]$/i;

export const SINGLE_SELECT_KEYWORDS =
  /^(status|priority|state|stage)$/i;

export const MULTI_SELECT_KEYWORDS =
  /^(tags?|labels?|categories|category|keywords?)$/i;

export const DATE_KEYWORDS =
  /^(date|dates|due\s*date|due|duedate|deadline|deadlines|scheduled?|schedule|created(\s*at)?|updated(\s*at)?|modified(\s*at)?|start(\s*date)?|end(\s*date)?|target(\s*date)?|completed(\s*at)?|closed(\s*at)?|published(\s*at)?|release(\s*date)?|day|timestamp)$/i;

export function stripTypeAnnotation(name: string): string {
  return name.replace(TYPE_ANNOTATION_REGEX, "").trim();
}

/** Rewrites a column's header from its current state; `explicit` defaults to "was annotated before". */
function rewriteColumnHeader(
  tableData: MarkdownTableData,
  col: TableColumn,
  colIndex: number,
  explicit = TYPE_ANNOTATION_REGEX.test(tableData.headers[colIndex] ?? "")
): void {
  if (colIndex < 0 || colIndex >= tableData.headers.length) return;
  tableData.headers[colIndex] = formatColumnHeader(col.name, col.type, col.dateFormat, {
    explicit,
    calculation: col.calculation,
    width: col.width,
    datetimeFormat: col.datetimeFormat,
    autoUpdate: col.autoUpdate,
    dictionary: col.dictionary,
  });
}

export function formatColumnHeader(
  name: string,
  type: ColumnType,
  dateFormat?: DateFormatOption,
  options: {
    explicit?: boolean;
    calculation?: CalculationType;
    width?: number;
    datetimeFormat?: string;
    autoUpdate?: boolean;
    dictionary?: string;
  } = {}
): string {
  const cleanName = stripTypeAnnotation(name);
  const calculation =
    options.calculation && options.calculation !== "none" ? options.calculation : undefined;

  // An un-annotated header is re-detected from its values on every render, so
  // a type the user picked by hand has to be written down to survive — and a
  // calculation or width has nowhere to live without one.
  const width = typeof options.width === "number" ? clampColumnWidth(options.width) : undefined;
  const dictionary =
    (type === "select" || type === "multi-select") && options.dictionary
      ? options.dictionary
      : undefined;
  if (!options.explicit && !calculation && width === undefined && !dictionary) {
    if (type === "text") {
      const wouldBeDetectedAsAnotherType =
        SINGLE_SELECT_KEYWORDS.test(cleanName) ||
        MULTI_SELECT_KEYWORDS.test(cleanName) ||
        DATE_KEYWORDS.test(cleanName);
      if (!wouldBeDetectedAsAnotherType) return cleanName;
    } else if (type === "select" && SINGLE_SELECT_KEYWORDS.test(cleanName)) {
      return cleanName;
    }
  }

  const params: string[] = [];
  if (type === "date") {
    params.push(dateFormat || "YYYY-MM-DD");
  }
  if (type === "datetime") {
    params.push(options.datetimeFormat || DEFAULT_DATETIME_FORMAT);
    if (options.autoUpdate) params.push("autoupdate");
  }
  if (dictionary) {
    params.push(`dict=${dictionary}`);
  }
  if (calculation) {
    params.push(calculation);
  }
  if (width !== undefined) {
    params.push(`w=${width}`);
  }

  return params.length > 0
    ? `${cleanName} [${type}:${params.join(",")}]`
    : `${cleanName} [${type}]`;
}

export function applyAddColumn(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  name: string,
  type: ColumnType,
  atIndex?: number,
  dateFormat?: DateFormatOption,
  datetime: { format?: string; autoUpdate?: boolean } = {}
): TableColumn {
  const insertIdx =
    atIndex !== undefined && atIndex >= 0 && atIndex <= tableData.headers.length
      ? atIndex
      : tableData.headers.length;

  const headerText = formatColumnHeader(name, type, dateFormat, {
    datetimeFormat: datetime.format,
    autoUpdate: datetime.autoUpdate,
  });
  const cleanName = stripTypeAnnotation(name);

  tableData.headers.splice(insertIdx, 0, headerText);
  if (tableData.alignments) {
    tableData.alignments.splice(
      insertIdx,
      0,
      type === "checkbox" ? ":---:" : type === "number" ? "---:" : "---"
    );
  }
  tableData.rows.forEach((r) => r.cells.splice(insertIdx, 0, ""));

  const newCol: TableColumn = {
    name: cleanName,
    index: insertIdx,
    type,
    align: type === "checkbox" ? "center" : type === "number" ? "right" : "left",
    ...(type === "date" ? { dateFormat: dateFormat || "YYYY-MM-DD" } : {}),
    ...(type === "datetime"
      ? {
          datetimeFormat: datetime.format || DEFAULT_DATETIME_FORMAT,
          ...(datetime.autoUpdate ? { autoUpdate: true } : {}),
        }
      : {}),
  };

  columns.splice(insertIdx, 0, newCol);
  columns.forEach((c, idx) => (c.index = idx));
  return newCol;
}

export function applyRenameColumn(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  colIndex: number,
  newName: string
): void {
  const col = columns[colIndex];
  const explicitTypeMatch = newName.match(TYPE_ANNOTATION_REGEX);
  const cleanName = stripTypeAnnotation(newName);
  const targetType = explicitTypeMatch
    ? (explicitTypeMatch[1].toLowerCase() as ColumnType)
    : col
    ? col.type
    : "text";

  const annotatedParams = explicitTypeMatch?.[2];
  const annotatedFormat = (annotatedParams ?? "")
    .split(",")
    .map((param) => param.trim())
    .filter(
      (param) =>
        param.length > 0 &&
        parseWidthParam(param) === undefined &&
        parseDictParam(param) === undefined
    )
    .join(",");
  const annotatedDatetime = parseDatetimeParams(annotatedParams);
  const targetDateFormat = annotatedFormat
    ? (annotatedFormat.toUpperCase() as DateFormatOption)
    : col?.dateFormat;
  const targetWidth = parseWidthParam(explicitTypeMatch?.[2]) ?? col?.width;
  const isList = targetType === "select" || targetType === "multi-select";
  const targetDictionary = isList
    ? explicitTypeMatch
      ? parseDictParam(annotatedParams)
      : col?.dictionary
    : undefined;

  if (col) {
    col.name = cleanName;
    col.type = targetType;
    if (targetWidth !== undefined) col.width = targetWidth;
    if (targetDictionary) col.dictionary = targetDictionary;
    else delete col.dictionary;
    if (targetType === "date") {
      col.dateFormat = targetDateFormat || "YYYY-MM-DD";
    } else {
      delete col.dateFormat;
    }
    if (targetType === "datetime") {
      col.datetimeFormat =
        annotatedDatetime.format || col.datetimeFormat || DEFAULT_DATETIME_FORMAT;
      if (explicitTypeMatch) col.autoUpdate = annotatedDatetime.autoUpdate || undefined;
      if (!col.autoUpdate) delete col.autoUpdate;
    } else {
      delete col.datetimeFormat;
      delete col.autoUpdate;
    }
  }

  const hadExplicitType = TYPE_ANNOTATION_REGEX.test(tableData.headers[colIndex] ?? "");
  const headerText = formatColumnHeader(
    cleanName,
    targetType,
    targetDateFormat || col?.dateFormat,
    {
      explicit: hadExplicitType || Boolean(explicitTypeMatch),
      calculation: col?.calculation,
      width: targetWidth,
      datetimeFormat: col?.datetimeFormat,
      autoUpdate: col?.autoUpdate,
      dictionary: targetDictionary,
    }
  );
  if (colIndex >= 0 && colIndex < tableData.headers.length) {
    tableData.headers[colIndex] = headerText;
  }
}

export function applyChangeColumnType(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  colIndex: number,
  newType: ColumnType,
  dateFormat?: DateFormatOption,
  datetimeFormat?: string
): void {
  const col = columns[colIndex];
  if (!col) return;

  col.type = newType;
  if (newType === "checkbox") {
    col.align = "center";
    if (tableData.alignments && colIndex < tableData.alignments.length) {
      tableData.alignments[colIndex] = ":---:";
    }
  } else if (newType === "number") {
    if (!col.align || col.align === "left") {
      col.align = "right";
      if (tableData.alignments && colIndex < tableData.alignments.length) {
        tableData.alignments[colIndex] = "---:";
      }
    }
  }
  if (newType === "date") {
    col.dateFormat = dateFormat || col.dateFormat || "YYYY-MM-DD";
  } else {
    delete col.dateFormat;
  }
  if (newType === "datetime") {
    col.datetimeFormat = datetimeFormat || col.datetimeFormat || DEFAULT_DATETIME_FORMAT;
  } else {
    delete col.datetimeFormat;
    delete col.autoUpdate;
  }

  if (newType !== "select" && newType !== "multi-select") {
    delete col.dictionary;
    delete col.dictionaryColors;
  }

  // "Sum" makes no sense on a checkbox, so an incompatible one is dropped.
  if (!isCalculationAllowedFor(newType, col.calculation)) {
    delete col.calculation;
  }

  const cleanName = stripTypeAnnotation(col.name);
  col.name = cleanName;

  rewriteColumnHeader(tableData, col, colIndex, true);
}

/** Turns "datetime:autoupdate" on or off, making the column a datetime one if it is not yet. */
export function applyChangeColumnAutoUpdate(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  colIndex: number,
  enabled: boolean,
  defaultDatetimeFormat?: string
): void {
  const col = columns[colIndex];
  if (!col) return;

  if (col.type !== "datetime") {
    applyChangeColumnType(tableData, columns, colIndex, "datetime", undefined, defaultDatetimeFormat);
  }
  if (enabled) col.autoUpdate = true;
  else delete col.autoUpdate;

  rewriteColumnHeader(tableData, col, colIndex, true);
}

/** Binds a select or multi-select column to a dictionary, or back to a custom list (undefined). */
export function applyChangeColumnDictionary(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  colIndex: number,
  dictionary: string | undefined
): void {
  const col = columns[colIndex];
  if (!col || (col.type !== "select" && col.type !== "multi-select")) return;

  if (dictionary) col.dictionary = dictionary;
  else delete col.dictionary;
  delete col.dictionaryColors;

  rewriteColumnHeader(tableData, col, colIndex);
}

export function applyChangeColumnDateFormat(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  colIndex: number,
  newDateFormat: DateFormatOption
): void {
  const col = columns[colIndex];
  if (!col || col.type !== "date") return;

  const oldFormat = col.dateFormat || "YYYY-MM-DD";
  col.dateFormat = newDateFormat;

  const cleanName = stripTypeAnnotation(col.name);
  col.name = cleanName;

  const headerText = formatColumnHeader(cleanName, "date", newDateFormat, {
    calculation: col.calculation,
    width: col.width,
  });
  if (colIndex >= 0 && colIndex < tableData.headers.length) {
    tableData.headers[colIndex] = headerText;
  }

  if (oldFormat !== newDateFormat) {
    for (const row of tableData.rows) {
      const cell = (row.cells[colIndex] || "").trim();
      if (cell) {
        const parsed = parseDateByOption(cell, oldFormat);
        if (parsed) {
          row.cells[colIndex] = formatDateByOption(parsed, newDateFormat);
        }
      }
    }
  }
}

export function applyDeleteColumn(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  colIndex: number
): void {
  if (colIndex >= 0 && colIndex < tableData.headers.length) {
    tableData.headers.splice(colIndex, 1);
    if (tableData.alignments && colIndex < tableData.alignments.length) {
      tableData.alignments.splice(colIndex, 1);
    }
    tableData.rows.forEach((r) => r.cells.splice(colIndex, 1));
  }
  if (colIndex >= 0 && colIndex < columns.length) {
    columns.splice(colIndex, 1);
    columns.forEach((c, idx) => (c.index = idx));
  }
}

export function applyChangeColumnCalculation(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  colIndex: number,
  calculation: CalculationType
): void {
  const col = columns[colIndex];
  if (!col) return;

  if (calculation === "none") {
    delete col.calculation;
  } else {
    col.calculation = calculation;
  }

  rewriteColumnHeader(tableData, col, colIndex);
}

export function applyChangeColumnWidth(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  colIndex: number,
  width: number
): void {
  const col = columns[colIndex];
  if (!col) return;

  col.width = clampColumnWidth(width);

  rewriteColumnHeader(tableData, col, colIndex);
}

export function applyChangeColumnAlignment(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  colIndex: number,
  newAlignment: ColumnAlignment
): void {
  if (colIndex < 0 || colIndex >= columns.length) return;
  const col = columns[colIndex];
  if (col) {
    col.align = newAlignment;
  }
  if (!tableData.alignments) {
    tableData.alignments = new Array<string>(tableData.headers.length).fill("---");
  }
  while (tableData.alignments.length < tableData.headers.length) {
    tableData.alignments.push("---");
  }
  tableData.alignments[colIndex] = formatColumnAlignmentToken(newAlignment);
}

export function applyReorderRows(
  tableData: MarkdownTableData,
  fromIndex: number,
  toIndex: number
): void {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= tableData.rows.length ||
    toIndex < 0 ||
    toIndex >= tableData.rows.length
  ) {
    return;
  }

  const [movedRow] = tableData.rows.splice(fromIndex, 1);
  tableData.rows.splice(toIndex, 0, movedRow);
  tableData.rows.forEach((r, idx) => (r.rowIndex = idx));
}

export function applyReorderColumns(
  tableData: MarkdownTableData,
  columns: TableColumn[],
  fromIndex: number,
  toIndex: number
): void {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= tableData.headers.length ||
    toIndex < 0 ||
    toIndex >= tableData.headers.length
  ) {
    return;
  }

  const [movedCol] = columns.splice(fromIndex, 1);
  columns.splice(toIndex, 0, movedCol);
  columns.forEach((c, idx) => (c.index = idx));

  const [movedHeader] = tableData.headers.splice(fromIndex, 1);
  tableData.headers.splice(toIndex, 0, movedHeader);

  if (tableData.alignments && tableData.alignments.length > fromIndex) {
    const [movedAlign] = tableData.alignments.splice(fromIndex, 1);
    tableData.alignments.splice(toIndex, 0, movedAlign);
  }

  tableData.rows.forEach((r) => {
    const [movedCell] = r.cells.splice(fromIndex, 1);
    r.cells.splice(toIndex, 0, movedCell);
  });
}
