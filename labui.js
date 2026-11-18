(function () {
/* ===================================================================
   LabUI (v94): interface kit + application shell for the Virtual Lab.
   Separation of concerns: this file knows nothing about chemistry or
   physics formulas — experiments (content modules) describe themselves
   with plain data and LabUI renders controls, charts, explanations and
   the notebook pipeline around them.
   =================================================================== */
"use strict";
const $ = id => document.getElementById(id);
const fmt = (x, d = 2) => x === null || x === undefined || (typeof x === "number" && !isFinite(x)) ? "∞" : String(Math.abs(x) >= 1000 ? +x.toFixed(0) : +x.toFixed(d));
const RM = () => matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ---------------- widgets ---------------- */
/* ctl: {k,label,min,max,step,unit,onLive,onDone} renders a live-readout slider */
function slider(ses, ctl) {
    const p = ses.params;
    const wrap = document.createElement("label");
    wrap.className = "xu-ctl";
    const v = p[ctl.k] !== undefined ? p[ctl.k] : ctl.min;
    wrap.innerHTML = '<span>' + ctl.label + ' <b class="xu-rv" data-k="' + ctl.k + '">' + fmt(v, ctl.d !== undefined ? ctl.d : 2) + (ctl.unit || "") + '</b></span>' +
        '<input type="range" min="' + ctl.min + '" max="' + ctl.max + '" step="' + (ctl.step || 1) + '" value="' + v + '" aria-label="' + ctl.label + '">';
    const inp = wrap.querySelector("input"), rv = wrap.querySelector(".xu-rv");
    inp.addEventListener("input", () => {
        const n = +inp.value; ses.set(ctl.k, n);
        rv.textContent = fmt(n, ctl.d !== undefined ? ctl.d : 2) + (ctl.unit || "");
        if (ctl.onLive) ctl.onLive(n, ses);
    });
    inp.addEventListener("change", () => { if (ctl.onDone) ctl.onDone(+inp.value, ses); });
    return wrap;
}
function select(ses, ctl) {
    const wrap = document.createElement("label");
    wrap.className = "xu-ctl";
    const v = ses.params[ctl.k];
    wrap.innerHTML = '<span>' + ctl.label + '</span><select aria-label="' + ctl.label + '">' +
        ctl.options.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? " selected" : "") + '>' + o[1] + '</option>').join("") + '</select>';
    wrap.querySelector("select").addEventListener("change", e => {
        let val = e.target.value;
        if (ctl.num) val = +val;
        ses.set(ctl.k, val);
        if (ctl.onDone) ctl.onDone(val, ses);
    });
    return wrap;
}
function checkbox(ses, ctl) {
    const wrap = document.createElement("label");
    wrap.className = "xu-ctl xu-check";
    wrap.innerHTML = '<input type="checkbox" style="width:auto"' + (ses.params[ctl.k] ? " checked" : "") + ' aria-label="' + ctl.label + '"><span>' + ctl.label + '</span>';
    wrap.querySelector("input").addEventListener("change", e => {
        ses.set(ctl.k, e.target.checked);
        if (ctl.onDone) ctl.onDone(e.target.checked, ses);
    });
    return wrap;
}
function numField(ses, ctl) {
    const wrap = document.createElement("label");
    wrap.className = "xu-ctl";
    wrap.innerHTML = '<span>' + ctl.label + (ctl.unit ? ' <i class="xu-u">(' + ctl.unit + ')</i>' : "") + '</span>' +
        '<input type="number" step="any" value="' + (ses.params[ctl.k] !== undefined ? ses.params[ctl.k] : "") + '" aria-label="' + ctl.label + '">';
    wrap.querySelector("input").addEventListener("change", e => {
        const n = parseFloat(e.target.value);
        if (e.target.value === "" || isNaN(n)) { ses.set(ctl.k, undefined); }
        else {
            let v = n;
            if (ctl.min !== undefined) v = Math.max(ctl.min, v);
            if (ctl.max !== undefined) v = Math.min(ctl.max, v);
            ses.set(ctl.k, v);
        }
        if (ctl.onDone) ctl.onDone(ses.params[ctl.k], ses);
    });
    return wrap;
}
function control(col, ses, ctl) {
    let el = null;
    if (ctl.type === "select") el = select(ses, ctl);
    else if (ctl.type === "check") el = checkbox(ses, ctl);
    else if (ctl.type === "number") el = numField(ses, ctl);
    else el = slider(ses, ctl);
    el._ctl = ctl;
    if (ctl.showIf) el.style.display = ctl.showIf(ses) ? "" : "none";
    col.appendChild(el);
    if (!ses._ctls) ses._ctls = [];
    ses._ctls.push(el);
    return el;
}
const ro = (k, v) => '<div class="ro"><span>' + k + '</span><b>' + v + '</b></div>';
const why = t => '<div class="why">' + t + '</div>';

