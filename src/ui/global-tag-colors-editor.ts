import { SettingsService } from "../services/settings-service";
import { TagColor } from "../types";
import { appendPickerRow, createIconButton, createSwatchButton } from "./color-picker";

/**
 * Editor of the global tag colors. Every change is saved at once; a tag name is stored
 * lowercase, so to rename a tag delete it and add it again.
 */
export function renderGlobalTagColorsEditor(host: HTMLElement, service: SettingsService): void {
  let openPicker: string | null = null;
  let newColor: TagColor = "blue";
  let newPickerOpen = false;
  let error = "";

  const render = (): void => {
    host.empty();
    const colors = service.getSettings().customTagColors ?? {};
    const entries = Object.entries(colors);

    if (entries.length === 0) {
      host.createDiv({
        cls: "ms-settings-empty-notice",
        text: "No global tag colors yet. Add one below, or pick colors from table or board dropdowns.",
      });
    }
    for (const [tag, color] of entries) renderRow(tag, color);
    renderAddRow();
  };

  const renderRow = (tag: string, color: TagColor): void => {
    const row = host.createDiv({ cls: "ms-dict-item" });
    const line = row.createDiv({ cls: "ms-dict-item-line" });
    createSwatchButton(line, color, "Tag color", () => {
      openPicker = openPicker === tag ? null : tag;
      render();
    });
    line.createSpan({ cls: "ms-gtc-name", text: tag });
    createIconButton(
      line,
      "Delete tag color",
      "✕",
      () => {
        void service.removeTagColor(tag).then(() => {
          openPicker = null;
          render();
        });
      },
      { title: "Reset to automatic color" }
    );

    if (openPicker !== tag) return;
    appendPickerRow(row, color, async (picked: TagColor) => {
      await service.setTagColor(tag, picked);
      openPicker = null;
      render();
    });
  };

  const renderAddRow = (): void => {
    const row = host.createDiv({ cls: "ms-dict-item" });
    const line = row.createDiv({ cls: "ms-dict-add" });
    createSwatchButton(line, newColor, "New tag color", () => {
      newPickerOpen = !newPickerOpen;
      render();
    });
    const input = line.createEl("input", { type: "text", placeholder: "Tag name, e.g. In Progress" });
    const add = line.createEl("button", { text: "Add tag color" });

    const submit = async (): Promise<void> => {
      const name = input.value.trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (key in (service.getSettings().customTagColors ?? {})) {
        error = `"${name}" already has a color.`;
        render();
        return;
      }
      error = "";
      await service.setTagColor(name, newColor);
      render();
    };
    add.addEventListener("click", () => void submit());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    });

    if (error) row.createDiv({ cls: "ms-dict-status ms-dict-error", text: error });
    if (!newPickerOpen) return;
    appendPickerRow(row, newColor, (picked: TagColor) => {
      newColor = picked;
      newPickerOpen = false;
      render();
    });
  };

  render();
}
