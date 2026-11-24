# LIFEQUEST — Phase 2: Character + World (v97)

Implementation and test report for Phase 2 of Project LIFEQUEST.
Phase 1 (read-only audit) is in [`LIFEQUEST-PHASE1-AUDIT.md`](./LIFEQUEST-PHASE1-AUDIT.md).

**Status: complete and tested.** 222 automated checks pass (124 LifeQuest + 55 Virtual Lab + 43 tracker smoke), plus a manual pass against the *served* app.

---

## 1. What Phase 2 delivers

A peaceful 2D life-simulation inside Command Centre. One anonymous character in a
rendered world who **only ever performs activities the user has actually recorded**.

| Capability | State |
| --- | --- |
| One consistent character (single SVG rig, fixed proportions) | ✅ |
| 26 reusable animation states + smooth transitions | ✅ |
| Cosmetics that never break recognisability (6 skins, 8 outfits, 9 accessories) | ✅ |
| Per-subject study materials on the desk (14 prop sets) | ✅ |
| Built world: 3 of 12 rooms — study desk, bedroom, rest area — with day/night sky, sun/moon arc, ambient motes/stars/clouds | ✅ |
| Camera, RAF loop gated on visibility + activity | ✅ |
| Read-only tracker adapter (live timers, day records, schedule, sleep) | ✅ |
| Activity → behaviour mapper implementing the binding academic-desk rule | ✅ |
| Daily timeline (strict honesty: real clock time only when it is really known) | ✅ |
| 8 UI panels (World, Character, Daily Life, Map + 4 honest Phase 5/6 previews) | ✅ |
| Game-only persistence in `state.lq`, riding existing backup/import/export/sync | ✅ |
| Both themes, desktop sidebar, mobile bottom bar, `prefers-reduced-motion`, pause/reduce controls | ✅ |
| Replay engine (adjustable speed, any past date) | ⏳ Phase 5 |
| Chapters 2–6, skill trees, milestone editor, world evolution | ⏳ Phase 6 |

Nothing in Phase 2 writes to a tracker record. Nothing is logged twice. There is no
XP decay, no punishment for inactivity, and no reward for merely opening a tab.

---

## 2. Architecture as built

The user-approved shape: **tracker records = source of truth**, an adapter reads them,
a mapper turns them into behaviour, a character engine renders it, and only
game-specific data is stored (in `state.lq`).

```
tracker (state.*, pomo, rt, aalimLabStore)     ← never written by the game
        │  read-only
   lq-adapter.js   dkey/live/dayRecords/schedule/sleepOf/snapshot/mastery/totals
        │  real events
   lq-mapper.js    map(event) → {room, spot, anim, pose, subjectKey, props, kind, source}
        │  mapped activity
   lq-world.js     scene(mapped) → {back, front, ambient, place, sky, lampOn, note}
   lq-character.js rig()/apply()/deskProps()   one SVG figure + per-subject desk props
        │
   lq-render.js    5 SVG layers + RAF loop (only while active && visible && !livePaused)
        │
   lq-ui.js        8 lazy panels      lifequest.js  boot, nav injection, wrappers, polling
        │
   lq-store.js     state.lq (persisted with the tracker) + aalimLifeQuestUI (local cosmetics)
```

### Files added (9)

| File | Bytes | Role |
| --- | --- | --- |
| `lq-store.js` | 10.2 KB | `state.lq` schema, `norm`, `LQMerge` for `mergeState()`, idempotent `award(ref)` |
| `lq-adapter.js` | 15.5 KB | read-only view of tracker data, live timers, day records, strict timestamp classes |
| `lq-mapper.js` | 17.7 KB | activity → room/spot/animation/props; the binding academic-desk rule |
| `lq-character.js` | 17.4 KB | the rig, 26 animation states, cosmetics, 14 subject prop sets |
| `lq-world.js` | 17.0 KB | 960×540 scene builders, sky/sun/moon, spots, honest "not built yet" scenes |
| `lq-render.js` | 9.8 KB | layer mounting, RAF gating, camera zoom, activity application |
| `lq-ui.js` | 24.5 KB | the 8 panels and their event handling |
| `lifequest.js` | 9.4 KB | boot, hub/nav injection, non-replacing wrappers, storage/visibility listeners |
| `lifequest.css` | 29.2 KB | theme-token styling + every keyframe set + reduced-motion kill switches |

Total added: **150,609 bytes (147 KiB), 44,534 bytes gzipped** — inside the ≤150 KB budget
set in the audit (sizes above are decimal KB, as `wc -c` reports them). No framework,
no build step, no external asset, no network request — `fetch`, `XMLHttpRequest` and
`alert()` appear nowhere in the game layer (asserted by test 11.11).

### Existing files changed (2, additive only)

`index.html` — 14 insertions, 4 deletions (`git diff --numstat`), all additive:

