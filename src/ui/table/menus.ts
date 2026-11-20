import { Notice } from "obsidian";
import { getCalculationOptionsForColumnType } from "../../core/calculation-engine";
import { exportTableToCSV } from "../../core/markdown-parser";
import { ColumnAlignment, TableColumn } from "../../types";
import { appendIcon, createMenuItem } from "../../utils/dom";
import {
  COLUMN_TYPE_DEFINITIONS,
  getColumnTypeIcon,
  ICON_ALIGN_CENTER,
  ICON_ALIGN_LEFT,
  ICON_ALIGN_RIGHT,
  ICON_ARROW_DOWN,
  ICON_ARROW_LEFT,
  ICON_ARROW_RIGHT,
  ICON_ARROW_UP,
  ICON_CHECK,
  ICON_CHEVRON_RIGHT,
  ICON_CLEAR,
  ICON_COPY,
  ICON_DOWNLOAD,
  ICON_DUPLICATE,
  ICON_EDIT,
  ICON_EYE_OFF,
  ICON_TRASH,
  ICON_TYPE_NUMBER,
} from "../icons";
import { confirmAction } from "../modals/confirm-modal";
import { RenameColumnModal } from "../modals/rename-column-modal";
import { mountFloatingPopover } from "../popover";
import { resolveColumnAlignment } from "./cells";
import { TableViewContext } from "./types";

const ALIGNMENT_OPTIONS: { align: ColumnAlignment; label: string; icon: string }[] = [
  { align: "left", label: "Align left", icon: ICON_ALIGN_LEFT },
  { align: "center", label: "Align center", icon: ICON_ALIGN_CENTER },
  { align: "right", label: "Align right", icon: ICON_ALIGN_RIGHT },
];

function createMenuElement(...classNames: string[]): HTMLElement {
  return createDiv({
    cls: ["ms-col-header-menu", ...classNames].join(" ").trim(),
  });
}

function addMenuItem(
  menu: HTMLElement,
  icon: string,
  label: string,
  onClick: () => void,
  options: { danger?: boolean } = {}
): HTMLElement {
  return createMenuItem(
    menu,
    icon,
    label,
    () => {
      onClick();
      menu.remove();
    },
    options
  );
}

function addCheckableItem(
  container: HTMLElement,
  icon: string,
  label: string,
  isSelected: boolean,
  onClick: () => void
): HTMLElement {
  const item = container.createDiv({
    cls: `ms-menu-item ${isSelected ? "is-selected" : ""}`,
  });
  appendIcon(item.createSpan({ cls: "ms-menu-icon" }), icon);
  item.createSpan({ text: label });
  if (isSelected) {
    appendIcon(item.createSpan({ cls: "ms-check" }), ICON_CHECK);
  }
  item.addEventListener("click", onClick);
  return item;
}

function removeExistingMenu(): void {
  document.querySelector(".ms-col-header-menu")?.remove();
}

export class TableMenus {
  private ctx: TableViewContext;
  private openAddColumnModal: (atIndex?: number) => void;
  private activeMenu: "properties" | "export" | null = null;
  private closeCurrentPopover?: () => void;

  constructor(ctx: TableViewContext, openAddColumnModal: (atIndex?: number) => void) {
    this.ctx = ctx;
    this.openAddColumnModal = openAddColumnModal;
  }

  public get openMenuKind(): "properties" | "export" | null {
    return this.activeMenu;
  }

  public closeActivePopover(): void {
    this.closeCurrentPopover?.();
    this.closeCurrentPopover = undefined;
  }

  private mountAnchoredMenu(
    anchor: HTMLElement,
    menu: HTMLElement,
    kind: "properties" | "export",
    className: string
  ): void {
    this.activeMenu = kind;
    anchor.classList.add("is-active");

    this.closeCurrentPopover = mountFloatingPopover({
      anchorEl: anchor,
      popoverEl: menu,
      className,
      offsetTop: 4,
      onClose: () => {
        this.activeMenu = null;
        this.closeCurrentPopover = undefined;
        anchor.classList.remove("is-active");
      },
    });
  }

