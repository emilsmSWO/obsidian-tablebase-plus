import { describe, it, expect, vi } from "vitest";
import type { App } from "obsidian";
import {
  isInternalLinkResolved,
  openInternalLink,
  triggerLinkHover,
} from "../src/utils/link-actions";

describe("link-actions", () => {
  it("should open a note in a new tab on Ctrl/Cmd+click only", () => {
    const openLinkText = vi.fn();
    const app = { workspace: { openLinkText } } as unknown as App;
    openInternalLink(app, "Note", "a.md", new MouseEvent("click"));
    openInternalLink(app, "Note", "a.md", new MouseEvent("click", { ctrlKey: true }));
    expect(openLinkText).toHaveBeenNthCalledWith(1, "Note", "a.md", false);
    expect(openLinkText).toHaveBeenNthCalledWith(2, "Note", "a.md", "tab");
  });

  it("should resolve the note part of a link and treat in-note anchors as resolved", () => {
    const getFirstLinkpathDest = vi.fn((path: string) => (path === "Exists" ? {} : null));
    const app = { metadataCache: { getFirstLinkpathDest } } as unknown as App;
    expect(isInternalLinkResolved(app, "Exists#Sec", "a.md")).toBe(true);
    expect(isInternalLinkResolved(app, "Missing^blk", "a.md")).toBe(false);
    expect(getFirstLinkpathDest).toHaveBeenCalledWith("Missing", "a.md");
    expect(isInternalLinkResolved(app, "#Heading", "a.md")).toBe(true);
    expect(isInternalLinkResolved({} as App, "Whatever", "a.md")).toBe(true);
  });

  it("should trigger the workspace hover-link event with the plugin source", () => {
    const trigger = vi.fn();
    const app = { workspace: { trigger } } as unknown as App;
    const parent = { hoverPopover: null };
    const el = document.createElement("a");
    const event = new MouseEvent("mouseover");
    triggerLinkHover(app, parent, "Note", "a.md", event, el);
    expect(trigger).toHaveBeenCalledWith("hover-link", {
      event,
      source: "tablebase",
      hoverParent: parent,
      targetEl: el,
      linktext: "Note",
      sourcePath: "a.md",
    });
  });
});
