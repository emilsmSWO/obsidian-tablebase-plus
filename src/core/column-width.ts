import { TableColumn } from "../types";

export const DEFAULT_COLUMN_WIDTH = 240;
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 2000;
export const INDEX_COLUMN_WIDTH = 42;
export const ADD_COLUMN_WIDTH = 28;

const WIDTH_PARAM = /^w=(\d+)$/i;

export function clampColumnWidth(width: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}

/** Reads "w=300" out of a header annotation's parameter list ("sum,w=300"). */
export function parseWidthParam(params: string | undefined): number | undefined {
  for (const param of (params ?? "").split(",")) {
    const match = WIDTH_PARAM.exec(param.trim());
    if (match) return clampColumnWidth(Number(match[1]));
  }
  return undefined;
}

export function resolveColumnWidth(
  column: Pick<TableColumn, "width">,
  defaultWidth: number | undefined
): number {
  const width = column.width ?? defaultWidth;
  return typeof width === "number" && Number.isFinite(width)
    ? clampColumnWidth(width)
    : DEFAULT_COLUMN_WIDTH;
}

export function computeTableWidth(
  columns: TableColumn[],
  defaultWidth: number | undefined,
  showRowNumbers: boolean
): number {
  const data = columns.reduce((sum, col) => sum + resolveColumnWidth(col, defaultWidth), 0);
  return data + ADD_COLUMN_WIDTH + (showRowNumbers ? INDEX_COLUMN_WIDTH : 0);
}
