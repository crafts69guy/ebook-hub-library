import { IMAGE_FILE_PATTERN } from "./rules.ts";

const FENCE = /^\s*(```|~~~)/;
const HTML = /<!--|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/;
const INLINE_IMAGE = /!\[[^\]]*\]\(([^)]*)\)/g;
const ANY_IMAGE = /!\[[^\]]*\](?:\(|\[)/;
const UNSAFE_LINK = /\]\(\s*(?:javascript|data|vbscript|file):/i;

export interface MarkdownReport {
  problems: string[];
  /** Book-relative paths of the images this chapter references, in the order they appear. */
  images: string[];
}

/**
 * Content rules for chapter Markdown. The extension also sanitizes on import; rejecting
 * problems here keeps the published text identical to what readers see.
 *
 * Images must name a file bundled in the same book, spelled exactly as in `book.json`
 * (`images/0001.png`). Remote images are refused because nothing outside the repository is
 * covered by the index digests, and fetching one while reading would tell its host who is
 * reading what. See ADR-0005.
 */
export function inspectMarkdown(markdown: string): MarkdownReport {
  const problems: string[] = [];
  const images: string[] = [];
  let fence: string | null = null;

  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const marker = FENCE.exec(line)?.[1];
    if (marker !== undefined) {
      if (fence === null) {
        fence = marker;
      } else if (marker === fence) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      continue;
    }

    const at = `line ${index + 1}`;
    if (HTML.test(line)) {
      problems.push(`${at}: raw HTML is not allowed`);
    }
    if (UNSAFE_LINK.test(line)) {
      problems.push(`${at}: links must not use javascript:, data:, vbscript:, or file: URLs`);
    }

    for (const [, target] of line.matchAll(INLINE_IMAGE)) {
      if (IMAGE_FILE_PATTERN.test(target)) {
        images.push(target);
      } else {
        problems.push(`${at}: image "${target}" must be a bundled file such as images/0001.png`);
      }
    }
    // Whatever still looks like an image after the inline ones are removed is reference-style
    // or malformed, and neither names a file that can be verified.
    if (ANY_IMAGE.test(line.replace(INLINE_IMAGE, ""))) {
      problems.push(`${at}: images must be written as ![alt](images/0001.png)`);
    }
  }

  if (fence !== null) {
    problems.push("a code fence is never closed");
  }
  return { problems, images };
}
