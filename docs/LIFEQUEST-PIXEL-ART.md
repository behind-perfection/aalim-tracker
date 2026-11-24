# LIFEQUEST — the pixel-art pass (v99 / LIFEQUEST 0.4.0-pixel)

The brief, verbatim in spirit: *replace the current LIFEQUEST art style with a
pixel-art style. Retro pixel art, monochrome / limited grey palette, low
resolution, chunky pixels, simple shapes, no smooth gradients. Character,
environments, objects and animations all in pixel style. Subtle pixel-art
lighting and limited animation, like a minimalist retro game. Black, white and
grey only. Preserve readability and the calm, reflective tone.*

This document is the contract. Everything in it is enforced by tests
(`9.14`–`9.16` in `tests/lifequest.js`) and by the preview tool, so the style
cannot quietly drift back to vectors.

## 1. The grid

* One pixel = `LQWorld.P` = **4 scene units**. The stage is 960×540 units =
  **240×135 pixel-art pixels**, the classic low-res canvas.
* Every rect in every room, prop and rig sits on that grid. Test `9.15`
  rejects any scene coordinate that is not a multiple of `P`.
* The character rig is drawn in **pixel units** (1 unit = 1 art pixel) and the
  renderer multiplies the place scale by `P`, so the rig and the rooms share
  one grid exactly. He is 24 pixels tall standing.
* Camera zooms snap to whole multiples: 960, 480, 320 or 240 units wide
  (`LQRender.zoom`). A art pixel is therefore always a square block of screen
  pixels — 1×, 2×, 3× or 4× — never a fraction.

## 2. The palette

* One grey ramp, ten steps, shared by both themes: `g0 #0a0a0a … g9 #e2e2e2`
  (`.g0`–`.g9` in `lifequest.css`). The sky is four consecutive ramp steps.
* Rooms pick tones through CSS variables on `.lq-stage`
  (`--wall --floor --wood --blanket --page …`), with a dark-theme override
  block. Paper stays light in both themes so the subject glyph on the desk
  always reads.
* Skins are six neutral greys, outfits eight neutral grey pairs. Test `9.16`
  scans the whole stylesheet and fails on **any** colour whose R, G and B
  differ — hue is banned, not discouraged.
* No gradients, no filters, no blurs, no rounded corners, no circles, no
  ellipses, no curved paths — anywhere. Test `9.14` scans the generated
  markup for all of them.

## 3. Dither and light

* Two tones meet in a **1-pixel checker row**: `<pattern>` tiles `lqDithA/B`
  (30 % / 48 % black pixels) stitch wall→floor, rug edges, desk seams, the
  horizon fade and the sun/moon halo. Dither is the only "blend" in the game.
* Lighting is stepped, never smooth:
  * night = one flat wash rect over the room (`.lq-nightwash`, 16 % light
    theme / 28 % dark), plus a dimmer dither glow around lamps;
  * the sky is four flat bands chosen by time of day;
  * stars twinkle between two opacities with `steps(1)`;
  * the lamp glow flickers between three opacities with `steps(1)`.
* Shadows are single flat rows of semi-transparent black under furniture and
  feet. Nothing casts a soft shadow.

## 4. The character and his animation

* Poses are **pre-drawn pixel groups** (`lq-p-stand / -sit / -recline / -lie`);
  CSS shows exactly one. No rotation, no skew, no easing — a rotated pixel
  rect is not a pixel rect.
* Motion is a **two-frame swap**: `.alt` groups hold frames `.fa` and `.fb`,
  flipped by `lqFlipA/lqFlipB` with `steps(1,end)`. The swap period `--sw` is
  the whole choreography: walk .52 s, run .26 s, type .16 s, study .9 s,
  exam .36 s, read 2.6 s … one variable per activity.
* Breathing is the upper body rising **one pixel**, slowly (`lqBreath`,
  stepped). Walking bobs one pixel per swap. Head work (nodding in class,
  looking around while exploring) is a one-pixel shift.
* `prefers-reduced-motion` and the paused-live state freeze every swap, bob
  and twinkle; the scene stays fully legible as a still.
* Customisation (skin / outfit / accessory / held prop) only swaps pixels —
  test `11.8` still asserts identical part counts per pose.

## 5. Honesty is part of the style

* Unbuilt environments (Garden, Workshop, City, Sanctuary…) render the real
  study desk **dimmed**, behind a flat night wash, with the stepped silhouette
  of the place he cannot enter yet and the phase it arrives in. The note says
  "the character is shown at the study desk instead" — and the scene now does
  exactly that. Nothing is faked, nothing is invented.
* The desk, chair and props are the same pixel furniture for every academic
  activity; only the glyph on the open notebook changes with the subject
  (maths axes, chemistry flask, physics vector, bio leaf, code window…).

## 6. Tooling

`tools/pixel-preview.js` rasterises any room/anim/minute/theme **using the
real `lifequest.css` as the palette** (no second source of truth) and writes
`preview/<room>-<anim>-<minute>-<theme>.png`. It reports:

* `NON-GREY pixels painted` — must be 0;
* `SKIPPED (not rasterizable as pixel art)` — must be 0 elements (the three
  `<text>` lines of the unbuilt note are reported separately; they are real
  text in the browser, and the only non-rect art allowed).

Examples:

    NODE_PATH=/tmp/smoke/node_modules node tools/pixel-preview.js study study 600 light 2
    NODE_PATH=/tmp/smoke/node_modules node tools/pixel-preview.js bedroom sleep 1300 dark 2

(`2` = render at 2× for review; the in-game camera chooses 1×–4× by zoom.)

## 7. What changed, file by file

| file | change |
|---|---|
| `lq-world.js` | rooms rebuilt as pixel rects on the 4-unit grid; dither patterns; stepped sky bands; pixel sun/moon disc with crescent cut; silhouettes; unbuilt placeholder = dimmed study + note |
| `lq-character.js` | new 24-px rig, four pre-drawn poses, two-frame `.alt` groups, pixel accessories and held props, neutral-grey skins/outfits |
| `lq-render.js` | place scale × `P`; integer camera zooms; props wrapper carries the pixel grid |
| `lifequest.css` | grey ramp + room variables per theme; dither/glow/star/flicker keyframes with `steps(1)`; pose visibility; swap animation system; hue-free palette |
| `lq-ui.js` | preview rigs mounted at pixel scale inside real `<svg>` holders |
| `tools/pixel-preview.js` | new: contract-checking rasteriser (grid, greys, skips) |
| `tests/lifequest.js` | `9.14`–`9.16` pixel contract; pose-aware part counts |

## 8. Size after the pass

Deferred LIFEQUEST modules + stylesheet: **170,674 B raw / 50,554 B gzipped**,
against the ≤ 96 KB gzipped ceiling the Phase-3 refactor set (see
`docs/LIFEQUEST-PHASE3.md` §5). The art pass added ~2 KB gzipped and removed
every gradient, filter and curve from the game.
