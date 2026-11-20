import { MarkdownTableData } from "../types";

/**
 * A table's position among all tables of the note, counted over the whole text.
 * `lineStart`/`lineEnd` bound the rendered section (a table block or a fenced
 * code block); `indexInSection` picks one when a section holds several tables.
 */
function findTableOrdinal(
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

/**
 * Id of a rendered table: its position in the note when the note text is known,
 * otherwise (embeds, hover previews) its headers, which still keep tables of the
 * same note apart.
 */
export function resolveTableId(
  sourcePath: string,
  section: { lineStart: number; lineEnd: number } | null | undefined,
  docTables: MarkdownTableData[],
  headers: string[],
  indexInSection = 0
): string {
  const ordinal = section
    ? findTableOrdinal(docTables, section.lineStart, section.lineEnd, indexInSection)
    : undefined;
  const path = sourcePath || "doc";
  return ordinal !== undefined
    ? `tbl_${path}_${ordinal}`
    : `tbl_${path}_${headers.join("|")}_${indexInSection}`;
}
