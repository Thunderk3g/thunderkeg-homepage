# Asset Manifest — Diwakar's 3D Portfolio World

> **How to use this file**
> - **Sections marked 🧩 `[CLAUDE SOURCES]`** = I (Claude) will download these myself from free/CC0 sources. You don't need to do anything.
> - **Sections marked 🎨 `[YOU GENERATE]`** = please generate these in **Nano Banana / Antigravity** using the prompt provided. Drop the output into the listed path.
> - **Sections marked 🔊 `[SOURCED]` / 🔤 `[FONT]`** = pulled from free libraries (no generation needed).
> - Every generated prompt is self-contained, but **prepend the STYLE PREAMBLE below** to keep everything visually consistent.
> - Status legend: `[ ]` = not done, `[x]` = done, `[opt]` = optional polish.

---

## 🎨 STYLE PREAMBLE (prepend to every image-generation prompt)

```
Studio Ghibli-inspired, soft painterly minimalism. Warm golden-hour lighting,
gentle soft shadows, low-poly-friendly clean shapes, hand-painted look.
Palette: soft sky blue (#bfe3f0), warm peach (#fbe9c8), sage green (#a8cf8f),
terracotta (#c8745f), lavender (#cdbce8), cream (#f7f1e3). Cozy, wholesome,
calm, slightly storybook. No text unless asked. No harsh contrast, no neon,
no photorealism, no clutter.
```

---

## Folder convention (where generated files go)

```
public/
  textures/    # tileable surface textures (grass, paths, walls, water)
  sky/         # cloud sprites, sky gradient
  ui/          # panels, buttons, cursor/prompts, loading screen, logo
  icons/       # section signpost icons
  art/         # portrait, project posters, award badges
  audio/       # music + sfx
models/        # 3D models (Claude sources these)
fonts/         # webfonts
```

---

# 🎨 [YOU GENERATE] — 2D Art for Nano Banana / Antigravity

## 1. World textures (tileable)
For ALL of these, append to the prompt: *"seamless tileable texture, top-down
orthographic view, flat even lighting, no baked shadows, no perspective."*

- [ ] `public/textures/grass.png` — **1024×1024** — Lush stylized Ghibli grass, soft green with subtle clover and tiny flowers, painterly.
- [ ] `public/textures/path.png` — **1024×1024** — Warm dirt/cobblestone footpath, soft worn stones, sandy beige.
- [ ] `public/textures/water.png` — **512×512** — Stylized calm water, soft turquoise with gentle painterly ripples (used with a shimmer shader).
- [ ] `public/textures/roof_tiles.png` `[opt]` — **512×512** — Terracotta clay roof tiles, warm orange-red, hand-painted.
- [ ] `public/textures/plaster.png` `[opt]` — **512×512** — Warm cream plaster wall, subtle hand-painted texture.

## 2. Sky & atmosphere
- [ ] `public/sky/cloud_01.png` — **1024×512, TRANSPARENT PNG** — Single fluffy soft Ghibli cumulus cloud, isolated on transparent background, soft edges, no sky behind it.
- [ ] `public/sky/cloud_02.png` — **1024×512, TRANSPARENT PNG** — A different wispier flat-bottomed cloud, transparent background.
- [ ] `public/sky/cloud_03.png` — **1024×512, TRANSPARENT PNG** — A small puffy cloud cluster, transparent background.
  *(These become billboard sprites drifting across a code-generated gradient sky — best performance + that signature Ghibli sky.)*

## 3. The character avatar (used in the About panel + loading screen)
- [ ] `public/art/avatar_portrait.png` — **1024×1024, TRANSPARENT PNG** — *Feed your own photo as a reference image to Nano Banana*, then: "Studio Ghibli-style character portrait of this person, friendly warm smile, soft cel-shaded, head & shoulders, transparent background." (Likeness is optional — a stylized friendly developer avatar is fine too.)

## 4. UI (the interface that appears when you enter a building)
- [ ] `public/ui/panel_paper.png` — **1024×768, TRANSPARENT PNG** — Aged parchment/paper panel with soft rounded torn edges, warm cream, faint border, empty center (for text overlay). Design for 9-slice stretching.
- [ ] `public/ui/button.png` — **256×96, TRANSPARENT PNG** — Rounded wooden storybook button, warm, soft bevel, empty center.
- [ ] `public/ui/interact_prompt.png` — **128×128, TRANSPARENT PNG** — A small floating cream key-cap badge showing the letter "E", soft glow, storybook style.
- [ ] `public/ui/loading_screen.png` — **1920×1080** — Wide cozy Ghibli town at golden hour: small cluster of pastel cottages, winding path, big soft sky with clouds, rolling hills. Leave the lower third calmer for a loading bar. No text.
- [ ] `public/ui/logo.png` — **1200×400, TRANSPARENT PNG** — Hand-lettered storybook wordmark reading "Diwakar Adhikari", warm earthy ink, gentle, transparent background.
- [ ] `public/ui/favicon.png` — **512×512, TRANSPARENT PNG** — A single tiny cozy cottage icon, simple, readable at small size.

## 5. Section signpost icons (one consistent set — same frame/style for all 6)
Append: *"matching icon set, identical round wooden signpost frame, centered
symbol, transparent background, 256×256, consistent line weight."*

