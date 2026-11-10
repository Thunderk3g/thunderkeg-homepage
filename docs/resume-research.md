# Résumé: what the evidence says, and what was done about it

Research behind the résumé rewrite of 2026-11-10 (`src/data/resume.ts`,
`src/content/resumePdf.ts`, `/resume`, `/resume.pdf`, `/cv.pdf`).

## How far to trust this

**No source below was opened and read.** The research sandbox refused every
direct fetch (hrdive.com, ere.net, thetechresume.com, huyenchip.com,
staffeng.com, eugeneyan.com and others), so everything attributed to a source
is taken from search-result summaries of it. Quotes and figures should be
checked against the originals before they are repeated anywhere public. Where
a point is my own judgement with no source behind it, it is marked *mine*.

## 1. How résumés are read

- The first screen is short. Ladders' 2018 eye-tracking update put it at 7.4
  seconds. Ladders is a job board, the 2018 report gave no sample size and
  the 2012 one had about 30 recruiters, so treat it as a direction, not a
  measurement.
- What held attention in that study: simple layouts, clear section and
  job-title headers, bold titles over bulleted accomplishments. What did
  worst: clutter, multiple columns, long sentences.
- An engaged reader spent as long on page two as on page one.
- The "75% of résumés are auto-rejected by an ATS" figure traces to a 2012
  sales pitch by a résumé-optimisation vendor, with no method. Gergely Orosz's
  account of tech hiring is that applicant-tracking systems parse and search;
  the real automatic rejections come from knockout questions such as work
  authorisation. A Harvard Business School and Accenture study (2021) does
  report large employers configuring filters, so "ATS never filters" is too
  strong.
- Length: Orosz says two pages or fewer; Laszlo Bock says about a page per
  decade; Google's careers page says think twice before a second page.

**Done:** one column, real text, bold role titles with the dates on the
right, short bullets. Two pages, with page one able to stand alone (summary,
skills, and the two largest streams of the current role). A stream is never
allowed to start at the foot of a page.

## 2. How a bullet is built

- Bock's formula, repeated on Google's careers page: accomplished X, as
  measured by Y, by doing Z. Leaders should state team size and scope.
- Orosz: active verbs, and numbers, which most résumés lack. The kinds he
  lists: team size, teams adopting, SLA change, coverage before and after,
  revenue, users.
- Will Larson's promotion-packet questions make a template: what the project
  was, what you did, impact against a stated goal, what made it hard, whom you
  grew, what glue work you did.

**Done:** every bullet leads with the outcome or the decision, then the
measure, then the method. The old bullets led with the method.

## 3. Numbers, when the real ones are confidential

- Bock rejected a résumé that only disguised a client's name, and estimates
  5 to 10 percent of résumés leak confidential information. Clever wording is
  not clearance.
- Chip Huyen: "Metrics, without context, are meaningless." A bare percentage
  invites doubt.
- *Mine:* a number earns its place only with its baseline, what it was
  measured on, its scope, and my part in it. Otherwise leave it out.

**Done:** the résumé now uses three kinds of figure and says so on the page:

| Kind | Examples now on the résumé |
| --- | --- |
| Public | 962 rules, mean constraint density 0.462, 43 rules (4.5%); 10 decision records, 219 tests |
| Structural | three production systems; a ten-person team; four kinds of evidence; four decision states; two leakage barriers; two regulators |
| Already published by me | auto-accept 8.82% to 49.30% on a pilot slice (5.6×), 2.74% on the full corpus |

Nothing internal was estimated or invented. Each stream has an empty
`result` slot in `src/data/resume.ts` for one cleared outcome; when filled it
prints first, in bold, on every surface.

## 4. What AI hiring managers look for

- Huyen: "We're not looking for keywords. We look for demonstrated
  expertise." State the problem, then the technology. Show decisions and
  their consequences, "both positive and negative". Expect to be probed on
  every choice in one project.
- Eugene Yan and Jason Liu: understanding evaluation is essential, and data
  literacy (noticing when something looks off) is "crucial yet overlooked".
- Orosz on skills: near the top of page one, no self-ratings, nothing stale.

**Done:** the speaker-leakage finding and the retracted headline result are
stated as claim, test, what changed and what followed, with the published
figures. Skills are on page one and limited to what a bullet evidences.

## 5. Lead, as against senior

- Larson: staff level is role, behaviours, impact and recognition, not the
  title.
- The signals: scope beyond your own code, direction and standards set,
  decisions and trade-offs, adoption by others, people grown.

**Done in part.** Scope and decisions are now explicit. Adoption and people
grown are not on the résumé because I do not have the facts for them. See the
list below.

## 6. India, and remote roles elsewhere

- India (career blogs only, weak sources): leave out a photo, date of birth,
  marital status and any declaration; two pages is normal for senior roles.
- Elsewhere: no photo for the US and UK; Germany customarily expects one.
- *Mine:* compensation does not belong on it.

## 7. The academic reader

- A research master's programme expects a CV with education and research
  ahead of employment. Keeping two arrangements is normal.
- Publication status must be exact: published, accepted, under review. "In
  preparation" is discounted, so it should be clearly labelled and sparing.
