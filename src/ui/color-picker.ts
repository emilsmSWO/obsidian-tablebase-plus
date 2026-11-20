import { COLOR_LIST, getColorScheme } from "../core/color-palette";
import { TagColor } from "../types";

interface ColorPickerOptions {
  currentColor: TagColor;
  onSelectColor: (color: TagColor) => void | Promise<void>;
  allowCustomHex?: boolean;
}

export function createColorPickerElement(options: ColorPickerOptions): HTMLElement {
  const { currentColor, onSelectColor, allowCustomHex = true } = options;

  const container = createDiv({ cls: "ms-tag-color-picker" });

  const paletteRow = container.createDiv({ cls: "ms-color-palette-row" });

  const isCustom = currentColor && typeof currentColor === "string" && currentColor.startsWith("#");

  for (const color of COLOR_LIST) {
    const isSelected = currentColor === color;
    const dot = paletteRow.createSpan({
      cls: `ms-color-swatch-dot ms-color-${color} ${isSelected ? "is-selected" : ""}`,
      attr: { title: color.charAt(0).toUpperCase() + color.slice(1) },
    });

    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      void onSelectColor(color);
    });
  }

  if (allowCustomHex) {
    const customWrapper = paletteRow.createSpan({
      cls: `ms-color-custom-wrapper ${isCustom ? "is-selected" : ""}`,
      attr: { title: "Custom Color (Hex Picker)" },
    });
    if (isCustom) {
      customWrapper.setCssStyles({ borderColor: currentColor });
    }
    const colorInput = customWrapper.createEl("input", {
      type: "color",
      cls: "ms-color-custom-input",
      value: isCustom ? currentColor : "#2383e2",
    });

    colorInput.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // The native dialog fires "input" on every click; picking is final only after "Accept".
    let pending: string | null = null;
    const accept = container.createEl("button", {
      cls: "ms-color-accept mod-cta is-hidden",
      text: "Accept",
    });
    accept.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (pending) void onSelectColor(pending);
    });

    colorInput.addEventListener("input", (e) => {
      e.stopPropagation();
      pending = (e.target as HTMLInputElement).value || null;
      if (!pending) return;
      customWrapper.style.setProperty("--ms-custom-preview", pending);
      accept.classList.remove("is-hidden");
    });
  }

  return container;
}

/** Fills a round color swatch; the "default" color shows a checkered "no color" pattern. */
export function paintSwatch(el: HTMLElement, color: TagColor): void {
  const none = color === "default";
  el.classList.toggle("ms-swatch-none", none);
  if (!none) el.setCssStyles({ backgroundColor: getColorScheme(color).bg });
}

/** Round color button of a settings editor row; clicking it opens the row's picker. */
export function createSwatchButton(
  parent: HTMLElement,
  color: TagColor,
  label: string,
  onClick: () => void
): HTMLButtonElement {
  const swatch = parent.createEl("button", {
    cls: "ms-dict-swatch",
    attr: { "aria-label": label, title: label },
  });
  paintSwatch(swatch, color);
  swatch.addEventListener("click", onClick);
  return swatch;
}

/** Row below an editor line that holds a color picker. */
export function appendPickerRow(
  row: HTMLElement,
  currentColor: TagColor,
  onSelectColor: (color: TagColor) => void | Promise<void>
): void {
  row.createDiv({ cls: "ms-dict-picker" }).appendChild(
    createColorPickerElement({ currentColor, onSelectColor })
  );
}

export function createIconButton(
  parent: HTMLElement,
  label: string,
  text: string,
  onClick: () => void,
  options: { disabled?: boolean; title?: string } = {}
): void {
  const button = parent.createEl("button", {
    cls: "clickable-icon",
    text,
    attr: { "aria-label": label, title: options.title ?? label },
  });
  button.disabled = options.disabled ?? false;
  button.addEventListener("click", onClick);
}
