# Design Spec — Diwakar's 3D Portfolio World

**Date:** 2026-05-26
**Owner:** Diwakar Adhikari
**Status:** Approved (brainstorm complete) → ready for implementation planning

---

## 1. Overview

A 3D, explorable portfolio/resume website. The visitor controls a small character
who walks freely around a cozy, Studio-Ghibli-inspired town. Each building maps to
a section of Diwakar's resume; walking up to a building and pressing **E** opens a
styled panel with that content. Three optional, discoverable minigames add play
without ever blocking access to the resume content.

**Feel:** Third-person 3D roam (camera trails the character), free WASD/joystick
movement, real gravity & collisions. Warm, painterly, wholesome, minimalist.

### Goals
- Memorable, polished portfolio that showcases Diwakar as a senior engineer.
- Smooth: 60fps on desktop, graceful degradation on mobile.
- All resume content reachable; never gated behind gameplay.
- Maintainable by Diwakar (React/Next.js/TS — his existing stack).

### Non-goals (YAGNI)
- No multiplayer, no backend/database, no accounts.
- No procedural/infinite world — a small hand-placed town.
- No physics beyond what a walking character needs (no ragdoll, vehicles, etc.).
- No VR/AR.

---

## 2. Tech stack

| Concern | Choice | Version (pin at install) |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | latest 15.x |
| 3D | `three` + `@react-three/fiber` | R3F **v9** (React **19**) |
| Helpers | `@react-three/drei` | v10.x |
| Physics | `@react-three/rapier` | v2.x |
| Post FX | `@react-three/postprocessing` | latest |
| State | `zustand` | v5.x |
| Mobile input | `nipplejs` | 0.10.x |
| Deploy | Vercel | — |

> ⚠️ R3F v9 requires React 19; if React 18 is needed, use R3F v8 + drei v9. Confirm
> versions with `npm view <pkg> version` at install (npm registry pages were
> unreachable during research; versions came from official GitHub/docs).

---

## 3. Architecture

### 3.1 Component ownership
- **`<GameCanvas>`** — the R3F `<Canvas>`, wrapped in `dynamic(import, { ssr:false })`.
  Hosts `<Physics>`, lighting, sky, post-processing, world, player.
- **`<Player>`** — owns movement: a `kinematicPosition` RigidBody + a CapsuleCollider,
  driven by Rapier's `KinematicCharacterController` (autostep, snap-to-ground, manual
  gravity). Reads a unified input vector each frame.
- **`<FollowCamera>`** — owns the camera: damped lerp toward `playerPos + offset`,
  `lookAt` the player. (OrbitControls only as a debug cam.)
- **`<World>`** — static town: ground, paths, buildings, instanced nature/props.
- **`<Building id>`** — mesh + fixed colliders for walls + a **sensor** CuboidCollider
  whose `onIntersectionEnter` (player only) calls `enterBuilding(id)`.
- **`<UI>`** — DOM overlay (outside Canvas): info panels, minigame HUDs, mobile joystick,
  loading screen. Rendered from React/zustand state.

### 3.2 State model (the 60fps boundary)
- **Per-frame, non-reactive:** movement vector, velocity, camera position — held in
  refs / zustand transient state, mutated inside `useFrame`. **Never `setState` per frame.**
- **Discrete React state (zustand):** `nearBuilding`, `activePanel`, `activeMinigame`,
  minigame scores, settings (quality tier, audio on/off).
- Keyboard (`KeyboardControls`) and joystick (nipplejs) both write into one input store,
  so the rest of the code is input-source agnostic.

---

## 4. Art direction — the Ghibli rendering recipe

Soft & painterly, **not** hard cel-shaded. The Ghibli feel comes from lighting + sky +
color grade more than the shading model.

- **Materials:** `MeshStandardMaterial`, slightly desaturated albedo, low roughness
  contrast. `MeshToonMaterial` with a **soft (LinearFilter) 3-step gradient map** only
  as an accent on the character/hero surfaces.
- **Lighting:** low warm sun `directionalLight` (`#ffd9a0`, casts shadow) + warm
  `hemisphereLight` fill + `<Environment preset="sunset" background={false}>`
  (self-host HDRI via `@pmndrs/assets` for production).
- **Sky:** drei `<Sky>` gradient (golden-hour `sunPosition`/`turbidity`/`rayleigh`) +
  a handful of generated transparent cloud PNGs on drei `<Billboard>` drifting slowly.
  `<Clouds>` (volumetric) desktop-only.
- **Shadows:** `<SoftShadows>` (PCSS, mount once, ~8 samples) for the moving character;
  baked `<AccumulativeShadows>` + `<RandomizedLight>` for the static town; one
  directional shadow caster only.
