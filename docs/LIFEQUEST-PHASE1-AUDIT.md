# PROJECT LIFEQUEST — Phase 1: Architecture Audit

**Status:** Phase 1 complete. **No application code was modified** during this audit.
**Audited at:** `main` = `ecf7883` (v96, PR #6 merged) on branch `arena/e263fb30-aalim-tracker`.
**Method:** static inspection of `index.html`, `chemlab.html`, `sw.js`, `cloud-config.js`, `labstore.js`, `tests/*`.

Purpose: establish exactly where LIFEQUEST can attach to Command Centre **without touching tracker behaviour**, and what real data it may mirror.

---

## 1. Application inventory

| File | Lines | Bytes | Role |
|---|---|---|---|
| `index.html` | 5,506 | 540,428 | Entire tracker: markup, CSS, one giant inline `<script>` (starts line 478), plus a final bolt-on `<script>` (line 5484) |
| `chemlab.html` | 1,770 | 174,969 | Virtual Lab shell (loaded in an iframe) |
| `chemcore.js` `physcore.js` `biocore.js` | — | — | Calculation engines (untouched by v94–v96) |
| `labstore.js` `labreg.js` `labui.js` `labphysx.js` `labiox.js` `labchemx.js` `labviews.js` | — | — | Lab persistence, registry, UI kit, experiment modules, workspace views |
| `sw.js` | 104 | 3,936 | Service worker: cache `aalim-tracker-v96`, `ASSETS[]`, self-update |
| `cloud-config.js` | — | — | Public Supabase URL + publishable key |
| `supabase-2.119.0.js` | — | — | Vendored Supabase UMD (global `supabase`) |
| `manifest.webmanifest`, `icon-192/512.png` | — | — | PWA shell |
| `tests/smoke.js` (43 checks), `tests/lab.js` (55 checks) | — | — | jsdom suites, `NODE_PATH=/tmp/smoke/node_modules` |

**Script load order in `index.html`:** head inline script (line 6, raw-data rescue) → `supabase-2.119.0.js` (475) → CDN fallback (476) → `cloud-config.js` (477) → **main inline app script (478–5483)** → **bolt-on inline script (5484–5505)**.

---

## 2. The integration precedent that LIFEQUEST must follow

The last script block (line 5484) is the app's existing pattern for adding a whole feature **without editing the core**:

```js
(function(){
  function init(){
    const sec=document.createElement("section"); sec.id="vlab"; sec.className="page";
    sec.innerHTML='<div class="card" …><iframe id="vlabFrame" …></iframe></div>';
    document.querySelector("main").appendChild(sec);
  }
  if(window.safeRun) safeRun(init); else init();
  const sp=window.showPage;
  window.showPage=function(id){ sp.apply(this,arguments); if(id==="today")aiReveal(); if(id==="vlab"&&…){…} };
})();
```

Three techniques proven safe here:

1. **Create the `<section class="page">` at runtime** and append to `<main>` — no edit to the static markup.
2. **Wrap `window.showPage`** to run extra behaviour on navigation.
3. **Use `safeRun(fn)`** (line 4248) so a LIFEQUEST failure can never break boot.

> **Decision A (recommended):** LIFEQUEST ships as external files (`lifequest.css`, `lifequest.js`, and later `lq-*.js` modules) added to the end of `<body>` — after the bolt-on script — registered in `sw.js ASSETS`. The only edits inside `index.html` are (a) the `<link>`/`<script>` tags and (b) the hub entry in `HUBS`. Everything else is additive and monkey-patched.

---

## 3. Navigation architecture

```js
const HUBS = [                                  // line 4901
  {id:"home",   ic:"🏠", l:"Home",      k:"1", pages:[["dashboard","Dashboard"],["today","Today"],["calendar","Calendar & Trends"]]},
  {id:"study",  ic:"📖", l:"Study",     k:"2", pages:[study, syllabus, exams, homework, practice, paper]},
  {id:"revise", ic:"🧠", l:"Revise",    k:"3", pages:[flash, mistakes, feynman]},
  {id:"create", ic:"🛠️", l:"Create",    k:"4", pages:[research, library, movies, biz]},
  {id:"progress",ic:"📊",l:"Progress",  k:"5", pages:[analytics, report, tasks, review, hof]},
  {id:"life",   ic:"💪", l:"Life",      k:"6", pages:[workout, lift, deen, extra]},
  {id:"lab",    ic:"🧪", l:"Virtual Lab",k:"7", lock:LAB_LOCKED, pages:[["vlab","Virtual Lab"]]},
  {id:"set",    ic:"⚙️", l:"Settings",  k:"8", pages:[["settings","Settings"]]}
];
const NAVF = HUBS.flatMap(h => h.pages.map(([id,l]) => ({id, ic:h.ic, l, g:h.l, h:h.id, lock:!!h.lock})));
let curPage = "dashboard";
```

| Function | Line | Notes for LIFEQUEST |
|---|---|---|
| `showPage(id)` | 605 | Removes `.active` from all `.page`, adds to `$(id)`, syncs `nav button.active`, calls **`renderAll()`**, scrolls to top, plays `fxPage(id)` |
| `window.showPage` wrapper | 5502 | Existing patch point — LIFEQUEST wraps **again** (chain is already proven) |
| `openHub(hid)` / `subStep(d)` | 4913/4914 | Hub → last-visited sub-tab (`aalimHubSub`) |
| `navInit()` | 4951 | Builds the desktop `#side` sidebar, `#curPg`, `#subtabs`, search button; injects a `<style>` at runtime |
| `menuRender()` / `menuOpen()` / `menuGo()` | 4919 / 4934 | `Ctrl+K` palette, built from `NAVF` |
| `FX_PAGE` / `fxPage(id)` | 659 | Per-tab SVG "stinger" animation; `.stinger` is `pointer-events:none` |
| `safeRun(fn)` | 4248 | try/catch wrapper used for every boot step |

**26 pages exist:** 25 static `<section class="page">` + `#vlab` created at runtime. `curPage` is the single source of truth for "which tab is open" — and it is *navigation only*, never an activity signal (§6).

**Where LIFEQUEST goes:** a 9th hub `{id:"life2"|"quest", ic:"🌄", l:"LifeQuest", k:"9", pages:[["lq","World"],["lqchar","Character"],["lqmap","Map"],["lqday","Daily Life"],["lqskills","Skill Trees"],["lqmiles","Milestones"],["lqjournal","Journal"],["lqstats","Statistics"]]}` inserted **before** `set`, so `Settings` keeps hub key `8`… *or* appended after `set` with key `9`. **Open question Q1** (hub placement + whether sub-tabs are separate pages or one page with internal tabs — the world view wants maximum screen space, which argues for **one page + internal overlay panels**).

---

## 4. Data model — `localStorage["aalimTrackerV2"]`

```js
const STORAGE_KEY = "aalimTrackerV2";                          // line 553
const defaultState = () => normalize({});                      // 554
const KEYS = ["progress","study","tasks","extra","exams","marks","questions","feynman",
  "workouts","plan","extraLog","flashcards","mistakes","homework","lifts","library","quran",
  "prayers","dream","biz","bizLog","hof","goal10","movies","research","runs","karate",
  "karateNotes","hobbyCat","hobbyCfg","hobbySec","hobbyLog","dayLog","dayCfg","gam","papers","reviews"];  // 555
function normalize(x){ …returns an explicit object literal… }   // 557
function loadState(){ …migrates any older /^aalim/i key… }      // 573
function save(ns){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                     if(!ns){ syncMark(); cloudMarkLocalDirty(); } return true }
                   catch(e){ alert("The browser could not save tracker data…"); return false } }  // 591
```

### ⚠️ The single most important constraint

`normalize()` returns an **explicit object literal**. Any top-level key it does not list is **silently dropped** — and `normalize()` runs on every `loadState()`, on `applyRemote()` (folder sync, line 1396) and on `cloudApplyRow()` (Supabase, line 1755).

**Consequence:** if LIFEQUEST writes `state.lq = {…}` without registering it, the data dies on the next reload or sync. Therefore game data has exactly two viable homes:

| Option | Where | Syncs automatically? | Edits to core | Risk |
|---|---|---|---|---|
| **A (recommended)** | `state.lq` + add `"lq"` to `KEYS`, one clause to `normalize()`, one clause to `mergeState()` | ✅ Supabase, folder sync, export, import, merge, full backup — **all free** | 3 tiny surgical edits | Must write a correct `mergeLQ()`; `resetAll()` would clear it |
| **B** | separate `localStorage["aalimLifeQuest"]` | ❌ not carried by `cloudUploadLocal` (uploads only `JSON.stringify(state)`) | 0 core edits, but must patch `backupPayload`, `importData`, `cloudUploadLocal`, `cloudApplyRow` to satisfy acceptance #14/#15 | More patching, more chance of divergence between devices |

> **Decision B (recommended): Option A**, with the game's own `resetGame()` that clears only `state.lq` (satisfies §17 "reset game settings without deleting tracker data"), and `resetAll()` left untouched in behaviour but documented as also clearing `state.lq`.

### 4.1 Record shapes (verified from source — these are the mirror inputs)

| Array | Push site | Shape |
|---|---|---|
| `study` | 2393 (pomo log), 4302 (reading log), study-log form | `{date:"YYYY-MM-DD", mins, subject, type:<batch>, note, pomo?:1, rp?, rl?, h?:<hour>}` — reading sessions carry **`note:"📖 "+bookTitle`** and `subject: book.s||"Reading"` |
| `runs` | 2885 `saveRun()` | `{id, date, mins, steps, effort, note}` |
| `karate` | 2928 `kaSave()` | `{id, date, mins, focus, effort, note}` |
| `hobbyLog` | 3085 `sgSave()` | `{id, sec:<hobbySec id>, date, mins, focus, title, val, note}` |
| `extraLog` | 2798 | `{date, activity, mins, note, val}` |
| `workouts` | 2766 | `{date, mins, note}` |
| `lifts` | 1974 | `{date, ex, m, sets, reps}` |
| `quran` | 2023 | `{date, p:<pages/ayahs>, n:<note>}` |
| `movies` | 4740 | `{id, t:<title>, k:<kind>, d:<date>, m:<mins>, r:<rating>, n}` |
| `research` | 4789+ | `{id, title, q, subject, due, g, cat, wt, status, kind, learn[], parts[], tests[], chap[], chars[], hyp, plan, sources[], …}` |
| `papers` | 3483+ | `{id, date, subject, name, max, score, allowed, took, topics[]}` |
| `reviews` | 3510 `reviewSave()` | `{id, wk:"YYYY-MM-DD", win, hard, goals:[{t,done}], target, date}` |
| `mistakes` | 4065 `addMistake()` | `{id, date, subject, chapter, reason, lost, q, fix}` |
| `flashcards` | 3178 | `{subject, type, front, back, box, due, reviews, mid?}` |
| `feynman` | 2749 | `{topic, explain, gaps, status, date}` |
| `homework` | 2565 | `{id, subject, title, due, pri, est, note, status, done, spent, created}` |
| `tasks` | 856 | `{text, area, done, created}` |
| `library` | 2081 `addBook()`, 2071 `importReading()`, 4334 `addPdf()` | `{id?, t, a, ty, s, st:"To read"/"Reading"/"Done", l, n, lv?, file?}` |
| `hof` | 5079 | `{id, t, c:<category>, lvl, d:<date>, n}` |
| `biz` / `bizLog` | 2099 | `{n,d,st,a}` / `{date,v,t,a,n}` |
| `marks` | 2667 | `{date, subject, test, score, max}` |
| `questions` | 2694 | `{subject, chapter, type, marks, q, a, right, wrong, last}` |
| `exams` | 951 | `{id, name, date, topics[], link, type, done}` |
| `extra` | 878 | `{name, project, goal, hours, status, cat, measure, kind, catId, ms:[{t,done}]}` |
| `karateNotes` | 3587 `kgAdd()` | `{id, date, text}` |

### 4.2 Object-valued state

| Key | Shape / access |
|---|---|
| `progress` | `{"<Subject>\|<Chapter>": "<stage>"}` — stages from `statuses` (line 520): `Not Started, Reading NCERT, NCERT Done, Notes Made, NCERT Exercises, Extra Practice, PYQs & Samples, Revised, Mastered`. **This is the mastery evidence for skill trees and world evolution.** |
| `plan` | `{"YYYY-MM-DD": [{t, done, hw?}]}` — today's plan; `pomoTargets()` reads it |
| `dayLog` | `{"YYYY-MM-DD": {wake, bed, sleep?, idle:[{m}], water…}}` via `dayRec(k)` (3325) |
| `dayCfg` | `{school:{on,days,start:"08:00",end:"14:30"}, tuition:{on,days,start:"16:30",end:"18:00"}, blocks:[{id,start,mins,days}], sleepGoal}` via `dayCfg()` (3298) |
| `prayers` | `{"YYYY-MM-DD": {<prayer>:true}}` |
| `reader` | `{<bookId>: {page, hl:[highlights], mins, n?, mx?}}` via `rd(id)` (4270) |
| `gam` | via `G()` (3436): `{rest[], rewards[], claims[], cq[](commonplace quotes), kg[](karate goals), ch[](challenges), wd{}, bonus}` |
| `meta` | `{<chapterKey>:{flag, touched}, _readSeed:1}` |
| `dream`, `goal10`, `quotes`, `hobbyCat`, `hobbyCfg`, `hobbySec` | see §4.3 |
| `settings` | `{mid, board, weeklyGoal, theme:"light"/"dark", autoPlan, autoBreak, autoNext, sound, notify, wake:"06:00", sleep:"22:00"}` |
| `batches` | `["Udaan","Udaan Advanced","Business/AI","Extra-curricular","Other"]` |

### 4.3 Domains that drive LIFEQUEST content

* **Subjects** (`syllabus`, line 480): `Mathematics, Science, History, Geography, Political Science, Economics, Hindi B – स्पर्श, Hindi B – संचयन, Hindi B – व्याकरण, Information Technology 402, English – Language & Literature`.
* **Project categories** (`PC`, 4848): `Research 🔬`, `Engineering ⚙️`, `Novel`, plus `pcOf(cat)` fallback `other`. Each has its own status list and tabs.
* **Hobby sections** (`SEC_DEFAULT`, 3056): `draw 🎨 Drawing & Sketching`, `lang 🌍 Languages`, `chem 🧪 Real Chemistry`, `act 🎭 Acting` — each with `foc[]` focus areas, `ms[]` milestones, `tl`/`vl` labels. Users add more (`state.hobbySec.push`).
* **Challenges** (`CH_TPL`, 3595): e.g. `🎨 Draw every day for 14 days (draw)`, `🌍 Language practice`, `🥋 Karate basics, 10 days in 14`, `🏃 Run in place…`.
* **`kindNames(k)`** (2862): `state.extra.filter(x=>x.kind===k).map(x=>x.name)` — used by `activityMins()` to avoid double-counting karate/run entries logged in both `extraLog` and their dedicated arrays. **LIFEQUEST must reuse this exact de-duplication** (§11).

---

## 5. Other storage

### 5.1 `localStorage` keys (complete list)

| Key | Owner | LIFEQUEST relevance |
|---|---|---|
| `aalimTrackerV2` | main state | home of `state.lq` (Option A) |
| `aalimPomoV2` | `pomo` live timer | **live study signal** |
| `aalimReadT` | `rt` live reading timer | **live reading signal** |
| `aalimLabStore` | `LabStore` | **virtual-lab signal** (cross-document, see §7) |
| `aalimSyncMeta` | folder-sync meta `{lastSync,dirty,…}` | |
| `aalimSupabaseSyncMeta` | `CLOUD_META_KEY` `{userId,updatedAt,dirty,localChangedAt}` | |
| `aalimPage` | last open tab | restore LIFEQUEST sub-panel |
| `aalimHubSub` | last sub-tab per hub | |
| `aalimRecent` | recently visited pages | |
| `aalimSideMini` | sidebar collapsed | |
| `aalimHbTab`, `aalimRemDay`, `aalimLastExport`, `aalimAiCfg` | misc UI prefs | |
| *(new)* `aalimLifeQuestUI` | **proposed** — purely local UI prefs (camera, replay speed, ambient toggles) that must *not* sync | |

### 5.2 IndexedDB

| DB | Store | Purpose | Line |
|---|---|---|---|
| `aalimSync` | `h` | File System Access API handle for cloud-folder sync | 1369 |
| `aalimBooks` | `f` | PDF/EPUB blobs, keyed by `library[].id`, via `bio(op,id,blob)` | 4332 |

> LIFEQUEST needs **no** IndexedDB (no external assets). If generated "journey history" grows large, keep it capped in `state.lq` (see §12 retention).

---

## 6. Live activity signals — what is authoritative (and what is not)

The spec forbids assuming activity from an open tab. Verified available signals:

### 6.1 Pomodoro / Focus timer — `pomo` (lines 2267–2540)

```js
const PK = "aalimPomoV2"; let pomoT=null, actx=null;
let pomo = {running:false, mode:"focus"|"break", end:<epoch ms>, left:<s>, total:<s>,
            cycle:<n>, target:<resolved target|null>, f:25, b:5, l:15, day:"YYYY-MM-DD"};
```
* `pomoSave()` (2278) persists on every transition → **survives reload**, so the character's live state is reconstructible (acceptance #6).
* `pomoTick()` runs on `setInterval(…,500)` while running (2352 `runStart`).
* `pomo.target` comes from `resolveTarget(v)` (2287) where `v` is `"plan:<text>"`, `"hw:<id>"`, `"res:<id>"`, `"learn:<projectId>|<learnId>"`, giving `{v,label,subject,hw?|res?|learn?}`. **This is the richest real-time intent signal in the whole app** — it tells us not just "studying" but *which subject / which homework / which project*.
* Lifecycle hooks: `pomoToggle()` 2353 (start/pause), `pomoStop(force)` 2442 (finish → logs to `state.study`), `pomoSkip()` 2453, `pomoReset()` 2463, `pomoDone()` 2420, `pomoInit()` 2526 (restores a running timer after reload).

### 6.2 Reading timer — `rt` (lines 4260–4310)

```js
const RT_K="aalimReadT";
let rt = {run:0|1, st:<epoch ms when run started>, acc:<ms accumulated>, book:<library id>};
const rtMs = () => rt.acc + (rt.run ? Date.now()-rt.st : 0);
```
* `rtToggle()` 4279 start/pause (persists via `rtSave()`), `rtStop()` 4294 finish → **logs into `state.study`** with `note:"📖 "+book.title`, `subject: book.s||"Reading"`, `h: new Date().getHours()` (line 4302).
* A 1 s `setInterval` already ticks it (4277).
* `rt.book` + `state.reader[bookId]` give the exact book, page and highlights → the character can hold *that* book.

### 6.3 Explicitly logged activities

Everything else is **event-based**, not live: `saveRun`, `kaSave`, `sgSave`, `saveWorkout`, `saveLift`, `addMistake`, `reviewSave`, `cqAdd`, `addBook`, `addPdf`, `hofAdd`, movie/biz/paper/homework/task writers. Each ends with `save()` + one or more `render*()` calls.

### 6.4 Signals that must **not** be used

* `curPage` / `showPage(id)` — navigation only. Opening the Workout tab is not a workout.
* `document.visibilityState` — presence, not activity.
* `state.plan[today()]` unchecked items — intent, not action.

### 6.5 The hook strategy (no double-logging)

```js
// lifequest.js — wraps, never replaces
const _save = window.save;
window.save = function(ns){ const r = _save.apply(this, arguments); LQ.onTrackerChanged(ns); return r; };

const _pomoToggle = window.pomoToggle; window.pomoToggle = function(){ const r=_pomoToggle.apply(this,arguments); LQ.onTimer("pomo"); return r; };
// same for pomoStop, pomoSkip, pomoReset, pomoDone, rtToggle, rtStop
```
Plus a low-frequency poll (1 Hz only while the LIFEQUEST tab is visible) as a safety net, and a `storage` event listener for cross-document changes (§7). **LIFEQUEST never writes to any tracker array.** The tracker stays the single source of truth; the user logs once (acceptance #12).

---

## 7. Virtual Lab integration (`chemlab.html`, iframe)

* `#vlab` is created at runtime (5488) and the iframe `src` is set lazily on first visit (5502) with `fetch("chemlab.html",{cache:"no-cache"})` as an existence check.
* **There is no `postMessage` bridge** — verified: zero `postMessage`/`parent.` references in `chemlab.html`, `labui.js`, `labreg.js`.
* `LabStore` (`labstore.js`) persists to `localStorage["aalimLabStore"]`, `SCHEMA = 1`, shape `{v, notes[], projects[], sessions[], layout{}, runs[]}`; every record gets `{id, created, updated}` from `add()` (line 52). Exposed API: `list,get,add,update,remove,noteAdd,noteSearch,projectAdd,projectRun,sessionAdd,exportAll,importAll,layoutGet,layoutSet`.
* Sessions are keyed `id#seq` in `LabReg.LIVE` so one experiment can be open several times.

> **Decision C (recommended):** read lab activity from the **parent** document without editing lab code — listen for the `storage` event (fires in the parent when the same-origin iframe writes `aalimLabStore`) and diff `sessions[]`/`runs[]` by `updated`. Fallback: 2 s poll while the `#vlab` tab is open. **Optional, only if richer detail is wanted later:** a 3-line `postMessage` in `labreg.mount`/`saveSession`.

---

## 8. Sync, backup, import/export — where game data must ride

| Function | Line | Behaviour | LIFEQUEST action |
|---|---|---|---|
| `save(ns)` | 591 | Writes `state`; unless `ns`, calls `syncMark()` + `cloudMarkLocalDirty()` | Wrap only (§6.5). With Option A, `state.lq` is saved/synced for free |
| `syncMark()` | 1360 | Marks folder-sync dirty | — |
| `idb()/idbGet/idbSet/idbDel` | 1369–1372 | FS handle store | — |
| `syncRun(manual)` | 1397 | Folder-sync round trip | — |
| `applyRemote(r)` | 1396 | **`state = normalize(r.data)`** → full replace | `normalize` must carry `lq`; LIFEQUEST must re-derive on `renderAll()` |
| `cloudUploadLocal(explicit)` | 1765 | Upserts `{user_id, data: JSON.parse(JSON.stringify(state)), updated_at}` into Supabase table **`tracker_data`** | Option A ⇒ game data syncs across devices with **zero** new code (acceptance #15) |
| `cloudApplyRow(row)` | 1755 | `state = normalize(row.data)` | same as `applyRemote` |
| `cloudMarkLocalDirty()` | 1673 | Debounced auto-upload (1.8 s) | Game writes will auto-sync; **throttle LIFEQUEST persistence** (§12) to avoid upload churn |
| `backupPayload()` | 1547 | `{app:"aalim-tracker", v:2, savedAt, data:state, files:{<bookId>:base64}}` | Option A ⇒ included automatically (acceptance #14) |
| `restoreFiles(files)` | 1560 | Re-writes PDFs into `aalimBooks` | — |
| `shareBackup()` / `copyData()` | 1571 / 1595 | Full backup (with PDFs) / text-only copy | — |
| `exportData()` | 4176 | Downloads `JSON.stringify(state,null,2)` | — |
| `mergeState(a,b)` | 4192 | Per-key: JSON-dedup union for arrays, `mergeById` for `exams`, `Object.assign` for objects | **Must add an `lq` clause** using a dedicated `mergeLQ()` (union by event `id`, max of counters, later `updated` wins) — the generic JSON-dedup union would duplicate cosmetic/progress records |
| `importData(e)` | 4206 | Validates `KEYS.some(k=>inc[k])`, then MERGE or REPLACE | Adding `"lq"` to `KEYS` also lets a LIFEQUEST-only file validate |
| `resetAll()` | 4235 | Removes `STORAGE_KEY`, resets `pomo`, `state = defaultState()` | Document that it clears `state.lq`; add a separate `lqReset()` for game-only reset |

**Supabase config:** `window.AALIM_SUPABASE_CONFIG` in `cloud-config.js`; `cloudConfigured()` (1668) validates the URL/key shape. Table: `tracker_data(user_id, data jsonb, updated_at)`; row fetched via `.select("data,updated_at").eq("user_id",…).maybeSingle()` (1706).

---

## 9. Render pipeline & the guard patterns to copy

```js
function renderAll(){ /* line 5264 */ [renderBatches, updateCountdowns, renderSummary, renderSyllabus, renderStudy,
  renderTasks, renderExtra, renderExams, renderExamSummary, renderTracking, renderInsights,
  renderAnalytics, renderSettings, renderToday, renderMarks, renderQuestions, renderFeynman,
  renderWorkout, renderDash, renderDream, renderLift, renderDeen, renderLib, renderBiz,
  renderFlash, renderMistakes, renderReport, renderHof, … ].forEach(safeRun); }
```

* **`renderAll()` runs on every `showPage()` and every data change.** LIFEQUEST must **not** register an expensive renderer here; it should render on demand (tab visible) and subscribe to change events otherwise. Budget: `< 1 ms` when the tab is hidden.
* **Typing guard pattern** used by every dynamic panel — copy it verbatim:
  `if (el.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;` (see `renderPapers` 3483, `renderReview` 3519, `renderResearch` 4789).
* **Dynamic page containers** already exist as precedent for a fully JS-rendered tab: `#ppBox` (Past Papers), `#rvBox` (Weekly Review), `#resBox` (Projects), `#lbHero`, `#lbList`.
* **Non-blocking toast:** `hofToast(msg)` (line 5031, CSS `.hofToast` line 121) — reuse for LIFEQUEST milestones instead of `alert()`. Note the app currently has **95 `alert()` calls**; LIFEQUEST must add none.

---

## 10. Reusable helpers (do not re-implement)

| Helper | Line | Use in LIFEQUEST |
|---|---|---|
| `dayCover(d)` | 3303 | **Minute-by-minute array** from wake→sleep, codes `0=free,1=school,2=tuition,3=custom block` + `{arr,len,wake,school,tuition,hobby,free}` → the backbone of the daily timeline and the day/night cycle |
| `dayStats(n)` | 3361 | Last *n* days: `{k,d,sleep,bed,wake,idle,study,hob,school,tuition,free,hasIdle}` |
| `activityMins(k)` | 3155 | Total minutes for a date across `study+karate+runs+hobbyLog+extraLog` **with karate/run double-count removal** |
| `activityDates()` | 3159 | Set of dates with real activity → Journal + replay date picker |
| `dayMap()` | 1059 | `{date: studyMinutes}` |
| `weekTotals(off)` | 2867 | `{study,karate,run,hobby,…}` |
| `wkRange(off)` / `weekStart(d)` / `wkKey(d)` | 2859 / 1060 / 3437 | Week windows |
| `dkey(d)` `pad(n)` `addDays(d,n)` `inRng(d,a,b)` `okDate(d)` | 1054 / 1053 / 1061 / 2860 / 2858 | Date keys |
| `hm(m)` `hrs(m)` `fmtDur(ms)` `fmtClk(ms)` `num(v)` `sumF(l,f)` `avg(a,f)` | 3297 / 1055 / 1281 / 4273 / 2857 / 2861 / 3370 | Formatting — reuse so LIFEQUEST numbers match the tracker exactly |
| `esc(s)` `$ (id)` `today()` `uid2()` `lsGet(k,d)` | 589 / 588 / 590 / 2853 / 4912 | DOM/ids/safety |
| `circAvg(list)` | 3372 | Circular mean of minutes-of-day → "best study hours" / character rhythm |
| `resolveTarget(v)` `pomoTargets()` | 2287 / 2312 | Decode the live focus target into subject/homework/project |
| `statuses` / `allCounts()` / `stageCounts(sj)` | 520 / 525 / 526 | Mastery evidence for skill trees & world evolution |
| `paperWeak()` | 3482 | Weak topics → "needs attention" props, not punishment |
| `G()` | 3436 | Rewards/claims/rest/challenges/commonplace/karate-goals container |

---

## 11. Timestamp fidelity — the honesty problem (needs a decision)

| Source | Clock time known? |
|---|---|
| `pomo` (live) | ✅ exact — `end`, `left`, `total`, plus `pomoSave` timestamps |
| `rt` (live) | ✅ exact — `st`, `acc` |
| `state.study[].h` | ⚠️ hour only, and **only when logged the same day** (pomo + reading paths set it) |
| `dayCfg.school/tuition/blocks` | ✅ exact configured windows |
| `dayLog[k].wake / .bed / .idle[]` | ✅ real recorded times/durations |
| `runs/karate/hobbyLog/extraLog/workouts/lifts/quran/movies` | ❌ **date + minutes only** |
| `papers` | ⚠️ `date`, `took`, `allowed` (duration, no start) |
| `reviews/hof/mistakes/homework.done` | ❌ date only |

The spec's example timeline (`06:30 Wake up · 07:00 Mathematics · 07:30 Mathematics · 08:00 Break …`) is only fully truthful for **today** (live timers + `h`) and for days where the schedule blocks are configured.

> **Decision D (proposed policy — please confirm):**
> 1. **Anchored events** (known time): live timers, `study[].h`, `dayLog.wake/bed/idle`, configured `dayCfg` blocks. Rendered at their real clock position.
> 2. **Duration-only events**: rendered in the day's *free* windows in recorded order, each visually marked **"time approximate — duration from your log"**. Never presented as a known clock time.
> 3. **Untracked time**: character idles/rests in the current room; the timeline shows a neutral "unrecorded" band. No invented activities (§6 UNTRACKED TIME).
> 4. **Replay** uses the same two classes, so a replayed day is honest about what was measured vs. what was only totalled.

---

## 12. Proposed architecture (spec §14 mapped onto this codebase)

```
lifequest.css        – theme-token-driven styles, .lq* namespace, reduced-motion block
lifequest.js         – boot + hub/section injection + showPage/save/timer wrappers (the "vlab pattern")
lq-store.js          – LQStore: state.lq schema, normalise, mergeLQ, retention caps, UI-prefs key
lq-adapter.js        – TrackerAdapter: read-only selectors over `state`, `pomo`, `rt`, LabStore
lq-mapper.js         – ActivityMapper: (subject|category|kind|note|target) → {room, prop, animation}
lq-timeline.js       – TimelineEngine: day → anchored/approximate events (Decision D)
lq-replay.js         – ReplayEngine: date picker, speed 0.5×–8×, scrub, pause
lq-character.js      – Character + AnimationManager: shared SVG rig, state machine, transitions
lq-world.js          – World/rooms + Camera + environment layers + day-night + ambient
lq-render.js         – Renderer: single rAF loop, visibility-gated, layered SVG (Canvas only if needed)
lq-progress.js       – ProgressionEngine + SkillTree + MilestoneManager + WorldEvolution + EventHistory
lq-ui.js             – the 8 interface panels (World/Character/Map/Daily Life/Skills/Milestones/Journal/Stats)
```

Runtime namespace: a single global `window.LQ = {version, boot, onTrackerChanged, onTimer, api…}`; nothing else leaks.

### 12.1 `state.lq` schema (proposal)

```js
lq: {
  v: 1,                                  // game schema, independent of tracker KEYS
  char: { skin:"…", outfit:[], accessory:[], palette:{} },   // cosmetic only
  chapter: { current:1, unlocked:[1], edits:{} },            // narrative chapters, user-editable
  world: { upgrades:{library:0, lab:0, observatory:0, …}, unlockedAreas:[] },
  progress: { knowledge:0, exploration:0, creation:0, discipline:0, physical:0 },
  skills: { intellect:{}, creativity:{}, discipline:{}, physical:{}, knowledge:{} },
  milestones: [ {id, kind, ref, at, label} ],                // ref = tracker evidence key, de-dup guard
  collected: [ {id, at} ],
  journal: [ {d:"YYYY-MM-DD", events:[…] } ],                // capped (e.g. 120 days) — re-derivable
  seen: { lastEventHash:"…", lastScan:"…" },                 // idempotency: never re-award
  prefs: { reducedMotion:false, ambient:true, muted:false, replaySpeed:1, livePaused:false }
}
```

**Anti-double-count rule:** every milestone carries `ref` = a deterministic evidence key (e.g. `"book:<libraryId>"`, `"chapter:Mathematics|Polynomials:Mastered"`, `"review:2026-11-16"`, `"lab:chem.rx#3"`). Awarding checks `seen`/`milestones` for that `ref` first. No reward for opening a tab; no negative XP; no decay (§11).

**Write throttling:** coalesce `state.lq` writes (e.g. 2 s debounce) because every `save()` triggers `cloudMarkLocalDirty()` → debounced Supabase upload. Cosmetic-only changes (camera position) must **not** persist.

---

## 13. Activity → character/room mapping (derived from real fields)

| Real signal | Field used | Room | Character state | Props |
|---|---|---|---|---|
| Pomodoro focus, subject `Mathematics` | `pomo.target.subject` / `study[].subject` | Home → study desk, or Academy maths room | `studying` / `writing` | maths textbook, notebook, ruler |
| Subject `Science` + chapter from `syllabus.Science` | `target.label`, `homework.subject` | split by chapter keyword: Chemistry→Laboratory, Physics→Laboratory/Observatory, Biology→Laboratory | `experimenting` / `studying` | diagrams, apparatus |
| `research.cat === "Engineering"` or hobbySec `chem` | `research.cat`, `hobbyLog.sec` | Workshop | `typing` / `building` | workbench, soldering, robot arm |
| `research.cat === "Novel"` / writing | `cat`, `feynman` | Home desk / Library | `writing` / `thinking` | manuscript, lamp |
| Reading timer running | `rt.run`, `rt.book`, `state.reader[id]` | Library | `reading` (seated) | the actual book spine colour/page |
| Book `st === "Done"` | `library[].st` | Library | closes book, shelves it | completed shelf (world upgrade) |
| Virtual Lab session active | `LabStore.sessions[].updated`, `LabReg.LIVE` | Laboratory | `experimenting` | matches the experiment family |
| `karate[]` / `hobbyLog.sec==="karate"` | `focus`, `mins` | Garden training area | `karate` | kata sequence from `G().kg` goals |
| `runs[]` | `mins`, `steps`, `effort` | Garden / outdoor | `running` | cadence-driven stride |
| `workouts[]` / `lifts[]` | `ex`, `sets`, `reps` | Garden | `exercising` | matches `ex` name |
| `quran[]` / `prayers` | `p`, date | Quiet Sanctuary | `reading` (seated, calm) | mushaf, soft light |
| `movies[]` | `k`, `m` | Recreation area | `watching` | screen glow |
| `biz[]` / `bizLog[]` | `v`, `t` | City | `thinking` / `writing` | ledger, stall |
| `papers[]` / `exams[]` | `subject`, `took` | Academy exam hall | `writing` (timed) | answer booklet, clock |
| `mistakes[]` / `flashcards` review | `subject`, `box` | Home desk | `thinking` / `reading` | mistake notebook, cards |
| `reviews[]` saved | `wk` | Quiet Sanctuary | `reflecting` | journal |
| `dayLog.bed` / `settings.sleep` window | times | Bedroom | `sleeping` | lamp off, night sky |
| `settings.wake` | time | Bedroom | `waking` → `idle` | curtains |
| `dayCover` code 1 (school) | minutes | Academy | `attending` | classroom |
| `dayCover` code 2 (tuition) | minutes | Academy | `studying` | tuition desk |
| Nothing recorded | — | current room | `idle` / `resting` / `exploring` (only if the user drives it) | — |

Subject → discipline keyword matching must use the **actual** `syllabus` keys and `PC` categories, never a hard-coded guess. Unknown activities fall back to a **generic** `studying`/`idle` animation (§4L).

---

## 14. Theming, accessibility, performance envelope

* **Tokens:** `:root` (line 44) `--bg --card --text --muted --accent --accent2 --green --orange --red --border --shadow --ringbg`; dark via `[data-theme=dark]` (line 75); `applyTheme()` (1186) + `state.settings.theme`. LIFEQUEST must derive its palette from these tokens so both themes work with zero extra code.
* **Reduced motion:** 5 `@media(prefers-reduced-motion:reduce)` blocks already exist (stinger hidden, card animations off). LIFEQUEST adds its own and honours `LQ.prefs.reducedMotion` + `state.settings.sound`.
* **Existing `visibilitychange` handlers:** 1859 (cloud check), 1873, 1907 (SW update reload), 2551 (pomo), 4686 (reminders) — precedent for gating the rAF loop.
* **Perf rules:** one `requestAnimationFrame` loop, started only when the LIFEQUEST page is `.active`; full stop when `document.hidden`; SVG-first with layered `<g>` transforms; no layout thrash (read `getBoundingClientRect` at most once per resize); lazy boot (parse `state.lq` only on first open); reuse animation rigs by reference; target ≤ 3 ms/frame on a 2016-class phone, ≤ 150 KB total added assets.
* **Offline:** no network calls at all. No external images/fonts/libraries.

---

## 15. `sw.js` changes required (Phase 7)

```js
const CACHE = "aalim-tracker-v97";            // bump with APP_VERSION in index.html
const ASSETS = [ …existing 19…,
  "lifequest.css", "lifequest.js",
  "lq-store.js","lq-adapter.js","lq-mapper.js","lq-timeline.js","lq-replay.js",
  "lq-character.js","lq-world.js","lq-render.js","lq-progress.js","lq-ui.js" ];
```
The existing self-update chain (`activate` → `postMessage("aalim-sw-activated")` → banner/reload, plus `checkAppUpdate()` regex `/aalim-tracker-(v\d+)/`) picks this up with no further work. Cache-first for same-origin non-navigate requests already covers the new files.

---

## 16. Test plan (extends the existing jsdom suites)

`tests/lifequest.js` (new), same harness as `tests/lab.js` (`NODE_PATH=/tmp/smoke/node_modules`, `memoryStorage` + `ResizeObserver` + `matchMedia` shims in `beforeParse`):

1. **Boot safety** — app loads with LIFEQUEST present: no page errors, `#side` has 9 hubs, all 26 existing tabs still render (re-run the v96 render sweep).
2. **No tracker mutation** — snapshot `JSON.stringify(state)` (minus `lq`), drive every LIFEQUEST panel, assert byte-identical.
3. **Normalise round-trip** — `normalize(state)` preserves `lq`; `mergeState` does not duplicate milestones; `backupPayload()` contains `lq`; `importData` of a full backup restores it.
4. **Activity mapping** — seeded fixtures for each row of §13 assert the expected `{room, anim}`.
5. **Live sync** — `pomoToggle()` ⇒ character `studying` with the right subject; `pomoStop()` ⇒ logs once and character transitions; `rtToggle()` ⇒ `reading` with the right book; pause ⇒ resting state.
6. **Timeline honesty** — anchored events keep their clock time; duration-only events are flagged approximate; gaps render as unrecorded (no invented activity).
7. **Replay** — pick a past date from `activityDates()`, assert the sequence matches the records; speed change does not alter data.
8. **Idempotency** — awarding the same milestone twice yields one entry; re-scanning a completed day adds nothing.
9. **Reload recovery** — kill and re-create the DOM with the same storage; assert the live state is reconstructed from `aalimPomoV2` / `aalimReadT`.
10. **Perf/a11y** — rAF loop stopped when hidden; reduced-motion path renders a static scene; theme switch recolours without JS errors.
11. Keep `tests/smoke.js` 43/43 and `tests/lab.js` 55/55 green throughout.

---

## 17. Risks & guardrails

| Risk | Mitigation |
|---|---|
| `normalize()` silently deletes `state.lq` | Add `"lq"` to `KEYS` **and** a `normalize` clause in the same commit; test #3 asserts the round-trip |
| `mergeState` duplicates game records | Dedicated `mergeLQ()` (union by `id`, latest `updated` wins) |
| Game writes trigger Supabase upload churn | Debounce persistence; never persist camera/ephemera |
| LIFEQUEST exception breaks boot | Every entry point through `safeRun`; module wrapped in try/catch; `sw.js` still serves the app if a file 404s |
| Double-logging activities | LIFEQUEST is **read-only** on tracker arrays; only `state.lq` is written |
| Duplicate rewards / grinding | Deterministic `ref` keys + `seen` map (§12.1) |
| Inventing a life the user didn't live | Decision D honesty policy; untracked time is idle; no fabricated milestones; chapters never claim degrees/jobs |
| Performance regression on the 540 KB page | Lazy boot, single gated rAF, ≤ 150 KB added, no work while hidden |
| Breaking the 26 existing tabs / 8 hubs | Insert hub additively; re-run `tests/smoke.js` + `tests/lab.js` + the v96 render sweep every phase |
| iframe lab events missed | `storage` event + poll fallback; optional minimal `postMessage` later |

---

## 18. Integration point checklist (exact anchors for Phase 2+)

| # | Anchor | Line | Edit type |
|---|---|---|---|
| 1 | `<link rel="stylesheet" href="lifequest.css">` | before `</head>` / after main `<style>` | additive |
| 2 | `<script src="lifequest.js" defer>` … module tags | immediately before `</body>` (after the 5484 block) | additive |
| 3 | `HUBS` array | 4901 | **1 line inserted** |
| 4 | `KEYS` | 555 | add `"lq"` |
| 5 | `normalize(x)` return literal | 557–572 | add `lq: normLQ(x.lq)` |
| 6 | `mergeState(a,b)` | 4192 | add `lq: mergeLQ(a.lq,b.lq)` |
| 7 | `backupPayload()` | 1547 | nothing needed under Option A (state already included) — verify only |
| 8 | `sw.js ASSETS` + `CACHE` | 6 / 4 | list new files, bump `v97` |
| 9 | `index.html APP_VERSION` | 5023 | `v96` → `v97` |
| 10 | `tests/lifequest.js` | new | additive |

**Total edits to existing app code: 4 single-line insertions (HUBS, KEYS, normalize, mergeState) + 2 tag additions + version/cache bumps.** Everything else lives in new files.

---

## 19. Open questions before Phase 2

* **Q1 — Hub placement:** new 9th hub `🌄 LifeQuest` *before* Settings (Settings keeps key `8` → becomes `9`), or after Settings? And: one page with internal panels (max world space, recommended) or 8 separate sub-tabs?
* **Q2 — Storage option:** confirm **Option A** (`state.lq`, syncs everywhere, 4 one-line core edits) vs Option B (separate key, more patching).
* **Q3 — Timeline honesty:** confirm the **Decision D** policy for duration-only records (approximate placement, visibly labelled) vs. showing them only as an unpositioned list.
* **Q4 — Virtual Lab events:** confirm the read-only `storage`-event approach, or authorise a 3-line `postMessage` bridge in `labreg.js`.
* **Q5 — Chapter unlocking:** which real, configurable milestones unlock Chapters 2–6 (e.g. "board exam logged as done", "N books finished", "N projects completed")? Default proposal: user-editable thresholds in the Milestones panel, nothing auto-claimed.
* **Q6 — Rendering:** SVG-only (recommended, matches the app's existing pure-SVG style and themes cleanly) vs. SVG + Canvas for particles.

---

## 20. Phase 1 verdict

Command Centre is **well suited** to host LIFEQUEST: it already exposes persisted live timers (`pomo`, `rt`), a minute-resolution daily schedule (`dayCover`), subject-aware study records, category-aware projects, per-section hobby logs, chapter mastery stages, and a proven bolt-on extension pattern (`#vlab`) plus a single sync path (`state` → Supabase/folder/backup) that game data can ride for free.

The only structural hazards are `normalize()`'s explicit key list and `mergeState()`'s generic array union — both handled by four one-line edits and a dedicated `mergeLQ()`.

**No files were modified in Phase 1.** Ready to begin Phase 2 (Character + World) once Q1–Q6 are answered.
