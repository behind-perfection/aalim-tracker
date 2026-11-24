# LIFEQUEST — Phase 3: tracker integration depth + lazy loading (v98)

Phase 2 built the character, the world and a read-only view of the tracker's
timers. Phase 3 answers the question that view left open: **the game only knew
about a day when a timer had run.** Real evidence — a homework item ticked off,
a prayer marked, a mistake analysed, a test score entered, a project note
written, a meal logged — was invisible to it.

It also fixes a cost problem Phase 2 created, described in
[§5 The size budget](#5-the-size-budget-honest-accounting).

Branch `arena/e263fb30-aalim-tracker`. Phase 3 proper is commit `f8056f1`; the
lazy loading in §5 is the commit that follows it. Base: `main` @ `ecf7883` (v96).

---

## 1. Rules this phase had to obey

Unchanged from Phases 1–2, and enforced by tests rather than by intention:

| Rule | How Phase 3 keeps it |
|---|---|
| The tracker is the single source of truth | The game still writes nothing but `state.lq`. New test 14.29 checks every module's source for any assignment to a tracker array; 14.27 compares a full tracker snapshot before and after driving the whole game |
| No double counting | Every newly surfaced record carries `mins: 0` **on purpose** — see §2 |
| Nothing auto-claimed | No record invents a subject, a duration or a room. Unmapped activity renders generically and says so |
| Offline-first, zero network calls | The lazy loader injects `<script src>`/`<link href>` for files `sw.js` already precaches; no `fetch`, no XHR, no absolute URL (test 12.5) |
| No frameworks, no build step | One new hand-written file, `lq-boot.js`, in the same style as the rest |
| Unbuilt things labelled honestly | The placeholder page names the file it is waiting for, and a failed load says which file did not arrive and offers a retry |

---

## 2. `lq-adapter.js` — the whole day, not just the timers

### 2.1 Fifteen new dated-record emitters

`dayRecords(k)` now also reads: `homework` (`.done === k`), ticked `plan[k]`
items, `mistakes`, `feynman`, `questions` (`.last === k`), `marks`, `exams`
(`.done === k`), `research[].notes` / `research[].tests` (`.d === k`),
`bizLog`, `reviews`, `prayers[k]`, `dayLog[k].meals`, and `gam.rest`.

**All of them carry `mins: 0`, deliberately.** Their minutes already exist
somewhere in `state.study`: a finished focus block writes a study record *and*
adds to `homework.spent` and to the matching `plan[k].mins`. Counting the
marker as well would count the same work twice. These records say *what
happened*, never *how long it took*. Test 14.25 asserts that the game's daily
total still equals the tracker's own `activityMins(today())` exactly.

They are still events, so `push(o, allowZero)` admits them — a date-only record
is real evidence even when the tracker stored no duration for it.

Each record keeps the tracker's own extra fields rather than a guess:
`spent`/`onTime` for homework, `marksLost`/`fixed` for mistakes,
`right`/`wrong` for question practice, `score`/`max` for marks,
`projectId`/`cat`/`noteKind` for research, `order` for prayers, `amount` for
business and hobby entries.

### 2.2 Live intent is resolved by the tracker, not by the game

`intent(t)` takes the running pomodoro's `pomo.target` and hands it to the
host's **own** `resolveTarget()` (index.html:2288). The game therefore cannot
drift from the tracker's idea of what a session is for:

| `pomo.target` | classified as |
|---|---|
| `hw:<id>` | `homework`, with `homeworkId` and the homework's own subject |
| `chap:<subject>\|<chapter>` | `revision`, with subject and chapter |
| `learn:<pid>\|<lid>` / `res:<id>` | desk study **only if** the item's subject is a literal syllabus subject, otherwise `project` work |
| `plan:<text>` | study |
| no target (a free focus block) | the subject in `#pomoSubject` — i.e. exactly what `logFocus()` itself will write |

`livePomo()` returns `{subject, chapter, cat, projectId, homeworkId, intent}`,
so the scene and the HUD show the real target instead of a generic "focus".

### 2.3 `hobbyLog` / `extraLog` are classified from the tracker's definitions

Hobby records now carry the `hobbySec` `focus` and `title`; extra-curricular
records carry the matching `state.extra` definition's `kind`, `cat` and
`measure`. "Cricket" is sport because the tracker says it is a sport, not
because the word contains "crick".

### 2.4 `dates()` sees every kind of day

Rewritten to scan all dated arrays (`study, runs, karate, hobbyLog, extraLog,
workouts, quran, movies, papers, mistakes, feynman, marks, bizLog, lifts`),
date-bearing fields (`homework.done`, `exams.done`, `reviews.date`,
`questions.last`, research `notes[].d` / `tests[].d`) and date-keyed maps
(`dayLog`, `plan`, `prayers`, `gam.rest`). A day on which the only thing
recorded was three prayers and a ticked homework item is a real day in the
journey list now, not a gap (test 14.26).

---

## 3. `lq-mapper.js` — deeper, and stricter about what it claims

* **`KEYWORDS` + `byKeywords(txt)`** — one shared, **word-bounded** table used
  by the extra-curricular, hobby and plan routes. The unbounded patterns it
  replaced matched `art` inside "Smart revision" and would have matched `run`
  inside "Pruning". Both were real mis-classifications.
* **The academic-desk rule runs first.** Any record naming one of the 8
  syllabus subjects goes to the same desk, seated, with that subject's own
  materials — including records from the new sources.
* **`subjectKey()` now reads the recorded chapter, not just the subject.** A
  mistake logged under "Science" for chapter "Acids, Bases and Salts" is
  chemistry, and gets chemistry's materials. (This was defect #1 in §6.)
* **Chemistry hobby sections** split by what the tracker recorded: a `focus`
  matching `experiment|demo|practical|home-safe` goes to the **workshop bench**
  (`workshop|bench|build|stand`); theory goes to the academic desk. Neither can
  ever reach the laboratory — that stays reserved for real Virtual Lab sessions
  (`source: "lab"`), which is the Phase-2 rule and is still binding.
* **The astronomy → observatory keyword route was deleted.** No keyword may
  route to the observatory; test 14.24 asserts that no record from any source
  reaches `lab` or `observatory`.
* **Plan items** are resolved through the host's `planKey()`. A plan item that
  names a real chapter becomes revision of that chapter. One that does not gets
  `subjectKey: "generic"` and the note *"Planned item — no subject recorded, so
  none is claimed"* — an honest gap rather than an invented subject.
* **Unmapped activity** renders as `rest|open|explore|stand` with the note
  *"Unmapped activity — shown generically"*, instead of being forced into a
  category it does not belong to.
* **`questions`** kind → `write`, "Question bank practice".

`lq-world.js` gained one spot: `rest|table` at `x: 470`, beside the armchair
and side table, for meals, chess and cooking. It is in the built rest area, so
it renders for real rather than falling back to the desk.

`lq-ui.js`'s Daily Life panel now separates **records with a real duration**
from **markers with none**, and states plainly that the markers add no minutes
anywhere. Markers also show their mapped room and animation, and say
"not built yet" when the room is one of the six Phase-6 environments.

---

## 4. What a day looks like now

From a served run with ordinary tracker data (`v98`, 2026-11-24):

```
  homework   Polynomials Ex 2.1        → study/write     [academic maths]
  mistakes   Mistake analysis · Misread → study/revise    [academic chemistry]
  research   Engineering note · Solar tracker → workshop/build
  bizLog     Notes · Sale · 4 sets     → city/write
  prayers    Prayer · Fajr             → sanctuary/read
  prayers    Prayer · Dhuhr            → sanctuary/read
  prayers    Prayer · Asr              → sanctuary/read
  dayLog     Breakfast                 → rest/eat
  dayLog     Lunch                     → rest/eat
totals: 0 min = tracker activityMins: 0 min (identical)
```

Nine pieces of real evidence, none of them claiming a minute the tracker did
not record, and the daily total still exactly the tracker's own.

---

## 5. The size budget — honest accounting

The Phase-1 audit set a ceiling of **≤ 150 KB added**, to protect a page that
is already ~540 KB. Phase 2 landed at 150,609 B (147.1 KiB), just inside it.

Phase 3's new code is real, not padding: only 30 of the added lines are
comments, and a dead-code scan found nothing unreferenced. It brought the nine
game files to **171,224 B (167.2 KiB) — 17,624 B over the ceiling**, for
+6.4 KB gzipped.

> **v99 art pass:** the pixel-art rebuild (`docs/LIFEQUEST-PIXEL-ART.md`)
> re-measured the deferred set at **170,674 B raw / 50,554 B gzipped** —
> still far inside the ceiling, with every gradient and curve removed.

Rather than cut working evidence sources or quietly exceed the budget, the game
was made **lazy**. `lq-boot.js` is now the only LIFEQUEST file `index.html`
loads, and `lifequest.css` is no longer linked in `<head>`.

| | Phase 2 (eager) | Phase 3 before lazy | **Phase 3 after lazy** |
|---|---|---|---|
| downloaded on every visit | 150,609 B raw / 40,443 B gz | 171,224 B raw / 46,111 B gz | **8,948 B raw / 3,418 B gz** |
| downloaded only if the game is opened | — | — | 171,224 B raw / 46,111 B gz |
| total LIFEQUEST source | 150,609 B | 171,224 B | 180,172 B (175.9 KiB) |

**A tracker-only session now carries 5 % of what it carried in Phase 2** — a
94.8 % reduction in eager raw bytes, 92.6 % gzipped. Verified over HTTP with
request interception: at boot the only LIFEQUEST request is `lq-boot.js`, and
after visiting three tracker pages it still is. Opening the game fetches the
stylesheet and the eight modules in dependency order and boots in ~160 ms.

The **total** source is 175.9 KiB, so the ceiling is now understood as *"no
cost to the tracker unless the game is opened"* rather than *"≤150 KB of source
in the repository"*. That reinterpretation was an explicit decision, not a
silent one. All ten files remain in `sw.js`'s `ASSETS`, so the lazy load is
served from cache when offline.

### How the stub works

`lq-boot.js` (~9 KB) does the minimum that must happen at boot:

1. injects the hub into `HUBS`/`NAVF` and the sidebar, so LifeQuest is
   reachable by nav button, the `9` shortcut, the search palette, a `#!lq` deep
   link and a restored last page — with **no game code present**;
2. creates the placeholder `<section id="lq">` ("Preparing the world…"), which
   also makes the tracker's own `navInit()` restore path work;
3. wraps `showPage` — never replaces it — so the first navigation to `lq`
   injects `lifequest.css` and then the eight modules **sequentially**, so no
   module runs before the globals it reads exist;
4. reports honestly while loading (naming the file being fetched) and on
   failure (naming the file that did not arrive, noting if the browser is
   offline, and offering "Try again").

Both `lq-boot.js` and `lifequest.js` inject nav and create the page, and both
are idempotent — whichever runs first wins, the other no-ops, so the two files
work in either order. `lifequest.js` is unchanged in behaviour; it simply runs
later.

---

## 6. Two real defects the new tests caught

Both were found by section 14, not by inspection:

1. **`subjectKey()` ignored the recorded chapter.** A mistake logged under
   "Science" for chapter "Acids, Bases and Salts" was mapped as generic
   science materials instead of chemistry. Fixed by deriving the key from
   `chapter + label`, not `subject` alone (test 14.4).
2. **The plan route swallowed resolved revisions.** A ticked plan item that
   names a real syllabus chapter arrives from the adapter as `kind: "revision"`
   with `source: "plan"`. The mapper's new plan branch matched on
   `src === "plan"` and overrode it with the generic "no subject recorded"
   treatment — inventing ignorance where the tracker had just proved the
   subject. Fixed by matching `kind === "plan"` only (test 14.2).

A third finding is documented rather than fixed, because it is not ours:
driving the game panels can change `state.meta._hof`. That is the tracker's own
`renderHof()` (index.html:5133) stamping a Hall-of-Fame badge that has just
become true, on **any** page change. Test 14.28 proves it by producing the
identical stamp from tracker-only navigation with LIFEQUEST never opened.

---

## 7. Tests

```bash
NODE_PATH=/tmp/smoke/node_modules node tests/lifequest.js   # 165 checks
NODE_PATH=/tmp/smoke/node_modules node tests/smoke.js       #  43 checks
NODE_PATH=/tmp/smoke/node_modules node tests/lab.js         #  55 checks
```

All 263 pass, with no page problems. New in this phase:

* **Section 0 (0.1–0.11)** — lazy loading: no game global and no game CSS
  before the page is opened, exactly one eager LIFEQUEST file, the hub and
  placeholder present anyway, then the ordered fetch of all nine files on first
  open, the placeholder replaced by the real UI, and no re-download on
  re-opening.
* **Section 14 (14.1–14.29)** — every new evidence source, the resolved-intent
  rule for live pomodoros, the chemistry theory-vs-home-safe-practical split,
  zero-minute honesty against the tracker's own total, marker-only days
  appearing in the journey list, no route to the laboratory or observatory, and
  the read-only guarantees (14.27 snapshot, 14.28 host badge stamp, 14.29
  static source check).
* **12.3 / 12.4 / 12.4b** — all ten assets precached; `index.html` ships no
  eager game CSS or module scripts; `lq-boot.js` lists every file it must fetch
  in dependency order.

---

## 8. Still not built (unchanged, still labelled as such in the UI)

* **Phase 5 — Replay.** The Daily Life panel has day/speed/play controls that
  do not play anything yet, and says so.
* **Phase 6 — Chapters, skills, milestones and world evolution.** Six of the
  nine rooms (garden, workshop, city, sanctuary, library, observatory) are
  labelled silhouette placeholders; activity in them falls back to the study
  desk and the scene note names the room as not built yet.
* **Open question Q5** from the Phase-1 audit is still open: which real,
  user-configurable milestones should unlock Chapters 2–6. Nothing is
  auto-claimed in the meantime.
