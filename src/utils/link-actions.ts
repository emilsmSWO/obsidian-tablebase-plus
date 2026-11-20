import { App, Keymap } from "obsidian";
import { LinkRenderCallbacks } from "./link-renderer";

export const HOVER_LINK_SOURCE = "tablebase";

export interface LinkHoverParent {
  hoverPopover: unknown;
}

function openExternalLink(url: string): void {
  if (typeof window !== "undefined" && url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Ctrl/Cmd or middle click opens the note in a new tab, as in a note's own links. */
export function openInternalLink(
  app: App | undefined,
  href: string,
  sourcePath: string,
  event: MouseEvent
): void {
  if (!href || !app?.workspace) return;
  void app.workspace.openLinkText?.(href, sourcePath || "", Keymap.isModEvent(event));
}

export function isInternalLinkResolved(
  app: App | undefined,
  href: string,
  sourcePath: string
): boolean {
  const linkpath = href.split(/[#^]/)[0].trim();
  // "#Heading" and "^block" point into the note the link is in.
  if (!linkpath) return true;
  const cache = app?.metadataCache;
  if (typeof cache?.getFirstLinkpathDest !== "function") return true;
  return cache.getFirstLinkpathDest(linkpath, sourcePath || "") !== null;
}

export function triggerLinkHover(
  app: App | undefined,
  hoverParent: LinkHoverParent,
  href: string,
  sourcePath: string,
  event: MouseEvent,
  targetEl: HTMLElement
): void {
  app?.workspace?.trigger?.("hover-link", {
    event,
    source: HOVER_LINK_SOURCE,
    hoverParent,
    targetEl,
    linktext: href,
    sourcePath: sourcePath || "",
  });
}

/** The callbacks every view passes to renderTextWithLinks; `onActivate` runs before a click is handled. */
export function createLinkCallbacks(
  app: App | undefined,
  sourcePath: string,
  hoverParent: LinkHoverParent,
  onActivate?: () => void
): LinkRenderCallbacks {
  return {
    onExternalClick: (url, e) => {
      e.stopPropagation();
      onActivate?.();
      openExternalLink(url);
    },
    onInternalClick: (href, e) => {
      e.stopPropagation();
      onActivate?.();
      openInternalLink(app, href, sourcePath, e);
    },
    onInternalHover: (href, e, linkEl) =>
      triggerLinkHover(app, hoverParent, href, sourcePath, e, linkEl),
    isInternalResolved: (href) => isInternalLinkResolved(app, href, sourcePath),
  };
}
