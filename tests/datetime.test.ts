import { describe, it, expect, beforeAll, vi } from "vitest";
import { App } from "obsidian";
import {
  compareDatetimeStrings,
  formatDatetime,
  parseDatetime,
  parseDatetimeParams,
} from "../src/core/datetime-utils";
import { parseMarkdownTables } from "../src/core/markdown-parser";
import { sortRowsByRules } from "../src/core/sort-engine";
import { TableStateManager } from "../src/core/table-state";
import {
  applyAddColumn,
  applyAutoUpdateStamps,
  applyChangeColumnType,
  applyChangeColumnWidth,
  applyRenameColumn,
} from "../src/core/table-mutator";
import { SettingsService } from "../src/services/settings-service";
import { TableSyncService } from "../src/services/table-sync-service";
import { TableViewController } from "../src/services/table-view-controller";
import { VaultService } from "../src/services/vault-service";
import { DEFAULT_SETTINGS } from "../src/types";
import { installObsidianDomHelpers } from "./helpers/obsidian-dom";

const MOMENT = new Date(2024, 2, 5, 9, 7, 3);

describe("datetime format", () => {
  it("formats full, date-only and time-only formats", () => {
    expect(formatDatetime(MOMENT, "YYYY-MM-DD HH:mm")).toBe("2024-03-05 09:07");
    expect(formatDatetime(MOMENT, "DD.MM.YYYY")).toBe("05.03.2024");
    expect(formatDatetime(MOMENT, "hh:mm:ss")).toBe("09:07:03");
  });

  it("parses what it formats and rejects impossible values", () => {
    expect(parseDatetime("2024-03-05 09:07", "YYYY-MM-DD HH:mm")).toEqual(
      new Date(2024, 2, 5, 9, 7)
    );
    expect(parseDatetime("05.03.2024", "DD.MM.YYYY")).toEqual(new Date(2024, 2, 5));
    expect(parseDatetime("2024-02-31 10:00", "YYYY-MM-DD HH:mm")).toBeNull();
    expect(parseDatetime("25:00", "HH:mm")).toBeNull();
    expect(parseDatetime("2024-03-05", "YYYY-MM-DD HH:mm")).toBeNull();
  });

  it("compares time-only values by time of day and puts unparseable last", () => {
    expect(compareDatetimeStrings("08:30", "17:00", "HH:mm")).toBeLessThan(0);
    expect(compareDatetimeStrings("n/a", "17:00", "HH:mm")).toBeGreaterThan(0);
  });

  it("reads the format and flag from header params in any order", () => {
    expect(parseDatetimeParams("autoupdate,YYYY-MM-DD HH:mm,w=160")).toEqual({
      format: "YYYY-MM-DD HH:mm",
      autoUpdate: true,
    });
    expect(parseDatetimeParams("sum,w=300")).toEqual({ format: undefined, autoUpdate: false });
  });
});