- [ ] `public/icons/about.png` — a cozy little house / heart.
- [ ] `public/icons/experience.png` — a briefcase / office building.
- [ ] `public/icons/projects.png` — a workshop hammer & gear / lightbulb.
- [ ] `public/icons/skills.png` — an open book / sprouting plant.
- [ ] `public/icons/awards.png` — a star medal / trophy.
- [ ] `public/icons/contact.png` — a mailbox / paper envelope.

## 6. Project posters (shown as framed art inside the Projects building)
Square illustrations, **768×768**, cozy tech-storybook style.
- [ ] `public/art/project_metapod.png` — A glowing crystalline lockbox emitting unique geometric hash-runes; theme: secure cryptographic hashing/tokenization. Caption-free.
- [ ] `public/art/project_krypto_tracker.png` — A cozy desk with floating coin charts and a friendly portfolio dashboard; theme: crypto portfolio tracker.
- [ ] `public/art/project_pseudoserve.png` — A toy puppet-theater "fake server" handing API cards to a tiny developer; theme: on-the-fly API mocking.

## 7. Award badges (shown inside the Awards building)
Circular medal/badge illustrations, **512×512, TRANSPARENT PNG**, ribbon, warm gold.
- [ ] `public/art/award_deployment_star.png` — "Deployment Star" — a shooting star medal.
- [ ] `public/art/award_financial_innovation.png` — "Financial Innovation" — a sprouting-coin medal.
- [ ] `public/art/award_compex.png` — "COMPEX Scholarship" — a laurel-wreath scholar medal.

## 8. Minigame art (all 3 minigames confirmed)
**Bug Hunt (VAPT):**
- [ ] `public/art/bug_creature.png` — **512×512, TRANSPARENT PNG** — A cute, harmless little Ghibli bug creature (round body, big friendly eyes, tiny legs), not scary. Used as a drifting billboard around town.
- [ ] `public/art/bug_poof.png` — **256×256, TRANSPARENT PNG** — A soft puff of smoke/sparkles for when a bug is squashed.
- [ ] `public/art/badge_security_star.png` — **512×512, TRANSPARENT PNG** — A glowing shield-with-star reward badge for catching all bugs (nods to VAPT/security).

**Kafka Courier:**
- [ ] `public/art/event_packet.png` — **256×256, TRANSPARENT PNG** — A glowing little parcel/orb of light (a "stream event packet"), warm cyan-gold glow.
- [ ] `public/art/badge_courier.png` `[opt]` — **512×512, TRANSPARENT PNG** — A winged-envelope courier reward badge.

**Cache Match (Redis):**
- [ ] `public/art/card_back.png` — **512×640, TRANSPARENT PNG** — A storybook playing-card back, warm pattern, soft border (the face-down memory card).
- [ ] `public/art/card_faces.png` — **single sheet, 6 symbols in a 3×2 grid, ~1536×1024** — 6 distinct cozy tech symbols to match in pairs (e.g., gear, key, database cylinder, lightning bolt, leaf, star), consistent storybook style, on cream cards.

---

# 🧩 [CLAUDE SOURCES] — 3D Models (I download these, free/CC0)

You do **not** generate these. Listed so you know what's coming. I'll pull from
Three.js examples, [Quaternius](https://quaternius.com), [Poly Pizza](https://poly.pizza),
[Kenney](https://kenney.nl), and Mixamo — all free/CC0.

- [ ] **Player character** — rigged glTF with idle + walk + run animations
  (candidates: Three.js `Soldier.glb` / `RobotExpressive.glb`, or a Quaternius
  animated character — I'll pick the most Ghibli-friendly and recolor).
- [ ] **Buildings** ×6 — cottage, office/tower, workshop, library, shrine/monument, post office (Quaternius modular / Poly Pizza low-poly).
- [ ] **Nature props** — trees, bushes, rocks, flowers, grass tufts, lily pads.
- [ ] **Set dressing** — fences, lamp posts, benches, signposts, mailbox, well, wooden bridge, lantern.
- [ ] **Minigame props** — TBD after design.

---

# 🔊 [SOURCED] — Audio (free libraries, not generated)
From [freesound.org](https://freesound.org), [Pixabay](https://pixabay.com/music/), [Kenney audio](https://kenney.nl).
- [ ] `audio/bgm_ambient.mp3` — calm acoustic/piano Ghibli-ish loop.
- [ ] `audio/footstep.mp3` — soft grass footstep.
- [ ] `audio/ui_click.mp3` — gentle pop.
- [ ] `audio/door_open.mp3` — entering a building.
- [ ] `audio/chime.mp3` — discovery / success.
- [ ] `audio/ambient_nature.mp3` — birds + light wind loop.

# 🔤 [FONT] — Typography (Google Fonts, not generated)
- [ ] Display/headings: **Baloo 2** (rounded, friendly).
- [ ] Body/UI: **Nunito** or **Quicksand** (soft, readable).

# 🏷️ Tech/skill logos — DO NOT GENERATE
Use official brand logos via [simple-icons](https://simpleicons.org) for Java,
Angular, Node.js, JavaScript, Redis, Apache Kafka, AWS, SQL/NoSQL — generated
versions would look off-brand. I'll wire these in.

---

## ✅ Status: design LOCKED
Third-Person 3D Roam · Ghibli style · 6 buildings (About, Experience, Projects,
Skills, Awards & Research, Contact) · 3 minigames (Bug Hunt, Kafka Courier,
Cache Match). **Every section above is now final — safe to generate all of it.**
Priority order if you want to start somewhere: **#1 textures → #2 sky → #4 UI →
#5 icons → #3 avatar → #6/#7 posters & badges → #8 minigames.**