- Europass only where a programme names it. Some Erasmus Mundus consortia do.
- ETH Zurich asks for a gap-free chronological CV from school onward.

**Done:** `/cv.pdf` is the same content arranged for this reader: education,
research interests, peer-reviewed work, manuscripts each with its exact
status, then experience. The industry résumé leaves the in-preparation
manuscript out.

## 8. A résumé on a personal site

- Orosz: recruiters prefer PDF; a few short, clickable links.
- schema.org has no résumé type; Person structured data is the right one, and
  the page already has it.
- *Mine:* real text, one column, a file named for the person, and the page
  and the PDF built from one source so they cannot disagree.

**Done:** `/resume.pdf` and `/cv.pdf` are real files built at build time
from `src/data/resume.ts`, named `Diwakar-Adhikari-Resume.pdf` and
`Diwakar-Adhikari-CV.pdf`, linked from the résumé page, the welcome card, the
Hire app and the terminal (`resume`, `cv`). `scripts/resume-pdf.test.mts`
fails the build check if the résumé is not exactly two pages.

## Numbers still needed

These would move the résumé more than any rewording. None of them can come
from me. "Relative" means a ratio or a percentage change with its baseline,
which is usually publishable but should be checked against the employment
terms; "clearance" means it needs sign-off even in relative form.

**Compliance review**

| Number | Status |
| --- | --- |
| Agreement with human reviewers on a held-out set (precision and recall on violations, or kappa), with the set size | relative |
| Missed-violation rate before and after the evidence check | relative |
| Retrieval recall at k, dense only against hybrid | relative |
| Share of items sent to a human by the fail-closed rule, and how often that was right | relative |
| Review turnaround before and after, as "x times faster" | relative |
| Reviewer hours saved, share auto-cleared, volumes, violations caught, cost per review | clearance |

**Speech**

| Number | Status |
| --- | --- |
| WER or CER change on the speaker-disjoint test set, with the normalisation used | relative |
| The gap between the leaky split and the clean one | relative |
| Diarization error across the systems compared, and how many systems | relative |
| Hours of audio, calls, agents, any business outcome | clearance |

**Document AI**

| Number | Status |
| --- | --- |
| Field-level accuracy, one engine against two | relative |
| Document types and fields handled | relative |
| Change in the manual-review rate | relative |
| Straight-through rate, volumes, turnaround, false accepts | clearance |

**Leading** (mostly safe to state)

| Number | Status |
| --- | --- |
| Current team size and how many you mentor | safe |
| Journeys, APIs and integrations shipped as Dev Lead; release frequency | safe |
| People promoted or grown, and into what | safe |
| Teams or functions using your systems | safe |
| Time from prototype to production for each stream | safe |
| How many VAPT findings were closed, and how fast | relative |
| Revenue, conversion, premium, named partners | clearance |

## Sources (search summaries only)

How résumés are read:

- HR Dive on the Ladders study: https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/
- ERE, "Is the 6-Second Resume Scan a Myth?": https://www.ere.net/articles/is-the-6-second-resume-scan-a-myth
- Orosz, "ATS Myths Busted": https://thetechresume.com/samples/ats-myths-busted
- HBS Working Knowledge on "Hidden Workers": https://hbswk.hbs.edu/item/how-to-tap-the-talent-automated-hr-platforms-miss
- On the 75% myth: https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth

Bullets and structure:

- Orosz, "A Good Tech Resume": https://thetechresume.com/A_Good_Tech_Resume.pdf
- Orosz, "Common Mistakes": https://thetechresume.com/samples/common-mistakes
- Bock, "The Biggest Mistakes I See on Resumes": https://www.linkedin.com/pulse/20140917045901-24454816-the-5-biggest-mistakes-i-see-on-resumes-and-how-to-correct-them
- Quartz on Bock's formula: https://qz.com/201088/google-just-revealed-the-incredibly-simple-formula-for-killer-resumes

Lead and staff signals:

- Larson, "Staff promotion packets": https://lethain.com/promo-packets/
- StaffEng, "Staff archetypes": https://staffeng.com/guides/staff-archetypes/

AI hiring:

- Huyen, ML Interviews Book, "Background and resume": https://huyenchip.com/ml-interviews-book/contents/2.3.1.1-background-and-resume.html
- Yan and Liu, "How to Interview and Hire ML/AI Engineers": https://eugeneyan.com/writing/how-to-interview/
- Husain and Shankar, evals FAQ: https://hamel.dev/blog/posts/evals-faq/evals-faq.pdf

Academic CVs:

- ETH Zurich, application documents: https://ethz.ch/en/studies/master/application/international-bachelor/application-documents/general-documents.html
- KU Leuven, requested documents: https://www.kuleuven.be/english/apply/requested-documents
- KIT, CV guidance: https://irm.kit.edu/english/CurriculumVitae.php
- Newcastle University, Academic CV workbook: https://www.ncl.ac.uk/mediav8/careers/documents/Academic%20CV%20workbook.pdf

Gaps: nothing reliable was found on compensation disclosure in India, on PDF
fonts and file naming, or on CV rules for a specific AI & Law programme.