  public openIndexHeaderMenu(anchor: HTMLElement): void {
    removeExistingMenu();

    const isVisible = this.ctx.isRowNumbersVisible();
    const menu = createMenuElement();

    addMenuItem(
      menu,
      isVisible ? ICON_EYE_OFF : ICON_TYPE_NUMBER,
      isVisible ? "Hide row numbers" : "Show row numbers",
      () => this.setRowNumbersVisible(!isVisible)
    );

    mountFloatingPopover({ anchorEl: anchor, popoverEl: menu, offsetTop: 2 });
  }

  private setRowNumbersVisible(visible: boolean): void {
    this.ctx.filterState.showRowNumbers = visible;
    this.ctx.actions.onFilterChange(this.ctx.filterState);
    this.ctx.render();
  }

  public openPropertiesMenu(anchor: HTMLElement): void {
    const menu = createMenuElement("ms-props-menu");

    menu.createDiv({ cls: "ms-menu-section-title", text: "Table Options" });

    const isRowNumbersVisible = this.ctx.isRowNumbersVisible();
    const rowNumbersItem = menu.createDiv({
      cls: `ms-menu-item ms-prop-toggle-item ${isRowNumbersVisible ? "is-selected" : ""}`,
    });
    appendIcon(rowNumbersItem.createSpan({ cls: "ms-prop-icon" }), ICON_TYPE_NUMBER);
    rowNumbersItem.createSpan({ text: "Row numbers" });
    const rowNumbersCheck = rowNumbersItem.createSpan({ cls: "ms-prop-check" });
    if (isRowNumbersVisible) {
      appendIcon(rowNumbersCheck, ICON_CHECK);
    }
    rowNumbersItem.addEventListener("click", () => {
      this.closeActivePopover();
      this.setRowNumbersVisible(!isRowNumbersVisible);
    });

    const showCalculationRow = this.ctx.filterState.showCalculationRow === true;
    const calculationRowItem = menu.createDiv({
      cls: `ms-menu-item ms-prop-toggle-item ${showCalculationRow ? "is-selected" : ""}`,
    });
    appendIcon(calculationRowItem.createSpan({ cls: "ms-prop-icon" }), ICON_TYPE_NUMBER);
    calculationRowItem.createSpan({ text: "Calculation row" });
    const calculationRowCheck = calculationRowItem.createSpan({ cls: "ms-prop-check" });
    if (showCalculationRow) {
      appendIcon(calculationRowCheck, ICON_CHECK);
    }
    calculationRowItem.addEventListener("click", () => {
      this.closeActivePopover();
      this.ctx.filterState.showCalculationRow = !showCalculationRow;
      this.ctx.actions.onFilterChange(this.ctx.filterState);
      this.ctx.render();
    });

    menu.createDiv({ cls: "ms-menu-divider" });
    menu.createDiv({ cls: "ms-menu-section-title", text: "Visible Properties" });

    const hiddenIndices = this.ctx.filterState.hiddenColumnIndices ?? [];

    for (const col of this.ctx.columns) {
      const isVisible = !hiddenIndices.includes(col.index);
      const row = menu.createDiv({
        cls: `ms-menu-item ms-prop-toggle-item ${isVisible ? "is-selected" : ""}`,
      });
      appendIcon(row.createSpan({ cls: "ms-prop-icon" }), getColumnTypeIcon(col.type));
      row.createSpan({ text: col.name });
      const check = row.createSpan({ cls: "ms-prop-check" });
      if (isVisible) {
        appendIcon(check, ICON_CHECK);
      }

      row.addEventListener("click", () => {
        this.toggleColumnVisibility(col.index, isVisible);
      });
    }

    this.mountAnchoredMenu(anchor, menu, "properties", "ms-props-menu");
  }

