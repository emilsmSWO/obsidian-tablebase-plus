import { MarkdownTableData } from "../types";

/**
 * A table's position among all tables of the note, counted over the whole text.
 * `lineStart`/`lineEnd` bound the rendered section (a table block or a fenced
 * code block); `indexInSection` picks one when a section holds several tables.
 */
export function findTableOrdinal(
  docTables: MarkdownTableData[],
  lineStart: number,
  lineEnd: number,
  indexInSection = 0
): number | undefined {
  const inSection: number[] = [];
  docTables.forEach((table, ordinal) => {
    if (table.startLine >= lineStart && table.startLine <= lineEnd) inSection.push(ordinal);
  });
  if (inSection.length === 0) return undefined;
  return inSection[Math.min(Math.max(indexInSection, 0), inSection.length - 1)];
}

export function createTableId(sourcePath: string, ordinal: number): string {
  return `tbl_${sourcePath || "doc"}_${ordinal}`;
}

/**
 * Used when the note text is not available (embeds, hover previews). The header
 * text keeps tables of the same note apart where the position is unknown.
 */
export function createFallbackTableId(
  sourcePath: string,
  headers: string[],
  index: number
): string {
  let hash = 5381;
  for (const char of headers.join("\u0001")) {
    hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  }
  return `tbl_${sourcePath || "doc"}_h${hash.toString(36)}_${index}`;
}
