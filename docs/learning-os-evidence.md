# Learning OS: why the daily loop is built the way it is

The Learning OS used to be a careful description of what I know. It did not
tell me what to do at 7:30 on a Tuesday, and it took my own word for most of
what it recorded. The **Today** tab changes that. This note is the evidence
behind each decision, and an honest account of how well each source was
checked.

**How this was researched.** A literature pass in November 2026. Two sources
were read directly (the Anthropic skill-formation study and the FSRS algorithm
notes). Everything else is taken from abstracts and summaries returned by
search, so figures marked *secondary* were not read in the original paper.
The scheduling constants and the prediction rules are design judgments, not
findings; they are marked as such.

## What the evidence says, and what was built from it

| # | Finding | Strength | What it became |
|---|---------|----------|----------------|
| 1 | Retrieving from memory beats restudying, most of all after a delay. About 61% against 40% recall at one week (Roediger & Karpicke 2006, *secondary*); rated "high utility" (Dunlosky et al. 2013). | Strong | The unit of work is an unaided check, not reading. Today lists checks first. |
| 2 | Learning with an AI assistant costs skill unless it is used for understanding. Randomised study, n = 52: 50% on a later quiz with AI against 67% without (d = 0.74). Delegating and AI-led debugging scored under 40%; conceptual questions scored 65% or more (Shen & Tamkin 2026, read directly). Practice scores up 48%, later unaided exam down 17% (Bastani et al. 2025, PNAS). | Strong, recent, small samples | "AI off" steps; the coach is locked during them and open for the reading step; a pass with AI is logged as practice and changes no claim. The coach is told never to write the solution to a check. |
| 3 | Spacing practice out beats massing it; too short a gap costs more than too long (Cepeda et al. 2008, n > 1,350). | Strong | Each check comes back on a widening interval kept per skill. |
| 4 | How fluent something feels is a poor guide to whether it was learned. Over 80% of people judged massed practice at least as good as spaced; 15% actually did better with it (Kornell & Bjork 2008). Developers forecast a 24% speed-up from AI and were 19% slower (METR 2025). | Strong | A prediction is required before every attempt and compared with the outcome. |
| 5 | Retrieve to criterion, then again in later sessions ("successive relearning"): about a letter grade on course exams (Rawson, Dunlosky & Sciartelli 2013, *secondary*). | Moderate | A failed check returns in two days. A skill moves up a state only after unaided passes on three separate days. |
| 6 | Interleaving related topics beats blocking them: g ≈ 0.42 (Brunmair & Richter 2019). | Moderate | Neighbouring checks in the day's queue come from different domains. |
| 7 | Explaining it to yourself helps: 64 studies, small to moderate effect (Bisra et al. 2018; pooled figure *unverified*). | Moderate | Every session ends with an explanation written from memory. |
| 8 | Attempting before studying beats extra study time, even when the attempt fails (Richland, Kornell & Kao 2009). | Moderate | For skills rated unknown or aware, the session opens with an attempt before any reading. |
| 9 | Detailed guidance helps novices and gets in the way of the experienced ("expertise reversal", Kalyuga 2007, *secondary*). Hours of practice explain under 1% of performance differences in professions (Macnamara et al. 2014). | Moderate | The session changes shape with the skill's state: attempt-first when new, problem-first once applied. Hours are not tracked. |
| 10 | Stating when and where you will act raises follow-through: d = 0.65 across 94 tests (Gollwitzer & Sheeran 2006); a 2024 re-analysis puts it at 0.15 to 0.35 (*secondary*). | Moderate, shrinking | One if-then sentence, and days practised against days planned per week. |

## The schedule

Flashcard schedulers assume a review costs seconds. A check here costs 10 to
30 minutes, so the intervals start longer and a lapse is handled differently.
The rule is in the SM-2 family (intervals grow by an ease factor) and its
constants are **my design judgments**, anchored to SM-2 (ease 2.5, floor 1.3)
and to FSRS's default first stability of about 3.7 days.

