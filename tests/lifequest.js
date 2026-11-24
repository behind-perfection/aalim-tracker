/* LIFEQUEST (v99) integration tests — jsdom, no browser, no network.
   Usage:  npm i --no-save jsdom  &&  node tests/lifequest.js

   Covers, in order:
     1. boot safety + navigation injection (existing 8 hubs untouched)
     2. the tracker is never written to by the game
     3. state.lq survives normalize / mergeState / backupPayload
     4. the BINDING academic-desk rule (every subject, same desk)
     5. practical work only from the Virtual Lab
     6. non-academic routing (garden, sanctuary, city, workshop, bedroom…)
     7. live synchronisation from the real focus + reading timers
     8. strict timeline honesty (clock time only when it is really known)
     9. renderer: layers, subject props swap, desk geometry unchanged
    10. unbuilt environments stay honest
    11. accessibility + performance gating
    12. version / service-worker assets
    13. every existing page still renders
*/
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
vc.on("jsdomError", e => {
    const m = String(e.message || e);
    if (m.includes("scrollTo") || m.includes("requestFullscreen") || m.includes("Not implemented: window.alert")) return;
    problems.push("jsdomError: " + m);
});
vc.on("error", (...a) => problems.push("console.error: " + a.join(" ")));

(async () => {
    const dom = await JSDOM.fromFile(path.join(ROOT, "index.html"), {
        runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc,
        beforeParse: window => {
            memoryStorage(window);
            if (!window.ResizeObserver) window.ResizeObserver = class { observe() { } unobserve() { } disconnect() { } };
            if (!window.matchMedia) window.matchMedia = q => ({ matches: false, media: q, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
        }
    });
    const w = dom.window, d = w.document;
    await new Promise(res => w.addEventListener("load", res, { once: true }));
    await new Promise(r => setTimeout(r, 500));
    const $ = s => d.querySelector(s);
    const E = s => { try { return w.eval(s); } catch (e) { return "EVAL-ERR: " + e.message; } };
    const TODAY = E("today()");

    /* ============ 0. lazy loading — a tracker-only session pays nothing ====
       The 8 game modules and the stylesheet are fetched by lq-boot.js only when
       the LifeQuest page is first opened. Until then the tracker must carry no
       game code at all, while the hub stays fully reachable. */
    const idx0 = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const GAME_FILES = ["lq-store.js", "lq-adapter.js", "lq-mapper.js", "lq-character.js",
        "lq-world.js", "lq-render.js", "lq-ui.js", "lifequest.js"];
    const scriptSrcs = () => [...d.querySelectorAll("script[src]")].map(s => s.getAttribute("src"));
    ok("0.1 no game module global exists before the page is opened",
        !w.LQStore && !w.LQAdapter && !w.LQMapper && !w.LQCharacter && !w.LQWorld
        && !w.LQRender && !w.LQUI && !w.LQ,
        ["LQStore", "LQAdapter", "LQMapper", "LQCharacter", "LQWorld", "LQRender", "LQUI", "LQ"]
            .filter(n => w[n]).join(",") || "none loaded — correct");
    ok("0.2 index.html ships exactly one eager LIFEQUEST file: lq-boot.js", (() => {
        const srcs = scriptSrcs();
        return srcs.includes("lq-boot.js") && !srcs.some(s => GAME_FILES.includes(s));
    })(), scriptSrcs().filter(s => /^lq|^lifequest/.test(s)).join(",") || "none");
    ok("0.3 lifequest.css is not linked until the game is opened",
        ![...d.querySelectorAll('link[rel="stylesheet"]')].some(l => /lifequest\.css/.test(l.href))
        && !/href="lifequest\.css"/.test(idx0));
    ok("0.4 the hub, its shortcut and the placeholder page exist with no game code loaded", (() => {
        return E("HUBS.some(h=>h.id==='quest')") === true
            && E("HUBS.find(h=>h.id==='quest').k") === "9"
            && E("NAVF.some(n=>n.id==='lq')") === true
            && !!d.querySelector("#side button[data-h='quest']")
            && !!d.querySelector("main > section#lq.page")
            && /Preparing the world/.test(d.querySelector("main > section#lq.page").textContent);
    })(), d.querySelector("main > section#lq.page") ? d.querySelector("main > section#lq.page").textContent.trim().slice(0, 60) : "no #lq section");
    ok("0.5 the hub is reachable before loading, and opening it starts the fetch", (() => {
        E("openHub('quest')");                     /* nav → showPage('lq') → LQBoot.ensure() */
        return E("curPage") === "lq" && ["loading", "ready"].indexOf(w.LQBoot.status()) >= 0;
    })(), String(E("curPage")) + "/" + String(w.LQBoot && w.LQBoot.status()));
    ok("0.6 LQBoot is present and idle until the page is really shown",
        !!w.LQBoot && ["idle", "loading", "ready"].indexOf(w.LQBoot.status()) >= 0, String(w.LQBoot && w.LQBoot.status()));

    /* Opening the page must fetch the stylesheet + all 8 modules in dependency
       order and then boot the game. */
    const waitForGame = async ms => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
            if (w.LQ && w.LQ.ready()) return true;
            await new Promise(r => setTimeout(r, 50));
        }
        return false;
    };
    const booted = await waitForGame(20000);
    ok("0.7 opening LifeQuest loads lifequest.css and every module, then boots", booted,
        "LQBoot.status=" + String(w.LQBoot && w.LQBoot.status()) + " failedOn=" + String(w.LQBoot && w.LQBoot.failedOn()));
    ok("0.8 all 8 modules were injected exactly once, in dependency order", (() => {
        const srcs = scriptSrcs().filter(s => GAME_FILES.includes(s));
        return srcs.length === 8 && srcs.join(",") === GAME_FILES.join(",");
    })(), scriptSrcs().filter(s => GAME_FILES.includes(s)).join(","));
    ok("0.9 the stylesheet is injected on demand, not shipped in <head>",
        [...d.querySelectorAll('link[rel="stylesheet"]')].filter(l => /lifequest\.css/.test(l.href)).length === 1);
    ok("0.10 the placeholder is replaced by the real game UI", (() => {
        const sec = d.querySelector("main > section#lq.page");
        return !!sec && !/Preparing the world/.test(sec.textContent) && !!sec.querySelector(".lq-grid,.lq-stage,svg");
    })(), (d.querySelector("main > section#lq.page") || {}).textContent ? d.querySelector("main > section#lq.page").textContent.trim().slice(0, 60) : "none");
    ok("0.11 re-opening the page never re-downloads the modules", (() => {
        E("showPage('dashboard')"); E("showPage('lq')"); E("showPage('lq')");
        const srcs = scriptSrcs().filter(s => GAME_FILES.includes(s));
        return srcs.length === 8 && w.LQBoot.status() === "ready";
    })(), String(scriptSrcs().filter(s => GAME_FILES.includes(s)).length));
    /* ============================ 1. boot & navigation ==================== */
    ok("1.1 LIFEQUEST modules all loaded",
        !!(w.LQ && w.LQStore && w.LQAdapter && w.LQMapper && w.LQCharacter && w.LQWorld && w.LQRender && w.LQUI));
    ok("1.2 LQ reports ready", w.LQ && w.LQ.ready() === true);
    const hubs = E("HUBS.map(h=>h.id).join(',')");
    ok("1.3 existing 8 hubs intact and in order",
        hubs === "home,study,revise,create,progress,life,lab,set,quest", hubs);
    ok("1.4 existing hub shortcuts unchanged (1-8)",
        E("HUBS.slice(0,8).map(h=>h.k).join('')") === "12345678");
    ok("1.5 LifeQuest hub added with its own shortcut", E("HUBS[8].k") === "9" && E("HUBS[8].l") === "LifeQuest");
    ok("1.6 search palette (NAVF) includes the new page", E("NAVF.some(n=>n.id==='lq')") === true);
    ok("1.7 #lq section created inside <main>", !!$("#main > section#lq.page") || !!$("main > section#lq.page"));
    ok("1.8 all 26 pre-existing pages still present",
        E("['dashboard','syllabus','study','today','homework','practice','feynman','flash','mistakes','report','workout','lift','deen','library','biz','calendar','exams','tasks','extra','paper','review','hof','movies','research','analytics','settings','vlab'].every(id=>!!document.getElementById(id))") === true);

    /* Regression: `navInit()` builds #side ONCE from HUBS via setTimeout(0),
       which can fire while the parser is still fetching our external scripts.
       The hub must appear in the sidebar either way, exactly once. */
    ok("1.9 the sidebar lists all nine hubs, LifeQuest included exactly once", (() => {
        const ids = [...d.querySelectorAll("#side button[data-h]")].map(b => b.dataset.h);
        return ids.join(",") === "home,study,revise,create,progress,life,lab,set,quest"
            && d.querySelectorAll('#side button[data-h="quest"]').length === 1;
    })(), [...d.querySelectorAll("#side button[data-h]")].map(b => b.dataset.h).join(","));
    ok("1.10 openHub('quest') activates #lq and highlights its sidebar button", (() => {
        E("openHub('quest')");
        const act = d.querySelector(".page.active"), on = d.querySelector("#side button.on");
        return !!act && act.id === "lq" && !!on && on.dataset.h === "quest";
    })());
    ok("1.11 navigating away and back never duplicates the sidebar button", (() => {
        E("showPage('dashboard')"); E("openHub('quest')"); E("showPage('study')"); E("openHub('quest')");
        return d.querySelectorAll('#side button[data-h="quest"]').length === 1;
    })());
    ok("1.12 the phone bottom bar still has its original 4 hubs + More",
        [...d.querySelectorAll("#btm button")].map(b => b.dataset.h || "more").join(",") === "home,study,revise,create,more");
    ok("1.13 the search palette renders and finds the LifeQuest page", (() => {
        E("menuOpen()"); E(`document.getElementById("mq").value="life"`); E("menuRender()");
        const hit = /LifeQuest/i.test(d.getElementById("mlist").textContent);
        E("menuClose()");
        return hit;
    })());
    E("showPage('lq')");

    /* ==================== fixtures: real-looking tracker records =========== */
    E(`state.library.unshift({id:"bkMath",t:"NCERT Mathematics Class 10",a:"NCERT",ty:"Book",s:"Mathematics",st:"Reading",l:"",n:""})`);
    E(`state.library.unshift({id:"bkNovel",t:"Nineteen Eighty-Four",a:"George Orwell",ty:"Book",s:"Literature",st:"Reading",l:"",n:""})`);
    E(`state.study.unshift({date:today(),mins:40,subject:"Mathematics",type:"Udaan",note:"Polynomials",h:9})`);
    E(`state.study.unshift({date:today(),mins:25,subject:"Science",type:"Udaan",note:"Acids, Bases and Salts"})`);
    E(`state.runs.push({id:"r1",date:today(),mins:12,steps:900,effort:"easy",note:""})`);
    E(`state.karate.push({id:"k1",date:today(),mins:20,focus:"Basic blocks",effort:"medium",note:""})`);
    E(`state.quran.push({date:today(),p:"2 pages",n:""})`);
    E(`state.papers.push({id:"p1",date:today(),subject:"Mathematics",name:"Board sample 1",max:80,score:62,allowed:180,took:170,topics:[]})`);
    await new Promise(r => setTimeout(r, 120));

    /* ================= 2. the game never writes tracker records =========== */
    const snapNoLQ = () => E("JSON.stringify(Object.fromEntries(Object.entries(state).filter(([k])=>k!=='lq')))");
    E("showPage('dashboard')");
    await new Promise(r => setTimeout(r, 200));
    const before = snapNoLQ();
    E("showPage('lq')");
    await new Promise(r => setTimeout(r, 260));
    /* drive every panel */
    ["world", "char", "day", "map", "skills", "miles", "journal", "stats"].forEach(p => {
        E(`LQUI.show(${JSON.stringify(p)})`);
    });
    E("LQRender.zoom(1.4)"); E("LQRender.zoom(0.7)");
    E("LQStore.mutate(s=>{s.char.skin=2;s.char.outfit=3;s.char.accessory=4;})");
    E("LQUI.show('char')");
    await new Promise(r => setTimeout(r, 260));
    const after = snapNoLQ();
    ok("2.1 driving every LIFEQUEST panel leaves all tracker records byte-identical", before === after,
        before === after ? "" : "tracker state changed!");
    ok("2.2 game data is written under state.lq only", E("typeof state.lq") === "object" && E("state.lq.char.skin") === 2);
    ok("2.3 adapter is read-only (no writes on snapshot)", (() => {
        const b = snapNoLQ(); E("LQAdapter.snapshot(today())"); E("LQAdapter.mastery()"); E("LQAdapter.dates()");
        return b === snapNoLQ();
    })());

    /* ============== 3. state.lq rides the existing data paths ============= */
    ok("3.1 normalize() preserves lq", E("normalize(state).lq && typeof normalize(state).lq.char") === "object");
    ok("3.2 normalize() keeps lq from a raw payload",
        E(`normalize({lq:{char:{skin:4},milestones:[{ref:"book:1",id:"book:1",kind:"reading",label:"Finished a book",at:1,cat:"knowledge"}]}}).lq.char.skin`) === 4);
    ok("3.3 a malformed lq is contained: tracker normalize yields an object, LQStore repairs it",
        E(`(function(){const n=normalize({lq:"junk"});return n.lq && typeof n.lq==="object" && !Array.isArray(n.lq) && LQStore.norm("junk").v===1 && LQStore.norm(null).v===1})()`) === true);
    ok("3.4 KEYS includes lq (so imports validate)", E(`KEYS.includes("lq")`) === true);
    ok("3.5 LQMerge is exposed for mergeState()", typeof w.LQMerge === "function");
    const merged = E(`(function(){
      const a={milestones:[{ref:"x",id:"x",kind:"k",label:"X",at:2,cat:"knowledge"}],progress:{knowledge:5}};
      const b={milestones:[{ref:"x",id:"x",kind:"k",label:"X",at:1,cat:"knowledge"},{ref:"y",id:"y",kind:"k",label:"Y",at:3,cat:"creation"}],progress:{knowledge:2,creation:9}};
      const m=LQMerge(a,b); return m.milestones.length+"|"+m.progress.knowledge+"|"+m.progress.creation;})()`);
    ok("3.6 LQMerge de-duplicates milestones by ref and takes max counters", merged === "2|5|9", merged);
    ok("3.7 mergeState() carries lq through", E(`mergeState(state, normalize({lq:{char:{skin:1}}})).lq.char.skin >= 0`) === true);
    E("showPage('lq')");
    const payload = await E("backupPayload()");
    ok("3.8 full backup payload contains the game data", !!payload && payload.includes('"lq"'));

    /* Real restore path: a backup file fed through the app's own importData(). */
    const backupStr = payload;
    ok("3.9 restoring a backup brings the game data back (real importData path)", await (async () => {
        try {
            /* remember the game state as backed up, then corrupt it locally */
            const skin = E("state.lq ? state.lq.char.skin : null");
            E("LQStore.mutate(s=>{s.char.skin=7;s.char.outfit=6})"); E("LQStore.saveNow()");
            w.confirm = () => false;                 /* REPLACE, exactly as the user choosing Cancel */
            w.alert = () => { };
            const ev = { target: { files: [new w.File([backupStr], "backup.json", { type: "application/json" })], value: "" } };
            w.importData(ev);
            await new Promise(r => setTimeout(r, 400));
            const restored = E("state.lq && state.lq.char.skin");
            const trackerOk = E(`state.study.some(s=>s.note==="Polynomials")`) === true;
            return restored === skin && trackerOk && ev.target.value === "";
        } catch (e) { return "ERR " + e.message; }
    })());

    /* ============ 4. BINDING RULE — academic work stays at the desk ======= */
    const ACADEMIC = [
        ["Mathematics", "Polynomials", "maths"],
        ["Science", "Light – Reflection and Refraction", "physics"],
        ["Science", "Chemical Reactions and Equations", "chemistry"],
        ["Science", "Life Processes", "biology"],
        ["History", "Nationalism in India", "history"],
        ["Geography", "Resources and Development", "geography"],
        ["Economics", "Sectors of the Indian Economy", "economics"],
        ["Political Science", "Federalism", "political"],
        ["English – Language & Literature", "A Letter to God", "english"],
        ["Hindi B – स्पर्श", "कबीर", "hindi"],
        ["Information Technology 402", "HTML basics", "it"]
    ];
    let deskPass = 0, subjPass = 0, details = [];
    ACADEMIC.forEach(([subj, chap, want]) => {
        const m = w.LQMapper.map({ kind: "study", source: "study", subject: subj, label: chap });
        if (m.room === "study" && m.spot === "desk" && m.pose === "sit" && m.academic === true && !m.practical) deskPass++;
        else details.push(subj + "→" + m.room + "/" + m.spot + "/" + m.pose);
        if (m.subjectKey === want) subjPass++;
        else details.push("key:" + subj + "=" + m.subjectKey + "≠" + want);
    });
    ok("4.1 every academic subject → seated at the SAME study desk", deskPass === ACADEMIC.length, details.join("; "));
    ok("4.2 every academic subject resolves to its own subject key (right books/diagrams)", subjPass === ACADEMIC.length, details.join("; "));
    const propSet = new Set(ACADEMIC.map(([, , want]) => want));
    ok("4.3 desk materials differ per subject (11 distinct prop sets)", propSet.size === 11, [...propSet].join(","));
    ok("4.4 each subject has its own notebook glyph", [...propSet].every(k => !!w.LQCharacter.GLYPH[k]));
    const rev = w.LQMapper.map({ kind: "revision", subject: "Science", label: "Revision: Acids and Bases" });
    ok("4.5 revision → desk, revising that subject", rev.room === "study" && rev.anim === "revise" && rev.subjectKey === "chemistry");
    const mock = w.LQMapper.map({ kind: "exam", source: "papers", subject: "Mathematics", label: "Board sample 1" });
    ok("4.6 mock test → desk, writing an examination", mock.room === "study" && mock.anim === "exam");
    ok("4.7 chemistry THEORY is never sent to the laboratory",
        w.LQMapper.map({ kind: "study", subject: "Science", label: "Metals and Non-metals" }).room === "study");
    ok("4.8 chemistry theory gets no practical animation",
        w.LQMapper.map({ kind: "study", subject: "Chemistry", label: "Electrochemistry" }).anim !== "experiment");
    ok("4.9 theoretical astronomy is never sent to the observatory", (() => {
        const m = w.LQMapper.map({ kind: "study", subject: "Science", label: "Astronomy: the solar system and stars" });
        return m.room === "study" && m.spot === "desk";
    })());
    ok("4.10 astronomy theory gets a desk star chart, not a telescope room",
        w.LQMapper.subjectKey("Science", "astronomy stars planets solar system") === "astronomy" ||
        w.LQMapper.subjectKey("Science", "astronomy stars planets solar system") === "physics");
    ok("4.11 mapper guards academic events out of any other room",
        w.LQMapper.map({ kind: "study", subject: "Mathematics", label: "x", room: "lab" }).room === "study");

    /* ============ 5. practical work only from the Virtual Lab ============= */
    const lab = w.LQMapper.map({ kind: "lab", source: "lab", subject: "Chemistry", label: "Acids, Bases & Salts", expId: "chem.acid#1" });
    ok("5.1 a real Virtual Lab experiment → laboratory bench", lab.room === "lab" && lab.spot === "bench");
    ok("5.2 a real experiment gets the practical animation", lab.anim === "experiment" && lab.practical === true);
    ok("5.3 lab detection works from a stored LabStore session", (() => {
        const db = { v: 1, sessions: [{ id: "ses-1", created: Date.now() - 60000, updated: Date.now() - 60000, name: "Simple Pendulum · now", expId: "phy.pend#1", subject: "Physics", snap: {} }], runs: [] };
        w.localStorage.setItem("aalimLabStore", JSON.stringify(db));
        const lv = w.LQAdapter.liveLab();
        return !!lv && lv.subject === "Physics" && w.LQMapper.map(lv).room === "lab";
    })());
    ok("5.4 a stale lab session is NOT treated as current activity", (() => {
        const db = { v: 1, sessions: [{ id: "s", created: Date.now() - 9e6, updated: Date.now() - 9e6, name: "Old", expId: "chem.rx#1", subject: "Chemistry" }], runs: [] };
        w.localStorage.setItem("aalimLabStore", JSON.stringify(db));
        return w.LQAdapter.liveLab() === null;
    })());
    w.localStorage.removeItem("aalimLabStore");

    /* ================= 6. non-academic routing ============================ */
    ok("6.1 run in place → garden, running", (() => { const m = w.LQMapper.map({ kind: "run", source: "runs", label: "Run in place" }); return m.room === "garden" && m.anim === "run"; })());
    ok("6.2 karate → garden training area", (() => { const m = w.LQMapper.map({ kind: "karate", source: "karate", label: "Karate · Basic blocks" }); return m.room === "garden" && m.anim === "karate"; })());
    ok("6.3 workout / strength → garden, exercising", (() => { const m = w.LQMapper.map({ kind: "workout", source: "workouts" }); return m.room === "garden" && m.anim === "exercise"; })());
    ok("6.4 Qur'an log → quiet sanctuary, seated reading", (() => { const m = w.LQMapper.map({ kind: "deen", source: "quran", label: "Qur'an · 2 pages" }); return m.room === "sanctuary" && m.pose === "sit"; })());
    ok("6.5 movie → recreation, watching", (() => { const m = w.LQMapper.map({ kind: "watch", source: "movies", label: "A film" }); return m.room === "screen" && m.anim === "watch"; })());
    ok("6.6 business → city", w.LQMapper.map({ kind: "biz", source: "biz" }).room === "city");
    ok("6.7 sleep → bedroom, sleeping", (() => { const m = w.LQMapper.map({ kind: "sleep", source: "dayLog" }); return m.room === "bedroom" && m.anim === "sleep" && m.pose === "lie"; })());
    ok("6.8 waking → bedroom, waking up", (() => { const m = w.LQMapper.map({ kind: "wake", source: "dayLog" }); return m.room === "bedroom" && m.anim === "wake"; })());
    ok("6.9 break / untracked time → rest, never an invented activity", (() => {
        const a = w.LQMapper.map({ kind: "break", source: "pomo" }), b = w.LQMapper.map({ kind: "idle", source: "none" });
        return a.room === "rest" && a.anim === "rest" && b.anim === "idle";
    })());
    ok("6.10 engineering project → workshop bench", (() => { const m = w.LQMapper.map({ kind: "project", source: "research", cat: "Engineering", label: "Line-following robot" }); return m.room === "workshop" && m.anim === "build"; })());
    ok("6.11 programming project → workshop computer, typing", (() => { const m = w.LQMapper.map({ kind: "project", source: "research", cat: "Research", label: "Programming a solver" }); return m.room === "workshop" && m.spot === "computer" && m.anim === "type"; })());
    ok("6.12 novel/writing project → writing", (() => { const m = w.LQMapper.map({ kind: "project", source: "research", cat: "Novel", label: "Chapter 3" }); return m.anim === "write"; })());
    ok("6.13 drawing hobby → workshop easel, drawing", (() => { const m = w.LQMapper.map({ kind: "hobby", sec: "draw", secName: "Drawing & Sketching", label: "Gesture study" }); return m.room === "workshop" && m.anim === "draw"; })());
    ok("6.14 school / tuition (configured schedule) → academy", (() => { const m = w.LQMapper.map({ kind: "schedule", source: "dayCfg", label: "School", code: 1 }); return m.room === "academy" && m.anim === "attend"; })());
    ok("6.15 academic reading (subject book) → desk, not the library", (() => {
        const m = w.LQMapper.map({ kind: "reading", source: "reading", bookId: "bkMath", book: w.LQAdapter.bookOf("bkMath"), subject: "Mathematics" });
        return m.room === "study" && m.spot === "desk" && m.academic === true;
    })());
    ok("6.16 non-academic reading (literature) → library", (() => {
        const m = w.LQMapper.map({ kind: "reading", source: "reading", bookId: "bkNovel", book: w.LQAdapter.bookOf("bkNovel"), subject: "Literature" });
        return m.room === "library" && m.spot === "chair";
    })());
    ok("6.17 unknown activity falls back to a generic idle, not a guess", (() => {
        const m = w.LQMapper.map({ kind: "something-new", label: "Unknown thing" });
        return m.anim === "idle" && m.room === "rest";
    })());
    ok("6.18 every animation state in the spec exists on the rig", (() => {
        const need = ["idle", "walk", "run", "sit", "stand", "read", "write", "study", "think", "type", "draw", "experiment", "exercise", "karate", "eat", "rest", "sleep", "watch", "explore"];
        return need.every(a => !!w.LQCharacter.ANIMS[a]);
    })());

    /* ================= 7. live synchronisation ============================ */
    ok("7.1 no live signal → idle, nothing assumed", (() => {
        E("pomo.running=false"); E("rt.run=0");
        const lv = w.LQAdapter.live();
        return lv === null && w.LQMapper.current().anim === "idle";
    })());
    E(`pomo.running=true;pomo.mode='focus';pomo.day=today();pomo.total=1500;pomo.left=1200;pomo.end=Date.now()+1200000;
       pomo.cycle=1;pomo.target={v:"hw:1",label:"Mathematics: Polynomials",subject:"Mathematics",hw:"1"};`);
    const liveP = w.LQAdapter.live();
    ok("7.2 focus timer running → live signal with the exact subject and resolved intent",
        !!liveP && liveP.subject === "Mathematics" && liveP.kind === "homework" && !!liveP.intent && liveP.intent.homeworkId === "1",
        liveP && JSON.stringify({ k: liveP.kind, s: liveP.subject, at: liveP.at }));
    ok("7.3 live signal has a real clock time (exact:true)", !!liveP && liveP.exact === true && /^\d{2}:\d{2}$/.test(liveP.at));
    ok("7.4 character mirrors it: seated at the desk doing that subject's academic work", (() => {
        const m = w.LQMapper.current();
        return m.room === "study" && m.spot === "desk" && m.pose === "sit" && m.academic === true
            && m.subjectKey === "maths" && ["study", "write"].indexOf(m.anim) >= 0;
    })());
    ok("7.5 a physics target switches only the desk materials, not the room", (() => {
        E(`pomo.target={v:"hw:2",label:"Science: Light – Reflection and Refraction",subject:"Science",hw:"2"};`);
        const m = w.LQMapper.current();
        return m.room === "study" && m.subjectKey === "physics";
    })());
    ok("7.6 pause → the character rests instead of pretending to study", (() => {
        E("pomo.running=false;pomo.left=900;");
        return w.LQAdapter.live() === null;
    })());
    ok("7.7 break mode is a break, not study", (() => {
        E("pomo.running=true;pomo.mode='break';pomo.target=null;pomo.end=Date.now()+300000;");
        const lv = w.LQAdapter.live();
        return lv && lv.kind === "break" && w.LQMapper.map(lv).room === "rest";
    })());
    E("pomo.running=false;pomo.mode='focus';pomo.target=null;");
    E(`rt.run=1;rt.st=Date.now()-8*60000;rt.acc=0;rt.book="bkMath";`);
    ok("7.8 reading timer running → reading the actual book at the desk", (() => {
        const lv = w.LQAdapter.live();
        if (!lv || lv.kind !== "reading") return false;
        const m = w.LQMapper.map(lv);
        return lv.bookId === "bkMath" && m.room === "study" && m.anim === "read" && m.subjectKey === "maths";
    })());
    ok("7.9 elapsed reading time is computed from the real start stamp", (() => {
        const lv = w.LQAdapter.live();
        const mins = Math.round(lv.elapsedMs / 60000);
        return mins >= 7 && mins <= 9;
    })());
    E(`rt.book="bkNovel";`);
    ok("7.10 switching the book to literature moves him to the library", (() => {
        const m = w.LQMapper.map(w.LQAdapter.live());
        return m.room === "library";
    })());
    E("rt.run=0;rt.acc=0;rt.book='';");
    ok("7.11 live state is reconstructed after a reload (persisted timers)", (() => {
        E("pomoSave()");
        const raw = w.localStorage.getItem("aalimPomoV2");
        return !!raw && JSON.parse(raw).target === null && typeof JSON.parse(raw).running === "boolean";
    })());

    /* ============== 8. strict timeline honesty ============================ */
    const snap = w.LQAdapter.snapshot(TODAY);
    ok("8.1 anchored events carry a real clock time", snap.anchored.length >= 1 && snap.anchored.every(e => /^\d{2}:\d{2}$/.test(e.at)));
    ok("8.2 the study entry logged with an hour is anchored", snap.anchored.some(e => e.label === "Polynomials" && e.at === "09:00"));
    ok("8.3 hour-precision events are flagged as approximate-hour", snap.anchored.some(e => e.exact === "hour"));
    ok("8.4 a study entry with NO clock time is never placed on the timeline",
        !snap.anchored.some(e => /Acids, Bases/.test(e.label)) && snap.records.some(e => /Acids, Bases/.test(e.label)));
    ok("8.5 run / karate / Qur'an / paper appear only as duration records",
        ["run:", "karate:", "quran:", "paper:"].every(p => snap.records.some(r => r.id.indexOf(p) === 0)) &&
        !snap.anchored.some(e => /Run in place|Karate|Qur'an|Board sample/.test(e.label)));
    ok("8.6 records are honestly marked exact:false", snap.records.every(r => r.exact === false));
    ok("8.7 durations come straight from the tracker", (() => {
        const r = snap.records.filter(x => x.id.indexOf("run:") === 0)[0];
        return r && r.mins === 12;
    })());
    ok("8.8 karate/run are not double-counted from extraLog", (() => {
        /* the tracker's own de-dup rule keys off state.extra entries of that kind,
           so register the activity the way the tracker itself would */
        E(`state.extra.push({name:"Karate",project:"",goal:"",hours:0,status:"Active",cat:"",measure:"minutes",kind:"karate",catId:"",ms:[]})`);
        E(`state.extraLog.push({date:today(),activity:"Karate",mins:20,note:"",val:""})`);
        const s = w.LQAdapter.snapshot(TODAY);
        const k = s.records.filter(r => /Karate/i.test(r.label));
        return k.length === 1;
    })());
    ok("8.9 configured schedule bands are separate from activities", Array.isArray(snap.schedule));
    ok("8.10 dates() lists only days with real records", w.LQAdapter.dates().includes(TODAY));
    ok("8.11 an empty day yields nothing invented", (() => {
        const s = w.LQAdapter.snapshot("2001-01-01");
        return s.anchored.length === 0 && s.records.length === 0;
    })());
    ok("8.12 mastery evidence comes from the syllabus tracker", (() => {
        E(`state.progress["Mathematics|Polynomials"]="Mastered";state.progress["Mathematics|Real Numbers"]="Revised";`);
        const m = w.LQAdapter.mastery();
        return m.Mathematics && m.Mathematics.mastered === 1 && m.Mathematics.revised === 2;
    })());

    /* ================= 9. renderer ======================================== */
    E("showPage('lq')"); E("LQUI.show('world')");
    await new Promise(r => setTimeout(r, 200));
    ok("9.1 the world stage is an SVG with all five layers",
        !!$("#lqStageHost svg.lq-stage") && ["back", "props", "char", "front", "ambient"].every(l => !!$(".lq-layer-" + l)));
    ok("9.2 the character rig exists exactly once in the world", d.querySelectorAll(".lq-layer-char .lq-fig").length === 1);
    ok("9.3 every pose of the rig has head, torso, two arms and two legs", (() => {
        const f = $(".lq-layer-char .lq-fig");
        if (!f) return false;
        const frame = g => g.querySelector(".lq-legs .fa") || g.querySelector(".lq-legs") || g;
        const armFrame = a => a.querySelector(".fa") || a;
        return ["stand", "sit", "recline"].every(pose => {
            const g = f.querySelector(".lq-p-" + pose);
            if (!g) return false;
            const lf = frame(g);
            const af = armFrame(g.querySelector(".lq-arm-f")), ab = armFrame(g.querySelector(".lq-arm-b"));
            return g.querySelectorAll(".lq-head").length === 1 && g.querySelectorAll(".lq-torso").length === 1
                && g.querySelectorAll(".lq-arm").length === 2
                && lf.querySelectorAll(".lq-leg").length === 2 && lf.querySelectorAll(".lq-knee").length === 2
                && af.querySelectorAll(".lq-elbow").length === 1 && ab.querySelectorAll(".lq-elbow").length === 1;
        }) && !!f.querySelector(".lq-p-lie .lq-head") && !!f.querySelector(".lq-p-lie .lq-torso");
    })());
    /* Put him at the desk first: with no live signal the world correctly shows
       the rest area, so the study-room assertions need an explicit activity. */
    E(`LQRender.setActivity(LQMapper.map({kind:"study",source:"study",subject:"Mathematics",label:"Polynomials"}))`);
    await new Promise(r => setTimeout(r, 80));
    ok("9.4 the study room renders desk, chair, bookshelf, window and lamp", (() => {
        const b = $(".lq-layer-back").innerHTML;
        return ["lq-desk", "lq-chair", "lq-shelf", "lq-win", "lq-lamp"].every(c => b.includes(c));
    })());
    ok("9.5 the desk front panel is drawn after the character (seated occlusion)",
        $(".lq-layer-front").innerHTML.includes("lq-deskfront"));
    const backMaths = $(".lq-layer-back").innerHTML;
    const propsMaths = $(".lq-deskprops") && $(".lq-deskprops").getAttribute("data-subject");
    const figMaths = $(".lq-layer-char .lq-fig");
    const animMaths = figMaths.getAttribute("data-anim"), poseMaths = figMaths.getAttribute("data-pose");
    E(`LQRender.setActivity(LQMapper.map({kind:"study",source:"study",subject:"Science",label:"Chemical Reactions and Equations"}))`);
    const propsChem = $(".lq-deskprops") && $(".lq-deskprops").getAttribute("data-subject");
    ok("9.6 switching subject swaps the desk materials", propsMaths === "maths" && propsChem === "chemistry", propsMaths + "→" + propsChem);
    ok("9.7 switching subject does NOT change the room geometry", $(".lq-layer-back").innerHTML === backMaths);
    ok("9.8 both subjects keep the same seated study pose", animMaths === "study" && poseMaths === "sit"
        && $(".lq-layer-char .lq-fig").getAttribute("data-anim") === "study"
        && $(".lq-layer-char .lq-fig").getAttribute("data-pose") === "sit");
    ok("9.9 the notebook glyph changes with the subject", (() => {
        const p = $(".lq-layer-props").innerHTML;
        return p.includes("lq-note") && p.includes("lq-stack") && p.includes("lq-pencil");
    })());
    ok("9.10 the HUD states the activity and the room", (() => {
        const h = $(".lq-hud").textContent;
        return /Studying|Study/.test(h) && /Study desk/.test(h);
    })());
    ok("9.11 changing room rebuilds the scene (bedroom has a bed)", (() => {
        E(`LQRender.setActivity(LQMapper.map({kind:"sleep",source:"dayLog"}))`);
        return $(".lq-layer-back").innerHTML.includes("lq-bed");
    })());
    ok("9.12 day/night sky follows the real clock", (() => {
        const night = w.LQWorld.skyAt(60), noon = w.LQWorld.skyAt(720);
        return night.night === true && night.stars > 0.9 && noon.night === false && noon.glow > 0.9;
    })());
    ok("9.13 the sun/moon arc stays inside the window", (() => {
        return [0, 300, 600, 900, 1200, 1439].every(m => { const o = w.LQWorld.orbPos(m); return o.x >= 2 && o.x <= 28 && o.y >= 2 && o.y <= 20; });
    })());

    /* ---- 9b. the pixel-art contract: the style is a rule, not a mood ----- */
    const P = E("LQWorld.P");
    const artMarkup = E(`(function(){
      var sc = LQWorld.scene(LQMapper.map({kind:"study",source:"study",subject:"Mathematics"}), {minute:600});
      return sc.back + sc.front + sc.ambient + LQCharacter.rig() +
        LQCharacter.deskProps("maths", {w:24,h:10});
    })()`);
    ok("9.14 no curves, circles, ellipses, rounded corners, gradients or filters anywhere in the art",
        P === 4 && !/<path|<circle|<ellipse|rx=|ry=|Gradient|filter|blur|rotate\(/i.test(artMarkup));
    ok("9.15 every scene coordinate sits on the 4-unit pixel grid", (() => {
      const sceneOnly = E(`(function(){
        var sc = LQWorld.scene(LQMapper.map({kind:"study",source:"study",subject:"Mathematics"}), {minute:600});
        return sc.back + sc.front + sc.ambient;
      })()`);
      const bad = [];
      sceneOnly.replace(/\b[x_y]|width|height="( -?[\d.]+)"/g, (mm, v) => { if (v !== undefined && Math.abs(parseFloat(v) % P) > 1e-9) bad.push(v); return mm; });
      const attrs = sceneOnly.match(/\b(?:x|y|width|height)="(-?[\d.]+)"/g) || [];
      attrs.forEach(a => { const v = parseFloat(a.split("=")[1]); if (Math.abs(v % P) > 1e-9) bad.push(a); });
      return bad.length === 0;
    })());
    ok("9.16 the whole stylesheet is hue-free: every colour is black, white or a true grey", (() => {
      const css = require("fs").readFileSync(require("path").join(__dirname, "..", "lifequest.css"), "utf8");
      const bad = [];
      css.replace(/#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?/g, (mm, h) => {
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        if (r !== g || g !== b) bad.push(mm);
        return mm;
      });
      return bad.length === 0;
    })());

    /* ============== 10. unbuilt environments stay honest ================== */
    ok("10.1 an unbuilt room reports itself instead of faking a scene", (() => {
        const m = w.LQMapper.map({ kind: "karate", source: "karate", label: "Karate" });
        return m.built === false && /not built yet/i.test(m.note) && m.fallbackRoom === "study";
    })());
    ok("10.2 the renderer shows the honest note on screen", (() => {
        E(`LQRender.setActivity(LQMapper.map({kind:"karate",source:"karate",label:"Karate practice"}))`);
        const n = $(".lq-scenenote");
        return n && !n.hidden && /not built yet/i.test(n.textContent);
    })());
    ok("10.3 the character is still drawn (at the fallback desk)", !!$(".lq-layer-char .lq-fig"));
    ok("10.4 Phase 2 rooms are built, later ones declared with their phase", (() => {
        const R = w.LQMapper.ROOMS;
        return R.study.built && R.bedroom.built && R.rest.built &&
            R.lab.built === false && R.library.built === false && R.observatory.built === false &&
            R.lab.phase === 6;
    })());
    ok("10.5 the map panel marks built vs planned areas", (() => {
        E("LQUI.show('map')");
        return d.querySelectorAll("#lqp-map .lq-area").length >= 8 && !!$('#lqp-map .lq-area[data-built="1"]') && !!$('#lqp-map .lq-area[data-built="0"]');
    })());
    ok("10.6 phase-gated panels say which phase they arrive in", (() => {
        E("LQUI.show('skills')"); E("LQUI.show('miles')"); E("LQUI.show('journal')"); E("LQUI.show('stats')");
        return ["skills", "miles", "journal", "stats"].every(p => /Phase [56]/.test(d.getElementById("lqp-" + p).textContent));
    })());
    ok("10.7 phase-gated panels still show real tracker evidence", (() => {
        E("LQUI.show('skills')");
        return /Mathematics/.test(d.getElementById("lqp-skills").textContent);
    })());

    /* ============ 11. accessibility, control, performance ================= */
    ok("11.1 all eight panels exist and only one is visible", (() => {
        E("LQUI.show('world')");
        const vis = ["world", "char", "day", "map", "skills", "miles", "journal", "stats"].filter(p => !d.getElementById("lqp-" + p).hidden);
        return vis.length === 1 && vis[0] === "world";
    })());
    ok("11.2 reduce-motion preference adds the reduced class and stops keyframes", (() => {
        E("LQStore.mutate(s=>{s.prefs.reducedMotion=true})"); E("LQUI.show('world')");
        return $(".lq-stage").classList.contains("lq-reduced");
    })());
    ok("11.3 ambient toggle is honoured", (() => {
        E("LQStore.mutate(s=>{s.prefs.ambient=false})"); E("LQUI.show('world')");
        return $(".lq-stage").classList.contains("lq-noambient");
    })());
    ok("11.4 pausing live movement stops the render loop", (() => {
        E("LQStore.mutate(s=>{s.prefs.livePaused=true})"); E("LQUI.show('world')");
        const r = w.LQRender.state();
        E("LQStore.mutate(s=>{s.prefs.livePaused=false;s.prefs.ambient=true;s.prefs.reducedMotion=false})");
        return r.running === false;
    })());
    ok("11.5 leaving the page stops the loop; returning restarts it", (() => {
        E("showPage('dashboard')");
        const off = w.LQRender.state().running;
        E("showPage('lq')");
        const on = w.LQRender.state().running;
        return off === false && on === true;
    })());
    ok("11.6 hidden document stops rendering", (() => {
        Object.defineProperty(d, "hidden", { configurable: true, get: () => true });
        d.dispatchEvent(new w.Event("visibilitychange"));
        const r = w.LQRender.state().running;
        Object.defineProperty(d, "hidden", { configurable: true, get: () => false });
        d.dispatchEvent(new w.Event("visibilitychange"));
        return r === false;
    })());
    ok("11.7 character customisation is persisted in game data only", (() => {
        E("LQStore.mutate(s=>{s.char.skin=3;s.char.outfit=5;s.char.accessory=2})");
        E("LQUI.show('char')");
        const f = $("#lqp-char .lq-fig");
        return w.LQStore.get().char.skin === 3 && f.getAttribute("data-skin") === "3" && f.getAttribute("data-outfit") === "5";
    })());
    ok("11.8 customisation never changes his proportions (same core rig)", (() => {
        const parts = () => {
            const f = $("#lqp-char .lq-fig");
            const g = f.querySelector(".lq-p-" + (f.getAttribute("data-pose") || "stand"));
            const lf = g.querySelector(".lq-legs .fa") || g.querySelector(".lq-legs") || g;
            const af = a => (a.querySelector(".fa") || a);
            return [
                g.querySelectorAll(".lq-head").length, g.querySelectorAll(".lq-torso").length,
                g.querySelectorAll(".lq-arm").length, lf.querySelectorAll(".lq-leg").length,
                lf.querySelectorAll(".lq-knee").length,
                af(g.querySelector(".lq-arm-f")).querySelectorAll(".lq-elbow").length +
                af(g.querySelector(".lq-arm-b")).querySelectorAll(".lq-elbow").length
            ].join(",");
        };
        E("LQStore.mutate(s=>{s.char.skin=5;s.char.outfit=7;s.char.accessory=4})"); E("LQUI.show('char')");
        const a = parts();
        E("LQStore.mutate(s=>{s.char.skin=0;s.char.outfit=0;s.char.accessory=-1})"); E("LQUI.show('char')");
        const b = parts();
        const tr = $("#lqp-char .lq-fig").getAttribute("transform") || "";
        return a === b && a === "1,1,2,2,2,2" && !/scale/.test(tr);
    })());
    ok("11.9 animation preview does not record anything", (() => {
        const b = snapNoLQ();
        E("LQUI.show('char')");
        d.querySelectorAll("#lqp-char .lq-an").forEach(btn => btn.click());
        return snapNoLQ() === b && d.querySelectorAll("#lqp-char .lq-an").length >= 19;
    })());
    ok("11.10 milestones cannot be awarded twice for the same evidence", (() => {
        const a = w.LQStore.award("book:bkMath", { kind: "reading", label: "Finished a book", cat: "knowledge", points: 1 });
        const b = w.LQStore.award("book:bkMath", { kind: "reading", label: "Finished a book", cat: "knowledge", points: 1 });
        const n = w.LQStore.get().milestones.filter(m => m.ref === "book:bkMath").length;
        return a === true && b === false && n === 1;
    })());
    ok("11.11 no alert() is used by the game layer", (() => {
        const files = ["lq-boot.js", "lifequest.js", "lq-store.js", "lq-adapter.js", "lq-mapper.js", "lq-character.js", "lq-world.js", "lq-render.js", "lq-ui.js"];
        return files.every(f => !/\balert\s*\(/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    })());
    /* The reset control must be game-only: cosmetics + preferences disappear,
       earned evidence and every tracker record stay exactly as they were. */
    ok("11.12 the reset button clears cosmetics/prefs but keeps milestones and all tracker records", (() => {
        const before = snapNoLQ();
        const msBefore = E("LQStore.get().milestones.length");
        E("LQStore.mutate(s=>{s.char.skin=4;s.char.outfit=3;s.char.accessory=2;s.prefs.ambient=false;s.prefs.reducedMotion=true})");
        E("LQUI.show('char')");
        const btn = d.getElementById("lqResetGame");
        if (!btn) return "no #lqResetGame button";
        btn.click();
        const g = w.LQStore.get();
        return snapNoLQ() === before                              /* tracker untouched */
            && g.char.skin === 0 && g.char.outfit === 0 && g.char.accessory === -1
            && g.prefs.ambient !== false && !g.prefs.reducedMotion
            && g.milestones.length === msBefore && msBefore > 0;   /* evidence kept */
    })());

    /* ================= 12. version & service worker ======================= */
    const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const swf = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    ok("12.1 APP_VERSION bumped to v99", /const APP_VERSION = "v99"/.test(idx));
    ok("12.2 sw.js CACHE matches v99", /const CACHE = "aalim-tracker-v99"/.test(swf));
    ok("12.3 every LIFEQUEST asset is cached for offline use",
        ["lq-boot.js", "lifequest.css", "lq-store.js", "lq-adapter.js", "lq-mapper.js", "lq-character.js", "lq-world.js", "lq-render.js", "lq-ui.js", "lifequest.js"]
            .every(a => swf.includes('"' + a + '"')));
    /* The stylesheet is deliberately NOT in <head> any more: lq-boot.js injects
       it the first time the game is opened, so a tracker-only session never
       downloads 29 KB of game CSS. Offline still works because sw.js precaches
       the file (12.3) — the lazy <link> is served straight from the cache. */
    ok("12.4 index.html ships no eager game CSS or module scripts — only lq-boot.js", (() => {
        return !/href="lifequest\.css"/.test(idx)
            && (idx.match(/<script src="lq-|<script src="lifequest\.js"/g) || []).length === 1
            && /<script src="lq-boot\.js"><\/script>/.test(idx);
    })(), (idx.match(/<script src="(lq-[^"]+|lifequest\.js)"/g) || []).join(","));
    ok("12.4b lq-boot.js knows every file it must fetch, in dependency order", (() => {
        const boot = fs.readFileSync(path.join(ROOT, "lq-boot.js"), "utf8");
        const list = boot.slice(boot.indexOf("var FILES"), boot.indexOf("var status"));
        return ["lq-store.js", "lq-adapter.js", "lq-mapper.js", "lq-character.js", "lq-world.js",
            "lq-render.js", "lq-ui.js", "lifequest.js"].every((f, i, a) =>
            list.indexOf('"' + f + '"') > (i ? list.indexOf('"' + a[i - 1] + '"') : -1))
            && /lifequest\.css/.test(boot);
    })());
    ok("12.5 the game makes no network requests", (() => {
        const files = ["lq-boot.js", "lifequest.js", "lq-store.js", "lq-adapter.js", "lq-mapper.js", "lq-character.js", "lq-world.js", "lq-render.js", "lq-ui.js"];
        return files.every(f => !/fetch\s*\(|XMLHttpRequest|https?:\/\//.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    })());
    ok("12.6 all existing lab assets are still cached", ["chemlab.html", "labui.js", "chemcore.js", "physcore.js", "biocore.js"].every(a => swf.includes('"' + a + '"')));

    /* ============== 13. the existing app still works ====================== */
    const PAGES = ["dashboard", "today", "calendar", "study", "syllabus", "exams", "homework", "practice", "paper",
        "flash", "mistakes", "feynman", "research", "library", "movies", "biz", "analytics", "report",
        "tasks", "review", "hof", "workout", "lift", "deen", "extra", "settings"];
    let rendered = 0, broken = [];
    E("showPage('dashboard')");
    await new Promise(r => setTimeout(r, 150));
    PAGES.forEach(p => {
        E(`showPage(${JSON.stringify(p)})`);
        const sec = d.getElementById(p);
        const len = sec ? sec.innerHTML.trim().length : 0;
        if (sec && sec.classList.contains("active") && len > 200) rendered++; else broken.push(p + "(" + len + ")");
    });
    ok("13.1 all 26 existing tabs still render real content", rendered === PAGES.length, broken.join(","));
    ok("13.2 the tracker's own save/load still round-trips", (() => {
        E("save()");
        const raw = w.localStorage.getItem("aalimTrackerV2");
        return !!raw && JSON.parse(raw).lq !== undefined && JSON.parse(raw).study.length >= 2;
    })());
    ok("13.3 legacy state without lq loads cleanly and the game repairs it",
        E(`(function(){const o=JSON.parse(localStorage.getItem("aalimTrackerV2"));delete o.lq;const n=normalize(o);
            return !!n.lq && typeof n.lq==="object" && !Array.isArray(n.lq)
              && LQStore.norm(n.lq).v===1 && LQStore.norm(n.lq).prefs.replaySpeed===1
              && LQStore.norm(n.lq).char.skin===0})()`) === true);
    ok("13.4 the Virtual Lab hub still opens chemlab", E("HUBS.some(h=>h.id==='lab')") === true && !!d.getElementById("vlab"));

    /* ============ 14. Phase 3 — every real record type is mapped =========== */
    E(`state.homework.unshift({id:"hw1",subject:"Mathematics",title:"Polynomials Ex 2.1",due:today(),pri:"High",est:30,note:"",status:"Done",done:today(),spent:25,created:today()})`);
    E(`state.plan[today()]=[{t:"Mathematics: Polynomials",done:true},{t:"Help at home",done:true}]`);
    E(`state.mistakes.unshift({id:"mk1",date:today(),subject:"Science",chapter:"Acids, Bases and Salts",reason:"Misread the question",lost:2,q:"pH of 0.1 M HCl",fix:"Use -log[H+]",fixed:false})`);
    E(`state.feynman.unshift({topic:"Refraction",explain:"Light bends because its speed changes.",gaps:"",status:"Confident",date:today()})`);
    E(`state.questions.push({subject:"Mathematics",chapter:"Quadratic Equations",type:"Long answer",marks:3,q:"Solve",a:"x=2,3",right:2,wrong:1,last:today()})`);
    E(`state.marks.push({date:today(),subject:"Science",test:"Unit test 2",score:18,max:20})`);
    E(`state.exams.push({id:9001,name:"Half-yearly Science",date:today(),topics:[],link:"",type:"School",done:today()})`);
    E(`state.research.unshift({id:"p1",title:"Solar tracker",q:"How to follow the sun?",subject:"Engineering",due:"",g:10,cat:"Engineering",wt:0,status:"Building",kind:"Engineering",
        learn:[{id:"l1",t:"Motor driver",s:"Electronics",st:"Learning"},{id:"l2",t:"Trigonometry basics",s:"Mathematics",st:"To learn"}],
        parts:[],tests:[{d:today(),t:"Motor load",r:"Pass",x:""}],chap:[],chars:[],hyp:"",plan:"",concl:"",sources:[],
        notes:[{d:today(),k:"Finding",x:"Gear ratio matters"}],created:today(),tasks:[]})`);
    E(`state.bizLog.unshift({date:today(),v:"Notes",t:"Sale",a:120,n:"4 sets"})`);
    E(`state.reviews.push({id:"rv1",wk:"2026-W47",win:"Finished two chapters",hard:"Sleep",goals:[{t:"Revise daily",done:false}],target:today(),date:today()})`);
    E(`state.prayers[today()]={Fajr:true,Dhuhr:true,Asr:false,Maghrib:true,Isha:false}`);
    E(`state.dayLog[today()]=Object.assign(state.dayLog[today()]||{},{meals:{b:true,l:true,d:false}})`);
    E(`state.gam=Object.assign(state.gam||{},{rest:[today()]})`);
    E(`state.hobbySec=[{id:"chem",n:"Real Chemistry",ic:"🧪",foc:[],ms:[]},{id:"draw",n:"Drawing & Sketching",ic:"🎨",foc:[],ms:[]},{id:"chess",n:"Chess Club",ic:"♟",foc:[],ms:[]}]`);
    E(`state.hobbyLog.push({id:"hbc",sec:"chem",date:today(),mins:25,focus:"Reading theory",title:"Acids",val:"",note:""})`);
    E(`state.hobbyLog.push({id:"hbx",sec:"chem",date:today(),mins:20,focus:"Home-safe experiment (adult present)",title:"Indicator",val:"",note:""})`);
    E(`state.hobbyLog.push({id:"hbs",sec:"chess",date:today(),mins:15,focus:"Endgames",title:"",val:"",note:""})`);
    E(`state.extra.push({name:"Cricket practice",project:"",goal:"",hours:0,status:"Active",cat:"Sport",measure:"minutes",kind:"",catId:"",ms:[]})`);
    E(`state.extra.push({name:"Community service",project:"",goal:"",hours:0,status:"Active",cat:"",measure:"minutes",kind:"",catId:"",ms:[]})`);
    E(`state.extraLog.push({date:today(),activity:"Cricket practice",mins:30,note:"",val:""})`);
    E(`state.extraLog.push({date:today(),activity:"Community service",mins:45,note:"",val:""})`);
    E("save()");
    const p3 = snapNoLQ();          /* captured AFTER the fixtures: from here on,
                                       Phase 3 must only ever READ the tracker */
    const rec = id => E(`(function(){var r=LQAdapter.dayRecords(today()).filter(function(x){return x.id.indexOf(${JSON.stringify(id)})===0});return r.length?JSON.stringify(r[0]):"MISSING"})()`);
    const mapOf = id => E(`(function(){var r=LQAdapter.dayRecords(today()).filter(function(x){return x.id.indexOf(${JSON.stringify(id)})===0})[0];return r?JSON.stringify(LQMapper.map(r)):"MISSING"})()`);
    const J = s => { try { return JSON.parse(s); } catch (e) { return null; } };

    ok("14.1 completed homework is real evidence — at the desk, that subject, zero minutes (already in study)", (() => {
        const e = J(rec("hw:")), m = J(mapOf("hw:"));
        return !!e && e.kind === "homework" && e.mins === 0 && !!m && m.room === "study" && m.spot === "desk"
            && m.pose === "sit" && m.academic === true && m.subjectKey === "maths" && m.anim === "write";
    })(), rec("hw:"));
    ok("14.2 a ticked plan item that names a real chapter → revising that chapter at the desk", (() => {
        const rs = E(`LQAdapter.dayRecords(today()).filter(x=>x.source==="plan")`);
        const rev = rs.filter(x => x.kind === "revision");
        const m = rev.length ? w.LQMapper.map(rev[0]) : null;
        return rev.length === 1 && rev[0].subject === "Mathematics" && rev[0].chapter === "Polynomials"
            && !!m && m.room === "study" && m.spot === "desk" && m.anim === "revise" && m.subjectKey === "maths";
    })(), JSON.stringify({ n: E(`LQAdapter.dayRecords(today()).filter(function(x){return x.source==="plan"}).length`), rs: E(`JSON.stringify(LQAdapter.dayRecords(today()).filter(function(x){return x.source==="plan"}))`) }));
    ok("14.3 a ticked plan item with no provable subject claims no subject", (() => {
        const rs = E(`LQAdapter.dayRecords(today()).filter(x=>x.source==="plan"&&x.kind==="plan")`);
        const m = rs.length ? w.LQMapper.map(rs[0]) : null;
        return rs.length === 1 && !!m && m.room === "study" && m.subjectKey === "generic" && m.academic !== true
            && /no subject recorded/i.test(m.note || "");
    })());
    ok("14.4 a mistake analysed that day is revision at the desk, that subject", (() => {
        const e = J(rec("mistake:")), m = J(mapOf("mistake:"));
        return !!e && e.kind === "revision" && !!m && m.room === "study" && m.spot === "desk" && m.anim === "revise"
            && m.subjectKey === "chemistry" && m.academic === true;
    })(), rec("mistake:"));
    ok("14.5 a Feynman explanation is thinking at the desk", (() => {
        const m = J(mapOf("feynman:"));
        return !!m && m.room === "study" && m.spot === "desk" && m.anim === "think" && m.academic === true;
    })());
    ok("14.6 question-bank practice is writing at the desk, that subject", (() => {
        const m = J(mapOf("q:"));
        return !!m && m.room === "study" && m.anim === "write" && m.subjectKey === "maths";
    })());
    ok("14.7 a recorded test result is an examination at the desk — never the laboratory", (() => {
        const m = J(mapOf("mark:"));
        return !!m && m.room === "study" && m.spot === "desk" && m.anim === "exam" && m.academic === true && !m.practical;
    })());
    ok("14.8 a completed scheduled exam is an examination at the desk", (() => {
        const m = J(mapOf("exam:"));
        return !!m && m.room === "study" && m.anim === "exam" && m.academic === true;
    })());
    ok("14.9 project notes and tests are project work in the workshop — never the laboratory", (() => {
        const n = J(mapOf("resnote:")), t = J(mapOf("restest:"));
        return !!n && !!t && n.room === "workshop" && t.room === "workshop"
            && n.built === false && /not built yet/i.test(n.note || "") && n.fallbackRoom === "study"
            && n.room !== "lab" && t.room !== "lab";
    })(), mapOf("resnote:"));
    ok("14.10 a money-log entry is business in the city", (() => {
        const m = J(mapOf("biz:"));
        return !!m && m.room === "city" && m.academic !== true;
    })());
    ok("14.11 a weekly review is reflection, not study", (() => {
        const m = J(mapOf("review:"));
        return !!m && m.kind === "reflection" && m.room === "rest" && m.anim === "think" && m.academic !== true;
    })());
    ok("14.12 each prayer actually marked appears once, in the sanctuary", (() => {
        const ps = E(`LQAdapter.dayRecords(today()).filter(x=>x.source==="prayers")`);
        const m = ps.length ? w.LQMapper.map(ps[0]) : null;
        return ps.length === 3 && ps.map(x => x.label).join("|") === "Prayer · Fajr|Prayer · Dhuhr|Prayer · Maghrib"
            && !!m && m.room === "sanctuary" && m.subject === "Deen";
    })(), String(E(`LQAdapter.dayRecords(today()).filter(x=>x.source==="prayers").length`)));
    ok("14.13 logged meals are meals (home table), not study", (() => {
        const ms = E(`LQAdapter.dayRecords(today()).filter(x=>x.kind==="meal")`);
        const m = ms.length ? w.LQMapper.map(ms[0]) : null;
        return ms.length === 2 && !!m && m.room === "rest" && m.spot === "table" && m.anim === "eat" && m.academic !== true;
    })());
    ok("14.14 a claimed rest day is rest — never punished, never invented work", (() => {
        const m = J(mapOf("restday:"));
        return !!m && m.room === "rest" && m.anim === "rest" && m.pose === "recline" && m.academic !== true;
    })());
    ok("14.15 extra-curricular work is classified from the tracker's OWN activity definition", (() => {
        const all = E(`LQAdapter.dayRecords(today()).filter(function(x){return x.source==="extraLog"}).map(function(x){var m=LQMapper.map(x);return x.subject+"→"+m.room+"/"+m.anim}).join(" | ")`);
        return /Cricket practice→garden\/exercise/.test(all) && /Community service→rest\/explore/.test(all);
    })(), String(E(`LQAdapter.dayRecords(today()).filter(function(x){return x.source==="extraLog"}).map(function(x){return x.subject+"→"+LQMapper.map(x).room}).join("|")`)));
    ok("14.16 an unmapped activity stays generic and says so — nothing is invented", (() => {
        const e = E(`LQAdapter.dayRecords(today()).filter(x=>x.subject==="Community service")[0]`);
        const m = e ? w.LQMapper.map(e) : null;
        return !!m && m.anim === "explore" && m.room === "rest" && /unmapped/i.test(m.note || "") && m.label === e.label;
    })());
    ok("14.17 the Real Chemistry hobby section: theory at the desk, home-safe practical at the bench, NEVER the laboratory", (() => {
        const pick = focus => E(`JSON.parse(JSON.stringify(LQAdapter.dayRecords(today()).filter(function(x){return x.sec==="chem"&&x.focus===${JSON.stringify(focus)}})[0]||"null"))`);
        const mt = w.LQMapper.map(pick("Reading theory")), mp = w.LQMapper.map(pick("Home-safe experiment (adult present)"));
        return pick("Reading theory") !== null && pick("Home-safe experiment (adult present)") !== null
            && mt.room === "study" && mt.spot === "desk" && mt.subjectKey === "chemistry" && mt.academic === true && mt.anim === "study"
            && mp.room === "workshop" && mp.spot === "bench" && mp.academic !== true
            && mt.room !== "lab" && mp.room !== "lab";
    })());
    ok("14.18 a custom hobby section is classified honestly (chess → a quiet think)", (() => {
        const e = E(`JSON.parse(JSON.stringify(LQAdapter.dayRecords(today()).filter(x=>x.sec==="chess")[0]||"null"))`);
        const m = e ? w.LQMapper.map(e) : null;
        return !!m && m.room === "rest" && m.spot === "table" && m.anim === "think";
    })());
    ok("14.19 live intent: a project focus block is project work, not desk study", (() => {
        E(`pomo.running=true;pomo.mode="focus";pomo.day=today();pomo.total=1500;pomo.left=1200;pomo.end=Date.now()+1200000;pomo.target=resolveTarget("res:p1");`);
        const lv = w.LQAdapter.live(), m = lv ? w.LQMapper.map(lv) : null;
        E(`pomo.running=false;pomo.target=null;`);
        return !!lv && lv.kind === "project" && lv.intent.projectId === "p1" && !!m && m.room === "workshop" && m.room !== "study";
    })());
    ok("14.20 live intent: a project learning item with a school subject stays at the desk (binding rule)", (() => {
        E(`pomo.running=true;pomo.mode="focus";pomo.day=today();pomo.total=1500;pomo.left=1200;pomo.end=Date.now()+1200000;pomo.target=resolveTarget("learn:p1|l2");`);
        const lv = w.LQAdapter.live(), m = lv ? w.LQMapper.map(lv) : null;
        E(`pomo.target=resolveTarget("learn:p1|l1");`);
        const lv2 = w.LQAdapter.live(), m2 = lv2 ? w.LQMapper.map(lv2) : null;
        E(`pomo.running=false;pomo.target=null;`);
        return !!m && m.room === "study" && m.spot === "desk" && m.academic === true && m.subjectKey === "maths"
            && !!m2 && m2.room === "workshop";          /* Electronics is not a school subject here */
    })());
    ok("14.21 live intent: a syllabus chapter target is revision of that exact chapter at the desk", (() => {
        E(`pomo.running=true;pomo.mode="focus";pomo.day=today();pomo.total=1500;pomo.left=1200;pomo.end=Date.now()+1200000;pomo.target=resolveTarget("chap:Mathematics|Quadratic Equations");`);
        const lv = w.LQAdapter.live(), m = lv ? w.LQMapper.map(lv) : null;
        E(`pomo.running=false;pomo.target=null;`);
        return !!lv && lv.kind === "revision" && lv.subject === "Mathematics" && lv.chapter === "Quadratic Equations"
            && !!m && m.room === "study" && m.anim === "revise" && m.subjectKey === "maths";
    })());
    ok("14.22 live intent: a homework target is homework at the desk", (() => {
        E(`pomo.running=true;pomo.mode="focus";pomo.day=today();pomo.total=1500;pomo.left=1200;pomo.end=Date.now()+1200000;pomo.target=resolveTarget("hw:hw1");`);
        const lv = w.LQAdapter.live(), m = lv ? w.LQMapper.map(lv) : null;
        E(`pomo.running=false;pomo.target=null;`);
        return !!lv && lv.kind === "homework" && lv.subject === "Mathematics" && !!m && m.room === "study" && m.anim === "write";
    })());
    ok("14.23 free focus uses the subject the user typed (what the tracker itself will log)", (() => {
        E(`document.getElementById("pomoSubject").value="Geography";`);
        E(`pomo.running=true;pomo.mode="focus";pomo.day=today();pomo.total=1500;pomo.left=1200;pomo.end=Date.now()+1200000;pomo.target=null;`);
        const lv = w.LQAdapter.live(), m = lv ? w.LQMapper.map(lv) : null;
        E(`pomo.running=false;document.getElementById("pomoSubject").value="";`);
        return !!lv && lv.subject === "Geography" && !!m && m.room === "study" && m.subjectKey === "geography";
    })());
    ok("14.24 no new evidence source can ever reach the laboratory or the observatory", (() => {
        const rs = E(`LQAdapter.dayRecords(today()).map(function(x){return LQMapper.map(x).room})`);
        const labs = rs.filter(r => r === "lab").length, obs = rs.filter(r => r === "observatory").length;
        return labs === 0 && obs === 0;
    })(), String(E(`LQAdapter.dayRecords(today()).map(function(x){return LQMapper.map(x).room}).join(",")`)));
    ok("14.25 evidence markers add no minutes — the tracker's own total is unchanged", (() => {
        const t = E(`LQAdapter.totals(today()).all`), am = E(`activityMins(today())`);
        const zeros = E(`LQAdapter.dayRecords(today()).filter(function(x){return x.mins===0}).length`);
        return t === am && zeros >= 14;
    })(), String(E(`LQAdapter.totals(today()).all`) + " vs " + E(`activityMins(today())`)));
    ok("14.26 days that only hold markers are still real days in the journey list", (() => {
        const ds = E(`LQAdapter.dates()`);
        return ds.indexOf(TODAY) >= 0 && ds.length === new Set(ds).size;
    })());
    ok("14.27 Phase 3 reads everything and writes nothing", snapNoLQ() === p3);

    /* One tracker mutation IS reachable while browsing LIFEQUEST — but it is the
       host's own, not the game's. renderHof() (index.html:5133) stamps
       state.meta._hof for any badge that has just become true, on every page
       change. Prove the writer is the host by producing the identical stamp from
       tracker-only navigation with LIFEQUEST never opened. */
    ok("14.28 the only tracker write reachable from LIFEQUEST is the host's own Hall-of-Fame stamp, reproduced by tracker-only navigation", (() => {
        const T = E("today()");
        E(`state.reviews.length=0;`);
        E(`state.reviews.push({id:"hofrv",wk:"W-hof",win:"Good week",hard:"",goals:[{t:"Revise",done:true}],target:30,date:"${T}"});`);
        const stamp = () => E("JSON.stringify(state.meta._hof||{})");
        E(`state.meta._hof={};save();`);
        E("showPage('stats')");                       /* tracker page only */
        const hostStamp = stamp();
        E(`state.meta._hof={};save();`);
        E("showPage('lq')"); E("LQUI.show('day')");    /* via LIFEQUEST */
        const lqStamp = stamp();
        return hostStamp !== "{}" && hostStamp === lqStamp
            && /First Weekly Review/.test(hostStamp);
    })(), String(E("JSON.stringify(state.meta._hof||{})")));
    ok("14.29 no LIFEQUEST module ever writes a tracker record", (() => {
        const src = ["lq-adapter.js", "lq-mapper.js", "lq-world.js", "lq-ui.js", "lq-render.js",
            "lq-character.js", "lq-store.js", "lifequest.js", "lq-boot.js"]
            .map(f => String(fs.readFileSync(path.join(__dirname, "..", f), "utf8")));
        /* the game reads the tracker; only lq-store.js may write, and only state.lq */
        return src.every((s, i) => {
            if (i === 6) return true;                                  /* lq-store.js */
            return !/state\.(study|homework|plan|mistakes|feynman|questions|marks|papers|exams|research|bizLog|reviews|prayers|dayLog|gam|hobbyLog|extraLog|extra|runs|karate|workouts|lifts|quran|movies|hof|tasks|meta)\s*(=|\.push|\.unshift|\[)/.test(s);
        });
    })());

    ok("boot: no page errors", problems.length === 0, problems.slice(0, 4).join(" || "));

    /* ------------------------------------------------------------- report */
    const pass = results.filter(r => r.startsWith("PASS")).length;
    results.forEach(r => console.log(r));
    console.log("\n" + pass + "/" + results.length + " passed");
    if (problems.length) { console.log("\nPAGE PROBLEMS:"); problems.slice(0, 8).forEach(p => console.log("  " + p)); }
    else console.log("page problems: none");
    w.close();
    process.exit(pass === results.length ? 0 : 1);
})();
