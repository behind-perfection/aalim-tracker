# Tests

No-browser boot + regression tests, using [jsdom](https://www.npmjs.com/package/jsdom).
They load the real files from this repository — nothing is mocked except the DOM.

```bash
npm i --no-save jsdom      # once
node tests/smoke.js        # 43 checks — tracker boot, navigation, forms, animations
node tests/lab.js          # 55 checks — Virtual Lab shell + experiment engines
node tests/lifequest.js    # 165 checks — LIFEQUEST integration (v98+)
```

Each script exits `0` when every check passes and `1` on the first failing run, and
prints `page problems:` for any console error, uncaught exception or jsdom error that
is not a known-benign "not implemented" note (`scrollTo`, `alert`, `confirm`, `print`).

If jsdom lives somewhere unusual, point `NODE_PATH` at it:

```bash
NODE_PATH=/tmp/smoke/node_modules node tests/lifequest.js
```

## Art contract

`node tools/pixel-preview.js <room> <anim> <minute> <theme> [scale]` rasterises
the shipped scene with the real stylesheet as palette and fails loud (via its
report) on any non-grey pixel or any element that is not an axis-aligned rect.
Suite checks `9.14`–`9.16` enforce the same contract headlessly: no curves,
circles, gradients or rounded corners; every scene coordinate on the 4-unit
grid; every stylesheet colour a true grey. See `docs/LIFEQUEST-PIXEL-ART.md`.

## What each suite guards

**`smoke.js`** — the app boots without the on-screen error bar; the vendored Supabase
bundle loads with no network; navigation renders; the hobby-idea edit form and the
hobby-block form never read each other's fields (the duplicate-id bug fixed in v87);
the v88 tab-open animations fire and clean themselves up.

**`lab.js`** — the Virtual Lab hub boots, the experiment registry and views render,
lab-store persistence survives a reload, and the chemistry/physics/biology engines
compute the values their UIs display.

**`lifequest.js`** — LIFEQUEST is additive and honest:

0. **lazy loading** — a tracker-only session downloads `lq-boot.js` and nothing else:
   no game module global exists, `lifequest.css` is not linked, yet the hub, its `9`
   shortcut, the search-palette entry and the placeholder page are all already there.
   Opening the page fetches the stylesheet and the 8 modules in dependency order,
   exactly once, and replaces the placeholder with the real UI;
1. the original eight hubs, their `1`–`8` shortcuts and all 26 pre-existing pages are
   untouched, and LifeQuest appears as hub 9 (sidebar, bottom bar, search palette);
2. the tracker's `state` stays **byte-identical** (minus `lq`) while every panel,
   animation preview and the game-only reset button are driven;
3. `state.lq` survives `normalize()`, `KEYS`, `LQMerge`, `mergeState()`,
   `backupPayload()` and a real restore through the app's own `importData()`;
4. the binding academic-desk rule — every academic subject is studied seated at the
   same desk with that subject's own materials, chemistry theory never goes to the
   laboratory, astronomy/geography/maths theory never goes to the observatory;
5. only a real Virtual Lab experiment reaches the laboratory;
6. non-academic routing (garden, sanctuary, city, workshop, bedroom, library, screen);
7. live sync from the real focus and reading timers, with the exact clock;
8. strict timeline honesty — exact times only where they are really known,
   amount-only records are never positioned, untracked time is idle;
9. renderer layers, per-subject prop swap, unchanged desk geometry;
10. unbuilt environments stay honest instead of being faked;
11. accessibility and performance gating (reduced motion, ambient, pause, visibility),
    idempotent milestone awards, no `alert()`, game-only reset;
12. `APP_VERSION` and `sw.js` agree, and every new asset is precached;
13. every existing page still renders afterwards;
14. **Phase 3 evidence depth** — homework, ticked plan items, mistake analyses,
    Feynman explanations, question-bank practice, test marks, completed exams,
    project notes and tests, business log, weekly reviews, prayers, meals and
    claimed rest days all surface as records; the live pomodoro is classified
    through the tracker's own `resolveTarget()`; zero-duration markers never add
    minutes to any total; and the only tracker write reachable from the game is
    the host's own `renderHof()` badge stamp, reproduced by tracker-only navigation.

Add a check the same way in any suite: `ok("name", condition, optionalDetail)`.