| What happened | Next check | Ease |
|---------------|-----------|------|
| First pass | 3 days | starts at 2.3 |
| First pass, hard | 1 day | starts at 2.3 |
| Pass | previous × ease | +0.05, at most 2.8 |
| Hard pass | previous × 1.3 | −0.15 |
| Fail | 2 days; once the retry passes, a quarter of the interval before the lapse (at least 2 days) | −0.2, floor 1.3 |

Other rules: the interval is capped at 180 days; intervals of 10 days or more
move by up to 10% so reviews do not pile onto one day; at most three checks a
day, with the rest held over rather than hidden.

Two rules use the prediction, and are heuristics: a pass that was predicted at
50% or less counts as a hard pass; a fail that was predicted at 90% is flagged
as familiarity mistaken for ability, and the interval does not grow again
until two clean passes.

The code is `src/learning/schedule.ts`; its tests are
`scripts/learning-schedule.test.mts`.

## Calibration without false precision

There will never be much data: a few checks a week. So the display is built
for small counts.

- Predictions fall into three groups (50% or less, about 70%, 90%), shown as
  raw counts: "said 90%: passed 6 of 9".
- Beside each count is a 90% Wilson interval for the true pass rate, which
  behaves sensibly for small n (Brown, Cai & DasGupta 2001).
- Under 10 predictions there is no verdict at all. From 10, the mean
  prediction minus the pass rate is reported as over- or under-confidence.
- From 20, a Brier score is shown next to 0.25, which is what always saying
  50% would score.
- No smooth curve is ever drawn.

## What was left out on purpose

- **Streaks, badges, points.** Badges and leaderboards lowered motivation and
  exam scores over a 16-week course (Hanus & Fox 2015, abstract only). For
  streaks I found evidence of engagement and nothing on learning, so the claim
  that streaks harm learning is *unverified*; they are left out because they
  reward showing up, not passing.
- **Hours logged, highlight counts, re-reading.** Re-reading and highlighting
  are rated low utility (Dunlosky et al. 2013), and time on task is not skill.
- **Same-session success as proof.** Performance during a session is an
  unreliable index of learning (Soderstrom & Bjork 2015). That is why a state
  moves only after passes on separate days.

## Sources

- Bastani et al. 2025, *PNAS*: https://ideas.repec.org/a/nas/journl/v122y2025pe2422633122.html
- Brown, Cai & DasGupta 2001: https://projecteuclid.org/euclid.ss/1009213286
- Brunmair & Richter 2019: https://pubmed.ncbi.nlm.nih.gov/31556629/
- Cepeda et al. 2008: https://pubmed.ncbi.nlm.nih.gov/19076480/
- Dunlosky et al. 2013 (summary): https://www.psychologicalscience.org/?p=82014
- FSRS algorithm notes: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
- Gollwitzer & Sheeran 2006: https://www.socmot.uni-konstanz.de/publications/implementation-intentions-and-goal-achievement-meta-analysis-effects-and-processes
- Kornell & Bjork 2008: https://pubmed.ncbi.nlm.nih.gov/18578849/
- Macnamara et al. 2014 (summary): https://www.psychologicalscience.org/news/releases/becoming-an-expert-takes-more-than-practice.html
- METR 2025: https://arxiv.org/pdf/2507.09089
- Richland, Kornell & Kao 2009: https://pubmed.ncbi.nlm.nih.gov/19751074/
- Roediger & Karpicke 2006: https://psychology.ecu.edu/wp-content/pv-uploads/sites/216/2019/03/Roediger-Karpicke-2006.pdf
- Shen & Tamkin 2026, Anthropic: https://www.anthropic.com/research/AI-assistance-coding-skills
- Soderstrom & Bjork 2015: https://pubmed.ncbi.nlm.nih.gov/25910388/
- Successive relearning (summary of Rawson et al. 2013): https://www.retrievalpractice.org/archive/2018/successive-relearning
