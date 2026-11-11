# Teardown: what exists, what was borrowed, what is new

Research behind the Teardown mode (`src/os/teardown`): the running desktop
tilted and pulled apart into its layers, continuing under the wallpaper into
the display, the session, the file system, the kernel and the hardware.

Done on 2026-11-10. How far each claim can be trusted is marked:

- **read**: the source itself was opened and read.
- **summary**: taken from a search-result summary; the page was not opened.
- **unverified**: no reliable source found.

Several primary sites (MDN, the CSS Working Group drafts, Wikipedia,
Microsoft Learn) could not be fetched from the research sandbox, so the MDN
and specification text below was read from their GitHub sources instead.

## 1. 3D desktops, and what happened to them

| Project | What it did | What became of it | Trust |
| --- | --- | --- | --- |
| Compiz cube, Expo | Workspaces on a rotating cube; Expo zooms out to a wall of all of them. A "3D Windows" plugin lifted windows off the cube face while it turned. | Ubuntu preferred Expo and wall over the cube; the lead developer declined a Wayland port in 2013. | summary |
| Sun Project Looking Glass | A 3D desktop with windows that could be turned around. | Inactive since late 2006. Reason not found. | summary |
| BumpTop | A desk with physics: files in piles you could throw. | Bought by Google in 2010 and discontinued. | summary |
| Windows Flip 3D | A tilted stack of live windows to switch between. | Removed in Windows 8. | summary |
| Task Gallery (Microsoft Research, 2000) | Tasks hung as pictures in a 3D gallery. | Never shipped. | summary |
| KWin cube | Desktop cube effect. | Removed in Plasma 5.23 as hard to maintain; rewritten for Plasma 6. | summary |
| Wayfire | Compiz-inspired Wayland compositor with cube and expo plugins. | Active; the plugins are in the source tree. | read |
| SphereXP, Exposé, Mission Control, visionOS | | Not sourced. | unverified |

The pattern in the sourced cases: 3D as a place to work was dropped again and
again, and the part that survived was the momentary, reversible overview
(Expo displacing the cube in Ubuntu). One secondhand citation (Cockburn and
McKenzie, 2002) reports that a third dimension did not help people find
things and made them slower.

**What Teardown takes from this:** it is an overview, not a workspace. The
desktop is inert while it is apart, and Esc puts it back.

## 2. Exploded views of interfaces

| Tool | What it does | Trust |
| --- | --- | --- |
| Firefox Tilt | WebGL view of the page with depth by DOM nesting. Native from Firefox 11, removed in 47. | read (README); removal from summaries |
| Edge DevTools 3D View | DOM, z-index and composited-layer views of a page, from a snapshot. | read (explainer) |
| Chrome Layers panel | Rotatable diagram of compositor layers. | summary |
| Xcode Debug View Hierarchy | Pauses the app and explodes its view tree, with a spacing slider. | summary |
| Reveal | Runtime inspector for iOS apps with an exploded view. | summary |
| Android Studio Layout Inspector, 3D mode | Rotatable view hierarchy. Deprecated in 2026 for low use. | summary |
| dom3d, exploded-dom-js, compose-exploded-layers, ViewExploder | Libraries that explode a DOM or view tree with CSS or canvas. dom3d lists wrong z-order and "some websites appear flat" as known issues. | read |

All of these are tools for developers looking at one app or page. In the ones
read, depth means nesting depth or an assigned z-index, the view is a
snapshot or a paused app, and there is no parts list.

## 3. Does anything combine the two?

Nothing was found. The searches covered: exploded views of a desktop
environment; interactive 3D visualisations of operating-system layers
(kernel, processes, file system, hardware); web-desktop portfolios with 3D,
isometric or exploded modes; "exploded" compositor effects in KWin,
Hyprland, Wayfire and Compiz; and "x-ray", "under the hood" or "teardown"
modes in web desktops.

Nearest misses: a portfolio that hangs windows on the walls of a CSS 3D room
(not exploded, no system layers), and the interactive Linux kernel map (2D).

So the claim that can be defended is narrow: the techniques are old, and this
combination appears to be new. That rests on about eight searches, not an
exhaustive survey.

What the combination is:

1. It is for the person using the desktop, not for a developer inspecting it.
2. It is live: the same elements, still running, not a snapshot.
3. Depth means something: each layer is a part of the system with a name
   (panel, a window, the icon view, the wallpaper), in real stacking order.
4. It continues under the wallpaper into what holds the desktop up, read from
   live state: display, session, file system, storage, machine.
5. It is annotated like a drawing: balloons, leaders, a parts list.