- **Tone & post:** `gl={{ toneMapping: ACESFilmicToneMapping }}`; `<EffectComposer>` order
  grade → bloom → vignette: gentle `HueSaturation`/`BrightnessContrast` (or a warm LUT),
  subtle `Bloom` (`mipmapBlur`, `luminanceThreshold ~0.9`), low `Vignette`.
- **Palette:** sky `#bfe3f0`, peach `#fbe9c8`, sage `#a8cf8f`, terracotta `#c8745f`,
  lavender `#cdbce8`, cream `#f7f1e3`.

---

## 5. World layout & content

Spawn at **Home/About** (town center). Free roam; paths connect buildings; a pond and
trees for atmosphere. Approaching a building shows a floating "Press E" prompt; pressing
E opens that section's panel.

| # | Building | Theme | Content (from resume.json) |
|---|---|---|---|
| 1 | **Home / About** | cottage (spawn) | Name "Diwakar Adhikari", summary, stylized avatar, quick contact (Pune, India). |
| 2 | **Experience** | office | Senior Software Engineer-I, Bajaj Finserv Direct Ltd, June 2022–Present. Impact bullets (API design +25% efficiency, Angular +30% perf, NFO launch +50% adoption, VAPT fixes +45% security, etc.). |
| 3 | **Projects** | workshop | Framed posters: **METAPOD** (crypto hashing/tokenization), **KRYPTO-TRACKER** (crypto portfolio tracker), **PSEUDOSERVE** (API mocking tool). |
| 4 | **Skills** | library/garden | Java, Angular, HTML/CSS, Node.js, JavaScript, API Design & Integration, Redis, Apache Kafka, SQL, NoSQL, AWS — shown with official logos (simple-icons). Also hosts the Cache Match minigame. |
| 5 | **Awards & Research** | shrine | Awards: Deployment Star, Esteemed Contributor to Financial Innovation, COMPEX Scholarship. Research: Sustainable Energy Research recognition (CSU/IAASSE, USA); Rice Disease Identification via ANN & image processing. |
| 6 | **Contact** | post office | diwakar.adhikari0@gmail.com, +91 9378067880, Pune India; LinkedIn/GitHub when provided. Also serves the downloadable PDF resume. |

**Education** (B.Tech CSE, SRM University, CGPA 8.8, 2018–2022) and the
**Full-Stack Java Developer** certification surface inside About or Experience.

---

## 6. Character & animation

- **Hero model:** KayKit Adventurers (CC0, chibi-cute, animations attached), recolored to
  the palette. Fallback: Quaternius Universal Base Character (CC0) + Universal Animation
  Library. Both glTF-native (no conversion).
- **Animation:** drei `useAnimations`; crossfade **idle ↔ walk ↔ run** by horizontal speed
  (`crossFadeTo(..., warp=true)`, ~0.2–0.3s). For any NPCs, clone with `SkeletonUtils.clone`
  so each has an independent skeleton.

---

## 7. Controls

- **Desktop:** drei `<KeyboardControls>` maps WASD/arrows → named actions, read each frame
  via the non-reactive getter.
- **Mobile:** nipplejs joystick as a fixed DOM overlay *outside* the Canvas; its move/end
  events write the same `{x,z}` vector into the input store. Touch-detected: shown on touch,
  hidden on desktop.
- **Movement:** Rapier KCC — `computeColliderMovement` → `computedMovement`, manual gravity,
  `computedGrounded()` resets vertical velocity. `<Physics timeStep={1/60}>`, clamp dt.
- **Camera:** damped follow (`easing.damp3`/`MathUtils.damp`), not a fixed lerp factor.

---

## 8. Minigames (all optional, discoverable, non-blocking)

1. **Bug Hunt (VAPT):** cute bug-creature billboards hide around town; press E near one to
   squash it (poof sprite). Catch them all → "Security Star" badge + a line about VAPT work.
   HUD: bugs remaining.
2. **Kafka Courier:** pick up glowing event-packets at a producer building, deliver to a
   consumer building before a timer expires; chained deliveries combo for a higher score.
   HUD: timer + score. Themed producer→consumer.
