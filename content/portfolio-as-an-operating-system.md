---
kind: post
title: Building a portfolio that boots
date: 2026-08-30
summary: This site is a Kali Linux desktop in a browser tab — window manager, shell, filesystem, arcade. Notes on what that costs and why the shell was the part worth building.
tags: frontend, engineering, this-site
---

The site you are reading this on boots. There is a BIOS-ish log, a login screen, a
window manager with focus and z-order, a filesystem, a shell with about ninety commands,
and a games arcade whose multiplayer runs over Supabase Realtime. The résumé is one file
that every surface renders from.

It is a silly amount of engineering for a portfolio, and I want to be honest about which
parts earned their keep.

## What the structure buys

**One typed résumé source.** `src/data/resume.ts` exports a structured model. The `/resume`
page, the PDF export, the in-OS Firefox app, the fake `~/Documents` tree and the AI
assistant's grounding context all derive from it. Before this rewrite they had drifted into
four different résumés, three of them stale, one of them still carrying claims I had since
decided I could not source. Fixing that meant editing one file.

That file also carries an editorial policy in a comment at the top, because the repository
is public and I work at an insurer:

> Employer-internal production metrics are NOT published here; they need written clearance
> and they live only in the private master résumé. What is published: architecture, method,
> named negative results, and numbers that come from public corpora or personal repositories.

A policy in a comment next to the data is a policy you actually read. A policy in a
document is a policy you remember having written.

**Content as files.** Every post — including this one — is a markdown file in `/content`
with six lines of frontmatter. Write it, commit it, it is live. The loader is 90 lines,
the frontmatter parser is 12, and the markdown renderer is hand-rolled because the corpus
is first-party prose and headings/lists/tables/code is the whole feature surface. Adding a
CMS would have meant a database, an auth story and a deploy dependency, all to solve a
problem `git` already solves.

## What the structure costs

The window manager is real state: position, size, z-order, minimise, maximise, restore
bounds, focus. Roughly 200 lines of zustand. That is fine.

The parts that are *not* fine, and that I would cut first in a rewrite: the terminal's
command surface grew past ninety commands and about a fifth of them exist because they
were fun to write rather than because anyone will run them. The simulated security tools
look convincing and demonstrate nothing about my engineering that the résumé does not say
better. Both are load-bearing for the joke and dead weight for the purpose.

I kept them. That is a preference, not a defence.

## The bug worth writing down

`html, body { height: 100%; overflow: hidden }` — set so the desktop could own the
viewport. Correct for the OS. It also silently truncated `/resume`, the one page a
recruiter actually opens, at whatever fitted in 900 pixels. Everything below the second
job was unreachable and there was no scrollbar to suggest otherwise.

It survived because I only ever tested the page I was working on, and the OS is
`position: fixed; inset: 0` so it never needed body scroll to work. The clipping was
invisible from inside the thing that caused it.

The fix is two lines. The lesson is the one I keep relearning: a global set for one
consumer is a global, and the other consumers do not get a compile error — they get a
quietly worse experience that nobody reports, because the people it happens to are not the
people who file bugs.

## Try it

Open the terminal (the first desktop icon, or press `Ctrl` `Alt` `T`) and run `help`.
`blog` lists these posts. `papers` lists what I am reading. `resume` prints the whole
thing, `pdf` builds one. `Cmd`/`Ctrl` + `K` opens a command palette over every app.

If something is broken, it is [on GitHub](https://github.com/Thunderk3g) and I would like
to know.
