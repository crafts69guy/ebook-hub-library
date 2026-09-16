/**
 * Library rules shared by validation and index generation. They mirror what the Ebook Hub
 * extension accepts (see the extension's ADR-0005 and `src/domain/community.ts`); change both
 * sides together.
 */
export const INDEX_SCHEMA_VERSION = 1;
export const REPOSITORY = "https://github.com/crafts69guy/ebook-hub-library";
export const REF = "main";

export const BOOK_FILE = "book.json";
export const ALLOWED_LICENSES = [
  "public-domain",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC-BY-3.0",
  "CC-BY-SA-3.0",
] as const;

export const LANGUAGE_PATTERN = /^[a-z]{2,3}$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CHAPTER_FILE_PATTERN = /^chapters\/\d{4}\.md$/;
export const IMAGE_FILE_PATTERN = /^images\/\d{4}\.(?:png|jpg|jpeg|webp)$/;
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Leading bytes every accepted image format must start with, so a renamed file cannot ship as
 * an image. WebP also has to carry "WEBP" at offset 8, which `isKnownImage` checks separately.
 */
export const IMAGE_SIGNATURES: Readonly<Record<string, readonly number[]>> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  webp: [0x52, 0x49, 0x46, 0x46],
};

export const MAX_TITLE_LENGTH = 200;
export const MAX_SUMMARY_LENGTH = 280;
export const MAX_BOOK_JSON_BYTES = 64 * 1024;
export const MAX_CHAPTER_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_BOOK_BYTES = 20 * 1024 * 1024;
