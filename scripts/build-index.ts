import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildBooks, composeIndex } from "./lib/index-builder.ts";

export interface CliIo {
  cwd: string;
  now: () => Date;
  log: (message: string) => void;
  error: (message: string) => void;
}

const VALIDATE_ONLY = "--validate-only";
const USAGE = `Usage: node scripts/build-index.ts [${VALIDATE_ONLY}]`;

async function readPreviousIndex(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    // A missing or corrupt index is regenerated from scratch.
    return null;
  }
}

/** Validate `books/` and, unless `--validate-only` is passed, write `index.json`. Returns the exit code. */
export async function run(args: readonly string[], io: CliIo): Promise<number> {
  const unknown = args.filter((arg) => arg !== VALIDATE_ONLY);
  if (unknown.length > 0) {
    io.error(`Unknown option: ${unknown.join(" ")}\n${USAGE}`);
    return 2;
  }

  const { books, errors } = await buildBooks(io.cwd);
  if (errors.length > 0) {
    io.error(`Validation failed with ${errors.length} problem(s):`);
    errors.forEach((error) => io.error(`  - ${error}`));
    return 1;
  }
  io.log(`Validated ${books.length} book(s).`);
  if (args.includes(VALIDATE_ONLY)) {
    return 0;
  }

  const indexPath = join(io.cwd, "index.json");
  const index = composeIndex(books, await readPreviousIndex(indexPath), io.now());
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  io.log(`Wrote index.json with ${books.length} book(s).`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = await run(process.argv.slice(2), {
    cwd: process.cwd(),
    now: () => new Date(),
    log: console.log,
    error: console.error,
  });
}
