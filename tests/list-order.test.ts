import { describe, it, expect } from "vitest";
import { mergeListOrder, moveListOrders, pruneListOrders } from "../src/core/list-order";

const orders = {
  "tbl_Notes/a.md_0": { Status: ["Todo"] },
  "tbl_Notes/a.md_1": { Status: ["Done"] },
  "tbl_b.md_0": { Tags: ["x"] },
};

describe("list order", () => {
  it("keeps saved order, drops unused options and appends new ones", () => {
    expect(mergeListOrder(["B", "Gone", "A"], ["A", "B", "C"])).toEqual(["B", "A", "C"]);
  });

  it("moves the entries of a renamed note or folder and drops those of a deleted one", () => {
    expect(Object.keys(moveListOrders(orders, "Notes/a.md", "Notes/c.md") ?? {})).toEqual([
      "tbl_Notes/c.md_0",
      "tbl_Notes/c.md_1",
      "tbl_b.md_0",
    ]);
    expect(Object.keys(moveListOrders(orders, "Notes", "Docs") ?? {})).toContain(
      "tbl_Docs/a.md_1"
    );
    expect(Object.keys(moveListOrders(orders, "Notes/a.md", null) ?? {})).toEqual(["tbl_b.md_0"]);
    expect(moveListOrders(orders, "other.md", null)).toBeNull();
  });

  it("prunes entries whose note no longer exists, including legacy ids", () => {
    const withLegacy = { ...orders, tbl_5_9: { Status: ["x"] } };
    const pruned = pruneListOrders(withLegacy, (path) => path === "b.md");
    expect(Object.keys(pruned ?? {})).toEqual(["tbl_b.md_0"]);
    expect(pruneListOrders(orders, () => true)).toBeNull();
  });
});
