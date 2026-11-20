import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { App } from "obsidian";
import {
  dictionaryTags,
  itemColor,
  parseColumnTags,
  parseDictParam,
  validateDictionaryName,
  validateItems,
} from "../src/core/dictionary";
import { parseMarkdownTables } from "../src/core/markdown-parser";
import {
  applyChangeColumnDictionary,
  applyChangeColumnType,
  applyRenameColumn,
  formatColumnHeader,
} from "../src/core/table-mutator";
import { TableStateManager } from "../src/core/table-state";
import { SettingsService } from "../src/services/settings-service";
import { TableSyncService } from "../src/services/table-sync-service";
import { TableViewController } from "../src/services/table-view-controller";
import { VaultService } from "../src/services/vault-service";
import { DEFAULT_SETTINGS, Dictionary, PluginSettings } from "../src/types";
import { renderDictionariesEditor } from "../src/ui/dictionaries-editor";
import { SingleSelectPopover } from "../src/ui/modals/single-select-popover";
import { installObsidianDomHelpers } from "./helpers/obsidian-dom";

const statuses: Dictionary = {
  name: "Statusy",
  items: [{ name: "Todo" }, { name: "Done", color: "green" }],
};

function settingsWith(...dictionaries: Dictionary[]): PluginSettings {
  return { ...DEFAULT_SETTINGS, dictionaries, customTagColors: { todo: "orange" } };
}

function table(header: string, ...cells: string[]) {
  return parseMarkdownTables(
    `| Task | ${header} |\n| --- | --- |\n${cells.map((cell) => `| x | ${cell} |`).join("\n")}`
  )[0];
}

describe("dictionary helpers", () => {
  it("reads dict= from header params and rejects duplicate or unsafe names", () => {
    expect(parseDictParam("dict=My List,w=200")).toBe("My List");
    expect(parseDictParam("sum,w=200")).toBeUndefined();
    expect(validateDictionaryName(" statusy ", [statuses])).toMatch(/already exists/);
    expect(validateDictionaryName("a,b", [])).toMatch(/cannot contain/);
    expect(validateDictionaryName("Nowy", [statuses])).toBeNull();
    expect(validateItems([{ name: "A" }, { name: "a" }])).toMatch(/twice/);
    expect(validateItems([{ name: "A;B" }])).toMatch(/cannot contain/);
    expect(validateItems([{ name: " " }])).toMatch(/empty/);
  });

  it("treats the default item color as unset: global color first, then the automatic one", () => {
    expect(itemColor({ name: "Todo", color: "default" }, { todo: "orange" })).toBe("orange");
    const automatic = itemColor({ name: "High" }, {});
    expect(itemColor({ name: "High", color: "default" }, {})).toBe(automatic);
    expect(automatic).not.toBe("default");
    const tags = dictionaryTags({ name: "S", items: [{ name: "Done", color: "green" }] }, { done: "red" });
    expect(tags[0].color).toBe("green");
  });

  it("colors dictionary items own color, then global color, and flags values outside", () => {
    const columns = new TableStateManager().analyzeColumns(
      table("Status [select:dict=Statusy]", "Todo", "Gone"),
      settingsWith(statuses)
    );
    const column = columns[1];
    expect(column.uniqueTags?.map((tag) => [tag.name, tag.color])).toEqual([
      ["Todo", "orange"],
      ["Done", "green"],
    ]);
    const tags = parseColumnTags("Done, Gone", column, {});
    expect(tags.map((tag) => [tag.name, tag.color, tag.outside])).toEqual([
      ["Done", "green", undefined],
      ["Gone", expect.any(String), true],
    ]);
  });

  it("falls back to a custom list when the dictionary does not exist", () => {
    const column = new TableStateManager().analyzeColumns(
      table("Status [select:dict=Missing]", "Todo"),
      settingsWith(statuses)
    )[1];
    expect(column.dictionary).toBe("Missing");
    expect(column.dictionaryColors).toBeUndefined();
    expect(column.uniqueTags?.map((tag) => tag.name)).toEqual(["Todo"]);
  });
});

