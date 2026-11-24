# Tests

No-browser boot + regression tests, using [jsdom](https://www.npmjs.com/package/jsdom).
They load the real files from this repository — nothing is mocked except the DOM.

```bash
npm i --no-save jsdom      # once
node tests/smoke.js        # 43 checks — tracker boot, navigation, forms, animations
node tests/lab.js          # 55 checks — Virtual Lab shell + experiment engines
node tests/lifequest.js    # 124 checks — LIFEQUEST integration (v97+)
```

Each script exits `0` when every check passes and `1` on the first failing run, and
prints `page problems:` for any console error, uncaught exception or jsdom error that
is not a known-benign "not implemented" note (`scrollTo`, `alert`, `confirm`, `print`).

If jsdom lives somewhere unusual, point `NODE_PATH` at it:

```bash
NODE_PATH=/tmp/smoke/node_modules node tests/lifequest.js
```

## What each suite guards

**`smoke.js`** — the app boots without the on-screen error bar; the vendored Supabase
bundle loads with no network; navigation renders; the hobby-idea edit form and the
hobby-block form never read each other's fields (the duplicate-id bug fixed in v87);
the v88 tab-open animations fire and clean themselves up.

**`lab.js`** — the Virtual Lab hub boots, the experiment registry and views render,
lab-store persistence survives a reload, and the chemistry/physics/biology engines
compute the values their UIs display.

**`lifequest.js`** — LIFEQUEST is additive and honest:

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
13. every existing page still renders afterwards.

Add a check the same way in any suite: `ok("name", condition, optionalDetail)`.
