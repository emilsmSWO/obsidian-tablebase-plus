import { MarkdownPostProcessorContext, MarkdownSectionInformation } from "obsidian";
import { findTargetTable, parseMarkdownTables } from "../core/markdown-parser";
import { resolveTableId } from "../core/table-id";
import { stripTypeAnnotation } from "../core/table-mutator";
import { cellElementToMarkdown } from "./cell-markdown";
import { toPlainText } from "../utils/link-renderer";
import { TableViewController } from "../services/table-view-controller";
import { TableViewRegistry } from "../services/table-view-registry";
import { SettingsService } from "../services/settings-service";
import { MarkdownTableData, MarkdownTableRow } from "../types";
import { isPrintMode } from "./print-mode";
import { TableRenderChild } from "./table-render-child";

const SKIP_CONTAINER_CLASSES = ["ms-notion-database-container", "ms-kanban-container"];

export class TablePostProcessor {
  private viewController: TableViewController;
  private registry: TableViewRegistry;
  private settingsService: SettingsService;

  constructor(
    viewController: TableViewController,
    registry: TableViewRegistry,
    settingsService: SettingsService
  ) {
    this.viewController = viewController;
    this.registry = registry;
    this.settingsService = settingsService;
  }

  public process(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (isPrintMode(el) || !this.settingsService.getSettings().autoConvertMarkdownTables) {
      return;
    }

    if (SKIP_CONTAINER_CLASSES.some((cls) => el.classList.contains(cls))) {
      return;
    }

    const tables = el.querySelectorAll("table");
    tables.forEach((tableEl, tableIndex) => {
      this.enhanceTable(tableEl, ctx, tableIndex);
    });
  }

  private shouldSkip(tableEl: HTMLTableElement): boolean {
    if (tableEl.dataset.msEnhanced === "true") return true;
    if (tableEl.classList.contains("ms-db-grid-table")) return true;
    if (SKIP_CONTAINER_CLASSES.some((cls) => tableEl.closest(`.${cls}`))) return true;
    return Boolean(
      tableEl.previousElementSibling?.classList.contains("ms-notion-database-container")
    );
  }

  /**
   * Column alignment lives in the delimiter row, which the renderer does not
   * reproduce in the DOM, so it has to be read back from the note itself.
   */
  private findSourceTable(
    sectionInfo: MarkdownSectionInformation | null,
    docTables: MarkdownTableData[],
    headers: string[],
    rowCount: number,
    tableIndex: number
  ): MarkdownTableData | undefined {
    if (!sectionInfo?.text) return undefined;

    const candidate = findTargetTable(
      docTables,
      sectionInfo.lineStart,
      headers,
      tableIndex
    );
    if (!candidate) return undefined;
    if (candidate.headers.length !== headers.length) return undefined;
    if (candidate.rows.length !== rowCount) return undefined;

    return candidate;
  }

  /**
   * Takes the header from the note whenever it is the rendered text plus a type
   * annotation, so a "[text]"-style suffix survives even if the renderer drops
   * it. Anything else (formatting, links) keeps the rendered text.
   */
  private reconcileHeaders(
    renderedHeaders: string[],
    source: MarkdownTableData | undefined
  ): string[] {
    if (!source) return [...renderedHeaders];

    return renderedHeaders.map((rendered, index) => {
      const fromSource = source.headers[index];
      if (!fromSource) return rendered;
      return stripTypeAnnotation(fromSource) === rendered ? fromSource : rendered;
    });
  }

  /**
   * Rendered cells are read back as Markdown with their links intact. Where
   * that has the same visible text as the source cell, the source wins (it
   * keeps the exact link syntax); anything else (bold, italics) keeps what was
   * rendered, since the grid cannot draw it back.
   */
  private reconcileRows(
    renderedRows: MarkdownTableRow[],
    source: MarkdownTableData | undefined
  ): MarkdownTableRow[] {
    if (!source) return renderedRows;

    return renderedRows.map((row, rowIndex) => {
      const sourceRow = source.rows[rowIndex];
      if (!sourceRow) return row;

      return {
        ...row,
        rawLine: sourceRow.rawLine,
        cells: row.cells.map((rendered, colIndex) => {
          const fromSource = sourceRow.cells[colIndex];
          if (fromSource === undefined) return rendered;
          return toPlainText(fromSource) === toPlainText(rendered) ? fromSource : rendered;
        }),
      };
    });
  }

  private enhanceTable(
    tableEl: HTMLTableElement,
    ctx: MarkdownPostProcessorContext,
    tableIndex: number
  ): void {
    if (this.shouldSkip(tableEl)) return;

    const headers = Array.from(tableEl.querySelectorAll("thead th")).map(
      (th) => th.textContent?.trim() ?? ""
    );
    if (headers.length === 0) return;

    tableEl.dataset.msEnhanced = "true";

    const rows: MarkdownTableRow[] = Array.from(
      tableEl.querySelectorAll<HTMLTableRowElement>("tbody tr")
    ).map((tr, rowIndex) => ({
      rowIndex,
      rawLine: "",
      cells: Array.from(tr.querySelectorAll("td")).map((td) => cellElementToMarkdown(td)),
    }));

    const sectionInfo = ctx.getSectionInfo?.(tableEl) ?? null;
    const startLine = sectionInfo ? sectionInfo.lineStart : -1;
    const endLine = sectionInfo ? sectionInfo.lineEnd : -1;
    const docTables = sectionInfo?.text ? parseMarkdownTables(sectionInfo.text) : [];
    const source = this.findSourceTable(sectionInfo, docTables, headers, rows.length, tableIndex);

    const tableData: MarkdownTableData = {
      // The renderer is called once per section, so `tableIndex` says nothing about
      // which table of the note this is; the position in the text does.
      id: resolveTableId(ctx.sourcePath, sectionInfo, docTables, headers, tableIndex),
      headers: this.reconcileHeaders(headers, source),
      alignments: source
        ? [...source.alignments]
        : new Array<string>(headers.length).fill("---"),
      rows: this.reconcileRows(rows, source),
      startLine,
      endLine,
      rawMarkdown: source ? source.rawMarkdown : "",
    };

    const view = this.viewController.createInlineTableView({
      sourcePath: ctx.sourcePath,
      tableData,
      startLine,
      tableIndex,
    });

    const viewEl = view.getElement();
    tableEl.addClass("ms-table-hidden");
    tableEl.parentNode?.insertBefore(viewEl, tableEl);

    const parentEl = viewEl.parentElement;
    if (parentEl) {
      parentEl.addClass("ms-enhanced-table-wrapper");
    }

    ctx.addChild(new TableRenderChild(viewEl, view, this.registry));
  }
}
