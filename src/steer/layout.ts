/**
 * Display tokens and the lines they fall on. The server scores lines and the
 * canvas draws them, so these must agree with steering/steerable/layout.py;
 * steering/tests/fixtures/layout.json is checked against both.
 */

const PIECE = /\n+|[^\S\n]*[^\s]+|[^\S\n]+(?=\n|$)/g;

/** Cut text into display tokens. Joining them gives the text back. */
export function split(text: string): string[] {
  return text.match(PIECE) ?? [];
}

/** `split` for text that arrives in pieces: the last piece is held until the next one starts. */
export class StreamSplitter {
  private buf = '';

  get empty(): boolean {
    return this.buf === '';
  }

  feed(delta: string): string[] {
    this.buf += delta;
    const pieces = split(this.buf);
    if (pieces.length <= 1) return [];
    this.buf = pieces.pop()!;
    return pieces;
  }

  flush(): string[] {
    const pieces = split(this.buf);
    this.buf = '';
    return pieces;
  }
}

const lead = (tok: string) => tok.length - tok.replace(/^[ \t]+/, '').length;

/**
 * The visual line each token is on, wrapping at `cols` characters. A newline
 * token belongs to the line it ends. A word that would cross the edge moves to
 * the next line and loses the spaces in front of it.
 */
export function wrap(tokens: readonly string[], cols: number): number[] {
  const lines: number[] = [];
  let line = 0;
  let col = 0;
  for (const tok of tokens) {
    if (tok.startsWith('\n')) {
      lines.push(line);
      line += tok.length;
      col = 0;
      continue;
    }
    let width = [...tok].length;
    if (col > 0 && col + width > cols) {
      line += 1;
      col = 0;
    }
    if (col === 0) width -= lead(tok);
    lines.push(line);
    col += width;
  }
  return lines;
}

export function lineCount(tokens: readonly string[], cols: number): number {
  if (!tokens.length) return 0;
  const lines = wrap(tokens, cols);
  const last = tokens[tokens.length - 1];
  return lines[lines.length - 1] + 1 + (last.startsWith('\n') ? last.length - 1 : 0);
}

export function paragraphs(tokens: readonly string[]): number {
  let count = 0;
  let open = false;
  for (const tok of tokens) {
    if (tok.startsWith('\n')) {
      if (tok.length > 1) open = false;
    } else if (!open) {
      open = true;
      count += 1;
    }
  }
  return count;
}
