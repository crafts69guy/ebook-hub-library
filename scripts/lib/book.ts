import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { errorMessage, isNonEmptyString, isObject, isStringList } from "./json.ts";
import { findMarkdownProblems } from "./markdown-rules.ts";
import {
  ALLOWED_LICENSES,
  BOOK_FILE,
  CHAPTER_FILE_PATTERN,
  LANGUAGE_PATTERN,
  MAX_BOOK_BYTES,
  MAX_BOOK_JSON_BYTES,
  MAX_CHAPTER_BYTES,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  SLUG_PATTERN,
  VERSION_PATTERN,
} from "./rules.ts";

export interface IndexFile {
  path: string;
  sha256: string;
}

export interface IndexEntry {
  slug: string;
  version: string;
  title: string;
  authors: string[];
  language: string;
  categories: string[];
  license: string;
  summary?: string;
  path: string;
  files: IndexFile[];
}

export interface BookContext {
  language: string;
  slug: string;
  categories: ReadonlySet<string>;
}

export interface BookResult {
  entry: IndexEntry | null;
  errors: string[];
}

interface Listing {
  files: string[];
  problems: string[];
}

const BOOK_FIELDS = new Set(["title", "authors", "language", "categories", "license", "source", "version", "summary", "chapters"]);
const MB = 1024 * 1024;
const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    // Unparsable URLs are simply not https URLs.
    return false;
  }
}

async function listFiles(dir: string, prefix = ""): Promise<Listing> {
  const listing: Listing = { files: [], problems: [] };
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) {
      listing.problems.push(`${relative}: symbolic links are not allowed`);
    } else if (entry.isDirectory()) {
      const nested = await listFiles(join(dir, entry.name), `${relative}/`);
      listing.files.push(...nested.files);
      listing.problems.push(...nested.problems);
    } else {
      listing.files.push(relative);
    }
  }
  return listing;
}

function readChapterFiles(value: unknown, add: (message: string) => void): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    add("book.json: chapters must be a non-empty array");
    return [];
  }
  const files: string[] = [];
  value.forEach((chapter: unknown, index: number) => {
    const at = `book.json: chapters[${index}]`;
    if (!isObject(chapter)) {
      add(`${at} must be an object with title and file`);
      return;
    }
    if (!isNonEmptyString(chapter.title)) {
      add(`${at}.title must be a non-empty string`);
    }
    const file = chapter.file;
    if (typeof file !== "string" || !CHAPTER_FILE_PATTERN.test(file)) {
      add(`${at}.file must look like chapters/0001.md`);
      return;
    }
    if (files.includes(file)) {
      add(`${at}.file ${file} is listed more than once`);
      return;
    }
    files.push(file);
  });
  return files;
}