/* ---------------- chart: labelled SVG with optional zoom/pan ---------------- */
/* spec: {W,H,series:[{pts:[[x,y]..],color,w,dash}],xLabel,yLabel,xTicks,yTicks,
         markers:[{x,y,label,color}],legend:[{label,color}],zeroY:bool}       */
function chart(spec) {
    const W = spec.W || 560, H = spec.H || 280, pad = spec.pad || 40;
    let xs = [], ys = [];
    (spec.series || []).forEach(s => s.pts.forEach(p => { xs.push(p[0]); ys.push(p[1]); }));
    (spec.markers || []).forEach(m => { xs.push(m.x); ys.push(m.y); });
    if (!xs.length) return '<svg viewBox="0 0 ' + W + ' ' + H + '"><text x="20" y="30" fill="var(--mut)">no data</text></svg>';
    let x0 = spec.xMin !== undefined ? spec.xMin : Math.min.apply(null, xs), x1 = spec.xMax !== undefined ? spec.xMax : Math.max.apply(null, xs);
    let y0 = spec.yMin !== undefined ? spec.yMin : Math.min.apply(null, ys), y1 = spec.yMax !== undefined ? spec.yMax : Math.max.apply(null, ys);
    if (spec.zeroY) { y0 = Math.min(0, y0); y1 = Math.max(0, y1); }
    if (x1 === x0) x1 = x0 + 1; if (y1 === y0) y1 = y0 + 1;
    const px = y0 - (y1 - y0) * .08, py = y1 + (y1 - y0) * .08;
    const X = x => pad + (x - x0) / (x1 - x0) * (W - 2 * pad);
    const Y = y => H - pad - (y - px) / (py - px) * (H - 2 * pad);
    const ticks = (a, b, n) => { const out = []; for (let i = 0; i <= n; i++) out.push(a + (b - a) * i / n); return out; };
    const xt = spec.xTicks || ticks(x0, x1, 4), yt = spec.yTicks || ticks(px, py, 4);
    let o = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xuchart" role="img">';
    yt.forEach(t => { o += '<line x1="' + pad + '" y1="' + Y(t).toFixed(1) + '" x2="' + (W - pad) + '" y2="' + Y(t).toFixed(1) + '" stroke="var(--bd)" stroke-width="1" stroke-dasharray="3 4"/><text x="' + (pad - 5) + '" y="' + (Y(t) + 3).toFixed(1) + '" font-size="10" fill="var(--mut)" text-anchor="end">' + fmt(t, spec.td || 1) + '</text>'; });
    xt.forEach(t => { o += '<line x1="' + X(t).toFixed(1) + '" y1="' + (H - pad - 4) + '" x2="' + X(t).toFixed(1) + '" y2="' + (H - pad + 4) + '" stroke="var(--mut)" stroke-width="1.2"/><text x="' + X(t).toFixed(1) + '" y="' + (H - pad + 16) + '" font-size="10" fill="var(--mut)" text-anchor="middle">' + fmt(t, spec.td || 1) + '</text>'; });
    if (px < 0 && py > 0) o += '<line x1="' + pad + '" y1="' + Y(0).toFixed(1) + '" x2="' + (W - pad) + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--mut)" stroke-width="1.4"/>';
    o += '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '" stroke="var(--mut)" stroke-width="1.6"/><line x1="' + pad + '" y1="' + pad / 2 + '" x2="' + pad + '" y2="' + (H - pad) + '" stroke="var(--mut)" stroke-width="1.6"/>';
    (spec.series || []).forEach(s => {
        if (!s.pts.length) return;
        o += '<polyline points="' + s.pts.map(p => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ") + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.w || 2.6) + '" stroke-linecap="round"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + '/>';
    });
    (spec.markers || []).forEach(m => {
        o += '<circle cx="' + X(m.x).toFixed(1) + '" cy="' + Y(m.y).toFixed(1) + '" r="5.5" fill="' + (m.color || "var(--acc2)") + '"/>';
        if (m.label) o += '<text x="' + X(m.x).toFixed(1) + '" y="' + (Y(m.y) - 9).toFixed(1) + '" font-size="11" fill="var(--tx)" text-anchor="middle">' + m.label + '</text>';
    });
    o += '<text x="' + (W / 2) + '" y="' + (H - 6) + '" font-size="11" fill="var(--mut)" text-anchor="middle">' + (spec.xLabel || "") + '</text>';
    o += '<text x="12" y="' + (H / 2) + '" font-size="11" fill="var(--mut)" text-anchor="middle" transform="rotate(-90 12 ' + (H / 2) + ')">' + (spec.yLabel || "") + '</text>';
    if (spec.legend && spec.legend.length > 1) {
        spec.legend.forEach((l, i) => {
            o += '<rect x="' + (W - pad - 120) + '" y="' + (10 + i * 16) + '" width="12" height="4" fill="' + l.color + '"/><text x="' + (W - pad - 104) + '" y="' + (15 + i * 16) + '" font-size="11" fill="var(--mut)">' + l.label + '</text>';
        });
    }
    o += '</svg>';
    return o;
}

