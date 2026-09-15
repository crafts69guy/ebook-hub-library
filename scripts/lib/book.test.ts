import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { CATEGORIES, CHAPTER, createLibrary, validBook, type BookFiles, type TempLibrary } from "../test-helpers.ts";
import { validateBook } from "./book.ts";

const MB = 1024 * 1024;
const sha256 = (content: string) => createHash("sha256").update(content).digest("hex");
const context = (language = "en", slug = "walden") => ({ language, slug, categories: new Set(CATEGORIES) });

let library: TempLibrary;

before(async () => {
  library = await createLibrary();
});

after(async () => {
  await library.cleanup();
});

async function errorsFor(slug: string, options: BookFiles): Promise<string[]> {
  const dir = await library.writeBook("en", slug, options);
  return (await validateBook(dir, context("en", slug))).errors;
}

function assertIncludes(errors: string[], message: string): void {
  assert.ok(
    errors.some((error) => error.includes(message)),
    `expected an error containing "${message}", got ${JSON.stringify(errors, null, 2)}`,
  );
}

describe("validateBook", () => {
  it("returns an index entry with SHA-256 digests for a valid book", async () => {
    const dir = await library.writeBook("en", "walden");

    const result = await validateBook(dir, context());

    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.entry, {
      slug: "walden",
      version: "1.0.0",
      title: "Walden",
      authors: ["Henry David Thoreau"],
      language: "en",
      categories: ["essays"],
      license: "public-domain",
      summary: "Life in the woods.",
      path: "books/en/walden",
      files: [
        { path: "book.json", sha256: sha256(JSON.stringify(validBook(), null, 2)) },
        { path: "chapters/0001.md", sha256: sha256(CHAPTER) },
      ],
    });
  });

  it("omits blank or missing summaries from the entry", async () => {
    for (const [slug, summary] of [
      ["blank-summary", "  "],
      ["no-summary", undefined],
    ] as const) {
      const dir = await library.writeBook("en", slug, { book: validBook({ summary }) });
      const { entry, errors } = await validateBook(dir, context("en", slug));
      assert.deepEqual(errors, []);
      assert.equal(entry !== null && "summary" in entry, false);
    }
  });

  const fieldCases: [string, Record<string, unknown>, string][] = [
    ["unknown fields", { cover: "cover.png" }, 'unknown field "cover"'],
    ["long titles", { title: "x".repeat(201) }, "title must be a non-empty string"],
    ["missing authors", { authors: [] }, "authors must be a non-empty array"],
    ["mismatched language", { language: "vi" }, 'language must be "en" to match its folder'],
    ["missing categories", { categories: "essays" }, "categories must be a non-empty array"],
    ["unknown categories", { categories: ["cooking"] }, 'category "cooking" is not listed in categories.json'],
    ["repeated categories", { categories: ["essays", "essays"] }, "categories must not repeat"],
    ["disallowed licenses", { license: "CC-BY-NC-4.0" }, "license must be one of"],
    ["insecure sources", { source: "http://example.org/book" }, "source must be an https URL"],
    ["unparsable sources", { source: "not a url" }, "source must be an https URL"],
    ["missing sources", { source: 42 }, "source must be an https URL"],
    ["invalid versions", { version: "v1" }, "version must be a semantic version"],
    ["long summaries", { summary: "x".repeat(281) }, "summary must be a string"],
    ["non string summaries", { summary: 5 }, "summary must be a string"],
    ["empty chapter lists", { chapters: [] }, "chapters must be a non-empty array"],
    ["non object chapters", { chapters: ["chapters/0001.md"] }, "chapters[0] must be an object"],
    ["untitled chapters", { chapters: [{ file: "chapters/0001.md" }] }, "chapters[0].title must be a non-empty string"],
    ["badly named chapter files", { chapters: [{ title: "A", file: "chapter1.md" }] }, "chapters[0].file must look like"],
    [
      "repeated chapter files",
      {
        chapters: [
          { title: "A", file: "chapters/0001.md" },
          { title: "B", file: "chapters/0001.md" },
        ],
      },
      "is listed more than once",
    ],
  ];

  for (const [label, overrides, message] of fieldCases) {
    it(`rejects ${label}`, async () => {
      const slug = label.replaceAll(" ", "-");
      const dir = await library.writeBook("en", slug, { book: validBook(overrides) });
      const result = await validateBook(dir, context("en", slug));
      assertIncludes(result.errors, message);
      assert.equal(result.entry, null);
    });
  }

  it("rejects missing, malformed, non-object, and oversized book.json files", async () => {
    const missing = await library.writeBook("en", "missing-book-json");
    await rm(join(missing, "book.json"));
    assert.deepEqual((await validateBook(missing, context("en", "missing-book-json"))).errors, ["book.json is missing"]);

    assertIncludes(await errorsFor("malformed-json", { book: "{" }), "book.json is not valid UTF-8 JSON");
    assertIncludes(
      await errorsFor("latin1-json", { files: { "book.json": new Uint8Array([0x7b, 0xff, 0x7d]) } }),
      "book.json is not valid UTF-8 JSON",
    );
    assertIncludes(await errorsFor("array-json", { book: "[]" }), "book.json must contain a JSON object");
    assertIncludes(
      await errorsFor("huge-json", { book: validBook({ padding: "x".repeat(70 * 1024) }) }),
      "book.json is larger than 64 KB",
    );
  });

  it("rejects unlisted, missing, and linked files", async () => {
    const errors = await errorsFor("stray-files", {
      book: validBook({
        chapters: [
          { title: "One", file: "chapters/0001.md" },
          { title: "Three", file: "chapters/0003.md" },
        ],
      }),
      files: { "chapters/0001.md": CHAPTER, "chapters/0002.md": CHAPTER, "cover.png": "png" },
    });
    assertIncludes(errors, "chapters/0002.md: only book.json and the chapter files listed in it are allowed");
    assertIncludes(errors, "cover.png: only book.json");
    assertIncludes(errors, "chapters/0003.md is listed in book.json but does not exist");

    const linked = await library.writeBook("en", "linked-file");
    await symlink(join(linked, "chapters", "0001.md"), join(linked, "chapters", "link.md"));
    assertIncludes((await validateBook(linked, context("en", "linked-file"))).errors, "chapters/link.md: symbolic links are not allowed");
  });

  it("rejects empty, non-UTF-8, unsafe, and oversized chapters", async () => {
    assertIncludes(await errorsFor("empty-chapter", { files: { "chapters/0001.md": "  \n" } }), "chapters/0001.md is empty");
    assertIncludes(
      await errorsFor("binary-chapter", { files: { "chapters/0001.md": new Uint8Array([0xc3, 0x28]) } }),
      "chapters/0001.md is not valid UTF-8",
    );
    assertIncludes(
      await errorsFor("html-chapter", { files: { "chapters/0001.md": "<b>bold</b>" } }),
      "chapters/0001.md: line 1: raw HTML is not allowed",
    );
    assertIncludes(
      await errorsFor("big-chapter", { files: { "chapters/0001.md": "a".repeat(2 * MB + 1) } }),
      "chapters/0001.md is larger than 2 MB",
    );

    const chapters = Array.from({ length: 11 }, (_, index) => `chapters/${String(index + 1).padStart(4, "0")}.md`);
    const errors = await errorsFor("big-book", {
      book: validBook({ chapters: chapters.map((file, index) => ({ title: `Part ${index + 1}`, file })) }),
      files: Object.fromEntries(chapters.map((file) => [file, "a".repeat(2 * MB)])),
    });
    assertIncludes(errors, "the book is larger than 20 MB");
  });

  it("rejects invalid language and slug folder names", async () => {
    const dir = await library.writeBook("en", "folder-names");
    const { errors } = await validateBook(dir, context("EN", "Folder_Names"));
    assertIncludes(errors, 'language folder "EN" must be a lowercase ISO 639 code');
    assertIncludes(errors, 'folder name "Folder_Names" must be a lowercase kebab-case slug');
  });
});
