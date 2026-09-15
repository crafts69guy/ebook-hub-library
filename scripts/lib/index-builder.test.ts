import assert from "node:assert/strict";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, type TestContext } from "node:test";

import { createLibrary, validBook } from "../test-helpers.ts";
import { buildBooks, composeIndex, loadCategories } from "./index-builder.ts";
import { REF, REPOSITORY } from "./rules.ts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

async function tempLibrary(t: TestContext, categories?: unknown) {
  const library = await createLibrary(categories);
  t.after(library.cleanup);
  return library;
}

describe("loadCategories", () => {
  it("reads kebab-case category slugs", async (t) => {
    const library = await tempLibrary(t);
    assert.deepEqual(await loadCategories(library.root), {
      categories: new Set(["essays", "fiction", "poetry"]),
      errors: [],
    });
  });

  it("reports unreadable and malformed category files", async (t) => {
    const library = await tempLibrary(t);
    await writeFile(join(library.root, "categories.json"), "{");
    const unreadable = await loadCategories(library.root);
    assert.match(unreadable.errors[0], /^categories.json could not be read/);

    for (const content of [{ categories: [] }, { categories: ["Bad Slug"] }, { other: true }, ["poetry"]]) {
      await writeFile(join(library.root, "categories.json"), JSON.stringify(content));
      assert.deepEqual((await loadCategories(library.root)).errors, [
        'categories.json must contain a non-empty "categories" array of kebab-case slugs',
      ]);
    }
  });
});

describe("buildBooks", () => {
  it("returns no books for an empty library", async (t) => {
    const library = await tempLibrary(t);
    assert.deepEqual(await buildBooks(library.root), { books: [], errors: [] });
  });

  it("sorts books by language then slug", async (t) => {
    const library = await tempLibrary(t);
    await library.writeBook("vi", "truyen-kieu", { book: validBook({ language: "vi", title: "Truyện Kiều" }) });
    await library.writeBook("en", "walden");
    await library.writeBook("en", "aesop-fables", { book: validBook({ title: "Aesop's Fables" }) });
    await writeFile(join(library.root, "books", ".gitkeep"), "");

    const { books, errors } = await buildBooks(library.root);

    assert.deepEqual(errors, []);
    assert.deepEqual(
      books.map((book) => book.path),
      ["books/en/aesop-fables", "books/en/walden", "books/vi/truyen-kieu"],
    );
  });

  it("reports stray files, duplicate slugs, and invalid books with their paths", async (t) => {
    const library = await tempLibrary(t);
    await library.writeBook("en", "walden");
    await library.writeBook("fr", "walden", { book: validBook({ language: "fr" }) });
    await library.writeBook("en", "broken", { book: "{" });
    await writeFile(join(library.root, "books", "README.md"), "notes");
    await writeFile(join(library.root, "books", "en", "notes.txt"), "notes");

    const { books, errors } = await buildBooks(library.root);

    assert.deepEqual(
      books.map((book) => book.path),
      ["books/en/walden", "books/fr/walden"],
    );
    assert.deepEqual(errors, [
      "books/README.md: only folders are allowed here",
      "books/en/notes.txt: only folders are allowed here",
      "books/en/broken: book.json is not valid UTF-8 JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      'books/fr/walden: slug "walden" is already used by books/en/walden',
    ]);
  });

  it("fails loudly when books/ cannot be read", async (t) => {
    const library = await tempLibrary(t);
    await writeFile(join(library.root, "books"), "not a folder");
    await assert.rejects(buildBooks(library.root), { code: "ENOTDIR" });
  });

  it("accepts the book template shipped in this repository", async (t) => {
    const categories = JSON.parse(await readFile(join(repoRoot, "categories.json"), "utf8"));
    const library = await tempLibrary(t, categories);
    await mkdir(join(library.root, "books", "en"), { recursive: true });
    await cp(join(repoRoot, "templates", "book"), join(library.root, "books", "en", "my-book"), { recursive: true });

    const { books, errors } = await buildBooks(library.root);

    assert.deepEqual(errors, []);
    assert.equal(books.length, 1);
  });
});

describe("composeIndex", () => {
  const now = new Date("2026-09-15T00:00:00.000Z");
  const later = new Date("2026-10-01T00:00:00.000Z");

  it("creates an index for the Ebook Hub extension", () => {
    assert.deepEqual(composeIndex([], null, now), {
      schemaVersion: 1,
      generatedAt: "2026-09-15T00:00:00.000Z",
      repository: REPOSITORY,
      ref: REF,
      books: [],
    });
  });

  it("keeps the previous timestamp only when nothing else changed", () => {
    const previous = JSON.parse(JSON.stringify(composeIndex([], null, now)));
    assert.equal(composeIndex([], previous, later).generatedAt, "2026-09-15T00:00:00.000Z");

    const changedBooks = composeIndex(
      [{ slug: "walden", version: "1.0.0", title: "Walden", authors: [], language: "en", categories: [], license: "public-domain", path: "books/en/walden", files: [] }],
      previous,
      later,
    );
    assert.equal(changedBooks.generatedAt, "2026-10-01T00:00:00.000Z");
    assert.equal(composeIndex([], { books: [] }, later).generatedAt, "2026-10-01T00:00:00.000Z");
  });
});