1. `<link rel="stylesheet" href="lifequest.css">` after the closing `</style>`.
2. `KEYS` gains `"lq"` so backups/imports validate and survive.
3. `normalize()` gains `lq: O(x.lq)` — **critical**: `normalize()` returns an explicit
   literal and runs on every `loadState()`, `applyRemote()` and `cloudApplyRow()`, so an
   unregistered top-level key would be silently deleted.
4. `mergeState()` gains `lq: (typeof LQMerge === "function" ? LQMerge(a.lq, b.lq) : …)` —
   the default merge JSON-dedupes arrays and `Object.assign`s objects, which would
   duplicate milestones and lose counters.
5. Eight `<script src>` tags before `</body>` (after every existing inline script).
6. `APP_VERSION` `v96` → `v97`.

`sw.js` — 11 insertions, 2 deletions: `CACHE` → `aalim-tracker-v97`, and all 9 new files added to `ASSETS`.
(`cache.addAll()` rejects the whole install on a single 404, so the CSS file had to
exist before it was listed.)

Not one line of existing tracker logic was rewritten, moved or deleted.

---

## 3. The binding academic-desk rule

Whenever the user does academic work the character **stays seated at his study desk**
and studies **that exact subject**; only the materials on the desk change.

| Real activity | Room | Pose | Animation | Desk props |
| --- | --- | --- | --- | --- |
| Mathematics / Polynomials | study | sit | `study` | textbook + notebook + ruler, equations on paper |
| Science → Chemistry (theory) | study | sit | `study` | chemistry text + periodic table card |
| Science → Physics (theory) | study | sit | `study` | physics text + diagram sheet |
| Science → Biology | study | sit | `study` | biology text + diagram |
| Geography / History / Economics / Political Science / English / Hindi / IT | study | sit | `study`/`read`/`write` | that subject's books and documents |
| Revision | study | sit | `revise` | flashcards + notes for the revised subject |
| Mock test / past paper | study | sit | `exam` | question paper + answer sheet |
| **Virtual Lab experiment** (only real practical work) | **laboratory** | stand | `experiment` | bench + apparatus |

Enforced explicitly, and asserted per subject by tests 4.x–5.x:

* Chemistry theory **never** routes to the laboratory; astronomy/geography/maths theory
  **never** routes to the observatory.
* No practical animation (`experiment`) is produced for theoretical academic study.
* The same desk geometry is reused for every subject: the back layer is byte-identical
  between subjects and only `.lq-deskprops` changes (tests 9.4–9.7).
* Reading a book whose subject is *literally* a tracked syllabus subject counts as desk
  study; any other book (Literature, Philosophy, Self-help…) is reading in the library —
  we do not guess.

---

## 4. Root causes found by testing, and the fixes

The first run of the new suite was 105/117. Every failure was diagnosed; five were real
code defects, the rest were fixture bugs in the new test file itself.

| # | Symptom | Root cause | Fix |
| --- | --- | --- | --- |
| 1 | `break` and `idle` produced the identical animation | one combined `break \|\| idle` branch in the mapper | split into two branches: `break` → anim `rest`, `idle` → anim `idle` (both rest area, seated) |
| 2 | A Literature book sent him to the study desk | `subjectKey("Literature")` fuzzy-matched `English – Language & Literature` from the real syllabus | new `exactSubject()` — reading counts as desk study only on an exact syllabus-subject match; everything else stays in the library |
| 3 | LifeQuest missing from the desktop sidebar in the served app | `navInit()` builds `#side` **once** from `HUBS` and is scheduled with `setTimeout(…,0)`, which can fire while the parser is still fetching our external `<script src>` files — so the sidebar was built from 8 hubs before the 9th was pushed, and `navSync()` only toggles `.on`, it never rebuilds | new idempotent `syncSidebar()` in `lifequest.js`: called at boot, retried at 60/400/1500 ms, and called from the `showPage` wrapper, so both load orders end correct; also updates the palette hint to "Keys: 1–9 tabs" |
| 4 | Qur'an pages, past papers and lift sets never appeared as events | the adapter dropped any record without a positive `mins`, but these carry an *amount* instead of a duration | `push(rec, allowZero)` — they are real events, still flagged `exact:false` so they are never given a clock position |
| 5 | No game-only reset control (a stated requirement) | not implemented | `LQStore.reset(scope)` + a "Reset appearance & preferences" button in the Character panel; clears cosmetics and preferences only, keeps milestones/journal/`seen`, never touches a tracker record |

Test-side fixes (no product change): reset `pomo`/`rt` hard before "no live signal"
assertions; set an explicit activity before asserting study-room DOM; assert a stable
*core rig* subset for proportions instead of total node count; call `localStorage` at
the top level of an eval string instead of inside an IIFE (jsdom loses global scope);
register `state.extra` with `kind:"karate"` before pushing an `extraLog` row so the
tracker's own de-duplication rule (`kindNames()`) actually applies.

---

## 5. Tests performed

