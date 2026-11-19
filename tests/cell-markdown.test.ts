import { describe, it, expect } from "vitest";
import { cellElementToMarkdown } from "../src/extensions/cell-markdown";

function toMarkdown(html: string): string {
  const td = document.createElement("td");
  td.innerHTML = html;
  return cellElementToMarkdown(td);
}

describe("cellElementToMarkdown", () => {
  it("should write internal links with an escaped alias separator", () => {
    expect(toMarkdown('<a class="internal-link" data-href="Page#Sec">Alias</a>')).toBe(
      "[[Page#Sec\\|Alias]]"
    );
    expect(toMarkdown('<a class="internal-link" data-href="Page">Page</a>')).toBe("[[Page]]");
  });

  it("should write external links, keeping only safe schemes", () => {
    expect(toMarkdown('<a href="https://a.org/x y">t</a>')).toBe("[t](<https://a.org/x y>)");
    expect(toMarkdown('<a href="mailto:me@x.org">mail</a>')).toBe("[mail](mailto:me@x.org)");
    expect(toMarkdown('<a href="javascript:alert(1)">bad</a>')).toBe("bad");
  });

  it("should flatten formatting, keep code spans and embeds, and turn breaks into spaces", () => {
    expect(
      toMarkdown('<strong>a</strong><br><code>b`c</code> <span class="internal-embed" src="Img.png"></span>')
    ).toBe("a ``b`c`` [[Img.png]]");
  });
});
