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
