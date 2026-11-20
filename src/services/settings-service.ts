import { moveListOrders, pruneListOrders } from "../core/list-order";
import { findDictionary, validateDictionaryName, validateItems } from "../core/dictionary";
import { DEFAULT_SETTINGS, DictionaryItem, PluginSettings, TagColor } from "../types";

export interface SettingsStorage {
  loadData(): Promise<Record<string, unknown> | null>;
  saveData(data: Record<string, unknown>): Promise<void>;
}

type SettingsChangeListener = (settings: PluginSettings) => void;

export class SettingsService {
  private settings: PluginSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<SettingsChangeListener> = new Set();
  private storage: SettingsStorage;

  constructor(storage: SettingsStorage) {
    this.storage = storage;
  }

  public async loadSettings(): Promise<PluginSettings> {
    try {
      const data = await this.storage.loadData();
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
      if (Array.isArray(this.settings.multiSelectColumnNames)) {
        const cyrillicPattern = /[\u0400-\u04FF]/;
        this.settings.multiSelectColumnNames = this.settings.multiSelectColumnNames.filter(
          (name) => !cyrillicPattern.test(name)
        );
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    this.notifyListeners();
    return this.settings;
  }

  public async saveSettings(): Promise<void> {
    await this.storage.saveData(this.settings as unknown as Record<string, unknown>);
    this.notifyListeners();
  }

  public getSettings(): PluginSettings {
    return this.settings;
  }

  public async updateSettings(partial: Partial<PluginSettings>): Promise<void> {
    this.settings = { ...this.settings, ...partial };
    await this.saveSettings();
  }

  public async setTagColor(tagName: string, color: TagColor): Promise<void> {
    const key = tagName.trim().toLowerCase();
    if (!key) return;
    this.settings.customTagColors[key] = color;
    await this.saveSettings();
  }

  public async removeTagColor(tagName: string): Promise<void> {
    const key = tagName.trim().toLowerCase();
    if (key in this.settings.customTagColors) {
      delete this.settings.customTagColors[key];
      await this.saveSettings();
    }
  }

  /** Dictionary changes return an error message when the change is not allowed, else null. */
  public async addDictionary(name: string, items: DictionaryItem[] = []): Promise<string | null> {
    const dictionaries = this.settings.dictionaries ?? [];
    const error = validateDictionaryName(name, dictionaries);
    if (error) return error;
    await this.updateSettings({
      dictionaries: [...dictionaries, { name: name.trim(), items: items.map((item) => ({ ...item })) }],
    });
    return null;
  }

  public async cloneDictionary(source: string, newName: string): Promise<string | null> {
    const original = findDictionary(this.settings.dictionaries, source);
    return original ? this.addDictionary(newName, original.items) : "The dictionary no longer exists.";
  }

  public async saveDictionary(name: string, items: DictionaryItem[]): Promise<string | null> {
    const dictionaries = this.settings.dictionaries ?? [];
    const target = findDictionary(dictionaries, name);
    if (!target) return "The dictionary no longer exists.";
    const cleaned = items.map((item) => ({ ...item, name: item.name.trim() }));
    const error = validateItems(cleaned);
    if (error) return error;
    await this.updateSettings({
      dictionaries: dictionaries.map((item) =>
        item === target ? { name: target.name, items: cleaned } : item
      ),
    });
    return null;
  }

  public async deleteDictionary(name: string): Promise<void> {
    const dictionaries = this.settings.dictionaries ?? [];
    const target = findDictionary(dictionaries, name);
    if (target) await this.updateSettings({ dictionaries: dictionaries.filter((d) => d !== target) });
  }

  public async moveListOrders(oldPath: string, newPath: string | null): Promise<void> {
    const next = moveListOrders(this.settings.tableBoardGroupOrders ?? {}, oldPath, newPath);
    if (next) await this.updateSettings({ tableBoardGroupOrders: next });
  }

  public async pruneListOrders(exists: (path: string) => boolean): Promise<void> {
    const next = pruneListOrders(this.settings.tableBoardGroupOrders ?? {}, exists);
    if (next) await this.updateSettings({ tableBoardGroupOrders: next });
  }

  public async resetDefaults(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
  }

  public subscribe(listener: SettingsChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.settings);
      } catch { /* listener errors must not break the notification loop */ }
    }
  }
}
