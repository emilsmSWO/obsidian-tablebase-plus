import { App, Plugin, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import { clampColumnWidth, DEFAULT_COLUMN_WIDTH, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from "../core/column-width";
import { DATE_FORMAT_OPTIONS } from "../core/date-utils";
import { DATETIME_FORMAT_OPTIONS } from "../core/datetime-utils";
import { SettingsService } from "../services/settings-service";
import { DateFormatOption, DEFAULT_SETTINGS, TagFormat } from "../types";
import { renderDictionariesEditor } from "./dictionaries-editor";
import { renderGlobalTagColorsEditor } from "./global-tag-colors-editor";
import { confirmAction } from "./modals/confirm-modal";

const MAX_HEIGHT_DESC =
  "Tables taller than this share of the window height scroll inside it, with the header kept in view. Set 0 for no limit.";

const LEFT_OFFSET_DESC =
  "Space in pixels between the left edge of the note and a table. 0 aligns the table with the text; use about 26 to keep the row drag handle inside the note.";
const MAX_LEFT_OFFSET = 100;

function clampLeftOffset(px: number): number {
  return Math.min(MAX_LEFT_OFFSET, Math.max(0, Math.round(px)));
}

function clampMaxTableHeight(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

const DATETIME_FORMAT_DESC =
  "Format used when displaying and entering values in datetime columns. Date-only and time-only formats work too.";
const AUTO_UPDATE_DESC =
  "Set columns marked [datetime:autoupdate] to the current time whenever a row is changed in TableBase Plus. Edits made outside Obsidian are not tracked.";

const DICTIONARIES_DESC =
  "Named lists of select and multi-select options with colors. Bind a column to one in its header menu (List source) or with [select:dict=Name].";

const GLOBAL_TAG_COLORS_DESC =
  "Colors for tag names across all tables and boards. A dictionary color overrides them; tags without a color get an automatic one.";

const COLUMN_WIDTH_DESC =
  "Width in pixels of columns that have no width of their own. Drag a column edge to set one; it is saved in the header as [text:w=300].";

export class TableBaseSettingTab extends PluginSettingTab {
  private settingsService: SettingsService;

  constructor(app: App, plugin: Plugin, settingsService: SettingsService) {
    super(app, plugin);
    this.settingsService = settingsService;
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    const dateOptions: Record<string, string> = {};
    for (const option of DATE_FORMAT_OPTIONS) {
      dateOptions[option.format] = `${option.label} (${option.example})`;
    }

    const datetimeOptions: Record<string, string> = {};
    for (const option of DATETIME_FORMAT_OPTIONS) {
      datetimeOptions[option.format] = option.label;
    }

    return [
      {
        name: "Auto-convert Markdown tables",
        desc: "Automatically convert standard Markdown tables into interactive TableBase Plus tables.",
        control: {
          type: "toggle",
          key: "autoConvertMarkdownTables",
        },
      },
      {
        name: "Auto-detect multi-select columns",
        desc: "Automatically detect multi-select columns by analyzing cell values (lists, wikilinks, tags).",
        control: {
          type: "toggle",
          key: "autoDetectMultiSelect",
        },
      },
      {
        name: "Multi-select column names",
        desc: "Comma-separated column header keywords to always treat as multi-select.",
        control: {
          type: "textarea",
          key: "multiSelectColumnNames",
          placeholder: "Tags, Status, Categories, Labels, Priority...",
        },
      },
      {
        name: "Default tag format",
        desc: "Format used when writing multi-select tags back to Markdown cells.",
        control: {
          type: "dropdown",
          key: "defaultTagFormat",
          options: {
            comma: "Comma-separated (Frontend, UI, Bug)",
            wikilink: "Wikilinks ([[Frontend]], [[UI]])",
            hashtag: "Hashtags (#Frontend #UI)",
          },
        },
      },
      {
        name: "Default date format",
        desc: "Format used when displaying and entering dates in date columns.",
        control: {
          type: "dropdown",
          key: "dateFormat",
          options: dateOptions,
        },
      },
      {
        name: "Default datetime format",
        desc: DATETIME_FORMAT_DESC,
        control: {
          type: "dropdown",
          key: "datetimeFormat",
          options: datetimeOptions,
        },
      },
      {
        name: "Auto-update last update datetime column",
        desc: AUTO_UPDATE_DESC,
        control: {
          type: "toggle",
          key: "autoUpdateDatetime",
        },
      },
      {
        name: "Show row numbers",
        desc: "Display a leading column with row numbers in database tables.",
        control: {
          type: "toggle",
          key: "showRowNumbers",
        },
      },
      {
        name: "Default column width",
        desc: COLUMN_WIDTH_DESC,
        control: {
          type: "number",
          key: "defaultColumnWidth",
          min: MIN_COLUMN_WIDTH,
          max: MAX_COLUMN_WIDTH,
          placeholder: String(DEFAULT_COLUMN_WIDTH),
        },
      },
      {
        name: "Maximum table height",
        desc: MAX_HEIGHT_DESC,
        control: {
          type: "number",
          key: "maxTableHeight",
          min: 0,
          max: 100,
          placeholder: String(DEFAULT_SETTINGS.maxTableHeight),
        },
      },
      {
        name: "Table left offset",
        desc: LEFT_OFFSET_DESC,
        control: {
          type: "number",
          key: "tableLeftOffset",
          min: 0,
          max: MAX_LEFT_OFFSET,
          placeholder: String(DEFAULT_SETTINGS.tableLeftOffset),
        },
      },
      {
        name: "Show empty properties on board cards",
        desc: "Display placeholders for empty fields on Kanban cards so they can be filled in. Checkboxes are always shown.",
        control: {
          type: "toggle",
          key: "showEmptyBoardProperties",
        },
      },
      {
        name: "Dictionaries",
        desc: DICTIONARIES_DESC,
        render: (setting) => {
          setting.setName("Dictionaries").setDesc(DICTIONARIES_DESC);
          setting.settingEl.addClass("ms-dict-setting");
          const host = setting.settingEl.createDiv({ cls: "ms-dict-editor" });
          renderDictionariesEditor(host, this.app, this.settingsService);
          return () => host.remove();
        },
      },
      {
        name: "Global tag colors",
        desc: GLOBAL_TAG_COLORS_DESC,
        render: (setting) => {
          setting.setName("Global tag colors").setDesc(GLOBAL_TAG_COLORS_DESC);
          setting.settingEl.addClass("ms-dict-setting");
          const host = setting.settingEl.createDiv({ cls: "ms-dict-editor" });
          renderGlobalTagColorsEditor(host, this.settingsService);
          return () => host.remove();
        },
      },
      {
        name: "Restore default settings",
        desc: "Reset all plugin settings back to default values.",
        action: () => this.confirmReset(),
      },
    ];
  }

  override getControlValue(key: string): unknown {
    const settings = this.settingsService.getSettings() as unknown as Record<string, unknown>;
    if (key === "multiSelectColumnNames") {
      const names = settings.multiSelectColumnNames;
      return Array.isArray(names) ? names.join(", ") : "";
    }
    return settings[key];
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "multiSelectColumnNames") {
      const names =
        typeof value === "string"
          ? value
              .split(",")
              .map((name) => name.trim())
              .filter((name) => name.length > 0)
          : [];
      await this.settingsService.updateSettings({ multiSelectColumnNames: names });
      return;
    }
    if (key === "defaultColumnWidth") {
      const width = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(width)) return;
      await this.settingsService.updateSettings({ defaultColumnWidth: clampColumnWidth(width) });
      return;
    }
    if (key === "maxTableHeight") {
      const percent = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(percent)) return;
      await this.settingsService.updateSettings({ maxTableHeight: clampMaxTableHeight(percent) });
      return;
    }
    if (key === "tableLeftOffset") {
      const px = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(px)) return;
      await this.settingsService.updateSettings({ tableLeftOffset: clampLeftOffset(px) });
      return;
    }
    await this.settingsService.updateSettings({ [key]: value });
  }

  override display(): void {
    this.refresh();
  }

  private refresh(): void {
    if ("update" in this && typeof (this as unknown as { update?: () => void }).update === "function") {
      (this as unknown as { update: () => void }).update();
    }
    const { containerEl } = this;
    containerEl.empty();

    this.renderColumnDetection(containerEl);
    this.renderFormatting(containerEl);
    this.renderAppearance(containerEl);
    this.renderDictionaries(containerEl);
    this.renderGlobalTagColors(containerEl);
    this.renderReset(containerEl);
  }

  private addHeading(containerEl: HTMLElement, title: string): void {
    new Setting(containerEl).setName(title).setHeading();
  }

  private renderColumnDetection(containerEl: HTMLElement): void {
    const settings = this.settingsService.getSettings();
    this.addHeading(containerEl, "Column detection");

    new Setting(containerEl)
      .setName("Auto-convert Markdown tables")
      .setDesc(
        "Automatically convert standard Markdown tables into interactive TableBase Plus tables."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.autoConvertMarkdownTables)
          .onChange(async (value) => {
            await this.settingsService.updateSettings({ autoConvertMarkdownTables: value });
          })
      );

    new Setting(containerEl)
      .setName("Auto-detect multi-select columns")
      .setDesc(
        "Automatically detect multi-select columns by analyzing cell values (lists, wikilinks, tags)."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.autoDetectMultiSelect)
          .onChange(async (value) => {
            await this.settingsService.updateSettings({ autoDetectMultiSelect: value });
          })
      );

    new Setting(containerEl)
      .setName("Multi-select column names")
      .setDesc("Comma-separated column header keywords to always treat as multi-select.")
      .addTextArea((text) =>
        text
          .setPlaceholder("Tags, Status, Categories, Labels, Priority...")
          .setValue(settings.multiSelectColumnNames.join(", "))
          .onChange(async (value) => {
            const names = value
              .split(",")
              .map((name) => name.trim())
              .filter((name) => name.length > 0);
            await this.settingsService.updateSettings({ multiSelectColumnNames: names });
          })
      );
  }

  private renderFormatting(containerEl: HTMLElement): void {
    const settings = this.settingsService.getSettings();
    this.addHeading(containerEl, "Tag and date formatting");

    new Setting(containerEl)
      .setName("Default tag format")
      .setDesc("Format used when writing multi-select tags back to Markdown cells.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("comma", "Comma-separated (Frontend, UI, Bug)")
          .addOption("wikilink", "Wikilinks ([[Frontend]], [[UI]])")
          .addOption("hashtag", "Hashtags (#Frontend #UI)")
          .setValue(settings.defaultTagFormat)
          .onChange(async (value) => {
            await this.settingsService.updateSettings({
              defaultTagFormat: value as TagFormat,
            });
          })
      );

    new Setting(containerEl)
      .setName("Default date format")
      .setDesc("Format used when displaying and entering dates in date columns.")
      .addDropdown((dropdown) => {
        for (const option of DATE_FORMAT_OPTIONS) {
          dropdown.addOption(option.format, `${option.label} (${option.example})`);
        }
        dropdown
          .setValue(settings.dateFormat ?? "YYYY-MM-DD")
          .onChange(async (value) => {
            await this.settingsService.updateSettings({
              dateFormat: value as DateFormatOption,
            });
          });
      });

    new Setting(containerEl)
      .setName("Default datetime format")
      .setDesc(DATETIME_FORMAT_DESC)
      .addDropdown((dropdown) => {
        for (const option of DATETIME_FORMAT_OPTIONS) {
          dropdown.addOption(option.format, option.label);
        }
        dropdown.setValue(settings.datetimeFormat).onChange(async (value) => {
          await this.settingsService.updateSettings({ datetimeFormat: value });
        });
      });

    new Setting(containerEl)
      .setName("Auto-update last update datetime column")
      .setDesc(AUTO_UPDATE_DESC)
      .addToggle((toggle) =>
        toggle.setValue(settings.autoUpdateDatetime).onChange(async (value) => {
          await this.settingsService.updateSettings({ autoUpdateDatetime: value });
        })
      );
  }

  private renderAppearance(containerEl: HTMLElement): void {
    const settings = this.settingsService.getSettings();
    this.addHeading(containerEl, "Appearance");

    new Setting(containerEl)
      .setName("Show row numbers")
      .setDesc("Display a leading column with row numbers in database tables.")
      .addToggle((toggle) =>
        toggle
          .setValue(settings.showRowNumbers ?? false)
          .onChange(async (value) => {
            await this.settingsService.updateSettings({ showRowNumbers: value });
          })
      );

    new Setting(containerEl)
      .setName("Default column width")
      .setDesc(COLUMN_WIDTH_DESC)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = String(MIN_COLUMN_WIDTH);
        text.inputEl.max = String(MAX_COLUMN_WIDTH);
        text
          .setPlaceholder(String(DEFAULT_COLUMN_WIDTH))
          .setValue(String(settings.defaultColumnWidth ?? DEFAULT_COLUMN_WIDTH))
          .onChange(async (value) => {
            const width = Number(value);
            if (value.trim() === "" || !Number.isFinite(width)) return;
            await this.settingsService.updateSettings({
              defaultColumnWidth: clampColumnWidth(width),
            });
          });
        // Clamping happens while typing, so show the stored value once editing ends.
        text.inputEl.addEventListener("blur", () => {
          text.setValue(
            String(this.settingsService.getSettings().defaultColumnWidth ?? DEFAULT_COLUMN_WIDTH)
          );
        });
      });

    new Setting(containerEl)
      .setName("Maximum table height")
      .setDesc(MAX_HEIGHT_DESC)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = "100";
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.maxTableHeight))
          .setValue(String(settings.maxTableHeight ?? DEFAULT_SETTINGS.maxTableHeight))
          .onChange(async (value) => {
            const percent = Number(value);
            if (value.trim() === "" || !Number.isFinite(percent)) return;
            await this.settingsService.updateSettings({
              maxTableHeight: clampMaxTableHeight(percent),
            });
          });
      });

    new Setting(containerEl)
      .setName("Table left offset")
      .setDesc(LEFT_OFFSET_DESC)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = String(MAX_LEFT_OFFSET);
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.tableLeftOffset))
          .setValue(String(settings.tableLeftOffset ?? DEFAULT_SETTINGS.tableLeftOffset))
          .onChange(async (value) => {
            const px = Number(value);
            if (value.trim() === "" || !Number.isFinite(px)) return;
            await this.settingsService.updateSettings({ tableLeftOffset: clampLeftOffset(px) });
          });
      });

    new Setting(containerEl)
      .setName("Show empty properties on board cards")
      .setDesc(
        "Display placeholders for empty fields on Kanban cards so they can be filled in. Checkboxes are always shown."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.showEmptyBoardProperties ?? false)
          .onChange(async (value) => {
            await this.settingsService.updateSettings({ showEmptyBoardProperties: value });
          })
      );
  }

  private renderDictionaries(containerEl: HTMLElement): void {
    this.addHeading(containerEl, "Dictionaries");
    containerEl.createEl("p", { cls: "setting-item-description", text: DICTIONARIES_DESC });
    renderDictionariesEditor(
      containerEl.createDiv({ cls: "ms-dict-editor" }),
      this.app,
      this.settingsService
    );
  }

  private renderGlobalTagColors(containerEl: HTMLElement): void {
    this.addHeading(containerEl, "Global tag colors");
    containerEl.createEl("p", { cls: "setting-item-description", text: GLOBAL_TAG_COLORS_DESC });
    renderGlobalTagColorsEditor(containerEl.createDiv({ cls: "ms-dict-editor" }), this.settingsService);
  }

  private renderReset(containerEl: HTMLElement): void {
    this.addHeading(containerEl, "Reset settings");

    new Setting(containerEl)
      .setName("Restore default settings")
      .setDesc("Reset all plugin settings back to default values.")
      .addButton((btn) => {
        btn.setButtonText("Reset to defaults");
        const destBtn = btn as unknown as { setDestructive?: () => void };
        if (typeof destBtn.setDestructive === "function") {
          destBtn.setDestructive();
        } else {
          btn.setClass("mod-warning");
        }
        btn.onClick(() => this.confirmReset());
      });
  }

  private confirmReset(): void {
    confirmAction({
      app: this.app,
      title: "Restore default settings?",
      message:
        "All plugin settings, including dictionaries, global tag colors and saved list orders, will be reset to their defaults. Table text in your notes is not changed. This cannot be undone.",
      confirmText: "Restore defaults",
      destructive: true,
      onConfirm: async () => {
        await this.settingsService.resetDefaults();
        this.refresh();
      },
    });
  }
}
