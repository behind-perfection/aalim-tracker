/* Boot + regression smoke test for the Command Centre (no browser needed).
   Usage:  npm i --no-save jsdom  &&  node tests/smoke.js
   Checks: the app boots without the on-screen error bar, the vendored Supabase
   bundle loads offline, nav/sidebar render, and the hobby-idea edit form and
   the hobby-block form never read each other's fields (duplicate-id bug, v87). */
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.resolve(__dirname, "..");

/* jsdom gives file:// pages no localStorage (opaque origin), so hand the page
   an in-memory stand-in. Subresources still load from disk beside index.html,
   which proves the app boots with the vendored Supabase bundle and no network. */
function memoryStorage(window) {
    const store = new Map();
    Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
            removeItem: (k) => store.delete(k),
            clear: () => store.clear(),
            key: (i) => [...store.keys()][i] ?? null,
            get length() { return store.size; }
        }
    });
}

const vc = new VirtualConsole();
const problems = [];
vc.on("jsdomError", (e) => { const m = String(e.message || e); if (!m.includes("scrollTo")) problems.push("jsdomError: " + m); });
vc.on("error", (...a) => problems.push("console.error: " + a.join(" ")));

const results = [];
const ok = (name, cond, extra) => results.push((cond ? "PASS" : "FAIL") + " | " + name + (extra ? " | " + extra : ""));

/* ---- v91 engine unit checks (pure modules, no DOM needed) ---- */
const PhysCore = require(path.resolve(__dirname, "..", "physcore.js"));
const BioCore = require(path.resolve(__dirname, "..", "biocore.js"));
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
{
    const m = PhysCore.solve({ u: 0, a: 2, t: 3 }, ["Motion"]).vals;
    ok("solver: suvat chain (v=6, s=9)", near(m.v, 6) && near(m.s, 9), JSON.stringify(m));
    const e = PhysCore.solve({ V: 6, R: 2 }, ["Electricity"]).vals;
    ok("solver: Ohm+Joule chain (I=3, P=18)", near(e.I, 3) && near(e.P, 18));
    const p = PhysCore.projectile({ v0: 20, angle: 90, h0: 0, g: 10 });
    ok("projectile: T≈4s, H≈20m", near(p.T, 4, 0.05) && near(p.H, 20, 0.1), `T=${p.T} H=${p.H}`);
    const c = PhysCore.circuit({ V: 6, mode: "series", rs: [2, 4] });
    ok("circuit: series Req=6, I=1", near(c.Req, 6) && near(c.I, 1));
    const cp = PhysCore.circuit({ V: 6, mode: "parallel", rs: [2, 4] });
    ok("circuit: parallel Req=4/3", near(cp.Req, 4 / 3));
    const o = PhysCore.optics({ kind: "lens", f: 10, u: 30 });
    ok("optics: convex f10 u30 → v15, M−0.5, real", near(o.v, 15) && near(o.M, -0.5) && o.real);
    const om = PhysCore.optics({ kind: "mirror", f: -10, u: 30 });
    ok("optics: concave mirror u30 f−10 → v−15 real", near(om.v, -15) && om.real);
    const of = PhysCore.optics({ kind: "lens", f: 10, u: 10 });
    ok("optics: object at focus → v=∞, atF flagged", of.atF === true && of.v === Infinity);
    const ox = PhysCore.optics({ kind: "mirror", f: 15, u: 30 });
    ok("optics: convex mirror → virtual erect behind mirror", ox.v > 0 && !ox.real && !ox.inverted);
    const ph = BioCore.photo({ light: 0, co2: 400, temp: 25 });
    ok("photo: darkness → net negative (respiration)", ph.net < 0 && ph.gross === 0);
    const ph2 = BioCore.photo({ light: 90, co2: 400, temp: 25 });
    ok("photo: bright light → net positive", ph2.net > 0);
    ok("photo: limiting factor at 5% light is light", BioCore.photo({ light: 5, co2: 800, temp: 30 }).limiting === "light");
    ok("enzyme: pepsin prefers pH 2 over 7", BioCore.enzyme({ id: "pepsin", temp: 37, ph: 2, S: 50 }).activity > BioCore.enzyme({ id: "pepsin", temp: 37, ph: 7, S: 50 }).activity);
    ok("enzyme: boiling denatures", BioCore.enzyme({ id: "amylase", temp: 75, ph: 6.8, S: 50 }).activity < 5);
    const g1 = BioCore.cross({ traits: [{ dom: "T", rec: "t", p1: "Tt", p2: "Tt" }] });
    ok("genetics: Tt×Tt → 3:1", (g1.pheno["dominant"] || 0) === 3 && (g1.pheno["recessive"] || 0) === 1, JSON.stringify(g1.pheno));
    const g2 = BioCore.cross({ traits: [{ dom: "T", rec: "t", p1: "Tt", p2: "Tt" }, { dom: "Y", rec: "y", p1: "Yy", p2: "Yy" }] });
    const pv = Object.values(g2.pheno).sort((a, b) => b - a).join(":");
    ok("genetics: dihybrid → 9:3:3:1", pv === "9:3:3:1", pv);
    const ch = BioCore.chain({ producerkJ: 10000, levels: 4, eff: 10 });
    ok("ecology: 10% law → top level 10 kJ", near(ch.levels[3].kJ, 10));
}

