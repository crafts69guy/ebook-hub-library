import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findMarkdownProblems } from "./markdown-rules.ts";

describe("findMarkdownProblems", () => {
  it("accepts plain Markdown", () => {
    assert.deepEqual(findMarkdownProblems("# Title\n\nSome *text* with a [link](https://example.org) and a < b."), []);
  });

  it("reports raw HTML, comments, images, and unsafe links with line numbers", () => {
    const markdown = [
      "Intro",
      "<div>block</div>",
      "<!-- hidden -->",
      "![cover](cover.png)",
      "![logo][ref]",
      "[click](javascript:alert(1))",
    ].join("\n");

    assert.deepEqual(findMarkdownProblems(markdown), [
      "line 2: raw HTML is not allowed",
      "line 3: raw HTML is not allowed",
      "line 4: images are not allowed",
      "line 5: images are not allowed",
      "line 6: links must not use javascript:, data:, vbscript:, or file: URLs",
    ]);
  });

  it("ignores fenced code, including other fence markers inside it", () => {
    const markdown = ["```html", "<div>example</div>", "~~~", "![x](y)", "```", "", "~~~", "<b>also code</b>", "~~~"].join(
      "\r\n",
    );
    assert.deepEqual(findMarkdownProblems(markdown), []);
  });

  it("reports unclosed code fences", () => {
    assert.deepEqual(findMarkdownProblems("```\ncode"), ["a code fence is never closed"]);
  });
});
