import { MarkdownPostProcessorContext } from "obsidian";
import { parseMarkdownTables } from "../core/markdown-parser";
import { resolveTableId } from "../core/table-id";
import { TableViewController } from "../services/table-view-controller";
import { TableViewRegistry } from "../services/table-view-registry";
import { isPrintMode } from "./print-mode";
import { TableRenderChild } from "./table-render-child";

export const TABLE_CODE_BLOCK_LANGUAGES = ["tablebase", "table", "notion-table"] as const;

export class TableCodeBlockProcessor {
  private viewController: TableViewController;
  private registry: TableViewRegistry;

  constructor(viewController: TableViewController, registry: TableViewRegistry) {
    this.viewController = viewController;
    this.registry = registry;
  }

  public process(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): void {
    if (isPrintMode(el)) {
      return;
    }

    const tables = parseMarkdownTables(source);
    if (tables.length === 0) {
      el.createDiv({ cls: "ms-empty-codeblock", text: "Empty table block" });
      return;
    }

    const tableData = tables[0];
    // Positions inside the block say nothing about the note, so the id comes from
    // where the block sits among the note's tables.
    const section = ctx.getSectionInfo?.(el);
    const docTables = section?.text ? parseMarkdownTables(section.text) : [];
    tableData.id = resolveTableId(ctx.sourcePath, section, docTables, tableData.headers);

    const view = this.viewController.createCodeBlockView({
      sourcePath: ctx.sourcePath,
      tableData,
      initialSource: source,
      getLineStart: () => ctx.getSectionInfo(el)?.lineStart,
    });

    const viewEl = view.getElement();
    el.appendChild(viewEl);
    ctx.addChild(new TableRenderChild(viewEl, view, this.registry));
  }
}
