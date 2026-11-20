import { App } from "obsidian";
import { itemColor, validateItems } from "../core/dictionary";
import { SettingsService } from "../services/settings-service";
import { Dictionary, DictionaryItem, TagColor } from "../types";
import { appendPickerRow, createIconButton, createSwatchButton } from "./color-picker";
import { confirmAction } from "./modals/confirm-modal";

const DELETE_WARNING =
  "Columns that use this dictionary fall back to a custom list built from the table values. The table text is not changed.";

/**
 * Dictionary editor of the settings. Item edits go to a draft that is written only by
 * "Save" and dropped by "Revert". Names of existing dictionaries cannot be changed; use "Clone".
 */
export function renderDictionariesEditor(
  host: HTMLElement,
  app: App,
  service: SettingsService
): void {
  const drafts = new Map<string, DictionaryItem[]>();
  const errors = new Map<string, string>();
  const openKeys = new Set<string>();
  let colorPicker: string | null = null;
  let cloning: string | null = null;
  let newDictionaryError = "";
  // Typing in an item name only refreshes the footer, so the input keeps its focus.
  const footerRefreshers = new Map<string, () => void>();

  const keyOf = (dictionary: Dictionary): string => dictionary.name.toLowerCase();
  const draftOf = (dictionary: Dictionary): DictionaryItem[] => {
    let draft = drafts.get(keyOf(dictionary));
    if (!draft) {
      draft = dictionary.items.map((item) => ({ ...item }));
      drafts.set(keyOf(dictionary), draft);
    }
    return draft;
  };
  const isDirty = (dictionary: Dictionary): boolean => {
    const draft = drafts.get(keyOf(dictionary));
    return draft !== undefined && JSON.stringify(draft) !== JSON.stringify(dictionary.items);
  };

  const render = (): void => {
    host.empty();
    const dictionaries = service.getSettings().dictionaries ?? [];
    if (dictionaries.length === 0) {
      host.createDiv({
        cls: "ms-settings-empty-notice",
        text: "No dictionaries yet. Add one below, then pick it in a select column's header menu (List source).",
      });
    }
    for (const dictionary of dictionaries) renderDictionary(dictionary);
    renderAddDictionary();
  };

  const renderDictionary = (dictionary: Dictionary): void => {
    const key = keyOf(dictionary);
    const details = host.createEl("details", { cls: "ms-dict" });
    details.open = openKeys.has(key) || isDirty(dictionary);
    details.addEventListener("toggle", () => {
      if (details.open) openKeys.add(key);
      else openKeys.delete(key);
    });

    const summary = details.createEl("summary", { cls: "ms-dict-summary" });
    summary.createSpan({ cls: "ms-dict-name", text: dictionary.name });
    summary.createSpan({ cls: "ms-dict-count", text: `${dictionary.items.length} items` });

    const body = details.createDiv({ cls: "ms-dict-body" });
    const draft = draftOf(dictionary);

    const rows = body.createDiv({ cls: "ms-dict-items" });
    draft.forEach((item, index) => renderItem(rows, dictionary, draft, item, index));

    renderAddItem(body, dictionary, draft);

    const status = body.createDiv({ cls: "ms-dict-status" });
    const footer = body.createDiv({ cls: "ms-dict-actions" });
    const save = footer.createEl("button", { cls: "mod-cta", text: "Save" });
    const revert = footer.createEl("button", { text: "Revert" });
    const refreshFooter = (): void => {
      const dirty = isDirty(dictionary);
      save.disabled = !dirty;
      revert.disabled = !dirty;
      status.empty();
      const error = errors.get(key);
      if (error) status.createDiv({ cls: "ms-dict-error", text: error });
      else if (dirty) status.createDiv({ cls: "ms-dict-unsaved", text: "Unsaved changes." });
    };
    refreshFooter();
    footerRefreshers.set(key, refreshFooter);

    save.addEventListener("click", () => {
      void service.saveDictionary(dictionary.name, draft).then((error) => {
        if (error) errors.set(key, error);
        else {
          errors.delete(key);
          drafts.delete(key);
        }
        render();
      });
    });
    revert.addEventListener("click", () => {
      drafts.delete(key);
      errors.delete(key);
      render();
    });

    renderDictionaryActions(footer, dictionary);
  };

  const renderItem = (
    container: HTMLElement,
    dictionary: Dictionary,
    draft: DictionaryItem[],
    item: DictionaryItem,
    index: number
  ): void => {
    const key = keyOf(dictionary);
    const pickerKey = `${key}:${index}`;
    const row = container.createDiv({ cls: "ms-dict-item" });
    const line = row.createDiv({ cls: "ms-dict-item-line" });
    const global = service.getSettings().customTagColors;

    createSwatchButton(line, itemColor(item, global), "Item color", () => {
      colorPicker = colorPicker === pickerKey ? null : pickerKey;
      render();
    });

    const input = line.createEl("input", { type: "text", value: item.name });
    input.addEventListener("input", () => {
      item.name = input.value;
      errors.delete(key);
      footerRefreshers.get(key)?.();
    });

    const move = (offset: number): void => {
      const target = index + offset;
      if (target < 0 || target >= draft.length) return;
      [draft[index], draft[target]] = [draft[target], draft[index]];
      colorPicker = null;
      render();
    };
    createIconButton(line, "Move up", "↑", () => move(-1), { disabled: index === 0 });
    createIconButton(line, "Move down", "↓", () => move(1), { disabled: index === draft.length - 1 });
    createIconButton(line, "Delete item", "✕", () => {
      draft.splice(index, 1);
      colorPicker = null;
      render();
    });

    if (colorPicker !== pickerKey) return;
    appendPickerRow(row, itemColor(item, global), (color: TagColor) => {
      // The global color is only the proposal; a dictionary stores a color it does not match.
      if (color === global[item.name.trim().toLowerCase()]) delete item.color;
      else item.color = color;
      render();
    });
  };

  const renderAddItem = (
    container: HTMLElement,
    dictionary: Dictionary,
    draft: DictionaryItem[]
  ): void => {
    const key = keyOf(dictionary);
    const line = container.createDiv({ cls: "ms-dict-add" });
    const input = line.createEl("input", { type: "text", placeholder: "New item" });
    const add = line.createEl("button", { text: "Add item" });
    const submit = (): void => {
      const name = input.value.trim();
      const error = validateItems([...draft, { name }]);
      if (error) {
        errors.set(key, error);
        render();
        return;
      }
      draft.push({ name });
      errors.delete(key);
      render();
    };
    add.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });
  };

  const renderDictionaryActions = (footer: HTMLElement, dictionary: Dictionary): void => {
    const key = keyOf(dictionary);
    const clone = footer.createEl("button", { text: "Clone" });
    clone.addEventListener("click", () => {
      cloning = cloning === key ? null : key;
      render();
    });
    const remove = footer.createEl("button", { cls: "mod-warning", text: "Delete" });
    remove.addEventListener("click", () => {
      confirmAction({
        app,
        title: `Delete dictionary "${dictionary.name}"?`,
        message: DELETE_WARNING,
        confirmText: "Delete",
        destructive: true,
        onConfirm: async () => {
          drafts.delete(key);
          await service.deleteDictionary(dictionary.name);
          render();
        },
      });
    });

    if (cloning !== key) return;
    const line = footer.parentElement?.createDiv({ cls: "ms-dict-add" });
    if (!line) return;
    const input = line.createEl("input", { type: "text", placeholder: "Name of the copy" });
    const create = line.createEl("button", { cls: "mod-cta", text: "Create copy" });
    create.addEventListener("click", () => {
      void service.cloneDictionary(dictionary.name, input.value).then((error) => {
        if (error) errors.set(key, error);
        else {
          errors.delete(key);
          cloning = null;
        }
        render();
      });
    });
  };

  const renderAddDictionary = (): void => {
    const line = host.createDiv({ cls: "ms-dict-add ms-dict-new" });
    const input = line.createEl("input", { type: "text", placeholder: "New dictionary name" });
    const create = line.createEl("button", { cls: "mod-cta", text: "Add dictionary" });
    const submit = (): void => {
      void service.addDictionary(input.value).then((error) => {
        newDictionaryError = error ?? "";
        render();
      });
    };
    create.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });
    if (newDictionaryError) host.createDiv({ cls: "ms-dict-error", text: newDictionaryError });
  };

  render();
}
