(function () {
/* ===================================================================
   LabViews (v94): shared workspace tabs + the chem-bench registry entry.
   Research Workspace, Lab Notebook, Experiment Comparison,
   Hypothesis & Predictions, Results & Analysis — all backed by LabStore.
   =================================================================== */
"use strict";
const U = window.LabUI, R = window.LabReg;
const $ = id => document.getElementById(id);
const S = () => window.LabStore;
const esc = s => String(s === undefined || s === null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------------- chem bench as a registry entry ---------------- */
R.def({
    id: "chem.bench", subject: "chem", topic: "Experiment Bench", name: "Experiment Bench", icon: "🧪",
    level: "Class 10", laws: ["Full reaction engine (chemcore)", "Heat transfer", "Gas laws (qualitative)", "Solubility rules", "Reactivity series"],
    apparatus: ["Flasks", "Test tubes", "Burette", "Bunsen burner", "Tongs", "Probes", "Indicators", "Electrolysis mug"],
    variables: [["reagents", "any from the catalogue"], ["amounts", "mL / g"], ["T", "temperature via burner"], ["time", "warp ×1–×10"]],
    defaults: {}
}, {
    mount(ses) {
        ses.el.innerHTML = '<div class="planned"><div class="plico">🧪</div><h3>Experiment Bench</h3><p>The full drag-and-drop chemistry bench is the left-hand workspace view. Select <b>Chemistry Lab → Experiment Bench</b> in the sidebar.</p></div>';
    },
    snapshot() { return R.chemSnapshot(); },
    restore(ses) { return R.chemRestore(ses.restored); }
});

/* ---------------- overlay plots for comparison ---------------- */
function plotOf(ses) {
    const p = ses.params, PC = window.PhysCore, BC = window.BioCore;
    if (ses.id === "phy.proj") { const r = PC.projectile({ v0: p.v0, angle: p.ang, h0: p.h0, g: p.g, drag: p.drag, k: p.k }); return { pts: r.pts.map(q => [q.x, q.y]), x: "distance (m)", y: "height (m)" }; }
    if (ses.id === "phy.heat") { const r = R.exp("phy.heat").compute(p); return { pts: r.pts, x: "time (min)", y: "temperature (°C)" }; }
    if (ses.id === "phy.wave") { const r = R.exp("phy.wave").compute(p); return { pts: r.pts, x: "position (m)", y: "amplitude" }; }
    if (ses.id === "phy.pend") { const pts = []; for (let L = 0.1; L <= 3; L += 0.05) pts.push([L, 2 * Math.PI * Math.sqrt(L / p.g)]); return { pts: pts, x: "length (m)", y: "period (s)" }; }
    if (ses.id === "bio.photo") { const pts = []; for (let L = 0; L <= 100; L += 2) pts.push([L, BC.photo({ light: L, co2: p.co2, temp: p.ptemp }).net]); return { pts: pts, x: "light (%)", y: "net rate" }; }
    if (ses.id === "bio.enz") { const pts = []; for (let T = 0; T <= 80; T++) pts.push([T, BC.enzyme({ id: p.enz, temp: T, ph: p.ph, S: p.S }).activity]); return { pts: pts, x: "temperature (°C)", y: "activity (%)" }; }
    if (ses.id === "bio.chain") { const r = BC.chain({ producerkJ: p.prod, levels: p.lv, eff: p.eff }); return { pts: r.levels.map((l, i) => [i, l.kJ]), x: "trophic level", y: "energy (kJ)" }; }
    if (ses.id === "phy.circ") { const c = PC.circuit({ V: p.V, mode: p.mode, rs: [p.r1, p.r2, p.r3] }); return c ? { pts: c.parts.map(x => [x.i + 1, x.P]), x: "resistor", y: "power (W)" } : null; }
    if (ses.id === "bio.cardiac") { const r = R.exp("bio.cardiac").compute(p); const pts = []; for (let e = 0; e <= 100; e += 2) pts.push([e, (p.hr * (1 + .9 * e / 100) * (1 - .12 * p.fit / 100)) * (p.sv * (1 + .35 * e / 100) * (1 + .25 * p.fit / 100)) / 1000]); return { pts: pts, x: "exercise (%)", y: "cardiac output (L/min)" }; }
    return null;
}
function numbersOf(ses) {
    const out = {};
    try {
        const r = ses.compute ? ses.compute() : null;
        if (!r) return out;
        if (ses.id === "phy.proj") { out["Range (m)"] = r.R; out["Flight time (s)"] = r.T; out["Max height (m)"] = r.H; out["Impact speed (m/s)"] = r.vImpact; }
        else if (ses.id === "phy.circ") { out["Req (Ω)"] = r.Req; out["I (A)"] = r.I; out["P (W)"] = r.P; }
        else if (ses.id === "phy.opt") { out["v (cm)"] = r.v; out["M"] = r.M; }
        else if (ses.id === "phy.pend") { out["T (s)"] = r.T; }
        else if (ses.id === "phy.incline") { out["a (m/s²)"] = r.a; out["N (N)"] = r.Wperp; }
        else if (ses.id === "phy.heat") { out["Mixture T (°C)"] = r.Tf; }
        else if (ses.id === "phy.wave") { out["f (Hz)"] = r.f; out["v (m/s)"] = r.v; }
        else if (ses.id === "phy.mag") { out["B (µT)"] = r.B * 1e6; if (r.F !== null) out["F (N)"] = r.F; }
        else if (ses.id === "bio.photo") { out["Net rate"] = r.net; out["Limiting"] = NaN; }
        else if (ses.id === "bio.enz") { out["Activity (%)"] = r.activity; }
        else if (ses.id === "bio.chain") { out["Top kJ"] = r.levels[r.levels.length - 1].kJ; }
        else if (ses.id === "bio.cardiac") { out["CO (L/min)"] = r.CO; out["DO₂ (mL/min)"] = r.DO2; }
        else if (ses.id === "bio.gen") { out["Boxes"] = r.total; }
        else if (ses.id === "chem.conc") { out["M (mol/L)"] = r.c; }
        else if (ses.id === "chem.acid") { out["pH"] = r.ph; out["Veq (mL)"] = r.veq; }
        else if (ses.id === "chem.metals") { out["E°cell (V)"] = r.Ecell; }
        else if (ses.id === "chem.elec") { out["E°cell (V)"] = r.E; }
    } catch (e) { }
    return out;
}
const COMPATIBLE = ["phy.proj", "phy.circ", "phy.opt", "phy.pend", "phy.incline", "phy.heat", "phy.wave", "bio.photo", "bio.enz", "bio.chain", "bio.cardiac", "bio.gen", "chem.conc", "chem.acid", "chem.metals", "chem.elec"];

/* ---------------- RESEARCH WORKSPACE ---------------- */
U.Shell.views["ws.research"] = function (host) {
    const render = () => {
        const sess = S().list("sessions").slice().sort((a, b) => b.updated - a.updated);
        const proj = S().list("projects").slice().sort((a, b) => b.updated - a.updated);
        let h = '<h2>🗂 Research Workspace</h2><p class="xsmall">Saved experiment sessions and research projects — all stored offline in this browser. Nothing here is ever overwritten silently: saving always creates a new record.</p>';
        h += '<div class="wcols"><div class="wcol"><h3>💾 Saved sessions (' + sess.length + ')</h3>';
        if (!sess.length) h += '<p class="xsmall">Open any experiment and press <b>💾 Save session</b> under its controls. Saved sessions restore their exact slider values (and for the chem bench, the whole table).</p>';
        sess.forEach(x => {
            const e = R.exp(x.expId);
            h += '<div class="wcard"><div class="wchead"><b>' + esc(x.name) + '</b><span class="pchip">' + (e ? e.icon + " " + e.name : esc(x.expId)) + '</span></div>' +
                '<div class="wsmall">' + new Date(x.updated).toLocaleString() + '</div>' +
                '<div class="wacts"><button class="btn sm" data-r="' + x.id + '">▶ Restore</button><button class="btn sm" data-dup="' + x.id + '">⧉ Duplicate</button><button class="btn sm" data-ren="' + x.id + '">✏ Rename</button><button class="btn sm danger" data-del="' + x.id + '">🗑</button></div></div>';
        });
        h += '</div><div class="wcol"><h3>🔬 Research projects (' + proj.length + ')</h3>';
        h += '<button class="btn on" id="newProj">＋ New research project</button>';
        if (!proj.length) h += '<p class="xsmall">Projects carry the full scientific method: hypothesis → variables → prediction → runs → conclusion. Create one, then attach experiment runs to it.</p>';
        proj.forEach(x => {
            h += '<div class="wcard"><div class="wchead"><b>' + esc(x.name) + '</b><span class="pchip">' + (x.status === "closed" ? "closed" : x.runs.length + " runs") + '</span></div>' +
                '<div class="wsmall">' + esc(x.hypothesis ? "H: " + x.hypothesis.slice(0, 90) : "no hypothesis yet") + '</div>' +
                '<div class="wacts"><button class="btn sm" data-openp="' + x.id + '">Open in Hypothesis tab</button><button class="btn sm" data-dupp="' + x.id + '">⧉</button><button class="btn sm" data-delp="' + x.id + '">🗑</button></div></div>';
        });
        h += '</div></div>';
        h += '<h3>📦 Backup & restore</h3><div class="wacts"><button class="btn sm" id="expAll">⬇ Export all lab data (JSON)</button><button class="btn sm" id="impAll">⬆ Import backup…</button><input type="file" id="impFile" accept=".json" hidden></div>' +
            '<p class="xsmall">Export writes a single JSON file with every note, project and saved session. Import keeps a safety copy of current data first. The main tracker\'s Supabase sync is untouched.</p>';
        host.innerHTML = h;
        host.querySelector("#newProj").onclick = () => {
            const nm = prompt("Project name:", "Investigation " + new Date().toLocaleDateString());
            if (nm === null) return;
            const p = S().projectAdd({ name: nm || "Untitled project" });
            U.Shell.state.hypo = p.id; U.Shell.applyView("ws.hypo");
        };
        host.querySelectorAll("[data-r]").forEach(b => b.onclick = () => {
            const rec = S().get("sessions", b.dataset.r);
            const e = R.exp(rec.expId);
            if (!e) return U.toast("That experiment is no longer registered");
            if (rec.expId === "chem.bench") {
                if (R.chemRestore(rec.snap.extra)) { U.Shell.applyView("chem.bench"); U.toast("Bench table restored"); }
                else U.toast("Could not restore the bench (open the Chemistry bench once first)");
            } else {
                const ses = R.restoreSession(rec);
                U.Shell.sessionsByView[rec.expId] = ses.key;
                U.Shell.applyView(rec.expId);
                U.toast("Session restored into " + e.name);
            }
        });
        host.querySelectorAll("[data-dup]").forEach(b => b.onclick = () => { S().duplicate("sessions", b.dataset.dup); render(); });
        host.querySelectorAll("[data-ren]").forEach(b => b.onclick = () => {
            const rec = S().get("sessions", b.dataset.ren);
            const nm = prompt("Rename session:", rec.name);
            if (nm !== null && nm !== "") { S().update("sessions", rec.id, { name: nm }); render(); }
        });
        host.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { if (confirm("Delete this saved session?")) { S().remove("sessions", b.dataset.del); render(); } });
        host.querySelectorAll("[data-openp]").forEach(b => b.onclick = () => { U.Shell.state.hypo = b.dataset.openp; U.Shell.applyView("ws.hypo"); });
        host.querySelectorAll("[data-dupp]").forEach(b => b.onclick = () => { S().duplicate("projects", b.dataset.dupp); render(); });
        host.querySelectorAll("[data-delp]").forEach(b => b.onclick = () => { if (confirm("Delete this project and all its runs?")) { S().remove("projects", b.dataset.delp); render(); } });
        host.querySelector("#expAll").onclick = () => {
            const blob = new Blob([S().exportAll()], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob); a.download = "aalim-lab-backup.json"; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        };
        const imp = host.querySelector("#impFile");
        host.querySelector("#impAll").onclick = () => imp.click();
        imp.onchange = () => {
            const f = imp.files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
                const r = S().importAll(String(rd.result));
                if (r.ok) { U.toast("Imported: " + r.counts.notes + " notes, " + r.counts.projects + " projects, " + r.counts.sessions + " sessions"); render(); }
                else U.toast("Import failed: " + r.error);
            };
            rd.readAsText(f);
        };
    };
    render();
};

/* ---------------- LAB NOTEBOOK ---------------- */
U.Shell.views["ws.notebook"] = function (host) {
    let q = "", subject = "all";
    const render = () => {
        const notes = S().noteSearch(q, subject);
        let h = '<h2>📓 Lab Notebook</h2><p class="xsmall">Every "Save reading" from any experiment lands here automatically with its settings and results — searchable, editable, exportable, and it survives refresh (offline storage).</p>';
        h += '<div class="nbbar"><input id="nbQ" type="search" placeholder="Search notes…" value="' + esc(q) + '" aria-label="Search notes"><select id="nbS" aria-label="Filter by subject"><option value="all">All subjects</option>' +
            [["Chemistry", "chem"], ["Physics", "phy"], ["Biology", "bio"]].map(s2 => '<option value="' + (s2[1] === "chem" ? "Chemistry" : s2[1] === "phy" ? "Physics" : "Biology") + '"' + (subject === (s2[1] === "chem" ? "Chemistry" : s2[1] === "phy" ? "Physics" : "Biology") ? " selected" : "") + '>' + s2[0] + '</option>').join("") + '</select>' +
            '<button class="btn sm" id="nbAdd">＋ Manual entry</button><button class="btn sm" id="nbExp">⬇ Export CSV</button></div>';
        if (!notes.length) h += '<p class="xsmall">No entries yet — run an experiment and press 📓, or add a manual entry.</p>';
        notes.forEach(n => {
            h += '<div class="nbentry" data-id="' + n.id + '"><div class="nbhead"><b>' + esc(n.title) + '</b>' +
                '<span class="pchip">' + esc(n.subject || "—") + '</span><span class="pchip">' + esc(n.experiment || "") + '</span>' +
                '<time>' + new Date(n.updated).toLocaleString() + '</time>' + (n.pinned ? '<span class="pin">📌</span>' : "") + '</div>' +
                '<div class="nbdet">' + esc(n.detail) + '</div>' +
                (n.results ? '<details><summary>settings & results</summary><pre>' + esc(JSON.stringify({ settings: n.settings, results: n.results }, null, 1)) + '</pre></details>' : "") +
                '<textarea class="nbnote" rows="2" placeholder="My notes / conclusion…">' + esc(n.note) + '</textarea>' +
                '<div class="wacts"><button class="btn sm" data-save>💾 Save note</button><button class="btn sm" data-pin>' + (n.pinned ? "Unpin" : "📌 Pin") + '</button><button class="btn sm danger" data-del>🗑</button></div></div>';
        });
        host.innerHTML = h;
        host.querySelector("#nbQ").oninput = e => { q = e.target.value; const pos = e.target.selectionStart; render(); const el = host.querySelector("#nbQ"); el.focus(); el.setSelectionRange(pos, pos); };
        host.querySelector("#nbS").onchange = e => { subject = e.target.value; render(); };
        host.querySelector("#nbAdd").onclick = () => {
            const t = prompt("Entry title:"); if (t === null) return;
            S().noteAdd({ subject: "Manual", title: t || "Note", detail: prompt("What did you observe or want to remember?") || "" });
            render();
        };
        host.querySelector("#nbExp").onclick = () => {
            const rows = [["date", "subject", "experiment", "title", "detail", "note"]];
            S().noteSearch(q, subject).forEach(n => rows.push([new Date(n.updated).toISOString(), n.subject, n.experiment, n.title, n.detail, n.note || ""]));
            const csv = rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "lab-notebook.csv"; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        };
        host.querySelectorAll(".nbentry").forEach(en => {
            const id = en.dataset.id;
            en.querySelector("[data-save]").onclick = () => { S().update("notes", id, { userNote: en.querySelector(".nbnote").value, note: en.querySelector(".nbnote").value }); U.toast("Note saved"); };
            en.querySelector("[data-pin]").onclick = () => { const n = S().get("notes", id); S().update("notes", id, { pinned: !n.pinned }); render(); };
            en.querySelector("[data-del]").onclick = () => { if (confirm("Delete this notebook entry?")) { S().remove("notes", id); render(); } };
        });
    };
    render();
};

/* ---------------- EXPERIMENT COMPARISON ---------------- */
U.Shell.views["ws.compare"] = function (host) {
    const cmp = { a: null, b: null };
    const opts = COMPATIBLE.map(id => { const e = R.exp(id); return '<option value="' + id + '">' + e.icon + " " + e.name + ' (' + e.topic + ')</option>'; }).join("");
    const render = () => {
        let h = '<h2>⚖️ Experiment Comparison</h2><p class="xsmall">Two fully independent sessions of the same model, side by side. Differing inputs are highlighted and the outcome differences are computed — not narrated.</p>';
        h += '<div class="cmpsel"><label>Experiment<select id="cmpE">' + opts + '</select></label></div>';
        h += '<div class="cmpcols"><div class="cmpcol" id="cmpA"></div><div class="cmpcol" id="cmpB"></div></div>';
        h += '<div id="cmpOut"></div>';
        host.innerHTML = h;
        host.querySelector("#cmpE").onchange = e => {
            if (cmp.a) R.close(cmp.a.key); if (cmp.b) R.close(cmp.b.key);
            cmp.a = R.open(e.target.value); cmp.b = R.open(e.target.value);
            drawSides();
        };
        if (!cmp.a) { cmp.a = R.open(COMPATIBLE[0]); cmp.b = R.open(COMPATIBLE[0]); }
        drawSides();
        function drawSides() {
            [["cmpA", "a", "Experiment A"], ["cmpB", "b", "Experiment B"]].forEach(side => {
                const col = host.querySelector("#" + side[0]), ses = cmp[side[1]];
                col.innerHTML = "<h3>" + side[2] + ' <small class="xlevel">' + ses.exp.icon + " " + ses.exp.name + '</small></h3><div class="cmpctls"></div><div class="cmpstage"></div>';
                const ctl = col.querySelector(".cmpctls");
                (ses.exp.defaults ? Object.keys(ses.exp.defaults) : []).forEach(() => { });
                const spec = specFor(ses, () => { drawSides(); });
                spec.forEach(c2 => U.control(ctl, ses, c2));
                col.querySelector(".cmpstage").innerHTML = miniStage(ses);
            });
            drawCompare();
        }
        function drawCompare() {
            const out = host.querySelector("#cmpOut");
            const A = cmp.a, Bv = cmp.b;
            const na = numbersOf(A), nb = numbersOf(Bv);
            const pa = plotOf(A), pb = plotOf(Bv);
            let h = "";
            if (pa && pb && pa.x === pb.x) {
                h += '<h3>Overlay</h3>' + U.chart({ W: 680, H: 300, zeroY: true, series: [{ pts: pa.pts, color: "var(--acc)", w: 3 }, { pts: pb.pts, color: "var(--orange)", w: 3, dash: "6 5" }], legend: [{ label: "A", color: "var(--acc)" }, { label: "B", color: "var(--orange)" }], xLabel: pa.x, yLabel: pa.y });
            }
            const keys = [...new Set(Object.keys(na).concat(Object.keys(nb)))];
            if (keys.length) {
                h += '<h3>Outcome table</h3><table class="ptable"><tr><th>Quantity</th><th>A</th><th>B</th><th>Δ (B−A)</th></tr>' +
                    keys.map(k => {
                        const a = na[k], b = nb[k];
                        const d = (typeof a === "number" && typeof b === "number" && isFinite(a) && isFinite(b)) ? b - a : null;
                        const diff = d !== null && Math.abs(d) > 1e-9;
                        return '<tr' + (diff ? ' class="diff"' : "") + '><td>' + k + '</td><td>' + (typeof a === "number" ? U.fmt(a, 3) : a || "—") + '</td><td>' + (typeof b === "number" ? U.fmt(b, 3) : b || "—") + '</td><td>' + (d === null ? "—" : (d > 0 ? "+" : "") + U.fmt(d, 3)) + '</td></tr>';
                    }).join("") + '</table>';
            }
            const diffs = Object.keys(A.params).filter(k => JSON.stringify(A.params[k]) !== JSON.stringify(Bv.params[k]));
            h += '<h3>What differs</h3>' + (diffs.length ? '<p class="xsmall">Inputs that differ: <b>' + diffs.join(", ") + '</b>. Everything else is identical, so every difference in the outcome table above is caused by exactly these inputs — that is a controlled experiment.</p>' : '<p class="xsmall">A and B have identical inputs — outcomes match exactly. Change one side to see cause and effect.</p>');
            out.innerHTML = h;
        }
    };
    function miniStage(ses) {
        try {
            const r = ses.compute();
            const nums = numbersOf(ses);
            return '<div class="cmpnums">' + Object.keys(nums).map(k => '<div class="ro"><span>' + k + '</span><b>' + (typeof nums[k] === "number" ? U.fmt(nums[k], 3) : nums[k]) + '</b></div>').join("") + '</div>';
        } catch (e) { return ""; }
    }
    function specFor(ses, onChange) {
        const p = ses.params, id = ses.id;
        const sl = (k, label, min, max, step, unit, d) => ({ k: k, label: label, min: min, max: max, step: step || 1, unit: unit || "", d: d !== undefined ? d : 0, onLive: onChange, onDone: onChange });
        const sel = (k, label, options, num) => ({ k: k, label: label, type: "select", options: options, num: num, onDone: onChange });
        if (id === "phy.proj") return [sl("v0", "v₀", 1, 60, 1, " m/s"), sl("ang", "θ", 0, 90, 1, "°"), sl("h0", "h₀", 0, 50, 1, " m"), sel("g", "Gravity", [["9.8", "Earth"], ["1.62", "Moon"], ["3.71", "Mars"], ["24.8", "Jupiter"]], true)];
        if (id === "phy.circ") return [sel("mode", "Connection", [["series", "Series"], ["parallel", "Parallel"]]), sl("V", "Battery", 1, 24, 1, " V"), sl("r1", "R1", 0, 50, 1, " Ω"), sl("r2", "R2", 0, 50, 1, " Ω"), sl("r3", "R3", 0, 50, 1, " Ω")];
        if (id === "phy.opt") return [sel("kind", "Device", [["lens", "Convex lens"], ["lensn", "Concave lens"], ["mirror", "Concave mirror"], ["mirrorx", "Convex mirror"]]), sl("f", "|f|", 4, 30, 1, " cm"), sl("u", "|u|", 5, 90, 1, " cm")];
        if (id === "phy.pend") return [sl("L", "Length", 0.1, 3, 0.05, " m", 2), sl("th0", "θ₀", 1, 80, 1, "°"), sel("g", "Gravity", [["9.8", "Earth"], ["1.62", "Moon"], ["3.71", "Mars"]], true)];
        if (id === "phy.incline") return [sl("th", "θ", 0, 70, 1, "°"), sl("mu", "μ", 0, 1, 0.05, "", 2), sl("m", "m", 0.5, 10, 0.5, " kg", 1)];
        if (id === "phy.heat") return [sl("m1", "m₁", 0.05, 1, 0.05, " kg", 2), sl("T1", "T₁", 30, 100, 1, " °C"), sl("m2", "m₂", 0.05, 1, 0.05, " kg", 2), sl("T2", "T₂", 0, 30, 1, " °C")];
        if (id === "phy.wave") return [sl("L", "L", 0.2, 2, 0.05, " m", 2), sl("T", "Tension", 5, 200, 1, " N"), sl("mu", "μ", 0.2, 8, 0.1, " g/m", 1), sl("n", "n", 1, 8, 1, "")];
        if (id === "bio.photo") return [sl("light", "Light", 0, 100, 1, "%"), sl("co2", "CO₂", 0, 1500, 10, " ppm"), sl("ptemp", "Temp", 0, 55, 1, " °C")];
        if (id === "bio.enz") return [sel("enz", "Enzyme", Object.keys(window.BioCore.ENZYMES).map(k => [k, window.BioCore.ENZYMES[k].n])), sl("etemp", "Temp", 0, 80, 1, " °C"), sl("ph", "pH", 0, 14, 0.5, "", 1), sl("S", "[S]", 0, 100, 1, " mM")];
        if (id === "bio.chain") return [sl("prod", "Producers", 1000, 100000, 500, " kJ"), sl("lv", "Levels", 2, 5, 1, ""), sl("eff", "Efficiency", 2, 25, 1, "%")];
        if (id === "bio.cardiac") return [sl("hr", "HR", 40, 120, 1, " bpm"), sl("sv", "SV", 40, 120, 1, " mL"), sl("exer", "Exercise", 0, 100, 1, "%"), sl("fit", "Fitness", 0, 100, 1, "%")];
        if (id === "bio.gen") return [sel("p1", "Parent 1", [["TT", "TT"], ["Tt", "Tt"], ["tt", "tt"]]), sel("p2", "Parent 2", [["TT", "TT"], ["Tt", "Tt"], ["tt", "tt"]])];
        if (id === "chem.conc") return [sl("mass", "Mass", 0.1, 100, 0.1, " g", 2), sl("V", "Volume", 10, 1000, 10, " mL")];
        if (id === "chem.acid") return [sl("Ca", "Ca", 0.01, 1, 0.01, " M", 2), sl("Va", "Va", 5, 50, 1, " mL"), sl("Cb", "Cb", 0.01, 1, 0.01, " M", 2), sl("Vb", "Vb", 0, 100, 0.5, " mL", 1)];
        if (id === "chem.metals") return [sl("metal", "Metal", 0, 11, 1, ""), sl("ion", "Ion", 0, 11, 1, "")];
        if (id === "chem.elec") return [sl("a", "Left", 0, 11, 1, ""), sl("c", "Right", 0, 11, 1, "")];
        return [];
    }
    render();
};

/* ---------------- HYPOTHESIS & PREDICTIONS ---------------- */
U.Shell.views["ws.hypo"] = function (host) {
    const render = () => {
        const projects = S().list("projects").slice().sort((a, b) => b.updated - a.updated);
        let pid = U.Shell.state.hypo && S().get("projects", U.Shell.state.hypo) ? U.Shell.state.hypo : (projects[0] ? projects[0].id : null);
        let h = '<h2>🧠 Hypothesis & Predictions</h2><p class="xsmall">The scientific method as a workflow: question → hypothesis → variables → prediction (recorded BEFORE the run) → experiment → compare → conclusion.</p>';
        h += '<div class="nbbar"><select id="hpSel" aria-label="Project">' + projects.map(p => '<option value="' + p.id + '"' + (p.id === pid ? " selected" : "") + '>' + esc(p.name) + '</option>').join("") + '</select><button class="btn sm" id="hpNew">＋ New project</button></div>';
        if (!pid) { h += '<p class="xsmall">Create a project to begin.</p>'; host.innerHTML = h; wireList(); return; }
        const p = S().get("projects", pid);
        const exps = R.allExps().filter(e => !e.planned && e.id !== "chem.bench" && e.subject !== "ws");
        h += '<div class="hypoform">' +
            '<label>Project name<input id="hName" value="' + esc(p.name) + '"></label>' +
            '<label>Investigation question<input id="hQ" value="' + esc(p.question || "") + '" placeholder="e.g. How does launch angle affect range?"></label>' +
            '<label>Hypothesis (a testable statement)<textarea id="hH" rows="2" placeholder="If … then … because …">' + esc(p.hypothesis) + '</textarea></label>' +
            '<div class="hrow3"><label>Independent variable (you change)<input id="hIv" value="' + esc(p.iv) + '"></label><label>Dependent variable (you measure)<input id="hDv" value="' + esc(p.dv) + '"></label><label>Controlled variables (kept same)<input id="hCv" value="' + esc(p.cv) + '"></label></div>' +
            '<label>Prediction — record it BEFORE running (numeric if possible)<textarea id="hP" rows="2" placeholder="I predict that … will be about …">' + esc(p.prediction) + '</textarea></label>' +
            '<label>Experiment to test it<select id="hExp"><option value="">— choose —</option>' + exps.map(e => '<option value="' + e.id + '"' + (p.experiment === e.id ? " selected" : "") + '>' + e.icon + " " + e.name + '</option>').join("") + '</select></label>' +
            '<div class="wacts"><button class="btn sm on" id="hSave">💾 Save project</button><button class="btn sm" id="hGo">▶ Open experiment (attach runs here)</button><button class="btn sm" id="hClose">' + (p.status === "closed" ? "🔓 Reopen" : "✅ Mark concluded") + '</button></div>' +
            '</div>';
        h += '<h3>Runs attached to this project (' + p.runs.length + ')</h3>';
        if (!p.runs.length) h += '<p class="xsmall">In the experiment, use <b>Attach run to project</b> under the controls. Each run stores the exact settings and results with a timestamp.</p>';
        p.runs.slice().reverse().forEach(r => {
            h += '<div class="wcard"><div class="wchead"><b>' + esc(r.title || "Run") + '</b><time>' + new Date(r.at).toLocaleString() + '</time></div><div class="wsmall">' + esc(r.detail) + '</div>' +
                (r.results ? '<pre class="runres">' + esc(JSON.stringify(r.results)) + '</pre>' : "") +
                '<div class="wacts"><button class="btn sm danger" data-delrun="' + r.id + '">🗑</button></div></div>';
        });
        h += '<h3>Conclusion</h3><label class="xu-ctl"><textarea id="hConc" rows="3" placeholder="Was the prediction supported? Cite specific runs as evidence…">' + esc(p.conclusion) + '</textarea></label>' +
            '<div class="wacts"><button class="btn sm on" id="hConcSave">💾 Save conclusion</button></div>';
        host.innerHTML = h;
        wireList();
        host.querySelector("#hpSel").onchange = e => { U.Shell.state.hypo = e.target.value; render(); };
        host.querySelector("#hpNew").onclick = () => { const nm = prompt("Project name:"); if (nm === null) return; const np = S().projectAdd({ name: nm || "Untitled" }); U.Shell.state.hypo = np.id; render(); };
        const collect = () => ({
            name: host.querySelector("#hName").value, question: host.querySelector("#hQ").value,
            hypothesis: host.querySelector("#hH").value, iv: host.querySelector("#hIv").value,
            dv: host.querySelector("#hDv").value, cv: host.querySelector("#hCv").value,
            prediction: host.querySelector("#hP").value, experiment: host.querySelector("#hExp").value
        });
        host.querySelector("#hSave").onclick = () => { S().update("projects", pid, collect()); U.toast("Project saved"); };
        host.querySelector("#hConcSave").onclick = () => { S().update("projects", pid, { conclusion: host.querySelector("#hConc").value }); U.toast("Conclusion saved"); };
        host.querySelector("#hClose").onclick = () => { S().update("projects", pid, { status: p.status === "closed" ? "open" : "closed" }); render(); };
        host.querySelector("#hGo").onclick = () => {
            const d = collect(); S().update("projects", pid, d);
            const eid = d.experiment;
            if (!eid) return U.toast("Choose an experiment first");
            U.Shell.state.hypo = pid;
            U.Shell.applyView(eid);
            U.toast("Runs from this experiment will list '" + d.name + "' in the attach menu");
        };
        host.querySelectorAll("[data-delrun]").forEach(b => b.onclick = () => {
            if (!confirm("Delete this run?")) return;
            const pp = S().get("projects", pid);
            pp.runs = pp.runs.filter(r => r.id !== b.dataset.delrun);
            S().update("projects", pid, { runs: pp.runs });
            render();
        });
    };
    function wireList() { }
    render();
};

/* ---------------- RESULTS & ANALYSIS ---------------- */
U.Shell.views["ws.results"] = function (host) {
    const render = () => {
        const projects = S().list("projects");
        const runs = [];
        projects.forEach(p => p.runs.forEach(r => runs.push({ p: p, r: r })));
        runs.sort((a, b) => b.r.at - a.r.at);
        let h = '<h2>📊 Results & Analysis</h2><p class="xsmall">All experiment runs recorded across projects, with prediction-vs-outcome checking and per-experiment trends.</p>';
        if (!runs.length) h += '<p class="xsmall">No runs yet. Create a project in <b>Hypothesis & Predictions</b>, attach runs from any experiment, and they will be analysed here.</p>';
        projects.forEach(p => {
            if (!p.runs.length) return;
            h += '<h3>' + esc(p.name) + '</h3>';
            if (p.prediction) h += '<div class="predcard"><b>Recorded prediction:</b> ' + esc(p.prediction) + '</div>';
            const numeric = {};
            p.runs.forEach(r => {
                if (r.results) Object.keys(r.results).forEach(k => {
                    const v = r.results[k];
                    if (typeof v === "number" && isFinite(v)) { (numeric[k] = numeric[k] || []).push([r.at, v]);
                    }
                });
            });
            Object.keys(numeric).forEach(k => {
                const pts = numeric[k].slice().sort((a, b) => a[0] - b[0]);
                if (pts.length >= 2) {
                    h += '<h4>Trend: ' + esc(k) + ' across runs</h4>' + U.chart({ W: 660, H: 200, series: [{ pts: pts.map((q, i) => [i + 1, q[1]]), color: "var(--acc)", w: 3 }], markers: pts.map((q, i) => ({ x: i + 1, y: q[1] })), xLabel: "run #", yLabel: k, xMin: 0.5, xMax: pts.length + 0.5, xTicks: pts.map((q, i) => i + 1), td: 0 });
                }
            });
            h += '<table class="ptable"><tr><th>When</th><th>Run</th><th>Results</th></tr>' +
                p.runs.slice().reverse().map(r => '<tr><td>' + new Date(r.at).toLocaleString() + '</td><td>' + esc(r.title || "") + '<br><small>' + esc(r.detail || "") + '</small></td><td><pre class="runres">' + esc(JSON.stringify(r.results || {})) + '</pre></td></tr>').join("") + '</table>';
            if (p.conclusion) h += '<div class="predcard"><b>Conclusion:</b> ' + esc(p.conclusion) + '</div>';
        });
        host.innerHTML = h;
    };
    render();
};

/* chem.bench snapshot hook for the Save-session button on the bench view:
   the bench has no buildView record bar, so expose a toolbar action instead. */
window.ShellHooks = {
    onView(v, prev) {
        const sv = $("chemSaveBtn");
        if (sv) sv.style.display = v === "chem.bench" ? "" : "none";
    }
};
})();
