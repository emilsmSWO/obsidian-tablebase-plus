import { describe, it, expect } from "vitest";
import { parseMarkdownTables } from "../src/core/markdown-parser";
import { resolveTableId } from "../src/core/table-id";

const text = ["| A |", "| --- |", "| 1 |", "", "| B |", "| --- |", "| 2 |"].join("\n");

describe("resolveTableId", () => {
  it("should number tables by their position in the note", () => {
    const docTables = parseMarkdownTables(text);
    expect(resolveTableId("n.md", { lineStart: 0, lineEnd: 2 }, docTables, ["A"])).toBe("tbl_n.md_0");
    expect(resolveTableId("n.md", { lineStart: 4, lineEnd: 6 }, docTables, ["B"])).toBe("tbl_n.md_1");
  });

  it("should fall back to the headers when the note text is unknown", () => {
    expect(resolveTableId("n.md", null, [], ["A", "B"], 2)).toBe("tbl_n.md_A|B_2");
  });
});