describe("datetime columns", () => {
  const analyze = (markdown: string, settings = {}) =>
    new TableStateManager().analyzeColumns(parseMarkdownTables(markdown)[0], {
      ...DEFAULT_SETTINGS,
      ...settings,
    });

  it("reads format, flag and width from the header, falling back to the setting", () => {
    const [column, fallback] = analyze(
      "| Updated [datetime:DD.MM.YYYY HH:mm,autoupdate,w=160] | Seen [datetime] |\n| --- | --- |\n| | |",
      { datetimeFormat: "HH:mm" }
    );
    expect(column).toMatchObject({
      type: "datetime",
      datetimeFormat: "DD.MM.YYYY HH:mm",
      autoUpdate: true,
      width: 160,
    });
    expect(fallback).toMatchObject({ type: "datetime", datetimeFormat: "HH:mm" });
    expect(fallback.autoUpdate).toBeUndefined();
  });

  it("writes the format into new and retyped column headers", () => {
    const tableData = parseMarkdownTables("| A | B |\n| --- | --- |\n| 1 | 2 |")[0];
    const columns = new TableStateManager().analyzeColumns(tableData, DEFAULT_SETTINGS);

    applyAddColumn(tableData, columns, "Updated", "datetime", undefined, undefined, {
      format: "YYYY-MM-DD",
      autoUpdate: true,
    });
    expect(tableData.headers[2]).toBe("Updated [datetime:YYYY-MM-DD,autoupdate]");

    applyChangeColumnType(tableData, columns, 1, "datetime", undefined, "HH:mm:ss");
    expect(tableData.headers[1]).toBe("B [datetime:HH:mm:ss]");

    applyChangeColumnWidth(tableData, columns, 2, 160);
    expect(tableData.headers[2]).toBe("Updated [datetime:YYYY-MM-DD,autoupdate,w=160]");

    applyChangeColumnType(tableData, columns, 2, "text");
    expect(tableData.headers[2]).toBe("Updated [text:w=160]");
  });

  it("keeps a hand-typed format and flag when the header is renamed", () => {
    const tableData = parseMarkdownTables("| A |\n| --- |\n| 1 |")[0];
    const columns = new TableStateManager().analyzeColumns(tableData, DEFAULT_SETTINGS);

    applyRenameColumn(tableData, columns, 0, "Changed [datetime:hh:mm,autoupdate]");
    expect(columns[0]).toMatchObject({
      name: "Changed",
      type: "datetime",
      datetimeFormat: "hh:mm",
      autoUpdate: true,
    });
    expect(tableData.headers[0]).toBe("Changed [datetime:hh:mm,autoupdate]");
  });

  it("sorts by time instead of text", () => {
    const tableData = parseMarkdownTables(
      "| At [datetime:DD.MM.YYYY] |\n| --- |\n| 02.01.2024 |\n| 15.12.2023 |"
    )[0];
    const columns = new TableStateManager().analyzeColumns(tableData, DEFAULT_SETTINGS);
    const sorted = sortRowsByRules(
      tableData.rows,
      [{ column: "At", columnIndex: 0, direction: "asc" }],
      columns
    );
    expect(sorted.map((row) => row.cells[0])).toEqual(["15.12.2023", "02.01.2024"]);
  });

  it("stamps every autoupdate column except the one being edited", () => {
    const tableData = parseMarkdownTables(
      "| Task | A [datetime:autoupdate] | B [datetime:YYYY-MM-DD,autoupdate] | C [datetime] |\n| --- | --- | --- | --- |\n| x | | | |"
    )[0];
    const columns = new TableStateManager().analyzeColumns(tableData, DEFAULT_SETTINGS);

    const stamps = applyAutoUpdateStamps(tableData, columns, 0, "YYYY-MM-DD HH:mm", 1, MOMENT);
    expect(stamps).toEqual([{ colIndex: 2, value: "2024-03-05" }]);
    expect(tableData.rows[0].cells).toEqual(["x", "", "2024-03-05", ""]);
  });
});

describe("datetime auto-update in the controller", () => {
  const markdown =
    "| Task | Updated [datetime:YYYY-MM-DD HH:mm,autoupdate] |\n| --- | --- |\n| a | old |\n| b | old |";

  beforeAll(() => {
    installObsidianDomHelpers(window as Window & typeof globalThis);
  });

  const squeeze = (text: string): string => text.replace(/ +/g, " ");

  async function setup(settings = {}) {
    const settingsService = new SettingsService({
      loadData: async () => ({ ...DEFAULT_SETTINGS, ...settings }),
      saveData: async () => undefined,
    });
    await settingsService.loadSettings();
    const syncService = new TableSyncService({} as VaultService);
    const saved: Array<(content: string) => string> = [];
    vi.spyOn(syncService, "syncInlineTable").mockImplementation(async (_path, transform) => {
      saved.push(transform);
    });
    const controller = new TableViewController(
      {} as App,
      settingsService,
      new TableStateManager(),
      syncService
    );
    const view = controller.createInlineTableView({
      sourcePath: "n.md",
      tableData: parseMarkdownTables(markdown)[0],
      startLine: 0,
      tableIndex: 0,
    });
    return { view, saved };
  }

  it("saves the edit and the new timestamp in one write", async () => {
    const { view, saved } = await setup();

    await view.actions.onCellUpdate(0, 0, "changed");

    expect(saved).toHaveLength(1);
    const written = squeeze(saved[0](markdown));
    expect(written).toMatch(/\| changed \| \d{4}-\d{2}-\d{2} \d{2}:\d{2} \|/);
    expect(written).toContain("| b | old |");
  });

  it("leaves the timestamp alone when the value did not change or the setting is off", async () => {
    const { view, saved } = await setup();
    await view.actions.onCellUpdate(0, 0, "a");
    expect(squeeze(saved[0](markdown))).toContain("| a | old |");

    const off = await setup({ autoUpdateDatetime: false });
    await off.view.actions.onCellUpdate(0, 0, "changed");
    expect(squeeze(off.saved[0](markdown))).toContain("| changed | old |");
  });

  it("does not re-stamp a manually edited autoupdate column", async () => {
    const { view, saved } = await setup();
    await view.actions.onCellUpdate(0, 1, "2020-01-01 10:00");
    expect(squeeze(saved[0](markdown))).toContain("| a | 2020-01-01 10:00 |");
  });

  it("stamps new and duplicated rows", async () => {
    const { view, saved } = await setup();
    await view.actions.onAddRow();
    await view.actions.onDuplicateRow(0);
    for (const transform of saved) {
      const added = squeeze(transform(markdown)).split("\n");
      expect(added.filter((line) => /\d{4}-\d{2}-\d{2} \d{2}:\d{2} \|$/.test(line))).toHaveLength(1);
    }
  });
});
