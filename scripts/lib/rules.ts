/**
 * Library rules shared by validation and index generation. They mirror what the Ebook Hub
 * extension accepts (see the extension's ADR-0005 and `src/domain/community.ts`); change both
 * sides together.
 */
export const INDEX_SCHEMA_VERSION = 1;
export const REPOSITORY = "https://github.com/crafts69guy/ebook-hub-library";
export const REF = "main";

export const BOOK_FILE = "book.json";
export const ALLOWED_LICENSES = ["public-domain", "CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0"] as const;

export const LANGUAGE_PATTERN = /^[a-z]{2,3}$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CHAPTER_FILE_PATTERN = /^chapters\/\d{4}\.md$/;
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export const MAX_TITLE_LENGTH = 200;
export const MAX_SUMMARY_LENGTH = 280;
export const MAX_BOOK_JSON_BYTES = 64 * 1024;
export const MAX_CHAPTER_BYTES = 2 * 1024 * 1024;
export const MAX_BOOK_BYTES = 20 * 1024 * 1024;