## 4. Conventions of exploded drawings

- **ISO 6433:2012** (part references): arrange references in rows or columns;
  leader lines shall not intersect, should be short, and are drawn at an
  angle. *summary, from the standard's sample pages*
- **ISO 128-22**: leaders should not cross other leaders. *summary*
- Drafting practice: balloons all one size; numbers match the parts list and
  run in a systematic order; avoid horizontal or vertical leaders; dashed
  lines show the path parts travel when assembled. *summary*
- **Li, Agrawala and others, SIGGRAPH 2008** (automated exploded views):
  explode along few canonical axes, respect which part blocks which, keep
  every part visible, stay compact. *summary*

**What Teardown takes from this:** one explosion axis; layers in their real
blocking order; balloons in one column numbered top to bottom to match the
stack; straight leaders at an angle that are re-aimed until none cross
(`leaderEnds` in `camera.ts`, checked by `scripts/teardown-camera.test.mts`);
dashed lines up the four corners as the assembly path; and any layer can be
opened on its own, so nothing stays hidden behind another.

## 5. CSS 3D on a whole live page

All read from the CSS Transforms specifications, MDN and web-platform-tests.

- `transform-style: preserve-3d` is undone by any "grouping" property on the
  same element: `overflow` other than `visible` or `clip`, `opacity` below 1,
  `filter`, `clip-path`, `isolation: isolate`, masks, `mix-blend-mode`,
  `contain: paint`. `backdrop-filter` is not in the specification's list but
  the web-platform test asserts that it flattens too.
- `transform-style` is not inherited. Every element between the scene and a
  layer needs it.
- Any transform, including the individual `translate` / `rotate` / `scale`
  properties, makes the element the containing block for `position: fixed`
  descendants.
- The individual properties compose with `transform`: translate, then rotate,
  then scale, then `transform`. Chrome 104, Firefox 72, Safari 14.1.
- Hit-testing through 3D transforms is underspecified and differs between
  engines. *summary*

**What Teardown does about it:**

- Layers are raised with `translate`, so a window's own `transform` (used
  while it is dragged or animating) is left alone.
- Flattening only matters on the two elements that have 3D children, the
  desktop and the window container. Neither carries a grouping property.
- One thing the sources did not predict: in Chromium a finished animation on
  `opacity` with `animation-fill-mode: both` keeps a compositing surface
  alive, and that surface flattens the 3D children even though the computed
  opacity is 1. The desktop's fade-in had exactly that. The fill mode was
  removed. *found by testing here, not from a source*
- Pointing is not left to the browser. The desktop is `inert` while apart and
  the pointer is resolved with the same arithmetic that places the layers.

## 6. Three readings of one stack

Added on the second pass (2026-11-10). The stack can be read three ways, and
the lens renames every layer and the components shown on it
(`src/os/teardown/anatomy.ts`):

- **Kali Linux.** What the layer is on a real Kali machine. The Xfce and
  theme facts are from `docs/kali-desktop-research.md`, which was checked
  against Kali's own packaging; that zsh became the default shell in 2020.4
  and that Kali stopped logging in as root in 2020.1 are from the Kali 2020.4
  release announcement (*summary*). The kernel, systemd and file-system
  descriptions are general Linux knowledge, not separately sourced.
- **This site.** What the layer actually is here: which component, which
  store, which library.
- **An LLM system.** An analogy, after the "LLM OS" sketch in Andrej
  Karpathy's 2023 talk *Intro to Large Language Models*: the model as the
  kernel, the context window as working memory, retrieval and files as the
  disk, tools as the applications. *Summary: taken from secondary write-ups
  of the talk; the talk itself was not opened.* The mappings for the panel
  (observability), the display (decoding), the wallpaper (the prior) and the
  hardware (compute) are my extensions, and the interface text says so on
  each. One known strain, from the write-ups: a page fault is invisible to a
  running process, but fetching from external memory is an explicit step for
  a model, so "retrieval is paging" should not be pushed far.

Each layer also lists the subjects of the Stacks record where I have worked
at that layer, and the parts it is wired to. `scripts/teardown-anatomy.test.mts`
checks that every subject and every link named there exists.

## 7. Two levels: leafing the stack, and a layer's own screen

Added on the third pass (2026-11-11), after the first version was used on the
live site. *All of this section is mine: it comes from testing here, not from
a source.*

**What was wrong.** Pointing at a layer slid it sideways out of the stack by
most of the screen's width. Three things made that feel rough:

