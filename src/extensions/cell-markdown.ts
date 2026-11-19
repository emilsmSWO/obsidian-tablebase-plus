import { EXTERNAL_SCHEME } from "../utils/link-renderer";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function cleanLabel(text: string): string {
  return text.replace(/[[\]|\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function formatInternalLink(target: string, text: string): string {
  const label = cleanLabel(text);
  return !label || label === target ? `[[${target}]]` : `[[${target}\\|${label}]]`;
}

function formatExternalLink(href: string, text: string): string {
  const label = cleanLabel(text) || href;
  const safeHref = href.replace(/\|/g, "%7C");
  const dest = /[\s()<>]/.test(safeHref) ? `<${safeHref.replace(/[<>]/g, encodeURIComponent)}>` : safeHref;
  return `[${label}](${dest})`;
}

function formatCodeSpan(code: string): string {
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  const pad = code.startsWith("`") || code.endsWith("`") ? " " : "";
  return `${fence}${pad}${code}${pad}${fence}`;
}

function walk(node: Node): string {
  if (node.nodeType === TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") return " ";

  if (el.classList.contains("internal-embed")) {
    const src = el.getAttribute("src") ?? el.getAttribute("alt") ?? "";
    return src ? `[[${src}]]` : el.textContent ?? "";
  }

  if (tag === "a") {
    const text = el.textContent ?? "";
    const dataHref = el.getAttribute("data-href");
    if (el.classList.contains("internal-link") && dataHref) {
      return formatInternalLink(dataHref, text);
    }
    const href = el.getAttribute("href") ?? "";
    if (EXTERNAL_SCHEME.test(href)) return formatExternalLink(href, text);
    return text;
  }

  if (tag === "code") return formatCodeSpan(el.textContent ?? "");

  return Array.from(el.childNodes).map(walk).join("");
}

/**
 * Turns a rendered table cell back into Markdown, limited to what a grid cell
 * can show: links, embeds (as links) and code spans. Formatting such as bold
 * is dropped, but the links inside it survive, which `textContent` loses.
 */
export function cellElementToMarkdown(cellEl: Element): string {
  return Array.from(cellEl.childNodes).map(walk).join("").replace(/\s+/g, " ").trim();
}