/* ---------------- explanation panel (learning requirement #8) ---------------- */
function explain(meta, ses) {
    const sec = (t, b) => b ? '<div class="xsec2"><h4>' + t + '</h4><div>' + b + '</div></div>' : "";
    let h = '<div class="explain">';
    h += sec("🎯 What is being investigated?", meta.investigation);
    h += sec("📜 Scientific principle", meta.principle);
    h += sec("🧮 Equations & definitions", (meta.equations || []).map(e => '<code>' + e + '</code>').join("<br>"));
    h += sec("📐 Variables & units", (ses && ses.exp.variables && ses.exp.variables.length ? ses.exp.variables : meta.varList || []).map(v => '<span class="xv"><b>' + v[0] + '</b> ' + v[1] + '</span>').join(" "));
    h += sec("💡 Why this result occurs", typeof meta.why === "function" ? meta.why(ses) : meta.why);
    h += sec("⚠️ Assumptions & limitations", (meta.assumptions || []).join("<br>• "));
    h += sec("🌍 Real-world applications", (meta.applications || []).join("<br>• "));
    h += sec("🔭 Investigate further", (meta.next || []).join("<br>• "));
    h += sec("⚖️ Laws in play", (ses && ses.exp.laws || []).map(l => '<span class="lawchip">' + l + '</span>').join(""));
    h += '</div>';
    return h;
}