- The pointer test followed the layer. A layer that slid away was no longer
  under the pointer, so the layer beneath took the hover, slid out in turn,
  and the first came back. A perfectly still pointer was stable, but a hand
  is not: a reviewer with no knowledge of the code, driving the live site,
  counted 20 to 30 changes of the picked layer in three seconds under two
  pixels of jiggle, and 108 on one slow sweep down the stack.
- Each leader chose its landing corner again on every frame, so a leader
  could jump from one corner to another while its layer was moving. The same
  scripted sweep run on both versions (the live site, then this build
  locally): the largest single-frame jump of a
  leader's end was 432 px before and 17 px after; the picked layer changed
  102 times before and 29 after.
- Everything else was dimmed with a CSS opacity transition on top of the
  camera's own easing. Two easings in series lag each other, and a
  full-screen layer changing opacity is repainted in full.

**What it does now.**

- *Pointing leafs the stack.* Every layer above the one being pointed at
  lifts by a fraction of a gap, which opens the stack at that layer the way a
  thumb opens a pile of paper. The layer itself does not move.
- *The pointer is tested against the stack at rest*, never against the
  displaced layers, so what is under the pointer cannot change unless the
  pointer crosses an edge. Measured with the reviewer's own test, two pixels
  of jiggle for three seconds at seven points on the stack: 0, 27, 22, 30,
  29, 0 and 30 changes of the picked layer before; none at any point after.
- *A leader's corner is chosen once*, on the stack at rest, and again only
  when the camera itself is turned (`leaderPicks` returns an index; the end
  point then follows the layer).
- *Nothing is dimmed on hover*, and opacity is written by the camera loop
  with no CSS transition over it (section 8 goes further). The notes follow the pointer 90 ms late, so
  sweeping across the stack does not re-render them at every layer.
- *Clicking a layer opens its own screen.* The rest of the stack steps away
  (up if it was above, down if below) and stops being painted; the camera
  takes an angle chosen for that layer and frames it with room for its
  pieces (`frame` in `camera.ts`); and the layer comes apart in a way of its
  own (`breakdowns.ts`):

| Layer | Move | What moves |
| --- | --- | --- |
| Panel | Keys | each real plugin lifts out of the bar, left to right |
| A window | Lid | the real title bar and client area lift off the frame |
| Icons and card | Pop-up | the real icons and the card stand up on their lower edge |
| Stacks board | Replay | the record is rebuilt one year at a time |
| Wallpaper | Fan | its components fan out like paint swatches |
| Display | Sheets | full-size sheets separate, one behind another |
| Session | Cascade | cards step out like a cascade of windows |
| File system | Drawers | slabs slide out in a staircase |
| Kernel | Rings | concentric rings rise to a ziggurat |
| Hardware | Chips | chips lift off the board to different heights |

  For the three live layers the pieces are the page's own elements, found by
  selector and measured with offsets (which ignore transforms). For the rest
  they are the layer's components under the current reading, drawn by the
  plate. Esc steps back one level at a time.

**Two more things CSS 3D did here that the sources did not predict.**

- A window's open animation had `animation-fill-mode: both`, the same trap as
  the desktop's fade-in in section 5: it would have flattened the title bar
  and client area back onto the frame. The fill mode was removed.
- A layer that has stepped away is given `visibility: hidden`, and its
  children inherit that. Deciding which pieces exist by asking whether they
  are visible therefore found none on a layer that was just coming back. The
  test is now on the piece's own opacity, which is not inherited.

**Not verified.** Frame rate. Everything above was measured in headless
Chromium without a GPU, at roughly ten frames a second, where only jumps and
feedback loops can be seen, not smoothness itself. Firefox and Safari have
not been tried.

## 8. Why the layer screens lagged, and what fixed it

Added on the fourth pass (2026-11-11), after the layer screens were reported
as laggy on a real machine. *All of this section is mine, from traces taken
here.* The traces are of headless Chromium drawing in software, so the
absolute times mean nothing; what they show reliably is what kind of work is
done on each frame, and that is the same on any machine.

**The idea that was wrong.** I had assumed that once every layer is a
compositor layer, moving the stack is free. It is, but only for as long as
nothing changes what a layer looks like and nothing forces a layer through an
extra pass. Four things did.