```bash
NODE_PATH=/tmp/smoke/node_modules node tests/lifequest.js   # 124/124
NODE_PATH=/tmp/smoke/node_modules node tests/lab.js         #  55/55
NODE_PATH=/tmp/smoke/node_modules node tests/smoke.js       #  43/43
```

All three exit 0 with **page problems: none** (no console error, no uncaught exception,
no jsdom error other than the known-benign `scrollTo`/`alert` "not implemented" notes).

`tests/lifequest.js` (new, 124 checks) covers, in order:

1. boot safety and navigation — the original 8 hubs and their `1`–`8` shortcuts intact,
   LifeQuest added as hub 9 with key `9`, sidebar/bottom bar/palette correct and
   idempotent, all 26 pre-existing pages still present;
2. the tracker is never written to by the game (byte-identical `state` minus `lq`
   while driving every panel, every animation preview and the reset button);
3. `state.lq` survives `normalize()`, `KEYS`, `LQMerge`, `mergeState()`,
   `backupPayload()`, and a **real restore through the app's own `importData()`**;
4. the binding academic-desk rule for 11 subjects, each with distinct props;
5. practical work reaches the laboratory only from the Virtual Lab;
6. non-academic routing (garden, sanctuary, city, workshop, bedroom, library, screen);
7. live synchronisation from the real focus and reading timers, with the exact clock;
8. strict timeline honesty — exact time only from live timers, `study[].h`, `dayLog` and
   `dayCfg`; amount-only records are listed but never positioned; untracked time is idle;
9. renderer layers, subject prop swap, unchanged desk geometry, seated occlusion;
10. unbuilt environments stay honest (labelled "arrives in Phase 6", never faked);
11. accessibility and performance gating — reduced motion, ambient toggle, pause live,
    page-leave and `document.hidden` stop the RAF loop, cosmetics persisted in game data
    only, proportions constant, previews record nothing, milestones cannot be awarded
    twice for the same evidence, no `alert()`, game-only reset;
12. version and service-worker assets — `v97` in both files, all 9 files precached;
13. every existing page still renders after all of the above.

### Served-app pass (`python3 tools/preview-server.py 8000`)

Verified over HTTP, not just from source: all 11 assets return 200; the app boots to
`v97` with 9 hubs and all 8 modules ready; the sidebar lists
`home,study,revise,create,progress,life,lab,set,quest`; `openHub('quest')` activates
`#lq` and highlights correctly; chemistry theory maps to `study/sit/chemistry`;
live focus-timer sync drives `data-anim="study"`, `data-pose="sit"` and the maths desk
props with the real clock in the HUD; cosmetics and preferences survive a full reload
(same `localStorage`); the game-only reset works and leaves the tracker byte-identical;
all 26 existing tabs still render; no page errors.

---

## 6. Guarantees held

* **Tracker is the single source of truth.** The game reads `state.*`, `pomo`, `rt` and
  `aalimLabStore`; the only write path is `state.lq` through `LQStore.mutate()`.
* **No double logging.** No game action creates a study/run/karate/reading record.
  Activity is *observed*, never re-entered.
* **No double rewards.** `award(ref)` is idempotent against `seen[ref]`, with refs
  derived deterministically from real evidence (`book:<id>`, `chapter:<Subject>|<Chapter>:<Status>`,
  `review:<date>`, `lab:<expId>#<seq>`).
* **No punishment for inactivity.** Idle time is rendered as resting; nothing decays,
  nothing is lost, no negative value exists anywhere in the schema.
* **Nothing auto-claimed.** Chapters 2–6 are narrative; degrees, jobs and positions are
  never asserted. Unlock thresholds arrive in Phase 6 as user-editable milestones.
* **Offline first.** Zero network calls; everything precached by `sw.js`.
* **Reliability over spectacle.** One RAF loop, running only while the page is visible
  and active; SVG layers rebuilt only on room change; ≤150 KB added.

---

## 7. Known limitations (by design, declared in the UI)

* Nine of the twelve room keys — Library, Laboratory, Academy, Observatory, Workshop,
  City, Garden, Sanctuary and the screen room — are *declared but not built*. Only the study,
  the bedroom and the rest area exist in Phase 2. Selecting one shows an honest placeholder naming the phase
  that will build it; the character is never pretended into a room that does not exist.
  The laboratory becomes reachable in Phase 6 together with world evolution.
* Replay (adjustable speed, any past date) is Phase 5; the Daily Life panel already
  lists real dates and real records, and says playback is not wired yet.
* Skill trees, milestones editor, chapters and collectibles show real tracker totals
  with a "Phase 6" label rather than fabricated ratings.
* `resetAll()` in Settings clears the whole tracker payload and therefore also
  `state.lq`. Use the Character panel's game-only reset for cosmetics and preferences.

## 8. Next phase

Phase 3 — tracker integration and activity mapping depth: homework/plan intent,
project and research work, exam and paper sessions, hobby blocks, and the workshop /
city / garden routing that depends on them. Phase 2's mapper is the extension point;
no existing behaviour needs to change.
