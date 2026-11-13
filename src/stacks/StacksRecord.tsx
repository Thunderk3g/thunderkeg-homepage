'use client';

import { useEffect, useRef, useState } from 'react';
import type { Entry } from '@/content/writing';
import { KINDS, KIND_LABEL, KIND_MEANING, type CubeKind } from '@/data/record';
import { countsByKind, type Cube, type Stack } from './model';
import { useBoard } from './useBoard';

/**
 * The board, as text: every field, every subject, and each cube under it
 * with its date. One implementation, two mount points: the Stacks app on the
 * desktop and the plain /stacks page. It is also the accessible route to
 * everything the canvas draws.
 *
 * `onOpen` is how a cube opens inside the desktop (a paper in Research, a
 * post in Writing). Without it, cubes link to their public page if they have
 * one.
 */
export function StacksRecord({
  entries,
  embedded = false,
  subjectId,
  onOpen,
}: {
  entries?: Entry[];
  embedded?: boolean;
  subjectId?: string;
  onOpen?: (cube: Cube) => void;
}) {
  const { board } = useBoard(entries);
  const [kind, setKind] = useState<CubeKind | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // arriving from a stack on the board: bring that subject into view
  useEffect(() => {
    if (!subjectId) return;
    setKind(null);
    const id = requestAnimationFrame(() =>
      root.current?.querySelector(`[data-subject="${CSS.escape(subjectId)}"]`)?.scrollIntoView({ block: 'center' }),
    );
    return () => cancelAnimationFrame(id);
  }, [subjectId]);

  // on the plain page the record is set as manual sections, like every other plain page (ManPage.tsx)
  const sec = embedded ? '' : ' man-sec';
  const body = embedded ? '' : ' man-body';
  const t = board.totals;
  const first = board.years[0]?.year;
  // areas I only follow, with nothing studied yet, belong to the desktop's research tools, not the public record
  const visible = (s: Stack) =>
    kind ? s.cubes.some((c) => c.kind === kind) : embedded || s.cubes.length > 0 || !s.subject.following;

  return (
    <div className={'stk' + (embedded ? ' embedded' : '')} ref={root}>
      <div className="stk-body">
        <section className={'stk-head' + sec}>
          {!embedded && <h2>SYNOPSIS</h2>}
          <div className={'stk-head-body' + body}>
        <p className="stk-sum">
          {t.cubes} things on {t.subjects} subjects in {t.fields} fields{first ? `, from ${first} to now` : ''}. Each line
          is one thing I built, measured, studied or wrote, newest first, so every subject reads as how I came to know
          it.
        </p>

        <div className="stk-filters" role="group" aria-label="Show one kind">
          <button type="button" className={'stk-chip' + (kind === null ? ' on' : '')} aria-pressed={kind === null} onClick={() => setKind(null)}>
            everything <b>{t.cubes}</b>
          </button>
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={`stk-chip k-${k}` + (kind === k ? ' on' : '')}
              aria-pressed={kind === k}
              title={KIND_MEANING[k]}
              onClick={() => setKind(kind === k ? null : k)}
            >
              <i aria-hidden="true" />
              {KIND_LABEL[k]} <b>{t.byKind[k]}</b>
            </button>
          ))}
        </div>
          </div>
        </section>

        {board.lanes.map((lane) => {
          const stacks = lane.stacks.filter(visible);
          if (!stacks.length) return null;
          return (
            <section key={lane.field.id} className={'stk-field' + sec} aria-labelledby={'stk-f-' + lane.field.id}>
              <h2 id={'stk-f-' + lane.field.id}>{lane.field.name}</h2>
              <div className={'stk-field-body' + body}>
                <p className="stk-blurb">{lane.field.blurb}</p>
                <div className="stk-stacks">
                  {stacks.map((s) => (
                    <StackCard key={s.subject.id} stack={s} kind={kind} focus={s.subject.id === subjectId} onOpen={onOpen} />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StackCard({
  stack,
  kind,
  focus,
  onOpen,
}: {
  stack: Stack;
  kind: CubeKind | null;
  focus: boolean;
  onOpen?: (cube: Cube) => void;
}) {
  const cubes = (kind ? stack.cubes.filter((c) => c.kind === kind) : stack.cubes).slice().reverse();
  const empty = !stack.cubes.length;
  return (
    <article className={'stk-stack' + (focus ? ' focus' : '') + (empty ? ' empty' : '')} data-subject={stack.subject.id}>
      <header>
        <h3>{stack.subject.name}</h3>
        {/* the stack on its side: oldest on the left */}
        <span className="stk-mini" aria-hidden="true">
          {stack.cubes.map((c) => (
            <i key={c.id} className={'k-' + c.kind} />
          ))}
          {stack.queued.map((c) => (
            <i key={c.id} className="queued" />
          ))}
        </span>
        <span className="stk-count">
          {empty
            ? stack.subject.following
              ? 'following'
              : 'nothing yet'
            : countsByKind(stack.cubes)
                .map((k) => `${k.n} ${KIND_LABEL[k.kind]}`)
                .join(' · ')}
        </span>
      </header>
      <p className="stk-blurb">{stack.subject.blurb}</p>
      {cubes.length > 0 && (
        <ol className="stk-cubes" reversed>
          {cubes.map((c) => (
            <li key={c.id} className={'k-' + c.kind}>
              <span className="stk-when">{c.when}</span>
              <span className="stk-kind">{KIND_LABEL[c.kind]}</span>
              <span className="stk-title">
                <CubeTitle cube={c} onOpen={onOpen} />
                {c.detail && <span className="stk-detail">{c.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {empty && stack.subject.following && (
        <p className="stk-note">An area I read in and keep current on. Papers I study here land on this stack.</p>
      )}
      {stack.queued.length > 0 && (
        <p className="stk-note">
          {stack.queued.length} paper{stack.queued.length === 1 ? '' : 's'} queued in the Research inbox
          {stack.due ? `, ${stack.due} recall card${stack.due === 1 ? '' : 's'} due today` : ''}.
        </p>
      )}
    </article>
  );
}

function CubeTitle({ cube, onOpen }: { cube: Cube; onOpen?: (cube: Cube) => void }) {
  if (cube.open && onOpen) {
    return (
      <button type="button" className="stk-link" onClick={() => onOpen(cube)}>
        {cube.title}
      </button>
    );
  }
  if (cube.href) {
    const external = /^https?:/.test(cube.href);
    return (
      <a className="stk-link" href={cube.href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {cube.title}
      </a>
    );
  }
  return <>{cube.title}</>;
}
