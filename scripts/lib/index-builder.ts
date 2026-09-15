import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { validateBook, type IndexEntry } from "./book.ts";
import { errorMessage, isObject } from "./json.ts";
import { INDEX_SCHEMA_VERSION, REF, REPOSITORY, SLUG_PATTERN } from "./rules.ts";

export interface LibraryIndex {
  schemaVersion: number;
  generatedAt: string;
  repository: string;
  ref: string;
  books: IndexEntry[];
}

export interface BuildResult {
  books: IndexEntry[];
  errors: string[];
}

interface Folders {
  names: string[];
  errors: string[];
}

const IGNORED_FILES = new Set([".gitkeep"]);

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function foldersIn(dir: string, label: string): Promise<Folders> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) {
      return { names: [], errors: [] };
    }
    throw error;
  }

  const folders: Folders = { names: [], errors: [] };
  for (const entry of entries) {
    if (entry.isDirectory()) {
      folders.names.push(entry.name);
    } else if (!IGNORED_FILES.has(entry.name)) {
      folders.errors.push(`${label}/${entry.name}: only folders are allowed here`);
    }
  }
  folders.names.sort();
  return folders;
}

export async function loadCategories(root: string): Promise<{ categories: Set<string>; errors: string[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(root, "categories.json"), "utf8"));
  } catch (error) {
    return { categories: new Set(), errors: [`categories.json could not be read: ${errorMessage(error)}`] };
  }
  const list: unknown = isObject(raw) ? raw.categories : undefined;
  const names = Array.isArray(list)
    ? list.filter((name: unknown): name is string => typeof name === "string" && SLUG_PATTERN.test(name))
    : [];
  if (!Array.isArray(list) || names.length === 0 || names.length !== list.length) {
    return {
      categories: new Set(),
      errors: ['categories.json must contain a non-empty "categories" array of kebab-case slugs'],
    };
  }
  return { categories: new Set(names), errors: [] };
}

/** Validate every book under `books/` and collect index entries sorted by language, then slug. */
export async function buildBooks(root: string): Promise<BuildResult> {
  const { categories, errors } = await loadCategories(root);
  const books: IndexEntry[] = [];
  const slugOwners = new Map<string, string>();
  const booksDir = join(root, "books");

  const languages = await foldersIn(booksDir, "books");
  errors.push(...languages.errors);
  for (const language of languages.names) {
    const slugs = await foldersIn(join(booksDir, language), `books/${language}`);
    errors.push(...slugs.errors);
    for (const slug of slugs.names) {
      const path = `books/${language}/${slug}`;
      const owner = slugOwners.get(slug);
      if (owner) {
        errors.push(`${path}: slug "${slug}" is already used by ${owner}`);
      } else {
        slugOwners.set(slug, path);
      }
      const result = await validateBook(join(booksDir, language, slug), { language, slug, categories });
      errors.push(...result.errors.map((error) => `${path}: ${error}`));
      if (result.entry) {
        books.push(result.entry);
      }
    }
  }
  return { books, errors };
}

/** Build the index, keeping the previous timestamp when nothing else changed to avoid noisy commits. */
export function composeIndex(books: IndexEntry[], previous: unknown, now: Date): LibraryIndex {
  const index: LibraryIndex = {
    schemaVersion: INDEX_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    repository: REPOSITORY,
    ref: REF,
    books,
  };
  if (isObject(previous) && typeof previous.generatedAt === "string") {
    const unchanged = JSON.stringify({ ...previous, generatedAt: index.generatedAt }) === JSON.stringify(index);
    if (unchanged) {
      return { ...index, generatedAt: previous.generatedAt };
    }
  }
  return index;
}