3. **Cache Match (Redis):** memory match-pairs board inside the Skills building ("warm the
   cache"); fewer flips = higher "hit rate" score. Pure DOM/`<Html>` UI, 6 symbol pairs.

Scores live in zustand; no persistence required (optional `localStorage` for best score).

---

## 9. UI/UX flow

1. **Loading screen** (generated art + progress) while assets stream in (drei `useProgress`).
2. **Spawn** at Home with a one-time hint ("WASD/drag to move, E to enter").
3. **Roam** → near a building, prompt appears → **E** opens a Ghibli paper panel (generated
   9-slice art) with the section content; **Esc**/close returns to roam.
4. **Minigames** start via an in-world prop/sign; HUD overlays; results show a badge.
5. **Accessibility / fallback:** a plain HTML resume page (`/resume`) rendered from
   `resume.json` for SEO, no-WebGL devices, and reduced-motion users. "View as text" link
   always available. Respect `prefers-reduced-motion` (reduce camera sway, drifting).

---

## 10. Assets

See **`assets.md`** (project root) for the full manifest.
- **3D models — Claude sources (all CC0):** Quaternius Universal Base Character / KayKit
  Adventurers (hero); Quaternius Medieval Village MegaKit + KayKit Medieval Hexagon prefabs
  (church→shrine, blacksmith→workshop) + Kenney City Kit (post office) for buildings;
  Quaternius Stylized Nature MegaKit + Kenney Nature Kit for nature & props.
- **2D art — Diwakar generates (Nano Banana / Antigravity):** textures, sky/cloud PNGs,
  avatar portrait, UI panels, section icons, project posters, award badges, minigame art.
- **Audio — sourced free:** ambient BGM, footsteps, UI, door, chime, nature.
- **Fonts:** Baloo 2 (display) + Nunito/Quicksand (body), Google Fonts.
- **Tech logos:** official via simple-icons (not generated).
- **Licensing:** avoid Mixamo/Soldier.glb as shipped source (Adobe license, embed-only);
  prefer CC0. Keep a credits list for any CC-BY asset.

---

## 11. Performance & mobile strategy

- Instance/merge repeated static props (trees, fences, lamps) via drei `<Instances>`/`<Merged>`
  → few draw calls. `<Detailed>` LOD for distant buildings.
- `<PerformanceMonitor>` + `AdaptiveDpr` auto-scale quality at runtime.
- **Quality tiers:** desktop = SoftShadows + real shadow map + volumetric clouds + full post,
  `dpr=[1,2]`. Mobile = billboard clouds, Contact/blob shadow, post limited to LUT/none,
  `dpr=[1,1.5]`, shadow map 1024, lowered Environment intensity.
- Texture caps: 2048 desktop / 1024 mobile. Shared gradient map across toon materials.

---

## 12. Build sequence (phases — detailed plan to follow)

1. **Scaffold:** Next.js + TS + R3F canvas; a ground plane, one box, follow camera; deploy a hello-world to Vercel.
2. **Movement:** Rapier physics, kinematic character controller, KeyboardControls, follow camera.
3. **Character:** load hero GLB, idle/walk/run crossfade by speed.
4. **World blockout:** place 6 buildings (grey-box) + colliders + sensor trigger zones; "Press E" → panel opens.
5. **Content:** wire `resume.json` into each building's panel; About/Experience/Projects/Skills/Awards/Contact; text fallback page.
6. **Art pass:** swap grey-boxes for sourced models, recolor; apply Ghibli rendering recipe (light/sky/shadows/post).
7. **Mobile:** nipplejs joystick, quality tiers, AdaptiveDpr.
8. **Minigames:** Cache Match → Bug Hunt → Kafka Courier.
9. **Polish:** audio, loading screen, reduced-motion, SEO/meta, performance budget pass.

---

## 13. Risks & open questions

- **R3F v9 / React 19** compatibility with Next.js version — verify at scaffold; fall back to R3F v8/React 18 if needed.
- **Asset coherence:** mixing KayKit + Quaternius + Kenney — unify via recolor pass to the palette; verify scale consistency.
- **Avatar likeness:** generated from Diwakar's photo (optional) vs a generic friendly avatar — Diwakar's choice at generation time.
- **LinkedIn/GitHub URLs** are null in resume.json — collect before Contact building ships.
- **Mobile perf** is the main risk — budget early, test on a real mid-range phone.

---

## 14. References (authoritative)

- R3F: https://r3f.docs.pmnd.rs/getting-started/introduction
- drei: https://drei.docs.pmnd.rs · useAnimations: https://drei.docs.pmnd.rs/abstractions/use-animations
- rapier: https://github.com/pmndrs/react-three-rapier · KCC: https://rapier.rs/docs/user_guides/javascript/character_controller/
- postprocessing: https://react-postprocessing.docs.pmnd.rs/
- three.js animation: AnimationMixer/Action https://threejs.org/docs/#api/en/animation/AnimationMixer · SkeletonUtils https://threejs.org/docs/#examples/en/utils/SkeletonUtils
- linked example: https://threejs.org/examples/#webgl_animation_multiple
- nipplejs: https://github.com/yoannmoinet/nipplejs
- CC0 assets: https://quaternius.com · https://kaylousberg.itch.io · https://kenney.nl · https://poly.pizza