| Cause | What it cost | Fix |
| --- | --- | --- |
| A highlight colour animated on the plate itself (`transition: border-color`), and a child's opacity driven from the loop (`.td-body`, `.td-lip`). Both are painted into the plate, so each frame of the animation repainted the whole full-screen plate, grid background included. | One hover sweep down the stack re-drew 3,598 tiles (2.9 s of raster work); one step from File system to Kernel re-drew 762 (1.4 s), 480 of them the Kernel plate alone. | Nothing painted into a big layer is animated. The highlight is a ring beside the layer, mounted only while the layer is picked or wired. What fades on an open plate is given a layer of its own first. After: 220 ms and 150 ms of raster work for the same two actions. |
| Per-frame values passed as custom properties (`--td-z`, `--td-o`, `--td-p`, and `--td-in` on the root). Custom properties inherit, so each write restyled everything under the element. | 2 to 5.7 ms of style work per frame while stepping between layers; whole-frame main-thread work of 19.3 ms (File system) and 15.9 ms (Kernel) against a budget of 16.7. | The loop writes `translate`, `rotate`, `opacity` and `visibility` directly, and skips a write whose value has not changed. After: 0.3 to 0.9 ms of style work, 2.1 and 4.0 ms whole-frame. |
| Animations with `animation-fill-mode: both` (the component chips on each plate, the desktop icons, the card). A filling animation keeps its element a compositor layer for good. | 29 chip layers and 11 icon layers that should not exist, and each plate holding them drawn through an off-screen pass. The stack had 79 layers. | `backwards` only. |
| Pieces promoted to layers one at a time as their staggered movement began. Each promotion repainted the layer the piece left. | Repeated full repaints of the open plate through the transition. | Every piece of a layer is promoted in the frame the layer opens (`will-change` under `[data-td-open]`); a closed plate's pieces are `display: none`. |

**The one the specifications do not mention.** In a 3D scene Chromium draws
every *flat* element (one without `transform-style: preserve-3d`) into an
off-screen picture of its own size and then places that picture, on every
frame, whether or not it has children. An element that is itself
`preserve-3d` is painted straight to the screen, and only its children go
through such a pass. Measured with ten bare plates and nothing else in the
scene: 10.7 render passes a frame flat, 1.0 with `preserve-3d` on each.

So the big surfaces (glass plates, slabs, rings, the wallpaper, the canvas,
the icon layer) are now `preserve-3d` themselves, and what is left to go
through a pass is small: a slab's label, the icon column, the card. Going
further and making every box on the solid plates 3D was tried and dropped:
101 passes a frame of tiny pictures for a small gain.

Also removed while the desktop is apart, because each needs an off-screen
pass on every frame the scene behind it moves: the backdrop blur on the notes
panel and on the desktop card, the saturation filter on unfocused windows,
the glow on the wires, and the soft shadows, gradients and hue filters on the
pieces (flat colours cost nothing to draw).

**Result, same machine, same script, before and after.**

| | Before | After |
| --- | --- | --- |
| Raster work, one hover sweep | 2,904 ms | 220 ms |
| Raster work, File system to Kernel | 1,393 ms | 150 ms |
| Tiles re-drawn while turning a layer's screen | not measured | none |
| Main-thread work per frame, step to File system | 19.3 ms | 2.1 ms |
| Main-thread work per frame, step to Kernel | 15.9 ms | 4.0 ms |
| Main-thread work per frame, open Panel | 10.0 ms | 3.9 ms |
| Layers in the stack view | 79 | 37 |
| Software frame rate, stepping to Kernel / File system / Session | 22 / 27 / 32 | 33 / 36 / 46 |

`scripts/teardown-css.test.mts` checks the stylesheet and the loop for each
of these rules, since any one of them comes back with a single line of CSS.

**Still not verified.** A real GPU. The Display screen is the heaviest that
remains (five full-size translucent sheets drawn over one another), and the
stack view still passes its five solid plates and each window through a
picture of their own.

## 9. The pop at the end of every layer transition

Added on the fifth pass (2026-11-11). *Mine, from frames recorded here.*

**What was seen.** Stepping from one layer's screen to the next, the new
layer arrived with its pieces lying flat on it, and about 1.1 seconds in they
all jumped to their final heights at once. The rise was never shown.

**How it was found.** Not by the numbers the loop writes, which eased
correctly. Every painted frame of each transition was recorded and the change
from one frame to the next measured. A transition that ends well has a curve
that falls to nothing; these had a spike of 5 to 11 (against about 0.5 around
it) between 1.06 and 1.28 s, in nine of ten transitions. The two frames
either side of a spike showed the pieces flat, then fully out.

**Why.** `opacity` under 1 is a grouping property (section 5): the browser
flattens everything inside the element onto it. An arriving layer was faded
in with an eased opacity, and an exponential ease spends a long time just
short of its target: the layer sat at 0.99 until the value was finally
snapped to 1, a little over a second in. For that whole second its pieces
were being moved correctly and drawn flat.