/* ---- v94: static integrity checks on the laboratory shell ---- */
{
    const fs = require("fs");
    const rd = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
    const lab = rd("chemlab.html"), ui = rd("labui.js"), phy = rd("labphysx.js"), bio = rd("labiox.js");
    ok("lab: --orange is defined in both themes", (lab.match(/--orange:#[0-9a-f]{6}/g) || []).length === 2);
    ok("lab: legacy chem bench preserved (ws/tool/pan + ACTS + spawn)", lab.includes('id="ws"') && lab.includes("const ACTS=") && lab.includes("function spawn(") && lab.includes("window.ChemLab="));
    ok("lab: shell loads all v94 modules", ["labstore.js", "labreg.js", "labui.js", "labphysx.js", "labiox.js", "labchemx.js", "labviews.js"].every(f => lab.includes('<script src="' + f + '">')));
    ok("lab: slider readouts update live (xu-rv in labui)", ui.includes("xu-rv") && ui.includes("rv.textContent"));
    ok("lab: optics handles object-at-focus (atF)", phy.includes("o.atF") && require(path.resolve(__dirname, "..", "physcore.js")).optics({ kind: "lens", f: 10, u: 10 }).atF === true);
    ok("lab: separate photo/enzyme temperature states", bio.includes("ptemp") && bio.includes("etemp"));
    ok("lab: notebook persistence via LabStore", rd("labstore.js").includes("noteAdd") && rd("labviews.js").includes("ws.notebook"));
}

JSDOM.fromFile(path.resolve(ROOT, "index.html"), {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true,
    beforeParse: memoryStorage, virtualConsole: vc,
}).then((dom) => {
    const w = dom.window, doc = w.document;
    const alerts = [];
    w.alert = (m) => alerts.push(String(m));
    setTimeout(() => {
        /* --- boot --- */
        ok("app booted (no stuck page)", !!w.__appBooted);
        ok("no on-screen error bar", !doc.getElementById("errBar"));
        ok("vendored supabase loaded offline", typeof w.supabase === "object" && !!w.supabase.createClient);
        ok("nav rendered", doc.getElementById("nav").childElementCount > 0);
        ok("sidebar rendered", !!doc.getElementById("side"));
        ok("dashboard cards rendered", doc.querySelectorAll("#dashboard .card").length > 5);

        /* --- hobby edit form vs hobby block form (duplicate-id regression) --- */
        w.renderDayCfg();                                   // Today page box owns hbN/hbS/hbM
        doc.getElementById("hbN").value = "Leftover Typo";  // poison the block form
        w.hbNew();                                          // opens the idea edit form (hbEN…)
        const id = w.eval("state.hobbyCat[state.hobbyCat.length-1].id");
        ok("edit form uses unique ids", !!doc.getElementById("hbEN") && !!doc.getElementById("hbEM"));
        doc.getElementById("hbEN").value = "Chess club";
        doc.getElementById("hbEC").value = "Games";
        doc.getElementById("hbED").value = "Planning skills";
        doc.getElementById("hbEM").value = "sessions";
        w.hbSave(id);
        const s = JSON.parse(w.eval("JSON.stringify(state.hobbyCat[state.hobbyCat.length-1])"));
        ok("hbSave reads its own fields", s.n === "Chess club" && s.c === "Games" && s.d === "Planning skills" && s.m === "sessions", JSON.stringify(s));
        ok("hbSave raised no alert", alerts.length === 0, alerts.join("; "));
        doc.getElementById("hbN").value = "Karate";
        doc.getElementById("hbS").value = "17:30";
        doc.getElementById("hbM").value = "30";
        w.blockAdd();
        const blocks = JSON.parse(w.eval("JSON.stringify(dayCfg().blocks)"));
        const b = blocks[blocks.length - 1];
        ok("blockAdd reads its own fields", b && b.n === "Karate" && b.start === "17:30" && b.mins === 30, JSON.stringify(b));

        /* --- v88 tab-open animations --- */
        ok("cards carry stagger delays", !!doc.querySelector("#dashboard .card[style*='animation-delay']"));
        ok("virtual lab unlocked (v91)", w.eval("LAB_LOCKED") === false);
        w.hbOpen("karate");
        const k = doc.querySelector(".stinger.karate");
        ok("karate tab plays the karate sequence", !!k && !!k.querySelector(".k-legF") && (k.textContent || "").includes("HIYAA!"));
        w.showPage("study");
        ok("study tab plays the book sequence", !!doc.querySelector(".stinger.seq .fxSeq svg .fx-open"));
        w.showPage("practice");
        ok("practice tab plays the target sequence", !!doc.querySelector(".stinger.seq .fx-dart"));
        w.showPage("hof");
        ok("hall of fame plays the trophy sequence", !!doc.querySelector(".stinger.seq .fx-shine"));
        w.hbOpen("read");
        ok("reading hobby tab plays page-turn", !!doc.querySelector(".stinger.seq .fxSeq svg"));
        w.swUpdateNotice("v90");
        const ub = doc.getElementById("swUpBar");
        ok("self-update banner appears", !!ub && (ub.textContent || "").includes("v90"));

        setTimeout(() => {
            ok("stingers clean themselves up", doc.querySelectorAll(".stinger").length === 0);
            console.log("=== SMOKE RESULT ===");
            results.forEach((l) => console.log(l));
            console.log("page problems:", problems.length ? problems : "none");
            process.exit(results.some((l) => l.startsWith("FAIL")) || problems.length ? 1 : 0);
        }, 1600);
    }, 6000);
}).catch((e) => { console.log("FATAL", e); process.exit(1); });