describe("dict= in headers", () => {
  it("is written next to the other parameters and kept by rename and type changes", () => {
    expect(
      formatColumnHeader("Status", "select", undefined, { dictionary: "Statusy", width: 200 })
    ).toBe("Status [select:dict=Statusy,w=200]");

    const data = table("Status [select:dict=Statusy,w=200]", "Todo");
    const columns = new TableStateManager().analyzeColumns(data, settingsWith(statuses));
    applyRenameColumn(data, columns, 1, "State");
    expect(data.headers[1]).toBe("State [select:dict=Statusy,w=200]");

    applyChangeColumnDictionary(data, columns, 1, undefined);
    expect(data.headers[1]).toBe("State [select:w=200]");
    applyChangeColumnDictionary(data, columns, 1, "Statusy");
    expect(data.headers[1]).toBe("State [select:dict=Statusy,w=200]");

    applyChangeColumnType(data, columns, 1, "text");
    expect(data.headers[1]).toBe("State [text:w=200]");
    expect(columns[1].dictionary).toBeUndefined();
  });
});

describe("dictionary settings", () => {
  const makeService = () => {
    const service = new SettingsService({
      loadData: async () => ({ ...DEFAULT_SETTINGS }),
      saveData: async () => undefined,
    });
    return service;
  };

  it("keeps names unique, validates items and clones with colors and order", async () => {
    const service = makeService();
    await service.loadSettings();
    expect(await service.addDictionary("Statusy")).toBeNull();
    expect(await service.addDictionary("statusy")).toMatch(/already exists/);
    expect(
      await service.saveDictionary("Statusy", [{ name: "B", color: "red" }, { name: "A" }])
    ).toBeNull();
    expect(await service.saveDictionary("Statusy", [{ name: "A" }, { name: "a" }])).toMatch(
      /twice/
    );
    expect(await service.cloneDictionary("Statusy", "Statusy")).toMatch(/already exists/);
    expect(await service.cloneDictionary("Statusy", "Kopia")).toBeNull();
    expect(service.getSettings().dictionaries[1]).toEqual({
      name: "Kopia",
      items: [{ name: "B", color: "red" }, { name: "A" }],
    });
    await service.deleteDictionary("STATUSY");
    expect(service.getSettings().dictionaries.map((d) => d.name)).toEqual(["Kopia"]);
  });
});

describe("dictionary UI", () => {
  beforeAll(() => {
    installObsidianDomHelpers(window as Window & typeof globalThis);
  });
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const setup = async () => {
    const service = new SettingsService({
      loadData: async () => ({ ...DEFAULT_SETTINGS, dictionaries: [statuses] }),
      saveData: async () => undefined,
    });
    await service.loadSettings();
    const host = document.createElement("div");
    document.body.appendChild(host);
    renderDictionariesEditor(host, {} as App, service);
    return { service, host };
  };
  const button = (host: HTMLElement, text: string) =>
    Array.from(host.querySelectorAll("button")).find((b) => b.textContent === text) as HTMLButtonElement;
  const names = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLInputElement>(".ms-dict-item input")).map((i) => i.value);

  it("edits a draft that is only stored by Save and dropped by Revert", async () => {
    const { service, host } = await setup();
    expect(button(host, "Save").disabled).toBe(true);

    const add = host.querySelector<HTMLInputElement>(".ms-dict-add input")!;
    add.value = "Review";
    button(host, "Add item").click();
    host.querySelectorAll<HTMLButtonElement>('[aria-label="Move up"]')[2].click();
    expect(names(host)).toEqual(["Todo", "Review", "Done"]);
    expect(host.querySelector(".ms-dict-unsaved")).not.toBeNull();
    expect(service.getSettings().dictionaries[0].items).toHaveLength(2);

    button(host, "Revert").click();
    expect(names(host)).toEqual(["Todo", "Done"]);

    host.querySelector<HTMLInputElement>(".ms-dict-add input")!.value = "Review";
    button(host, "Add item").click();
    expect(button(host, "Save").disabled).toBe(false);
    button(host, "Save").click();
    await vi.waitFor(() =>
      expect(service.getSettings().dictionaries[0].items.map((i) => i.name)).toEqual([
        "Todo",
        "Done",
        "Review",
      ])
    );
  });

  it("refuses a second item with the same name and a dictionary name that is taken", async () => {
    const { host } = await setup();
    host.querySelector<HTMLInputElement>(".ms-dict-add input")!.value = "todo";
    button(host, "Add item").click();
    expect(host.querySelector(".ms-dict-error")?.textContent).toMatch(/twice/);

    host.querySelector<HTMLInputElement>(".ms-dict-new input")!.value = "STATUSY";
    button(host, "Add dictionary").click();
    await vi.waitFor(() =>
      expect(host.querySelector(".ms-dict-new + .ms-dict-error")?.textContent).toMatch(
        /already exists/
      )
    );
  });
});

