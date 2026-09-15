import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, type TestContext } from "node:test";

import { run, type CliIo } from "./build-index.ts";
import { createLibrary, validBook } from "./test-helpers.ts";

const script = fileURLToPath(new URL("./build-index.ts", import.meta.url));

function captureIo(cwd: string, now = new Date("2026-09-15T00:00:00.000Z")) {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = { cwd, now: () => now, log: (message) => out.push(message), error: (message) => err.push(message) };
  return { io, out, err };
}

async function tempLibrary(t: TestContext) {
  const library = await createLibrary();
  t.after(library.cleanup);
  return library;
}

async function readIndex(root: string) {
  return JSON.parse(await readFile(join(root, "index.json"), "utf8"));
}

describe("build-index CLI", () => {
  it("rejects unknown options", async (t) => {
    const library = await tempLibrary(t);
    const { io, err } = captureIo(library.root);

    assert.equal(await run(["--check"], io), 2);
    assert.match(err[0], /^Unknown option: --check\nUsage:/);
  });

  it("lists every validation problem and writes nothing", async (t) => {
    const library = await tempLibrary(t);
    await library.writeBook("en", "broken", { book: validBook({ license: "all-rights-reserved" }) });
    const { io, err } = captureIo(library.root);

    assert.equal(await run([], io), 1);
    assert.equal(err[0], "Validation failed with 1 problem(s):");
    assert.match(err[1], /^ {2}- books\/en\/broken: book.json: license must be one of/);
    await assert.rejects(access(join(library.root, "index.json")));
  });

  it("validates without writing when asked", async (t) => {
    const library = await tempLibrary(t);
    await library.writeBook("en", "walden");
    const { io, out } = captureIo(library.root);

    assert.equal(await run(["--validate-only"], io), 0);
    assert.deepEqual(out, ["Validated 1 book(s)."]);
    await assert.rejects(access(join(library.root, "index.json")));
  });

  it("writes index.json and only bumps the timestamp when books change", async (t) => {
    const library = await tempLibrary(t);
    await library.writeBook("en", "walden");

    const first = captureIo(library.root);
    assert.equal(await run([], first.io), 0);
    assert.deepEqual(first.out, ["Validated 1 book(s).", "Wrote index.json with 1 book(s)."]);
    const index = await readIndex(library.root);
    assert.equal(index.generatedAt, "2026-09-15T00:00:00.000Z");
    assert.equal(index.books[0].path, "books/en/walden");

    assert.equal(await run([], captureIo(library.root, new Date("2026-09-20T00:00:00.000Z")).io), 0);
    assert.equal((await readIndex(library.root)).generatedAt, "2026-09-15T00:00:00.000Z");

    await library.writeBook("en", "leaves-of-grass", { book: validBook({ title: "Leaves of Grass", categories: ["poetry"] }) });
    assert.equal(await run([], captureIo(library.root, new Date("2026-09-21T00:00:00.000Z")).io), 0);
    const updated = await readIndex(library.root);
    assert.equal(updated.generatedAt, "2026-09-21T00:00:00.000Z");
    assert.equal(updated.books.length, 2);
  });

  it("regenerates a corrupt index", async (t) => {
    const library = await tempLibrary(t);
    await writeFile(join(library.root, "index.json"), "{");

    assert.equal(await run([], captureIo(library.root).io), 0);
    assert.deepEqual((await readIndex(library.root)).books, []);
  });

  it("runs as a script from the repository root", async (t) => {
    const library = await tempLibrary(t);
    await library.writeBook("en", "walden");

    const result = spawnSync(process.execPath, [script], { cwd: library.root, encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Wrote index.json with 1 book\(s\)\./);
    assert.equal((await readIndex(library.root)).books.length, 1);
  });
});