/* ---------------- notebook + project pipeline ---------------- */
/* recordBtn(host, getSes, meta): a "Save to notebook" + project linkage UI */
function recordBar(ses, getPayload) {
    const wrap = document.createElement("div");
    wrap.className = "xu-rec";
    const projects = window.LabStore.list("projects").filter(p => p.status === "open");
    wrap.innerHTML = '<button type="button" class="btn sm" data-a="nb">📓 Save reading to notebook</button>' +
        '<select data-a="pj" aria-label="Attach to project"><option value="">🔬 Attach run to project…</option>' +
        projects.map(p => '<option value="' + p.id + '">' + p.name + '</option>').join("") + '</select>' +
        '<button type="button" class="btn sm" data-a="sv">💾 Save session</button>';
    wrap.querySelector('[data-a="nb"]').onclick = () => {
        const pl = getPayload(ses);
        window.LabStore.noteAdd({
            subject: ses.exp.subject === "chem" ? "Chemistry" : ses.exp.subject === "phy" ? "Physics" : ses.exp.subject === "bio" ? "Biology" : ses.exp.subject,
            experiment: ses.exp.name, model: ses.exp.id, title: pl.title || ses.exp.name,
            detail: pl.detail || "", settings: ses.params, results: pl.results || null
        });
        toast("Saved to the Lab Notebook");
        if (Shell.state.view === "ws.notebook") Shell.renderView();
    };
    wrap.querySelector('[data-a="pj"]').onchange = e => {
        const pid = e.target.value; if (!pid) return;
        const pl = getPayload(ses);
        window.LabStore.projectRun(pid, {
            expId: ses.exp.id, params: JSON.parse(JSON.stringify(ses.params)),
            title: pl.title || ses.exp.name, detail: pl.detail || "", results: pl.results || null
        });
        toast("Run attached to project");
        e.target.value = "";
    };
    wrap.querySelector('[data-a="sv"]').onclick = () => {
        const nm = prompt("Save this session as:", ses.exp.name + " · " + new Date().toLocaleTimeString());
        if (nm === null) return;
        window.LabReg.saveSession(ses, nm || undefined);
        toast("Session saved — reopen it from Research Workspace");
    };
    return wrap;
}
function toast(msg) {
    let t = $("xtoast");
    if (!t) { t = document.createElement("div"); t.id = "xtoast"; t.className = "xtoast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------------- standard experiment layout builder ---------------- */
/* buildView(ses, {controls, stage, note}) — left controls, centre stage,
   right readings + explanation, with a record bar under the controls.    */
function buildView(ses, spec) {
    const root = document.createElement("div");
    root.className = "xview";
    root.innerHTML = '<div class="xctl2"></div><div class="xstage2"></div><div class="xnote2"></div>';
    ses.dom = { root, ctl: root.querySelector(".xctl2"), stage: root.querySelector(".xstage2"), note: root.querySelector(".xnote2") };
    const h3 = document.createElement("h3");
    h3.innerHTML = ses.exp.icon + " " + ses.exp.name + ' <small class="xlevel">' + ses.exp.level + '</small>';
    ses.dom.ctl.appendChild(h3);
    (spec.controls || []).forEach(c => control(ses.dom.ctl, ses, c));
    if (spec.record !== false) ses.dom.ctl.appendChild(recordBar(ses, spec.payload || (s => ({ title: s.exp.name, detail: "", results: s.results }))));
    ses.rerender = () => {
        (ses._ctls || []).forEach(el => { if (el._ctl && el._ctl.showIf) el.style.display = el._ctl.showIf(ses) ? "" : "none"; });
        const out = spec.stage(ses);
        ses.dom.stage.innerHTML = typeof out === "string" ? out : "";
        if (typeof out !== "string" && out) { ses.dom.stage.textContent = ""; ses.dom.stage.appendChild(out); }
        const readings = spec.note ? spec.note(ses) : "";
        ses.dom.note.innerHTML = "<h3>Readings</h3>" + readings +
            (spec.explain ? explain(spec.explain, ses) : "");
    };
    ses.rerender();
    return root;
}

/* ---------------- application shell ---------------- */
const NAV_EXTRA = [
    { id: "ws.research", icon: "🗂", name: "Research Workspace" },
    { id: "ws.notebook", icon: "📓", name: "Lab Notebook" },
    { id: "ws.compare", icon: "⚖️", name: "Experiment Comparison" },
    { id: "ws.hypo", icon: "🧠", name: "Hypothesis & Predictions" },
    { id: "ws.results", icon: "📊", name: "Results & Analysis" },
    { id: "ws.prac", icon: "📋", name: "Practical Records" }
];
const Shell = {
    state: { view: "chem.bench", sidebar: true, inspector: true },
    views: {},          /* viewId -> render(host) for workspace tabs */
    sessionsByView: {}, /* viewId -> live session key (kept across switches) */
    init() {
        const L = window.LabStore.layoutGet();
        if (L.view) this.state.view = L.view;
        if (L.sidebar === false) this.state.sidebar = false;
        if (L.inspector === false) this.state.inspector = false;
        window.LabStore.importLegacyNotes();
        this.renderNav();
        this.wireToolbar();
        this.applyView(this.state.view, true);
        document.addEventListener("keydown", e => {
            if (e.ctrlKey && e.key.toLowerCase() === "b") { e.preventDefault(); this.toggleSidebar(); }
        });
    },
    persist() { window.LabStore.layoutSet({ view: this.state.view, sidebar: this.state.sidebar, inspector: this.state.inspector, hypo: this.state.hypo }); },
    renderNav() {
        const sb = $("sbNav"); if (!sb) return;
        let h = "";
        window.LabReg.SUBJECTS.forEach(sub => {
            h += '<div class="sbgrp"><button type="button" class="sbhead" data-g="' + sub.id + '" aria-expanded="true">' + sub.icon + " " + sub.name + '</button><div class="sbitems" data-gi="' + sub.id + '">';
            if (sub.id === "ws") {
                NAV_EXTRA.forEach(v => { h += '<button type="button" class="sbitem" data-v="' + v.id + '">' + v.icon + " " + v.name + '</button>'; });
            } else {
                window.LabReg.topics(sub.id).forEach(tp => {
                    h += '<div class="sbtopic">' + tp + '</div>';
                    window.LabReg.byTopic(sub.id, tp).forEach(e => {
                        h += '<button type="button" class="sbitem' + (e.planned ? " planned" : "") + '" data-v="' + e.id + '">' + e.icon + " " + e.name + (e.planned ? ' <i class="plbadge">planned</i>' : "") + '</button>';
                    });
                });
            }
            h += '</div></div>';
        });
        sb.innerHTML = h;
        sb.querySelectorAll("[data-v]").forEach(b => b.onclick = () => this.applyView(b.dataset.v));
        sb.querySelectorAll("[data-g]").forEach(b => b.onclick = () => {
            const items = sb.querySelector('[data-gi="' + b.dataset.g + '"]');
            const open = items.style.display !== "none";
            items.style.display = open ? "none" : "";
            b.setAttribute("aria-expanded", String(!open));
        });
        this.markNav();
    },
    markNav() {
        document.querySelectorAll("#sbNav [data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === this.state.view));
        const e = window.LabReg.exp(this.state.view);
        const name = e ? e.name : (NAV_EXTRA.find(v => v.id === this.state.view) || {}).name || "Virtual Lab";
        const bc = $("crumb"); if (bc) bc.textContent = (e ? e.subject + " · " + e.topic + " · " : "workspace · ") + name;
    },
    applyView(v, first) {
        const prev = this.state.view;
        this.state.view = v;
        this.persist();
        const main = $("main");
        /* chemistry bench: the preserved singleton workspace */
        const chemOn = v === "chem.bench";
        main.classList.toggle("chem-on", chemOn);
        $("viewHost").hidden = chemOn;
        ["tool", "ws", "pan"].forEach(cn => { const el = document.querySelector("." + cn); if (el) el.style.display = chemOn ? "" : "none"; });
        const topChem = $("chemTop"); if (topChem) topChem.style.display = chemOn ? "" : "none";
        const host = $("viewHost");
        if (chemOn) { host.textContent = ""; }
        else {
            host.textContent = "";
            const reg = window.LabReg.exp(v);
            if (reg) {
                /* keep one live session per experiment view; never destroyed on switch */
                if (!this.sessionsByView[v]) this.sessionsByView[v] = window.LabReg.open(v).key;
                const ses = window.LabReg.session(this.sessionsByView[v]);
                window.LabReg.mount(ses, host);
                if (ses.exp.onShow) try { ses.exp.onShow(ses); } catch (e) { console.error(e); }
            } else if (this.views[v]) {
                const d = document.createElement("div");
                d.className = "xview-inner wview";
                host.appendChild(d);
                this.views[v](d, first);
            } else {
                host.innerHTML = '<div class="planned"><div class="plico">🚧</div><h3>Not found</h3><p>No view is registered as <code>' + v + '</code>.</p></div>';
            }
        }
        if (prev === "chem.bench" && !chemOn && window.ChemLab) { } /* bench RAF keeps running; harmless & cheap */
        this.markNav();
        if (window.ShellHooks && window.ShellHooks.onView) window.ShellHooks.onView(v, prev);
    },
    renderView() { this.applyView(this.state.view); },
    toggleSidebar() {
        this.state.sidebar = !this.state.sidebar;
        $("lab2").classList.toggle("sb-collapsed", !this.state.sidebar);
        this.persist();
    },
    toggleInspector() {
        this.state.inspector = !this.state.inspector;
        $("lab2").classList.toggle("insp-collapsed", !this.state.inspector);
        this.persist();
    },
    wireToolbar() {
        $("sbToggle").onclick = () => this.toggleSidebar();
        $("fsBtn").onclick = () => {
            if (!document.fullscreenElement) (document.documentElement.requestFullscreen ? document.documentElement.requestFullscreen() : 0);
            else document.exitFullscreen();
        };
        const ib = $("inspToggle"); if (ib) ib.onclick = () => this.toggleInspector();
        $("lab2").classList.toggle("sb-collapsed", !this.state.sidebar);
        $("lab2").classList.toggle("insp-collapsed", !this.state.inspector);
    }
};

const LabUI = { $, fmt, RM, slider, select, checkbox, numField, control, ro, why, chart, explain, recordBar, toast, buildView, Shell, NAV_EXTRA };
if (typeof module !== "undefined" && module.exports) module.exports = LabUI; else window.LabUI = LabUI;
})();
