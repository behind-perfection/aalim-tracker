(function () {
/* ===================================================================
   LabReg (v94): the expandable laboratory registry.
   New subjects/topics/experiments are added as DATA + a mount function
   (LabReg.define), never by editing the shell. Every experiment carries
   metadata: subject, topic, level, prerequisites, laws, apparatus and
   the variables it supports — ready for Class 11/12/JEE/NEET modules.

   Sessions: LabReg.open(id) creates an ISOLATED live session (own
   params, own results, own DOM). Switching views only hides a session;
   it is never destroyed or shared. Sessions can be saved to LabStore
   and restored exactly (param snapshot + per-experiment restore hook).
   =================================================================== */
"use strict";
const S = () => window.LabStore;

const SUBJECTS = [
    { id: "chem", icon: "🧪", name: "Chemistry Lab" },
    { id: "phy", icon: "⚡", name: "Physics Lab" },
    { id: "bio", icon: "🧬", name: "Biology Lab" },
    { id: "ws", icon: "📚", name: "Workspace" }
];

/* experiment definitions: meta first, mount supplied via define() */
const EXPS = {};
const ORDER = [];
function def(meta, impl) {
    const e = Object.assign({
        id: meta.id, subject: meta.subject, topic: meta.topic, name: meta.name,
        icon: meta.icon || "🔬", level: meta.level || "Class 10", prereqs: meta.prereqs || [],
        laws: meta.laws || [], apparatus: meta.apparatus || [], variables: meta.variables || [],
        planned: !!meta.planned, blurb: meta.blurb || "",
        mount: null, defaults: meta.defaults || null, snapshot: meta.snapshot || null, restore: meta.restore || null
    }, impl || {});
    if (!EXPS[e.id]) ORDER.push(e.id);
    EXPS[e.id] = e;
    return e;
}
function exp(id) { return EXPS[id] || null; }
function bySubject(sub) { return ORDER.map(id => EXPS[id]).filter(e => e.subject === sub); }
function topics(sub) {
    const t = [];
    bySubject(sub).forEach(e => { if (!t.includes(e.topic)) t.push(e.topic); });
    return t;
}
function byTopic(sub, topic) { return bySubject(sub).filter(e => e.topic === topic); }
function allExps() { return ORDER.map(id => EXPS[id]); }

/* ---------------- live isolated sessions ---------------- */
const LIVE = {};   /* key -> session;  key is unique per open, not per experiment */
let seq = 1;
function open(id, opts) {
    const e = exp(id);
    if (!e) throw new Error("Unknown experiment: " + id);
    const key = id + "#" + (seq++);
    const ses = {
        key, id, exp: e, subject: e.subject,
        params: JSON.parse(JSON.stringify(e.defaults || {})),
        results: null, el: null, mounted: false,
        opts: opts || {}, created: Date.now(),
        set(k, v) { ses.params[k] = v; },
        compute() { if (e.compute) { ses.results = e.compute(ses.params, ses); return ses.results; } return ses.results; }
    };
    LIVE[key] = ses;
    return ses;
}
function session(key) { return LIVE[key] || null; }
function close(key) { const s = LIVE[key]; if (s && s.el && s.el.remove) s.el.remove(); delete LIVE[key]; }
function liveList() { return Object.keys(LIVE).map(k => LIVE[k]); }

/* mount a session into a container; re-mount reuses the session's own DOM */
function mount(ses, host) {
    if (!ses.el) {
        ses.el = document.createElement("div");
        ses.el.className = "xview-inner xview";
        if (ses.exp.planned) ses.el.innerHTML = plannedCard(ses.exp);
        else if (ses.exp.mount) ses.exp.mount(ses);
        else ses.el.innerHTML = plannedCard(ses.exp);
    }
    host.textContent = "";
    host.appendChild(ses.el);
    ses.mounted = true;
    if (ses.exp.onMount) try { ses.exp.onMount(ses); } catch (e) { console.error(e); }
    return ses.el;
}
function plannedCard(e) {
    return '<div class="planned"><div class="plico">🚧</div><h3>' + e.name + ' — planned</h3>' +
        '<p>' + (e.blurb || "This module is registered in the lab architecture but its model is not implemented yet. It is listed honestly as planned rather than faked.") + '</p>' +
        (e.laws.length ? '<p class="pllaws"><b>Will be built on:</b> ' + e.laws.join(" · ") + '</p>' : '') +
        '<p class="plmeta">Registry id <code>' + e.id + '</code> · ' + e.level + '</p></div>';
}

/* ---------------- save / restore sessions (exact state) ---------------- */
function saveSession(ses, name) {
    const snap = { params: JSON.parse(JSON.stringify(ses.params)), extra: null };
    if (ses.exp.snapshot) { try { snap.extra = ses.exp.snapshot(ses); } catch (e) { } }
    const rec = S().sessionAdd({
        name: name || ses.exp.name + " · " + new Date().toLocaleString(),
        expId: ses.id, subject: ses.subject, snap: snap
    });
    return rec;
}
function restoreSession(rec) {
    const e = exp(rec.expId);
    if (!e) return null;
    const ses = open(rec.expId);
    ses.params = JSON.parse(JSON.stringify(rec.snap.params || {}));
    ses.restored = rec.snap.extra || null;
    return ses;
}

/* ---------------- chemistry bench adapter ----------------
   The bench is a preserved singleton (DOM + engine). The registry wraps
   it: mount = reveal its static workspace; sessions = engine snapshots. */
function chemSnapshot() {
    const CL = window.ChemLab; if (!CL) return null;
    try {
        return {
            items: CL.state.items.map(c => ({
                type: c.type, label: c.label, x: Math.round(c.x), y: Math.round(c.y), sc: c.sc,
                vol: +c.vol.toFixed(3), T: +c.T.toFixed(2), sp: c.sp, ppt: c.ppt, sol: c.sol, dep: c.dep,
                ind: c.ind, susp: c.susp, cork: c.cork, inv: c.inv, probes: c.probes, stir: c.stir,
                lit: c.lit, gas: c.gas, air: c.air, flow: c.flow, mount: null, sunE: c.sunE
            })),
            gog: CL.state.gog, warp: CL.state.warp
        };
    } catch (e) { return null; }
}
function chemRestore(snap) {
    const CL = window.ChemLab; if (!CL || !snap || !snap.items) return false;
    try {
        CL.state.items.slice().forEach(it => CL.removeItem(it));
        CL.state.tools.slice().forEach(it => CL.removeItem(it));
        snap.items.forEach(d => {
            let it = null;
            if (d.type === "bunsen" || d.type === "matchbox" || d.type === "burette") it = CL.spawnTool(d.type, d.x, d.y);
            else it = CL.spawn(d.type, d.x, d.y);
            if (!it) return;
            if (d.sc) it.sc = d.sc;
            if (it.vol !== undefined) {
                it.vol = d.vol; it.T = d.T;
                Object.assign(it.sp, d.sp); Object.assign(it.ppt, d.ppt); Object.assign(it.sol, d.sol);
                Object.assign(it.dep, d.dep); Object.assign(it.ind, d.ind);
                it.susp = d.susp; it.cork = d.cork; it.inv = d.inv; it.probes = (d.probes || []).slice(); it.stir = d.stir;
            }
            if (it.lit !== undefined) { it.lit = d.lit; it.gas = d.gas; it.air = d.air; }
            if (it.flow !== undefined) it.flow = d.flow;
            CL.place(it);
            if (CL.burnerView && it.type === "bunsen") CL.burnerView(it);
            if (it.vol !== undefined) CL.view(it);
        });
        CL.state.gog = snap.gog; CL.state.warp = snap.warp || 1;
        CL.renderPanel(true);
        return true;
    } catch (e) { console.error(e); return false; }
}

const LabReg = {
    SUBJECTS, def, exp, bySubject, topics, byTopic, allExps,
    open, session, close, mount, liveList, plannedCard,
    saveSession, restoreSession, chemSnapshot, chemRestore,
    LIVE
};
if (typeof module !== "undefined" && module.exports) module.exports = LabReg; else window.LabReg = LabReg;
})();
