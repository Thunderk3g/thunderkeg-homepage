import { bottleneck, evidenceFor, impliedState, lanes, overclaimed, rank, weekPlan } from './priority';
import type { LearningState } from './types';

/**
 * Coach context + a deterministic fallback coach.
 *
 * Only a *summary* of local state is ever sent anywhere, and only when the
 * button is pressed. With no LLM key configured the offline coach still answers
 * — it is computing over the same priority model the dashboard renders, so its
 * advice is consistent with the UI rather than a degraded imitation of it.
 */

export const COACH_PROMPTS = [
  'What should I learn next, and why that instead of the alternatives?',
  'Am I ready to move from PyTorch to transformer training?',
  'Give me an AI-free test for my current skill.',
  'What is my biggest current technical weakness?',
  'What project milestone would prove this skill?',
  'Am I spreading myself too thin?',
  'Where is AI dependence masking a skill gap?',
  'Give me a 60-minute learning session.',
  'Interview me on transformer inference.',
  'Challenge my architecture for the ASR lab.',
];

/** Compact, model-readable snapshot. Kept short — this is prompt budget. */
export function coachContext(state: LearningState): string {
  const ranked = rank(state);
  const q = lanes(state);
  const current = state.skills.find((s) => s.id === state.currentSkillId);
  const project = state.projects.find((p) => p.primary) ?? state.projects[0];
  const nextMilestone = project?.milestones.find((m) => !m.done);
  const week = weekPlan(state);

  const failedChecks = state.skills.filter((s) => s.independent === false);
  const untested = state.skills.filter(
    (s) => s.independent === null && ['APPLIED', 'INTERNALIZED', 'STRONG'].includes(s.state),
  );
  const overclaims = state.skills.filter((s) => overclaimed(s, evidenceFor(state, s.id)));

  const line = (s: { name: string; state: string; confidence: number; independent: boolean | null }) =>
    `${s.name} [${s.state}, conf ${s.confidence.toFixed(2)}, independent=${s.independent === null ? 'untested' : s.independent}]`;

  return [
    `TARGET: ${state.target.northStar} — spike: ${state.target.spike}. Companies: ${state.target.companies.join(', ')}.`,
    '',
    `CURRENT DEEP SKILL: ${current ? line(current) : 'none set'}`,
    `  objective: ${current?.objective ?? '—'}`,
    `  AI-free check: ${current?.aiFreeCheck ?? '—'}`,
    '',
    `COMPUTED BOTTLENECK: ${bottleneck(state)?.skill.name ?? '—'}`,
    '',
    'TOP RANKED GAPS (priority = importance × gap × uncertainty × dependency value):',
    ...ranked.slice(0, 8).map(
      (r) =>
        `  ${r.priority.toFixed(2)}  ${line(r.skill)} unlocks ${r.unlocks}${r.blockedBy.length ? `, blocked by ${r.blockedBy.map((b) => b.name).join(', ')}` : ''}`,
    ),
    '',
    `QUEUE: NOW=${q.NOW.map((r) => r.skill.name).join(', ') || '—'} | NEXT=${q.NEXT.map((r) => r.skill.name).join(', ') || '—'} | MAINTAIN=${q.MAINTAIN.length} skills | LATER=${q.LATER.length} | IGNORE=${q.IGNORE.length}`,
    '',
    `FAILED AI-FREE CHECKS: ${failedChecks.map((s) => s.name).join(', ') || 'none recorded'}`,
    `CLAIMED BUT NEVER TESTED UNAIDED: ${untested.map((s) => s.name).join(', ') || 'none'}`,
    `STATE OUTRUNS EVIDENCE: ${overclaims.map((s) => `${s.name} (claimed ${s.state}, evidence supports ${impliedState(evidenceFor(state, s.id))})`).join('; ') || 'none'}`,
    '',
    `PRIMARY PROJECT: ${project?.name} [${project?.stage}] — ${project?.milestones.filter((m) => m.done).length}/${project?.milestones.length} milestones.`,
    `  next milestone: ${nextMilestone ? `${nextMilestone.title} (I must implement: ${nextMilestone.mine})` : 'all done'}`,
    '',
    `RECENT EVIDENCE (${state.evidence.length} total):`,
    ...(state.evidence.length
      ? state.evidence
          .slice(0, 6)
          .map((e) => `  ${e.date} ${e.kind} "${e.artifact}" assistance=${e.assistance}${e.negative ? ' [negative result]' : ''} → ${e.whatLearned.slice(0, 90)}`)
      : ['  none yet — every skill estimate is currently an unverified self-assessment.']),
    '',
    `THIS WEEK: understand="${week.understand}" implement="${week.implement}" apply="${week.apply}"`,
  ].join('\n');
}

/* ───────────────────────── offline coach ───────────────────────── */

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

