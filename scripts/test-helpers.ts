import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const CATEGORIES = ["essays", "fiction", "poetry"];
export const CHAPTER = "# Economy\n\nWhen I wrote the following pages.\n";

/** A real 1x1 PNG, so image fixtures carry the signature the validator checks. */
export const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

/** A RIFF container that names itself WEBP; enough for signature checks. */
export const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c,
]);

export function validBook(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Walden",
    authors: ["Henry David Thoreau"],
    language: "en",
    categories: ["essays"],
    license: "public-domain",
    source: "https://www.gutenberg.org/ebooks/205",
    version: "1.0.0",
    summary: "Life in the woods.",
    chapters: [{ title: "Economy", file: "chapters/0001.md" }],
    ...overrides,
  };
}

export interface BookFiles {
  /** Object is written as JSON; a string is written verbatim. */
  book?: Record<string, unknown> | string;
  /** Extra or replacement files relative to the book folder. Defaults to one valid chapter. */
  files?: Record<string, string | Uint8Array>;
}

export interface TempLibrary {
  root: string;
  writeBook: (language: string, slug: string, options?: BookFiles) => Promise<string>;
  cleanup: () => Promise<void>;
}

export async function createLibrary(categories: unknown = { schemaVersion: 1, categories: CATEGORIES }): Promise<TempLibrary> {
  const root = await mkdtemp(join(tmpdir(), "ebook-hub-library-"));
  await writeFile(join(root, "categories.json"), JSON.stringify(categories));

  return {
    root,
    async writeBook(language, slug, options = {}) {
      const dir = join(root, "books", language, slug);
      const book = options.book ?? validBook({ language });
      const files: Record<string, string | Uint8Array> = {
        "book.json": typeof book === "string" ? book : JSON.stringify(book, null, 2),
        ...(options.files ?? { "chapters/0001.md": CHAPTER }),
      };
      for (const [path, content] of Object.entries(files)) {
        await mkdir(dirname(join(dir, path)), { recursive: true });
        await writeFile(join(dir, path), content);
      }
      return dir;
    },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