**Fix.** A layer is never faded while its pieces are off it. Fading and
coming apart are two clocks that do not overlap (`clocks()` in
`breakdowns.ts`): a layer coming in fades in first (0.16 s, linear, so it
ends exactly at 1) and then comes apart; a layer going out closes its pieces
first and then fades. `scripts/teardown-breakdowns.test.mts` runs both clocks
through arriving, leaving, both kinds of interruption and the return to the
stack, at five frame rates, and fails if a layer is ever under full opacity
with a piece out. Writing that test found a second fault before it shipped:
back in the stack, every layer's opacity stepped down and up again on
alternate frames.

**Two more faults at the end of a movement, found the same way.**

- *The camera never arrived.* An exponential ease only approaches its
  target, so after a transition looked finished the picture went on moving
  by fractions of a pixel: it was still changing 3.1 s after a step. Within
  half a pixel the camera is now put on its target. Transitions are at rest
  by about 1.3 s.
- *Reassembly ended with a jump.* The desktop was declared flat when it was
  within 0.7 degrees and 0.6 percent of flat, and the transform was then
  removed: its corner was still 11 to 15 px from where it belonged. It now
  eases to within half a pixel first.

## Sources

Read:

- CSS Transforms Level 2, source: https://raw.githubusercontent.com/w3c/csswg-drafts/main/css-transforms-2/Overview.bs
- CSS Transforms Level 1, source: https://raw.githubusercontent.com/w3c/csswg-drafts/main/css-transforms-1/Overview.bs
- MDN, transform-style: https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/css/reference/properties/transform-style/index.md
- MDN, containing block: https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/css/guides/display/containing_block/index.md
- MDN browser-compat-data, translate: https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/properties/translate.json
- web-platform-tests, preserve-3d and grouping properties: https://raw.githubusercontent.com/web-platform-tests/wpt/master/css/css-transforms/preserve-3d-flat-grouping-properties.html
- Edge 3D View explainer: https://raw.githubusercontent.com/MicrosoftEdge/MSEdgeExplainers/main/DevTools/3DView/explainer.md
- Tilt: https://github.com/victorporof/Tilt
- dom3d: https://github.com/OrionReed/dom3d
- exploded-dom-js: https://registry.npmjs.org/exploded-dom-js
- compose-exploded-layers: https://github.com/pingpongboss/compose-exploded-layers
- ViewExploder: https://github.com/AlexKGwyn/ViewExploder
- 3D Portfolio OS: https://github.com/jasonli2446/portfolio
- Wayfire: https://github.com/WayfireWM/wayfire
- hyprland-plugins: https://github.com/hyprwm/hyprland-plugins

From search summaries only:

- Kali Linux 2020.4 release: https://www.kali.org/blog/kali-linux-2020-4-release/
- LLM OS, lecture notes citing the talk: https://tddg.github.io/ds5110-spring25/assets/docs/lec11-llm-os.pdf
- LLM OS, secondary write-up: https://horaceheaven.github.io/publications/llm-os
- ISO 6433:2012 sample: https://cdn.standards.iteh.ai/samples/51527/d4eaa720fb0448bea2952817ce24d508/ISO-6433-2012.pdf
- Li and others, 2008: https://grail.cs.washington.edu/projects/exview3D
- Balloons and parts lists: https://wtcs.pressbooks.pub/blueprintreading/?p=501
- Tilt's removal: https://bugzilla.mozilla.org/show_bug.cgi?id=1224838
- Android Studio Panda 2 release notes: https://developer.android.com/studio/releases/past-releases/as-panda-2-release-notes
- Chrome Layers panel: https://developer.chrome.com/docs/devtools/layers
- Xcode view debugging: https://developer.apple.com/documentation/xcode/diagnosing-issues-in-the-appearance-of-your-running-app
- Compiz and Wayland: https://www.phoronix.com/news/MTI2ODU
- KWin cube: https://bugs.kde.org/show_bug.cgi?id=443410
- Flip 3D: https://en.wikipedia.org/wiki/List_of_features_removed_in_Windows_8
- Looking Glass: https://www.wikiwand.com/en/Project_Looking_Glass
- BumpTop: https://www.osnews.com/story/21288/bumptop-10-released-useful-or-gimmick/
- Task Gallery: https://www.microsoft.com/en-us/research/?p=145458
- 3D hit-testing: https://lists.w3.org/Archives/Public/public-css-archive/2019Jun/0030.html
- Linux kernel map: https://makelinux.github.io/kernel/map/intro