  private toggleColumnVisibility(columnIndex: number, isCurrentlyVisible: boolean): void {
    const hiddenIndices = [...(this.ctx.filterState.hiddenColumnIndices ?? [])];

    if (isCurrentlyVisible) {
      hiddenIndices.push(columnIndex);
    } else {
      const position = hiddenIndices.indexOf(columnIndex);
      if (position !== -1) {
        hiddenIndices.splice(position, 1);
      }
    }

    this.ctx.filterState.hiddenColumnIndices = hiddenIndices;
    this.ctx.actions.onFilterChange(this.ctx.filterState);
    this.closeActivePopover();
    this.ctx.render();
  }

  public openExportMenu(anchor: HTMLElement): void {
    const menu = createMenuElement("ms-export-menu");

    const buildCsv = (): string =>
      exportTableToCSV(this.ctx.tableData, this.ctx.filterState.hiddenColumnIndices ?? []);

    createMenuItem(menu, ICON_COPY, "Copy table as CSV", () => {
      void (async () => {
        try {
          await navigator.clipboard.writeText(buildCsv());
          new Notice("Table CSV copied to clipboard!");
        } catch {
          new Notice("Could not copy CSV to clipboard.");
        }
        this.closeActivePopover();
      })();
    });

    createMenuItem(menu, ICON_DOWNLOAD, "Download CSV file", () => {
      const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = createEl("a");
      link.href = url;
      link.download = `table_export_${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      new Notice("Table CSV downloaded!");
      this.closeActivePopover();
    });

    this.mountAnchoredMenu(anchor, menu, "export", "ms-export-menu");
  }

  private populateRowActions(menu: HTMLElement, rowIndex: number): void {
    const { actions, tableData } = this.ctx;

    addMenuItem(menu, ICON_ARROW_UP, "Insert row above", () => {
      void actions.onAddRow(rowIndex);
    });
    addMenuItem(menu, ICON_ARROW_DOWN, "Insert row below", () => {
      void actions.onAddRow(rowIndex + 1);
    });
    addMenuItem(menu, ICON_DUPLICATE, "Duplicate row", () => {
      void actions.onDuplicateRow(rowIndex);
    });

    const totalRows = tableData.rows.length;
    if (totalRows > 1) {
      menu.createDiv({ cls: "ms-menu-divider" });

      if (rowIndex > 0) {
        addMenuItem(menu, ICON_ARROW_UP, "Move row up", () => {
          void this.moveRow(rowIndex, rowIndex - 1);
        });
      }
      if (rowIndex < totalRows - 1) {
        addMenuItem(menu, ICON_ARROW_DOWN, "Move row down", () => {
          void this.moveRow(rowIndex, rowIndex + 1);
        });
      }
    }

    menu.createDiv({ cls: "ms-menu-divider" });
    addMenuItem(
      menu,
      ICON_TRASH,
      "Delete row",
      () => {
        void actions.onDeleteRow(rowIndex);
      },
      { danger: true }
    );
  }

  public async moveRow(fromIndex: number, toIndex: number): Promise<void> {
    const { filterState, actions } = this.ctx;

    if (filterState.sortRules && filterState.sortRules.length > 0) {
      filterState.sortRules = [];
      actions.onSortChange([]);
      new Notice("Sort rules cleared to apply manual row order.");
    }

    await actions.onReorderRows(fromIndex, toIndex);
  }

  public openRowContextMenu(anchor: HTMLElement, rowIndex: number): void {
    removeExistingMenu();

    const menu = createMenuElement("ms-row-context-menu");
    this.populateRowActions(menu, rowIndex);

    mountFloatingPopover({
      anchorEl: anchor,
      popoverEl: menu,
      offsetTop: 2,
      positionToSide: true,
      alwaysBelow: true,
      onClose: () => {
        if (this.ctx.selection.isRowFocused(rowIndex)) {
          this.ctx.clearFocus();
        }
      },
    });
  }

  public openCellContextMenu(
    anchor: HTMLElement,
    rowIndex: number,
    colIndex: number,
    column: TableColumn
  ): void {
    removeExistingMenu();

    const menu = createMenuElement("ms-cell-context-menu");
    this.populateRowActions(menu, rowIndex);
    menu.createDiv({ cls: "ms-menu-divider" });

    addMenuItem(menu, ICON_ARROW_LEFT, "Insert column left", () =>
      this.openAddColumnModal(colIndex)
    );
    addMenuItem(menu, ICON_ARROW_RIGHT, "Insert column right", () =>
      this.openAddColumnModal(colIndex + 1)
    );
    addMenuItem(menu, ICON_EDIT, `Rename column "${column.name}"`, () =>
      this.openRenameModal(column, colIndex)
    );
    addMenuItem(
      menu,
      ICON_TRASH,
      `Delete column "${column.name}"`,
      () => this.confirmDeleteColumn(column, colIndex),
      { danger: true }
    );

    if (column.type !== "checkbox") {
      menu.createDiv({ cls: "ms-menu-divider" });
      this.appendAlignmentSection(menu, column, colIndex);
    }
    menu.createDiv({ cls: "ms-menu-divider" });

    addMenuItem(menu, ICON_CLEAR, "Clear cell", () => {
      void this.ctx.actions.onCellUpdate(rowIndex, colIndex, "");
    });

    mountFloatingPopover({
      anchorEl: anchor,
      popoverEl: menu,
      offsetTop: 2,
      positionToSide: true,
      alwaysBelow: true,
      onClose: () => {
        if (this.ctx.selection.isCellFocused(rowIndex, colIndex)) {
          this.ctx.clearFocus();
        }
      },
    });
  }

  private appendAlignmentSection(
    menu: HTMLElement,
    column: TableColumn,
    columnIndex: number
  ): void {
    if (column.type === "checkbox") return;
    const section = menu.createDiv({ cls: "ms-menu-section" });
    section.createDiv({ cls: "ms-menu-section-title", text: "Text alignment" });

    const currentAlign = resolveColumnAlignment(column);
    for (const option of ALIGNMENT_OPTIONS) {
      const isSelected = currentAlign === option.align;
      addCheckableItem(section, option.icon, option.label, isSelected, () => {
        void this.ctx.actions.onColumnAlignmentChange(columnIndex, option.align);
        menu.remove();
      });
    }
  }

  public openRenameModal(column: TableColumn, columnIndex: number): void {
    new RenameColumnModal({
      app: this.ctx.app,
      currentName: column.name,
      onSave: async (newName) => {
        await this.ctx.actions.onRenameColumn(columnIndex, newName);
      },
    }).open();
  }

  private confirmDeleteColumn(column: TableColumn, columnIndex: number): void {
    confirmAction({
      app: this.ctx.app,
      title: "Delete property",
      message: `Delete column "${column.name}" and all of its values?`,
      confirmText: "Delete",
      destructive: true,
      onConfirm: async () => {
        await this.ctx.actions.onDeleteColumn(columnIndex);
      },
    });
  }

  public openColumnHeaderMenu(
    anchor: HTMLElement,
    column: TableColumn,
    columnIndex: number
  ): void {
    removeExistingMenu();

    const menu = createMenuElement();
    const nameInput = this.appendColumnNameRow(menu, column, columnIndex);

    menu.createDiv({ cls: "ms-menu-divider" });

    addMenuItem(menu, ICON_ARROW_UP, "Sort ascending", () => {
      this.ctx.actions.onSortChange([
        { column: column.name, columnIndex, direction: "asc" },
      ]);
    });
    addMenuItem(menu, ICON_ARROW_DOWN, "Sort descending", () => {
      this.ctx.actions.onSortChange([
        { column: column.name, columnIndex, direction: "desc" },
      ]);
    });

    menu.createDiv({ cls: "ms-menu-divider" });

    addMenuItem(menu, ICON_EYE_OFF, "Hide in view", () => {
      const hidden = this.ctx.filterState.hiddenColumnIndices ?? [];
      if (hidden.includes(columnIndex)) return;
      this.ctx.filterState.hiddenColumnIndices = [...hidden, columnIndex];
      this.ctx.actions.onFilterChange(this.ctx.filterState);
      this.ctx.render();
    });

    if (column.type !== "checkbox") {
      menu.createDiv({ cls: "ms-menu-divider" });
      this.appendAlignmentSection(menu, column, columnIndex);
    }
    menu.createDiv({ cls: "ms-menu-divider" });
    this.appendColumnTypeSection(menu, column, columnIndex);
    menu.createDiv({ cls: "ms-menu-divider" });

    addMenuItem(menu, ICON_ARROW_LEFT, "Insert left", () =>
      this.openAddColumnModal(columnIndex)
    );
    addMenuItem(menu, ICON_ARROW_RIGHT, "Insert right", () =>
      this.openAddColumnModal(columnIndex + 1)
    );

    menu.createDiv({ cls: "ms-menu-divider" });
    addMenuItem(
      menu,
      ICON_TRASH,
      "Delete property",
      () => this.confirmDeleteColumn(column, columnIndex),
      { danger: true }
    );

    mountFloatingPopover({
      anchorEl: anchor,
      popoverEl: menu,
      className: "ms-col-header-menu",
      offsetTop: 2,
      positionToSide: true,
      alwaysBelow: true,
      onClose: () => {
        if (this.ctx.selection.isColumnFocused(columnIndex)) {
          this.ctx.clearFocus();
        }
      },
    });

    window.requestAnimationFrame(() => {
      nameInput.focus();
      nameInput.select();
    });
  }

  private appendColumnNameRow(
    menu: HTMLElement,
    column: TableColumn,
    columnIndex: number
  ): HTMLInputElement {
    const headerRow = menu.createDiv({ cls: "ms-col-menu-name-row" });
    appendIcon(
      headerRow.createSpan({ cls: "ms-col-menu-type-icon" }),
      getColumnTypeIcon(column.type)
    );

    const nameInput = headerRow.createEl("input", {
      type: "text",
      cls: "ms-col-menu-name-input",
      value: column.name,
      placeholder: "Property name...",
    });

    let isCommitting = false;
    const commitRename = async (): Promise<void> => {
      if (isCommitting) return;
      const newName = nameInput.value.trim();
      if (!newName || newName === column.name) return;
      isCommitting = true;
      await this.ctx.actions.onRenameColumn(columnIndex, newName);
    };

    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void commitRename().then(() => {
          menu.remove();
        });
      } else if (e.key === "Escape") {
        e.preventDefault();
        menu.remove();
      }
    });

    nameInput.addEventListener("blur", () => {
      void commitRename();
    });

    nameInput.addEventListener("click", (e) => e.stopPropagation());

    return nameInput;
  }

  private appendColumnTypeSection(
    menu: HTMLElement,
    column: TableColumn,
    columnIndex: number
  ): void {
    const section = menu.createDiv({ cls: "ms-menu-section" });
    section.createDiv({ cls: "ms-menu-section-title", text: "Property Type" });
    const dictionaries = this.ctx.settings.dictionaries ?? [];

    for (const definition of COLUMN_TYPE_DEFINITIONS) {
      const isDatetime = definition.type === "datetime";
      const isAuto = column.type === "datetime" && column.autoUpdate === true;
      const isSelected = isDatetime
        ? column.type === "datetime" && !isAuto
        : column.type === definition.type;
      const isList = definition.type === "select" || definition.type === "multi-select";
      if (isList && dictionaries.length > 0 && this.ctx.actions.onColumnDictionaryChange) {
        this.appendListTypeItem(section, menu, column, columnIndex, definition, isSelected);
        continue;
      }
      addCheckableItem(section, definition.icon, definition.label, isSelected, () => {
        if (isDatetime && isAuto) {
          void this.ctx.actions.onColumnAutoUpdateChange(columnIndex, false);
        } else {
          void this.changeColumnType(column, columnIndex, definition.type);
        }
        menu.remove();
      });

      // Same column type with the autoupdate flag; clicking it again turns the flag off.
      if (isDatetime) {
        addCheckableItem(section, definition.icon, "Datetime auto-update", isAuto, () => {
          void this.ctx.actions.onColumnAutoUpdateChange(columnIndex, !isAuto);
          menu.remove();
        });
      }
    }
  }

  /**
   * Select and Multi-select open a nested list: Custom (values from the table) or a dictionary.
   * It is expanded inline because the menu scrolls and would clip a flyout.
   */
  private appendListTypeItem(
    section: HTMLElement,
    menu: HTMLElement,
    column: TableColumn,
    columnIndex: number,
    definition: (typeof COLUMN_TYPE_DEFINITIONS)[number],
    isCurrentType: boolean
  ): void {
    const change = this.ctx.actions.onColumnDictionaryChange;
    if (!change) return;
    const bound = isCurrentType && column.dictionaryColors ? column.dictionary?.toLowerCase() : undefined;

    const parent = addCheckableItem(section, definition.icon, definition.label, isCurrentType, () => {
      const open = !sub.classList.contains("is-hidden");
      sub.classList.toggle("is-hidden", open);
      parent.classList.toggle("is-expanded", !open);
    });
    appendIcon(parent.createSpan({ cls: "ms-menu-chevron" }), ICON_CHEVRON_RIGHT);

    const sub = section.createDiv({ cls: `ms-menu-submenu${isCurrentType ? "" : " is-hidden"}` });
    parent.classList.toggle("is-expanded", isCurrentType);
    const choose = (dictionary: string | undefined): void => {
      void change(columnIndex, dictionary, definition.type as "select" | "multi-select");
      menu.remove();
    };
    addCheckableItem(sub, definition.icon, "Custom (values from the table)", isCurrentType && !bound, () =>
      choose(undefined)
    );
    for (const dictionary of this.ctx.settings.dictionaries ?? []) {
      addCheckableItem(
        sub,
        definition.icon,
        dictionary.name,
        bound === dictionary.name.toLowerCase(),
        () => choose(dictionary.name)
      );
    }
  }

  private async changeColumnType(
    column: TableColumn,
    columnIndex: number,
    newType: TableColumn["type"]
  ): Promise<void> {
    if (newType === "date" && column.type !== "date") {
      const defaultFormat =
        column.dateFormat ?? this.ctx.settings.dateFormat ?? "YYYY-MM-DD";
      await this.ctx.actions.onColumnTypeChange(columnIndex, "date", defaultFormat);
      return;
    }
    await this.ctx.actions.onColumnTypeChange(columnIndex, newType);
  }

  public openCalculationMenu(anchor: HTMLElement, column: TableColumn): void {
    const menu = createMenuElement("ms-calc-menu");

    for (const option of getCalculationOptionsForColumnType(column.type)) {
      const isSelected = column.calculation === option.value;
      const item = menu.createDiv({
        cls: `ms-menu-item ${isSelected ? "is-selected" : ""}`,
      });
      item.createSpan({ text: option.label });
      if (isSelected) {
        appendIcon(item.createSpan({ cls: "ms-check" }), ICON_CHECK);
      }
      item.addEventListener("click", () => {
        void this.ctx.actions.onColumnCalculationChange(column.index, option.value);
        menu.remove();
      });
    }

    mountFloatingPopover({
      anchorEl: anchor,
      popoverEl: menu,
      className: "ms-calc-menu",
      offsetTop: 2,
    });
  }
}
