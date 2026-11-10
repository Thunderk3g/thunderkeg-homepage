# Teardown: what exists, what was borrowed, what is new

Research behind the Teardown mode (`src/os/teardown`): the running desktop
tilted and pulled apart into its layers, continuing under the wallpaper into
the display, the session, the file system, storage and the machine.

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
slid out of the stack, so nothing stays hidden behind another.

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
