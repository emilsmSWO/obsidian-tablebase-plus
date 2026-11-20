import { Dictionary, DictionaryItem, MultiSelectTag, TableColumn, TagColor } from "../types";
import { resolveTagColor } from "./color-palette";
import { parseCellTags } from "./tag-parser";

const DICT_PARAM = /^dict=(.+)$/i;
const FORBIDDEN_DICTIONARY_CHARS = /[,\][=]/;
const FORBIDDEN_ITEM_CHARS = /[,;]/;

/** Reads "dict=Status" out of a header annotation's parameter list ("dict=Status,w=200"). */
export function parseDictParam(params: string | undefined): string | undefined {
  for (const param of (params ?? "").split(",")) {
    const match = DICT_PARAM.exec(param.trim());
    if (match) return match[1].trim();
  }
  return undefined;
}

export function findDictionary(
  dictionaries: Dictionary[] | undefined,
  name: string | undefined
): Dictionary | undefined {
  const key = name?.trim().toLowerCase();
  return key ? dictionaries?.find((dictionary) => dictionary.name.toLowerCase() === key) : undefined;
}

/** Names are unique ignoring case and must survive being written into a header. */
export function validateDictionaryName(name: string, dictionaries: Dictionary[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a dictionary name.";
  if (FORBIDDEN_DICTIONARY_CHARS.test(trimmed)) return 'The name cannot contain , [ ] or =.';
  if (findDictionary(dictionaries, trimmed)) return `A dictionary named "${trimmed}" already exists.`;
  return null;
}

/** Item names are non-empty, unique ignoring case and free of the cell separators. */
export function validateItems(items: DictionaryItem[]): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    const name = item.name.trim();
    if (!name) return "Item names cannot be empty.";
    if (FORBIDDEN_ITEM_CHARS.test(name)) return `"${name}": item names cannot contain , or ;`;
    if (seen.has(name.toLowerCase())) return `"${name}" is listed twice.`;
    seen.add(name.toLowerCase());
  }
  return null;
}

export function itemColor(item: DictionaryItem, customColors?: Record<string, TagColor>): TagColor {
  // "default" means no own color: fall back to the global tag color, then to the automatic one.
  return item.color && item.color !== "default" ? item.color : resolveTagColor(item.name, customColors);
}

export function dictionaryColors(
  dictionary: Dictionary,
  customColors?: Record<string, TagColor>
): Map<string, TagColor> {
  return new Map(
    dictionary.items.map((item) => [item.name.toLowerCase(), itemColor(item, customColors)])
  );
}

export function dictionaryTags(
  dictionary: Dictionary,
  customColors?: Record<string, TagColor>
): MultiSelectTag[] {
  return dictionary.items.map((item) => ({
    id: item.name.toLowerCase(),
    name: item.name,
    color: itemColor(item, customColors),
  }));
}

/** The tags of a cell; in a dictionary column they take the item colors and flag unknown values. */
export function parseColumnTags(
  value: string,
  column: Pick<TableColumn, "dictionaryColors"> | undefined,
  customColors?: Record<string, TagColor>
): MultiSelectTag[] {
  const tags = parseCellTags(value, customColors);
  const colors = column?.dictionaryColors;
  if (!colors) return tags;
  return tags.map((tag) =>
    colors.has(tag.id) ? { ...tag, color: colors.get(tag.id) ?? tag.color } : { ...tag, outside: true }
  );
}