/** Validate one `books/<language>/<slug>` folder and build its index entry when it is valid. */
export async function validateBook(bookDir: string, context: BookContext): Promise<BookResult> {
  const errors: string[] = [];
  const add = (message: string) => {
    errors.push(message);
  };
  const { language, slug } = context;

  if (!LANGUAGE_PATTERN.test(language)) {
    add(`language folder "${language}" must be a lowercase ISO 639 code such as "en" or "vi"`);
  }
  if (!SLUG_PATTERN.test(slug)) {
    add(`folder name "${slug}" must be a lowercase kebab-case slug`);
  }

  const listing = await listFiles(bookDir);
  listing.problems.forEach(add);
  if (!listing.files.includes(BOOK_FILE)) {
    add(`${BOOK_FILE} is missing`);
    return { entry: null, errors };
  }

  const bookBytes = await readFile(join(bookDir, BOOK_FILE));
  if (bookBytes.byteLength > MAX_BOOK_JSON_BYTES) {
    add(`${BOOK_FILE} is larger than ${MAX_BOOK_JSON_BYTES / 1024} KB`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(strictUtf8.decode(bookBytes));
  } catch (error) {
    add(`${BOOK_FILE} is not valid UTF-8 JSON: ${errorMessage(error)}`);
    return { entry: null, errors };
  }
  if (!isObject(raw)) {
    add(`${BOOK_FILE} must contain a JSON object`);
    return { entry: null, errors };
  }

  Object.keys(raw)
    .filter((key) => !BOOK_FIELDS.has(key))
    .forEach((key) => add(`book.json: unknown field "${key}"`));

  const title = isNonEmptyString(raw.title) && raw.title.length <= MAX_TITLE_LENGTH ? raw.title : null;
  if (title === null) {
    add(`book.json: title must be a non-empty string of at most ${MAX_TITLE_LENGTH} characters`);
  }
  const authors = isStringList(raw.authors) ? raw.authors : null;
  if (authors === null) {
    add("book.json: authors must be a non-empty array of names");
  }
  if (raw.language !== language) {
    add(`book.json: language must be "${language}" to match its folder`);
  }
  const categories = isStringList(raw.categories) ? raw.categories : null;
  if (categories === null) {
    add("book.json: categories must be a non-empty array of category slugs");
  } else {
    categories
      .filter((category) => !context.categories.has(category))
      .forEach((category) => add(`book.json: category "${category}" is not listed in categories.json`));
    if (new Set(categories).size !== categories.length) {
      add("book.json: categories must not repeat");
    }
  }
  const license =
    typeof raw.license === "string" && (ALLOWED_LICENSES as readonly string[]).includes(raw.license)
      ? raw.license
      : null;
  if (license === null) {
    add(`book.json: license must be one of ${ALLOWED_LICENSES.join(", ")}`);
  }
  if (!isHttpsUrl(raw.source)) {
    add("book.json: source must be an https URL of the original publication");
  }
  const version = typeof raw.version === "string" && VERSION_PATTERN.test(raw.version) ? raw.version : null;
  if (version === null) {
    add("book.json: version must be a semantic version such as 1.0.0");
  }
  const summary = raw.summary;
  if (summary !== undefined && (typeof summary !== "string" || summary.length > MAX_SUMMARY_LENGTH)) {
    add(`book.json: summary must be a string of at most ${MAX_SUMMARY_LENGTH} characters`);
  }
  const chapterFiles = readChapterFiles(raw.chapters, add);

  listing.files
    .filter((file) => file !== BOOK_FILE && !chapterFiles.includes(file))
    .forEach((file) => add(`${file}: only book.json and the chapter files listed in it are allowed`));

  const files: IndexFile[] = [{ path: BOOK_FILE, sha256: sha256(bookBytes) }];
  let totalBytes = bookBytes.byteLength;
  for (const file of chapterFiles) {
    if (!listing.files.includes(file)) {
      add(`${file} is listed in book.json but does not exist`);
      continue;
    }
    const bytes = await readFile(join(bookDir, file));
    totalBytes += bytes.byteLength;
    if (bytes.byteLength > MAX_CHAPTER_BYTES) {
      add(`${file} is larger than ${MAX_CHAPTER_BYTES / MB} MB`);
    }
    let text: string;
    try {
      text = strictUtf8.decode(bytes);
    } catch {
      add(`${file} is not valid UTF-8`);
      continue;
    }
    if (text.trim() === "") {
      add(`${file} is empty`);
    }
    findMarkdownProblems(text).forEach((problem) => add(`${file}: ${problem}`));
    files.push({ path: file, sha256: sha256(bytes) });
  }
  if (totalBytes > MAX_BOOK_BYTES) {
    add(`the book is larger than ${MAX_BOOK_BYTES / MB} MB`);
  }

  if (title === null || authors === null || categories === null || license === null || version === null || errors.length > 0) {
    return { entry: null, errors };
  }
  return {
    entry: {
      slug,
      version,
      title,
      authors,
      language,
      categories,
      license,
      ...(typeof summary === "string" && summary.trim() !== "" ? { summary } : {}),
      path: `books/${language}/${slug}`,
      files,
    },
    errors,
  };
}
