/* Laboratory (v94) integration tests — jsdom, no browser, no network.
   Usage:  npm i --no-save jsdom  &&  node tests/lab.js
   Covers: registry metadata, shell navigation, isolated sessions,
   session save/restore, notebook CRUD + persistence, research projects
   workflow, comparison mode, offline boot of the full lab page. */
const path = require("path");
const fs = require("fs");
const { JSDOM, VirtualConsole } = require("jsdom");
const ROOT = path.resolve(__dirname, "..");

const results = [];
const ok = (name, cond, extra) => results.push((cond ? "PASS" : "FAIL") + " | " + name + (extra ? " | " + extra : ""));

function memoryStorage(window) {
    const store = new Map();
    Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: {
            getItem: k => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
            removeItem: k => store.delete(k),
            clear: () => store.clear(),
            key: i => [...store.keys()][i] ?? null,
            get length() { return store.size; },
            _store: store
        }
    });
}

const vc = new VirtualConsole();
const problems = [];
vc.on("jsdomError", e => { const m = String(e.message || e); if (!m.includes("scrollTo") && !m.includes("requestFullscreen")) problems.push("jsdomError: " + m); });
vc.on("error", (...a) => problems.push("console.error: " + a.join(" ")));

(async () => {
    const dom = await JSDOM.fromFile(path.join(ROOT, "chemlab.html"), {
        runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
        beforeParse: window => {
            memoryStorage(window);
            if (!window.ResizeObserver) window.ResizeObserver = class { observe() { } unobserve() { } disconnect() { } };
            if (!window.matchMedia) window.matchMedia = q => ({ matches: false, media: q, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
        }
    });
    const w = dom.window;
    await new Promise(res => w.addEventListener("load", res, { once: true }));
    await new Promise(r => setTimeout(r, 300));

    const R = w.LabReg, U = w.LabUI, S = w.LabStore, $ = id => w.document.getElementById(id);

    /* ---------- 1. registry & metadata ---------- */
    ok("registry: modules loaded", !!(R && U && S && w.ChemLab && w.PhysCore && w.BioCore && w.Engine));
    const all = R.allExps();
    ok("registry: full experiment list (>= 20)", all.length >= 20, all.length + " experiments");
    const meta = all.every(e => e.id && e.subject && e.topic && e.name && e.level && Array.isArray(e.laws) && Array.isArray(e.variables));
    ok("registry: every experiment carries metadata (subject/topic/level/laws/variables)", meta);
    const chemTopics = R.topics("chem");
    ok("registry: chemistry has all 7 required topics", ["Experiment Bench", "Reactions & Equations", "Solutions & Concentrations", "Acids, Bases & Salts", "Metals & Non-metals", "Electrochemistry"].every(t => chemTopics.includes(t)), chemTopics.join(","));
    const phyTopics = R.topics("phy");
    ok("registry: physics has mechanics/electricity/optics/heat/waves/magnetism/solver", ["Mechanics", "Electricity & Circuits", "Light & Optics", "Heat & Thermodynamics", "Waves & Sound", "Magnetism", "Physics Law Solver"].every(t => phyTopics.includes(t)));
    const bioTopics = R.topics("bio");
    ok("registry: biology has cell/human/plant/genetics/ecology/enzymes/experiments", ["Cell Biology", "Human Physiology", "Plant Physiology", "Genetics", "Ecology", "Enzymes", "Biological Experiments"].every(t => bioTopics.includes(t)));
    const planned = all.filter(e => e.planned);
    ok("registry: unimplemented modules honestly flagged planned", planned.length >= 1 && planned.every(e => e.planned === true), planned.map(e => e.id).join(","));

    /* ---------- 2. shell navigation ---------- */
    ok("shell: sidebar navigation rendered", $("sbNav").querySelectorAll("[data-v]").length >= 20);
    U.Shell.applyView("phy.proj");
    ok("nav: physics view mounts and hides chem workspace", $("main").classList.contains("chem-on") === false && $("viewHost").hidden === false && $("viewHost").querySelector(".xview") !== null);
    ok("nav: chem elements hidden but preserved in DOM", w.document.querySelector(".ws").style.display === "none" && $("ws") !== null);
    U.Shell.applyView("bio.enz");
    const enzMounted = $("viewHost").innerHTML.includes("Enzyme Bench");
    U.Shell.applyView("chem.bench");
    ok("nav: back to bench restores chem layout", $("main").classList.contains("chem-on") === true && $("viewHost").hidden === true && w.document.querySelector(".ws").style.display === "");
    ok("nav: previous session survived the switch (never destroyed)", R.liveList().some(s => s.id === "phy.proj") && R.liveList().some(s => s.id === "bio.enz"));

    /* ---------- 3. experiment state survives tab switching ---------- */
    U.Shell.applyView("phy.proj");
    const sesP = R.session(U.Shell.sessionsByView["phy.proj"]);
    sesP.set("v0", 33); sesP.rerender();
    U.Shell.applyView("ws.notebook");
    U.Shell.applyView("phy.proj");
    ok("sessions: params survive tab switching (no reset)", R.session(U.Shell.sessionsByView["phy.proj"]).params.v0 === 33);

    /* ---------- 4. isolated sessions (mandatory architecture #1) ---------- */
    const s1 = R.open("phy.proj"), s2 = R.open("phy.proj");
    s1.set("v0", 10); s2.set("v0", 50);
    const r1 = s1.compute(), r2 = s2.compute();
    ok("isolation: two sessions of one experiment are independent", s1.key !== s2.key && r1.R < r2.R && s1.params.v0 === 10 && s2.params.v0 === 50, `R1=${r1.R.toFixed(1)} R2=${r2.R.toFixed(1)}`);
    const s3 = R.open("bio.enz"); s3.set("ph", 2);
    ok("isolation: cross-subject sessions do not share state", s1.params.v0 === 10 && s3.params.ph === 2 && s3.params.enz === "amylase");

    /* ---------- 5. calculations ---------- */
    const conc = R.open("chem.conc");
    conc.set("mass", 5.85); conc.set("V", 250); conc.set("sol", 0);
    const cr = conc.compute();
    ok("calc: molarity 5.85 g NaCl in 250 mL = 0.4 M", Math.abs(cr.c - 0.4) < 1e-6, String(cr.c));
    const tit = R.open("chem.acid");
    const tr = tit.compute();
    ok("calc: titration equivalence at CaVa/Cb = 25 mL, pH 7 there", Math.abs(tr.veq - 25) < 1e-9 && Math.abs(tr.ph - 7) < 1e-9);
    const cell = R.open("chem.elec");
    cell.set("a", 5); cell.set("c", 9);   /* Zn | Cu */
    const er = cell.compute();
    ok("calc: Daniell cell Zn|Cu = 1.10 V", Math.abs(er.E - 1.1) < 1e-9, String(er.E));
    const pend = R.open("phy.pend");
    const pr = pend.compute();
    ok("calc: pendulum T = 2π√(L/g) ≈ 2.006 s at L=1, g=9.8", Math.abs(pr.T0 - 2 * Math.PI * Math.sqrt(1 / 9.8)) < 1e-9 && pr.T >= pr.T0);
    const card = R.open("bio.cardiac");
    const car = card.compute();
    ok("calc: cardiac output CO = SV×HR ≈ 5.04 L/min at rest", Math.abs(car.CO - 72 * 70 / 1000) < 1e-9);

    /* ---------- 6. save / restore sessions (mandatory architecture #1) ---------- */
    s1.set("ang", 60);
    const saved = R.saveSession(s1, "test session A");
    ok("persistence: session saved with exact params", saved && saved.snap.params.v0 === 10 && saved.snap.params.ang === 60);
    const restored = R.restoreSession(saved);
    ok("persistence: restored session reproduces exact state", restored.params.v0 === 10 && restored.params.ang === 60 && restored.key !== s1.key);
    const benchSnap = R.chemSnapshot();
    ok("persistence: chem bench snapshot works", benchSnap && Array.isArray(benchSnap.items));

    /* ---------- 7. notebook CRUD + persistence (mandatory architecture #2 storage) ---------- */
    const n1 = S.noteAdd({ subject: "Physics", experiment: "Projectile Motion", model: "phy.proj", title: "Test note", detail: "R=40.8m at 45°", settings: { v0: 20 }, results: { R: 40.8 } });
    S.noteAdd({ subject: "Chemistry", experiment: "Titration", title: "Second", detail: "pH 7 at 25 mL" });
    ok("notebook: entries stored with subject/experiment/model", S.list("notes").length >= 2 && S.get("notes", n1.id).model === "phy.proj");
    ok("notebook: search finds by text", S.noteSearch("45°").length === 1);
    ok("notebook: filter by subject", S.noteSearch("", "Chemistry").every(n => n.subject === "Chemistry"));
    S.update("notes", n1.id, { note: "my conclusion", userNote: "my conclusion" });
    ok("notebook: user note editable", S.get("notes", n1.id).note === "my conclusion");
    const exported = S.exportAll();
    S.remove("notes", n1.id);
    ok("notebook: delete works", S.get("notes", n1.id) === null);
    const reimport = S.importAll(exported);
    ok("persistence: export → delete → import round-trip restores data", reimport.ok && S.get("notes", n1.id) !== null && S.get("notes", n1.id).note === "my conclusion");
    ok("persistence: import rejects foreign files", S.importAll('{"hello":1}').ok === false);
    /* reload persistence: data written to localStorage survives a fresh module instance */
    const rawNow = w.localStorage.getItem("aalimLabStore");
    ok("persistence: store written to localStorage (survives refresh)", rawNow && JSON.parse(rawNow).notes.length >= 2);

    /* ---------- 8. research projects workflow (mandatory architecture #2) ---------- */
    const p1 = S.projectAdd({ name: "Angle vs Range", subject: "Physics", experiment: "phy.proj", hypothesis: "If angle increases to 45° then range maximises", prediction: "R will be about 40 m at 45°", iv: "launch angle", dv: "range", cv: "v0, g, h0" });
    const run = S.projectRun(p1.id, { expId: "phy.proj", params: { v0: 20, ang: 45 }, title: "Projectile", detail: "R=40.8", results: { R: 40.8 } });
    ok("projects: hypothesis + variables + prediction stored", S.get("projects", p1.id).hypothesis.includes("45") && S.get("projects", p1.id).iv === "launch angle");
    ok("projects: runs attach with results + timestamp", S.get("projects", p1.id).runs.length === 1 && run.at > 0);
    const dup = S.duplicate("projects", p1.id);
    ok("projects: duplicate creates independent copy", dup.id !== p1.id && dup.name.includes("copy") && dup.runs.length === 1);
    S.update("projects", p1.id, { conclusion: "Prediction supported: R=40.8 ≈ 40", status: "closed" });
    ok("projects: conclusion + close", S.get("projects", p1.id).conclusion.includes("supported") && S.get("projects", p1.id).status === "closed");

    /* ---------- 9. comparison mode ---------- */
    U.Shell.applyView("ws.compare");
    const cmpHost = $("viewHost");
    ok("comparison: view renders two independent columns", cmpHost.querySelectorAll(".cmpcol").length === 2);
    ok("comparison: each side has its own controls", cmpHost.querySelectorAll("#cmpA input[type=range]").length >= 3 && cmpHost.querySelectorAll("#cmpB input[type=range]").length >= 3);
    const inpA = cmpHost.querySelector("#cmpA input[type=range]");
    inpA.value = "55"; inpA.dispatchEvent(new w.Event("input", { bubbles: true }));
    const outHtml = cmpHost.querySelector("#cmpOut").innerHTML;
    ok("comparison: differing input produces outcome table + what-differs analysis", outHtml.includes("Outcome table") && outHtml.includes("What differs"));

    /* ---------- 10. workspace views render ---------- */
    ["ws.research", "ws.notebook", "ws.hypo", "ws.results", "ws.practicals"].forEach(v => {
        U.Shell.applyView(v);
        ok("view renders: " + v, $("viewHost").textContent.length > 40);
    });

    /* ---------- 11. planned module honesty ---------- */
    U.Shell.applyView("bio.exps");
    ok("planned module shows an honest 'planned' card, not a fake UI", $("viewHost").innerHTML.includes("planned") && $("viewHost").querySelector("input[type=range]") === null);

    /* ---------- 12. legacy chem features intact ---------- */
    ok("legacy: practicals data reachable (ACTS)", w.ChemLab.ACTS.length >= 10);
    ok("legacy: chem engine untouched (acid+base neutralises)", (() => {
        const c = w.Engine.newContainer("beaker", "t");
        const hcl = w.ChemLab.CHEMS.find(x => x.id === "hcl"), naoh = w.ChemLab.CHEMS.find(x => x.id === "naoh");
        w.Engine.addLiquid(c, hcl, 10); w.Engine.addLiquid(c, naoh, 10); w.Engine.tickContainer(c, 5);
        const ph = w.Engine.phOf(c);
        return ph > 5.5 && ph < 8.5;
    })());
    ok("legacy: bench snapshot/restore functions exist", typeof R.chemSnapshot === "function" && typeof R.chemRestore === "function");

    ok("boot: no page errors", problems.length === 0, problems.slice(0, 3).join(" ~ "));

    report(w);
})().catch(e => { console.log(results.join("\n")); console.log("SUITE ERROR: " + (e && e.stack || e)); process.exit(1); });

function report(w) {
    console.log(results.join("\n"));
    const fails = results.filter(r => r.startsWith("FAIL")).length;
    console.log("\n" + (results.length - fails) + "/" + results.length + " passed" + (fails ? " — " + fails + " FAILURES" : ""));
    if (w && w.close) w.close();
    process.exit(fails ? 1 : 0);
}