/** Deterministic advice computed from the same model the dashboard shows. */
export function offlineCoach(question: string, state: LearningState): string {
  const q = question.toLowerCase();
  const ranked = rank(state);
  const queue = lanes(state);
  const current = state.skills.find((s) => s.id === state.currentSkillId);
  const top = ranked.filter((r) => r.blockedBy.length === 0).slice(0, 3);
  const out: string[] = [];

  const footer = '\n— computed locally from your skill graph. Set LLM_API_KEY for a conversational coach.';

  if (/thin|too many|fragment|breadth/.test(q)) {
    const active = queue.NOW.length + queue.NEXT.length;
    out.push(
      `You have ${queue.NOW.length} skill in NOW and ${queue.NEXT.length} in NEXT (${active} active).`,
      queue.NEXT.length > 4
        ? 'That is too wide. NEXT should hold what the current skill directly unlocks — move the rest to LATER.'
        : 'That is within range. The risk is adding, not the current width.',
      '',
      `LATER holds ${queue.LATER.length} skills and IGNORE holds ${queue.IGNORE.length}. Leave them there.`,
    );
    return out.join('\n') + footer;
  }

  if (/ai-free|test|check|prove/.test(q) && current) {
    out.push(
      `AI-free check for ${current.name}:`,
      '',
      `  ${current.aiFreeCheck}`,
      '',
      'Rules: empty file, no assistant, no autocomplete, no copy-paste from a reference.',
      'You may read the reference *after* your version runs — and the diff is the evidence.',
      current.independent === false
        ? '\nYou have failed this check before. That is why it is still NOW.'
        : current.independent === null
          ? '\nNever attempted unaided. Until you do, the state estimate is a guess.'
          : '\nPassed before — this is a retrieval check, not a first attempt.',
    );
    return out.join('\n') + footer;
  }

  if (/weakness|bottleneck|weakest/.test(q)) {
    const b = top[0];
    if (!b) return 'No unblocked skills ranked — check your dependency graph.' + footer;
    out.push(
      `Biggest weakness: ${b.skill.name}.`,
      '',
      `  state ${b.skill.state}, confidence ${pct(b.skill.confidence)}, independence ${b.skill.independent === null ? 'never tested' : b.skill.independent}`,
      `  gap ${pct(b.gap)} · uncertainty ${pct(b.uncertainty)} · unlocks ${b.unlocks} downstream skills`,
      '',
      `It ranks first not because it is your lowest score, but because it is unblocked and ${b.unlocks} skills sit behind it.`,
      `Next: ${b.skill.objective}`,
    );
    return out.join('\n') + footer;
  }

  if (/masking|dependence|depend|honest/.test(q)) {
    const untested = state.skills.filter(
      (s) => s.independent === null && ['APPLIED', 'INTERNALIZED', 'STRONG'].includes(s.state),
    );
    const overclaims = state.skills.filter((s) => overclaimed(s, evidenceFor(state, s.id)));
    out.push('Where AI dependence may be masking a gap:', '');
    if (untested.length) {
      out.push(
        `${untested.length} skills are claimed at APPLIED or above but have never been tested unaided:`,
        ...untested.slice(0, 8).map((s) => `  • ${s.name} — ${s.aiFreeCheck}`),
      );
    } else {
      out.push('  Every APPLIED-or-above skill has an independence result recorded. Good.');
    }
    if (overclaims.length) {
      out.push('', 'State outruns attached evidence for:', ...overclaims.map((s) => `  • ${s.name} (claimed ${s.state}, evidence supports ${impliedState(evidenceFor(state, s.id))})`));
    }
    return out.join('\n') + footer;
  }

  if (/ready|move on|graduate/.test(q) && current) {
    const blockers = ranked.find((r) => r.skill.id === current.id)?.blockedBy ?? [];
    const ev = evidenceFor(state, current.id);
    const unaided = ev.filter((e) => e.assistance === 'none').length;
    out.push(
      `${current.name}: ${unaided} unaided artifact${unaided === 1 ? '' : 's'}, independence ${current.independent === null ? 'untested' : current.independent}.`,
      '',
      current.independent === true && unaided >= 1
        ? 'Yes — move on. Set the next NOW skill from the NEXT lane.'
        : 'No. You have not produced an unaided artifact for it yet. Passing the AI-free check is the gate, not feeling ready.',
      blockers.length ? `\nStill blocked by: ${blockers.map((b) => b.name).join(', ')}.` : '',
    );
    return out.join('\n') + footer;
  }

  if (/milestone|project|build/.test(q)) {
    const project = state.projects.find((p) => p.primary) ?? state.projects[0];
    const next = project?.milestones.find((m) => !m.done);
    out.push(
      `${project?.name} — ${project?.stage}, ${project?.milestones.filter((m) => m.done).length}/${project?.milestones.length} milestones.`,
      '',
      next
        ? [
            `Next milestone: ${next.title}`,
            `  you must implement: ${next.mine}`,
            `  agents may do: ${next.agentOk}`,
            '',
            `Proves: ${project?.proves.join(', ')}`,
          ].join('\n')
        : 'All milestones done — move the project stage forward and write it up.',
    );
    return out.join('\n') + footer;
  }

  if (/session|60|hour|today/.test(q) && current) {
    out.push(
      `60-minute session — ${current.name}`,
      '',
      `Goal: ${current.objective}`,
      '  15 min  Understand — what problem does it solve, what breaks without it?',
      `  25 min  Implement, no AI — ${current.aiFreeCheck}`,
      '  10 min  Verify — diff against a reference; find out why it differs',
      '  10 min  Explain — mechanism, complexity, the trade-off you would be asked about',
      '',
      'Evidence: the code plus a notes file recording what failed.',
    );
    return out.join('\n') + footer;
  }

  // default: what should I learn next
  out.push('Next, in order:', '');
  top.forEach((r, i) => {
    out.push(
      `${i + 1}. ${r.skill.name}  (priority ${r.priority.toFixed(2)})`,
      `   ${r.skill.objective}`,
      `   unlocks ${r.unlocks} downstream skills · confidence ${pct(r.skill.confidence)} · ${r.skill.independent === null ? 'independence untested' : r.skill.independent ? 'independent' : 'failed unaided'}`,
      '',
    );
  });
  const blocked = ranked.filter((r) => r.blockedBy.length > 0).slice(0, 3);
  if (blocked.length) {
    out.push('Not yet — these sit behind prerequisites:');
    blocked.forEach((r) => out.push(`   ${r.skill.name} ← needs ${r.blockedBy.map((b) => b.name).join(', ')}`));
  }
  return out.join('\n') + footer;
}
