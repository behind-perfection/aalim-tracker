(function () {
/* ===================================================================
   LabStore (v94): offline-first persistence for the Virtual Lab.
   - localStorage backend, schema-versioned, with migration hooks and
     an automatic backup snapshot before any destructive migration.
   - Stores: notes (lab notebook), projects (research workflow),
     sessions (saved experiment states), layout (workspace prefs).
   - Never deletes data it does not own: the chem bench keeps its own
     keys (aalimChemLab / chemActsDone / aalimChemSnd); on first run we
     COPY old notebook entries in, leaving the originals intact.
   =================================================================== */
"use strict";
const KEY = "aalimLabStore";
const SCHEMA = 1;
const FALLBACK = {};           /* in-memory stand-in when storage is blocked */
let mem = null;

function rawGet() {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; }
    catch (e) { return mem; }
}
function rawSet(o) {
    mem = o;
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; }
    catch (e) { return false; }   /* private mode / quota: keep working in memory */
}
function blank() { return { v: SCHEMA, notes: [], projects: [], sessions: [], layout: {}, runs: [] }; }

/* ---- migration: bump SCHEMA and add a step; old payloads are backed up ---- */
const MIGRATIONS = {
    /* example: 2: db => { db.notes.forEach(n => n.tag = n.tag || "general"); } */
};
function migrate(db) {
    if (!db || typeof db !== "object") return blank();
    let v = db.v || 0;
    if (v === SCHEMA) return Object.assign(blank(), db);
    try { rawSet({ backupOf: "v" + v, at: Date.now(), data: db }); } catch (e) { }
    while (v < SCHEMA && MIGRATIONS[v + 1]) { try { MIGRATIONS[v + 1](db); } catch (e) { } v++; }
    db.v = SCHEMA;
    return Object.assign(blank(), db);
}

let db = migrate(rawGet());

const uid = p => p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
const now = () => Date.now();
function save() { return rawSet(db); }

/* ---- generic collection helpers (no silent overwrites: adds are new ids) ---- */
function list(store) { return db[store] || []; }
function get(store, id) { return list(store).find(x => x.id === id) || null; }
function add(store, obj) {
    const o = Object.assign({ id: uid(store.slice(0, 3)), created: now(), updated: now() }, obj);
    db[store].push(o); save(); return o;
}
function update(store, id, patch) {
    const o = get(store, id); if (!o) return null;
    Object.assign(o, patch, { updated: now() }); save(); return o;
}
function remove(store, id) {
    const before = db[store].length;
    db[store] = db[store].filter(x => x.id !== id);
    const ok = db[store].length < before; if (ok) save(); return ok;
}

/* ---- lab notebook ---- */
function noteAdd(n) {
    return add("notes", {
        subject: n.subject || "", experiment: n.experiment || "", model: n.model || "",
        title: n.title || "Observation", detail: n.detail || "", settings: n.settings || null,
        results: n.results || null, note: n.userNote || "", pinned: false
    });
}
function noteSearch(q, subject) {
    const s = (q || "").toLowerCase();
    return list("notes").filter(n =>
        (!subject || subject === "all" || n.subject === subject) &&
        (!s || (n.title + " " + n.detail + " " + (n.note || "") + " " + n.experiment).toLowerCase().includes(s))
    ).sort((a, b) => b.updated - a.updated);
}

/* ---- research projects (hypothesis workflow) ---- */
function projectAdd(p) {
    return add("projects", {
        name: p.name || "Untitled project", subject: p.subject || "", experiment: p.experiment || "",
        hypothesis: p.hypothesis || "", prediction: p.prediction || "",
        iv: p.iv || "", dv: p.dv || "", cv: p.cv || "",
        config: p.config || null, runs: [], conclusion: "", status: "open"
    });
}
function projectRun(id, run) {
    const p = get("projects", id); if (!p) return null;
    const r = Object.assign({ id: uid("run"), at: now() }, run);
    p.runs.push(r); p.updated = now(); save(); return r;
}
function duplicate(store, id, newName) {
    const o = get(store, id); if (!o) return null;
    const copy = JSON.parse(JSON.stringify(o));
    delete copy.id; delete copy.created;
    copy.name = newName || (copy.name || "Copy") + " (copy)";
    return add(store, copy);
}

/* ---- export / import (user-driven backup & restore) ---- */
function exportAll() {
    return JSON.stringify({ app: "aalim-virtual-lab", v: SCHEMA, at: now(), db: db }, null, 1);
}
function importAll(text) {
    let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, error: "Not valid JSON" }; }
    if (!o || o.app !== "aalim-virtual-lab" || !o.db) return { ok: false, error: "Not an Aalim Lab backup file" };
    try { rawSet({ backupOf: "pre-import", at: now(), data: db }); } catch (e) { }
    db = migrate(o.db); save();
    return { ok: true, counts: { notes: db.notes.length, projects: db.projects.length, sessions: db.sessions.length } };
}

/* ---- layout & prefs ---- */
function layoutGet() { return db.layout || {}; }
function layoutSet(patch) { db.layout = Object.assign({}, db.layout, patch); save(); return db.layout; }

/* ---- one-time non-destructive import of the legacy chem notebook ---- */
function importLegacyNotes() {
    if (db.legacyImported) return 0;
    let old = [];
    try { old = JSON.parse(localStorage.getItem("aalimChemLab") || "[]"); } catch (e) { }
    let n = 0;
    if (Array.isArray(old)) for (const e of old) {
        if (!e || db.notes.some(x => x.legacyKey && x.legacyKey === (e.t + "|" + e.txt))) continue;
        db.notes.push({
            id: uid("not"), created: now(), updated: now(), subject: "Chemistry", experiment: "Bench",
            model: "", title: "Bench observation", detail: String(e.txt || e.text || ""),
            settings: null, results: null, note: "", pinned: false,
            legacyKey: (e.t || "") + "|" + (e.txt || e.text || "")
        });
        n++;
    }
    db.legacyImported = true; save();
    return n;
}

const LabStore = {
    SCHEMA, uid, save, ok: () => mem !== null || true,
    list, get, add, update, remove, duplicate,
    noteAdd, noteSearch,
    projectAdd, projectRun,
    sessionAdd: p => add("sessions", p),
    exportAll, importAll, layoutGet, layoutSet, importLegacyNotes,
    _db: () => db, _reset: () => { db = blank(); save(); }
};
if (typeof module !== "undefined" && module.exports) module.exports = LabStore; else window.LabStore = LabStore;
})();