describe("dictionary-bound popover and controller", () => {
  beforeAll(() => {
    installObsidianDomHelpers(window as Window & typeof globalThis);
  });

  it("offers only the listed options, without creating or recoloring", () => {
    document.body.innerHTML = "";
    const anchorEl = document.createElement("button");
    document.body.appendChild(anchorEl);
    const rect = { top: 100, bottom: 130, left: 50, right: 200, width: 150, height: 30, x: 50, y: 100 };
    anchorEl.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
    new SingleSelectPopover({
      app: {} as App,
      anchorEl,
      columnName: "Status",
      currentValue: "",
      allAvailableTags: [{ id: "todo", name: "Todo", color: "blue" }],
      settings: { ...DEFAULT_SETTINGS },
      restricted: true,
      onSelect: vi.fn().mockResolvedValue(undefined),
    }).open();
    const input = document.body.querySelector<HTMLInputElement>(".ms-popover-search-input")!;
    input.value = "Brand new";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.body.querySelector(".ms-create-option-item")).toBeNull();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.body.querySelector(".ms-select-option-item")).not.toBeNull();
    expect(document.body.querySelector(".ms-tag-color-btn")).toBeNull();
  });

  it("binds a column to a dictionary and leaves its saved order alone", async () => {
    const service = new SettingsService({
      loadData: async () => ({ ...DEFAULT_SETTINGS, dictionaries: [statuses] }),
      saveData: async () => undefined,
    });
    await service.loadSettings();
    const stateManager = new TableStateManager();
    const syncService = new TableSyncService({
      modifyFile: vi.fn(async () => true),
    } as unknown as VaultService);
    vi.spyOn(syncService, "syncInlineTable").mockResolvedValue(undefined);
    const controller = new TableViewController({} as App, service, stateManager, syncService);

    const data = table("Status [select]", "Gone", "Todo");
    const view = controller.createInlineTableView({
      sourcePath: "n.md",
      tableData: data,
      startLine: 0,
      tableIndex: 0,
    });
    expect(view.columns[1].uniqueTags?.map((tag) => tag.name)).toEqual(["Gone", "Todo"]);

    await view.actions.onColumnDictionaryChange?.(1, "Statusy");
    expect(data.headers[1]).toBe("Status [select:dict=Statusy]");
    expect(view.columns[1].uniqueTags?.map((tag) => tag.name)).toEqual(["Todo", "Done"]);
    expect(Object.values(service.getSettings().tableBoardGroupOrders)[0] ?? {}).toEqual({});

    await service.deleteDictionary("Statusy");
    expect(view.columns[1].dictionaryColors).toBeUndefined();
    expect(view.columns[1].uniqueTags?.map((tag) => tag.name)).toEqual(["Gone", "Todo"]);
  });

  it("turns a column into a dictionary-bound select in one change and offers it in the type menu", async () => {
    document.body.innerHTML = "";
    const service = new SettingsService({
      loadData: async () => ({ ...DEFAULT_SETTINGS, dictionaries: [statuses] }),
      saveData: async () => undefined,
    });
    await service.loadSettings();
    const syncService = new TableSyncService({
      modifyFile: vi.fn(async () => true),
    } as unknown as VaultService);
    vi.spyOn(syncService, "syncInlineTable").mockResolvedValue(undefined);
    const controller = new TableViewController({} as App, service, new TableStateManager(), syncService);

    const data = table("Status [text]", "Todo", "Done");
    const view = controller.createInlineTableView({
      sourcePath: "n.md",
      tableData: data,
      startLine: 0,
      tableIndex: 0,
    });
    document.body.appendChild(view.getElement());
    const th = view.getElement().querySelector<HTMLElement>('th.ms-db-th[data-col-index="1"]')!;
    const rect = { top: 40, bottom: 74, left: 200, right: 340, width: 140, height: 34, x: 200, y: 40 };
    th.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
    th.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const items = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".ms-col-header-menu .ms-menu-item"));
    const pick = (label: string, nth = 0) =>
      items().filter((el) => el.textContent?.trim() === label)[nth];
    const submenu = pick("Select").nextElementSibling as HTMLElement;
    expect(submenu.classList.contains("is-hidden")).toBe(true);
    pick("Select").click();
    expect(submenu.classList.contains("is-hidden")).toBe(false);
    expect(Array.from(submenu.querySelectorAll(".ms-menu-item")).map((el) => el.textContent?.trim())).toEqual([
      "Custom (values from the table)",
      "Statusy",
    ]);
    (submenu.querySelectorAll(".ms-menu-item")[1] as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(data.headers[1]).toBe("Status [select:dict=Statusy]");
    expect(view.columns[1].type).toBe("select");
    expect(view.columns[1].uniqueTags?.map((tag) => tag.name)).toEqual(["Todo", "Done"]);
  });
});
