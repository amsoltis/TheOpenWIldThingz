/**
 * A deliberately tiny inline-markdown reader.
 *
 * `primaryInstructionMarkdown` uses emphasis for the one word that matters —
 * "Take the **left** staircase" — and nothing more. Pulling in a markdown
 * renderer to support tables and images we will never send would add bundle
 * weight and an HTML-ish rendering path to a screen that must stay a single
 * legible sentence. Anything this parser does not understand is shown as
 * literal text, which is the safe failure: the traveller still reads the words.
 */

export interface MarkdownSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

export interface MarkdownBlock {
  kind: 'paragraph' | 'bullet';
  segments: MarkdownSegment[];
}

export function parseInlineMarkdown(source: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let buffer = '';
  let bold = false;
  let italic = false;

  const flush = (): void => {
    if (buffer.length === 0) return;
    const last = segments[segments.length - 1];
    if (last && last.bold === bold && last.italic === italic) {
      last.text += buffer;
    } else {
      segments.push({ text: buffer, bold, italic });
    }
    buffer = '';
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === undefined) break;

    if (char === '\\' && i + 1 < source.length) {
      buffer += source[i + 1] ?? '';
      i += 1;
      continue;
    }

    const pair = source.slice(i, i + 2);
    if (pair === '**' || pair === '__') {
      flush();
      bold = !bold;
      i += 1;
      continue;
    }
    if (char === '*' || char === '_') {
      flush();
      italic = !italic;
      continue;
    }
    buffer += char;
  }

  flush();
  return segments;
}

const BULLET_PREFIX = /^\s*(?:[-*+]|\d+\.)\s+/;

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const isBullet = BULLET_PREFIX.test(line);
    const body = isBullet ? line.replace(BULLET_PREFIX, '') : line;
    blocks.push({ kind: isBullet ? 'bullet' : 'paragraph', segments: parseInlineMarkdown(body) });
  }
  return blocks;
}

/** Emphasis-stripped text, for accessibility labels read aloud by a screen reader. */
export function markdownToPlainText(source: string): string {
  return parseMarkdownBlocks(source)
    .map((block) => block.segments.map((segment) => segment.text).join(''))
    .join(' ');
}
