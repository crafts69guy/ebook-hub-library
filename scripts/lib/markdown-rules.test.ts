import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inspectMarkdown } from "./markdown-rules.ts";

describe("inspectMarkdown", () => {
  it("accepts plain Markdown", () => {
    assert.deepEqual(inspectMarkdown("# Title\n\nSome *text* with a [link](https://example.org) and a < b."), {
      problems: [],
      images: [],
    });
  });

  it("collects bundled images in the order they appear", () => {
    const markdown = "![Plate I](images/0001.png)\n\nText\n\n![Plate II](images/0002.webp)";

    assert.deepEqual(inspectMarkdown(markdown), {
      problems: [],
      images: ["images/0001.png", "images/0002.webp"],
    });
  });

  it("rejects images that are not bundled files", () => {
    const markdown = [
      "![remote](https://example.org/plate.png)",
      "![escape](../../secrets/key.png)",
      "![wrong name](images/plate.png)",
      "![titled](images/0001.png \"Plate I\")",
    ].join("\n");

    assert.deepEqual(inspectMarkdown(markdown), {
      problems: [
        'line 1: image "https://example.org/plate.png" must be a bundled file such as images/0001.png',
        'line 2: image "../../secrets/key.png" must be a bundled file such as images/0001.png',
        'line 3: image "images/plate.png" must be a bundled file such as images/0001.png',
        'line 4: image "images/0001.png \"Plate I\"" must be a bundled file such as images/0001.png',
      ],
      images: [],
    });
  });

  it("rejects reference-style and malformed images", () => {
    assert.deepEqual(inspectMarkdown("![logo][ref]\n![unclosed](images/0001.png").problems, [
      "line 1: images must be written as ![alt](images/0001.png)",
      "line 2: images must be written as ![alt](images/0001.png)",
    ]);
  });

  it("reports raw HTML, comments, and unsafe links with line numbers", () => {
    const markdown = ["Intro", "<div>block</div>", "<!-- hidden -->", "[click](javascript:alert(1))"].join("\n");

    assert.deepEqual(inspectMarkdown(markdown).problems, [
      "line 2: raw HTML is not allowed",
      "line 3: raw HTML is not allowed",
      "line 4: links must not use javascript:, data:, vbscript:, or file: URLs",
    ]);
  });

  it("ignores fenced code, including other fence markers inside it", () => {
    const markdown = ["```html", "<div>example</div>", "~~~", "![x](y)", "```", "", "~~~", "<b>also code</b>", "~~~"].join(
      "\r\n",
    );
    assert.deepEqual(inspectMarkdown(markdown), { problems: [], images: [] });
  });

  it("reports unclosed code fences", () => {
    assert.deepEqual(inspectMarkdown("```\ncode").problems, ["a code fence is never closed"]);
  });
});
