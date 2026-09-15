const FENCE = /^\s*(```|~~~)/;
const HTML = /<!--|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/;
const IMAGE = /!\[[^\]]*\](?:\(|\[)/;
const UNSAFE_LINK = /\]\(\s*(?:javascript|data|vbscript|file):/i;

/**
 * Content rules for chapter Markdown. The extension also sanitizes on import; rejecting
 * problems here keeps the published text identical to what readers see.
 */
export function findMarkdownProblems(markdown: string): string[] {
  const problems: string[] = [];
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
    if (IMAGE.test(line)) {
      problems.push(`${at}: images are not allowed`);
    }
    if (UNSAFE_LINK.test(line)) {
      problems.push(`${at}: links must not use javascript:, data:, vbscript:, or file: URLs`);
    }
  }

  if (fence !== null) {
    problems.push("a code fence is never closed");
  }
  return problems;
}
