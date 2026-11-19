import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SettingsService } from "../src/services/settings-service";
import { DEFAULT_SETTINGS } from "../src/types";
import { renderGlobalTagColorsEditor } from "../src/ui/global-tag-colors-editor";
import { installObsidianDomHelpers } from "./helpers/obsidian-dom";

describe("global tag colors editor", () => {
  beforeAll(() => {
    installObsidianDomHelpers(window as Window & typeof globalThis);
  });
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  const setup = async () => {
    const service = new SettingsService({
      loadData: async () => ({ ...DEFAULT_SETTINGS, customTagColors: { bug: "red" } }),
      saveData: async () => undefined,
    });
    await service.loadSettings();
    const host = document.createElement("div");
    document.body.appendChild(host);
    renderGlobalTagColorsEditor(host, service);
    return { service, host };
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("lists, adds with a chosen color, recolors and deletes tags", async () => {
    const { service, host } = await setup();
    expect(host.querySelectorAll(".ms-gtc-name")[0].textContent).toBe("bug");

    host.querySelector<HTMLButtonElement>('[aria-label="New tag color"]')!.click();
    host.querySelector<HTMLElement>(".ms-color-swatch-dot.ms-color-green")!.click();
    host.querySelector<HTMLInputElement>('input[type="text"]')!.value = "In Progress";
    Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Add tag color")!.click();
    await flush();
    expect(service.getSettings().customTagColors).toEqual({ bug: "red", "in progress": "green" });

    host.querySelectorAll<HTMLButtonElement>('[aria-label="Tag color"]')[0].click();
    host.querySelector<HTMLElement>(".ms-color-swatch-dot.ms-color-blue")!.click();
    await flush();
    expect(service.getSettings().customTagColors.bug).toBe("blue");

    host.querySelectorAll<HTMLButtonElement>('[aria-label="Delete tag color"]')[0].click();
    await flush();
    expect(service.getSettings().customTagColors).toEqual({ "in progress": "green" });
  });

  it("refuses a tag that already has a color", async () => {
    const { service, host } = await setup();
    host.querySelector<HTMLInputElement>('input[type="text"]')!.value = "BUG";
    Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Add tag color")!.click();
    await flush();
    expect(host.querySelector(".ms-dict-error")?.textContent).toMatch(/already has a color/);
    expect(service.getSettings().customTagColors).toEqual({ bug: "red" });
  });
});
