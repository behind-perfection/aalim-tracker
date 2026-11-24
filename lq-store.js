/* ============================================================================
   LIFEQUEST · lq-store.js
   Game-only persistence. Lives at `state.lq` so it rides every existing sync,
   backup, export and import path for free (see docs/LIFEQUEST-PHASE1-AUDIT.md).

   HARD RULES
   · This module NEVER writes to any tracker array. `state.lq` is the only
     tracker-side key it touches.
   · Writes are debounced, because every tracker `save()` marks the cloud copy
     dirty and schedules a Supabase upload.
   · Cosmetic/ephemeral values (camera, panel open) are kept in localStorage
     under a separate key and are deliberately NOT synced.
   ========================================================================== */
(function () {
  "use strict";

  var SCHEMA = 1;
  var UI_KEY = "aalimLifeQuestUI";     // local-only prefs, never synced
  var JOURNAL_CAP = 120;               // days kept inline; older days are re-derivable
  var MILESTONE_CAP = 600;

  /* ---------------------------------------------------------------- shape */
  function blank() {
    return {
      v: SCHEMA,
      char: { skin: 0, outfit: 0, accessory: -1, palette: 0 },
      chapter: { current: 1, unlocked: [1], edits: {} },
      world: { upgrades: {}, areas: ["home"] },
      progress: { knowledge: 0, exploration: 0, creation: 0, discipline: 0, physical: 0 },
      skills: { intellect: {}, creativity: {}, discipline: {}, physical: {}, knowledge: {} },
      milestones: [],
      collected: [],
      journal: [],
      seen: {},
      prefs: { reducedMotion: false, ambient: true, muted: false, replaySpeed: 1, livePaused: false }
    };
  }

  var num = function (v, d) { var n = Number(v); return Number.isFinite(n) ? n : (d || 0); };
  var arr = function (v) { return Array.isArray(v) ? v : []; };
  var obj = function (v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; };
  var bool = function (v, d) { return typeof v === "boolean" ? v : !!d; };

  /* Deep-normalise unknown/older payloads. Never throws. */
  function norm(x) {
    var b = blank();
    x = obj(x);
    var o = b;
    o.v = SCHEMA;
    o.char = {
      skin: Math.max(0, Math.min(5, Math.round(num(obj(x.char).skin, 0)))),
      outfit: Math.max(0, Math.min(7, Math.round(num(obj(x.char).outfit, 0)))),
      accessory: Math.max(-1, Math.min(9, Math.round(num(obj(x.char).accessory, -1)))),
      palette: Math.max(0, Math.min(5, Math.round(num(obj(x.char).palette, 0))))
    };
    var ch = obj(x.chapter);
    o.chapter = {
      current: Math.max(1, Math.min(6, Math.round(num(ch.current, 1)))),
      unlocked: arr(ch.unlocked).map(function (n) { return Math.max(1, Math.min(6, Math.round(num(n, 1)))); }),
      edits: obj(ch.edits)
    };
    if (!o.chapter.unlocked.length) o.chapter.unlocked = [1];
    if (o.chapter.unlocked.indexOf(o.chapter.current) < 0) o.chapter.unlocked.push(o.chapter.current);
    var w = obj(x.world);
    o.world = { upgrades: obj(w.upgrades), areas: arr(w.areas).filter(function (a) { return typeof a === "string"; }) };
    if (!o.world.areas.length) o.world.areas = ["home"];
    var p = obj(x.progress);
    ["knowledge", "exploration", "creation", "discipline", "physical"].forEach(function (k) {
      o.progress[k] = Math.max(0, num(p[k], 0));
    });
    var s = obj(x.skills);
    ["intellect", "creativity", "discipline", "physical", "knowledge"].forEach(function (k) {
      o.skills[k] = obj(s[k]);
    });
    o.milestones = arr(x.milestones).filter(function (m) {
      return m && typeof m === "object" && typeof m.ref === "string" && m.ref;
    }).map(function (m) {
      return { id: String(m.id || m.ref), ref: String(m.ref), kind: String(m.kind || "milestone"), label: String(m.label || ""), at: num(m.at, 0), cat: String(m.cat || "knowledge") };
    }).slice(-MILESTONE_CAP);
    o.collected = arr(x.collected).filter(function (c) { return c && c.id; }).map(function (c) {
      return { id: String(c.id), at: num(c.at, 0) };
    });
    o.journal = arr(x.journal).filter(function (j) { return j && typeof j.d === "string"; }).slice(-JOURNAL_CAP);
    o.seen = obj(x.seen);
    var pf = obj(x.prefs);
    o.prefs = {
      reducedMotion: bool(pf.reducedMotion, false),
      ambient: bool(pf.ambient, true),
      muted: bool(pf.muted, false),
      replaySpeed: [0.5, 1, 2, 4, 8].indexOf(num(pf.replaySpeed, 1)) >= 0 ? num(pf.replaySpeed, 1) : 1,
      livePaused: bool(pf.livePaused, false)
    };
    return o;
  }

  /* ------------------------------------------------------- merge (2 devices)
     Used by mergeState() in index.html via window.LQMerge.
     Union by id, counters take the max, latest write wins for scalars. */
  function union(a, b, key) {
    var seen = {}, out = [];
    arr(a).concat(arr(b)).forEach(function (it) {
      if (!it || typeof it !== "object") return;
      var k = String(it[key] || JSON.stringify(it));
      if (seen[k]) return;
      seen[k] = 1; out.push(it);
    });
    return out;
  }
  function maxMap(a, b) {
    var o = obj(a), k;
    for (k in obj(b)) o[k] = Math.max(num(o[k], 0), num(b[k], 0));
    return o;
  }
  function merge(a, b) {
    a = norm(a); b = norm(b);
    var o = norm({});
    o.char = a.char.outfit || a.char.skin ? a.char : b.char;
    o.chapter = {
      current: Math.max(a.chapter.current, b.chapter.current),
      unlocked: Array.from(new Set(a.chapter.unlocked.concat(b.chapter.unlocked))).sort(),
      edits: Object.assign({}, b.chapter.edits, a.chapter.edits)
    };
    o.world = {
      upgrades: maxMap(a.world.upgrades, b.world.upgrades),
      areas: Array.from(new Set(a.world.areas.concat(b.world.areas)))
    };
    ["knowledge", "exploration", "creation", "discipline", "physical"].forEach(function (k) {
      o.progress[k] = Math.max(a.progress[k], b.progress[k]);
    });
    ["intellect", "creativity", "discipline", "physical", "knowledge"].forEach(function (k) {
      o.skills[k] = maxMap(a.skills[k], b.skills[k]);
    });
    o.milestones = union(a.milestones, b.milestones, "ref").slice(-MILESTONE_CAP);
    o.collected = union(a.collected, b.collected, "id");
    o.journal = union(a.journal, b.journal, "d").sort(function (x, y) { return x.d < y.d ? -1 : 1; }).slice(-JOURNAL_CAP);
    o.seen = Object.assign({}, b.seen, a.seen);
    o.prefs = a.prefs;                      // this device wins for local preferences
    return o;
  }

  /* ------------------------------------------------------------ host access */
  function host() {
    try { if (typeof state !== "undefined" && state && typeof state === "object") return state; } catch (e) { }
    return null;
  }
  var mem = null;                            // stand-in when the tracker is absent

  function get() {
    var h = host();
    var raw = h ? h.lq : mem;
    var n = norm(raw);
    if (h) h.lq = n; else mem = n;
    return n;
  }

  /* ------------------------------------------------------------- persistence */
  var timer = null;
  function scheduleSave(delay) {
    if (typeof window === "undefined") return;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; saveNow(); }, num(delay, 1200));
  }
  function saveNow() {
    clearTimeout(timer); timer = null;
    try {
      if (typeof save === "function") return save() !== false;
    } catch (e) { }
    return false;
  }
  /* mutate(fn) — the only sanctioned way to change game data */
  function mutate(fn, opts) {
    var g = get();
    var r = fn(g);
    g.v = SCHEMA;
    if (!opts || opts.save !== false) scheduleSave(opts && opts.delay);
    return r;
  }

  /* ------------------------------------------------- local-only UI prefs */
  function uiGet() {
    try { return Object.assign({ panel: "world", zoom: 1, camX: 0 }, JSON.parse(localStorage.getItem(UI_KEY) || "{}")); }
    catch (e) { return { panel: "world", zoom: 1, camX: 0 }; }
  }
  function uiSet(patch) {
    try { localStorage.setItem(UI_KEY, JSON.stringify(Object.assign(uiGet(), obj(patch)))); } catch (e) { }
  }

  /* ------------------------------------------------------- milestone awards
     `ref` is a deterministic evidence key derived from tracker data, so the
     same real accomplishment can never be rewarded twice. */
  function has(ref) { var g = get(); return !!g.seen[ref] || g.milestones.some(function (m) { return m.ref === ref; }); }
  function award(ref, m) {
    if (!ref || has(ref)) return false;
    mutate(function (g) {
      g.seen[ref] = Date.now();
      g.milestones.push({
        id: ref, ref: ref, kind: String((m && m.kind) || "milestone"),
        label: String((m && m.label) || ""), at: Date.now(), cat: String((m && m.cat) || "knowledge")
      });
      if (g.milestones.length > MILESTONE_CAP) g.milestones = g.milestones.slice(-MILESTONE_CAP);
      if (m && m.cat && g.progress[m.cat] !== undefined) g.progress[m.cat] = num(g.progress[m.cat], 0) + num(m.points, 1);
    });
    return true;
  }

  function setPref(k, v) { mutate(function (g) { g.prefs[k] = v; }); }

  /* reset(scope) — GAME DATA ONLY.
     "appearance" → cosmetics, "prefs" → game preferences, "ui" → the local
     panel/zoom key. Milestones, journal and `seen` are deliberately kept: they
     are derived from real tracker records, so wiping them would erase evidence
     the user actually earned. Nothing here ever touches a tracker record. */
  function reset(scope) {
    var b = blank();
    var r = mutate(function (g) {
      if (!scope || scope === "all" || scope === "appearance") g.char = b.char;
      if (!scope || scope === "all" || scope === "prefs") g.prefs = b.prefs;
    });
    if (scope === "ui" || !scope || scope === "all") {
      try { localStorage.removeItem(UI_KEY); } catch (e) { }
    }
    return r;
  }

  window.LQStore = {
    SCHEMA: SCHEMA, UI_KEY: UI_KEY, blank: blank, norm: norm, merge: merge,
    get: get, mutate: mutate, saveNow: saveNow, scheduleSave: scheduleSave,
    uiGet: uiGet, uiSet: uiSet, has: has, award: award, setPref: setPref, reset: reset,
    caps: { journal: JOURNAL_CAP, milestones: MILESTONE_CAP }
  };
  window.LQMerge = merge;                    // consumed by mergeState() in index.html
})();
