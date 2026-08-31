import type { ReactNode } from 'react';

/**
 * Small markdown renderer producing React elements (never raw HTML).
 *
 * Covers what the /content posts actually use: ATX headings, paragraphs,
 * unordered/ordered lists, fenced code, blockquotes, horizontal rules, tables,
 * and inline code / bold / italic / links.
 *
 * ponytail: hand-rolled instead of pulling in a markdown library — the corpus
 * is first-party prose and this is the whole feature surface. If a post ever
 * needs footnotes, nested lists or embedded HTML, swap in `marked` + a
 * sanitizer rather than growing this.
 */

/* ───────────────────────── inline ───────────────────────── */

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  for (const part of text.split(INLINE)) {
    if (!part) continue;
    const key = `${keyPrefix}-${i++}`;
    if (part.startsWith('`') && part.endsWith('`')) {
      out.push(<code key={key}>{part.slice(1, -1)}</code>);
    } else if (part.startsWith('**') && part.endsWith('**')) {
      out.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      out.push(<em key={key}>{part.slice(1, -1)}</em>);
    } else if (part.startsWith('[')) {
      const split = part.indexOf('](');
      const href = part.slice(split + 2, -1);
      const external = /^https?:/.test(href);
      out.push(
        <a key={key} href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
          {part.slice(1, split)}
        </a>,
      );
    } else {
      out.push(part);
    }
  }
  return out;
}

/* ───────────────────────── blocks ───────────────────────── */

const HEADINGS: Record<number, 'h2' | 'h3' | 'h4' | 'h5'> = { 1: 'h2', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5' };

function tableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

const isTableDivider = (line: string) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (!para.length) return;
    blocks.push(<p key={`p${k++}`}>{inline(para.join(' '), `p${k}`)}</p>);
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      flushPara();
      continue;
    }

    // fenced code
    if (line.startsWith('```')) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      blocks.push(
        <pre key={`c${k++}`}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // heading
    const h = /^(#{1,5})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      const Tag = HEADINGS[h[1].length];
      blocks.push(<Tag key={`h${k++}`}>{inline(h[2], `h${k}`)}</Tag>);
      continue;
    }

    // horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      flushPara();
      blocks.push(<hr key={`r${k++}`} />);
      continue;
    }

    // table — header row followed by a divider row
    if (line.startsWith('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      flushPara();
      const head = tableRow(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) body.push(tableRow(lines[i++]));
      i--;
      blocks.push(
        <div className="md-table-wrap" key={`t${k++}`}>
          <table>
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci}>{inline(c, `th${k}${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci}>{inline(c, `td${k}${ri}${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // blockquote
    if (line.startsWith('> ')) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) quote.push(lines[i++].slice(2));
      i--;
      blocks.push(<blockquote key={`q${k++}`}>{inline(quote.join(' '), `q${k}`)}</blockquote>);
      continue;
    }

    // lists
    const ordered = /^\d+\.\s+/.test(line);
    if (ordered || /^[-*]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      const match = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (i < lines.length && match.test(lines[i])) items.push(lines[i++].replace(match, ''));
      i--;
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={`l${k++}`}>
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `li${k}${ii}`)}</li>
          ))}
        </List>,
      );
      continue;
    }

    para.push(line);
  }
  flushPara();

  return <div className="md">{blocks}</div>;
}
