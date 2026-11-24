/* ============================================================================
   LIFEQUEST · lq-boot.js — lazy loader (the ONLY LIFEQUEST file the tracker
   loads eagerly: ~4 KB instead of 171 KB).

   Why this file exists
   --------------------
   The game is 8 modules + a stylesheet. Loading them on every visit made a
   540 KB tracker page ~30 % heavier for people who never open LifeQuest.
   So this stub does the minimum that must happen at boot:

     1. inject the LifeQuest hub + page into HUBS / NAVF / the sidebar, so the
        game is discoverable and reachable (nav, "9" shortcut, search palette,
        #!lq deep link, restored last page) with no game code present;
     2. create the placeholder <section id="lq"> that says honestly that the
        world is being prepared;
     3. on the first visit to that page only, inject lifequest.css and the 8
        modules in dependency order, then let lifequest.js boot the game.

   Everything here is additive and idempotent, and every entry point is routed
   through the tracker's own `safeRun` where possible: a failure in the game
   must never break the tracker. `lifequest.js` re-checks the nav and the page
   when it boots, so the two files can run in either order without duplicating
   anything.
   ========================================================================== */
(function () {
  "use strict";
  var W = window;
  var HUB_ID = "quest", PAGE_ID = "lq", HUB_KEY = "9";
  var CSS = "lifequest.css";
  /* dependency order matters: store → adapter → mapper → character → world →
     render → ui → boot. They are loaded one after another, not in parallel,
     so a module never runs before the globals it reads exist. */
  var FILES = ["lq-store.js", "lq-adapter.js", "lq-mapper.js", "lq-character.js",
    "lq-world.js", "lq-render.js", "lq-ui.js", "lifequest.js"];

  var status = "idle";                       /* idle | loading | ready | failed */
  var failedOn = "", waiters = [];

  var sr = function (fn) { try { if (typeof W.safeRun === "function") W.safeRun(fn); else fn(); } catch (e) { } };

  /* ---------------------------------------------------------- 1. navigation
     Same entries lifequest.js would inject — duplicated here on purpose,
     because the hub has to exist before any game file is downloaded. Both
     copies are idempotent, so whichever runs first wins and the other no-ops. */
  function injectNav() {
    try {
      if (typeof HUBS === "undefined" || !HUBS.some) return;
      if (!HUBS.some(function (h) { return h && h.id === HUB_ID; }))
        HUBS.push({ id: HUB_ID, ic: "🌄", l: "LifeQuest", k: HUB_KEY, pages: [[PAGE_ID, "LifeQuest"]] });
      if (typeof NAVF !== "undefined" && NAVF.push && !NAVF.some(function (n) { return n && n.id === PAGE_ID; }))
        NAVF.push({ id: PAGE_ID, ic: "🌄", l: "LifeQuest", g: "LifeQuest", h: HUB_ID, lock: false });
    } catch (e) { }
  }
  function syncSidebar() {
    try {
      var sd = document.getElementById("side");
      if (sd && !sd.querySelector('[data-h="' + HUB_ID + '"]')) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-h", HUB_ID);
        b.title = "LifeQuest (" + HUB_KEY + ")";
        b.setAttribute("onclick", "openHub('" + HUB_ID + "')");
        b.innerHTML = '<i>🌄</i><span>LifeQuest</span><span class="kb">' + HUB_KEY + '</span>';
        var foot = sd.querySelector(".sfoot");
        if (foot) sd.insertBefore(b, foot); else sd.appendChild(b);
      }
      var menu = document.getElementById("menu");
      if (menu) {
        var hint = menu.querySelector(".muted");
        if (hint && hint.textContent.indexOf("1–8 tabs") >= 0)
          hint.textContent = hint.textContent.replace("1–8 tabs", "1–" + HUB_KEY + " tabs");
      }
    } catch (e) { }
  }

  /* --------------------------------------------------------- 2. placeholder */
  function createPage() {
    var main = document.querySelector("main");
    if (!main) return null;
    var sec = document.getElementById(PAGE_ID);
    if (!sec) {
      sec = document.createElement("section");
      sec.id = PAGE_ID;
      sec.className = "page";
      sec.setAttribute("aria-label", "LifeQuest");
      main.appendChild(sec);
    }
    if (!sec.querySelector(".lq-boot")) paint(sec, "Preparing the world…", "");
    return sec;
  }
  /* The placeholder tells the truth about what is happening: which file is
     being fetched, or that the load failed and can be retried. Nothing is
     faked while the real modules are on their way. */
  function paint(sec, msg, detail) {
    if (!sec) return;
    sec.innerHTML = '<div class="card lq-boot"><p class="muted">' + esc(msg) + '</p>' +
      (detail ? '<p class="muted lq-small">' + detail + '</p>' : '') + '</div>';
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function say(msg, detail) { paint(document.getElementById(PAGE_ID), msg, detail); }

  /* ------------------------------------------------------------- 3. loading */
  function loadCSS() {
    if (document.querySelector('link[rel="stylesheet"][href="' + CSS + '"]')) return;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = CSS;
    (document.head || document.documentElement).appendChild(l);
  }
  function already(src) {
    var s = document.getElementsByTagName("script"), i;
    for (i = 0; i < s.length; i++) if (s[i].getAttribute("src") === src) return true;
    return false;
  }
  function loadNext(i) {
    if (i >= FILES.length) {
      status = "ready";
      /* lifequest.js boots itself on load; this covers the case where it was
         already present (e.g. a hard reload straight onto #!lq). */
      sr(function () { if (W.LQ && W.LQ.boot) W.LQ.boot(); });
      flush();
      return;
    }
    var src = FILES[i];
    if (already(src)) { loadNext(i + 1); return; }
    say("Preparing the world…", "Loading " + esc(src) + " (" + (i + 1) + " of " + FILES.length + ")");
    var el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.onload = function () { loadNext(i + 1); };
    el.onerror = function () {
      status = "failed"; failedOn = src;
      say("LifeQuest could not load.", "“" + esc(src) + "” did not arrive — the tracker itself is unaffected. " +
        (W.navigator && navigator.onLine === false ? "You appear to be offline. " : "") +
        "Nothing was lost: the game only ever reads your data.");
      var sec = document.getElementById(PAGE_ID);
      if (sec) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "action"; b.textContent = "Try again";
        b.addEventListener("click", function () { ensure(true); });
        var card = sec.querySelector(".lq-boot");
        if (card) card.appendChild(b);
      }
      flush();
    };
    document.body.appendChild(el);
  }
  function flush() {
    var q = waiters; waiters = [];
    q.forEach(function (fn) { try { fn(status === "ready"); } catch (e) { } });
  }
  /* Start (or resume) the lazy load. Safe to call any number of times. */
  function ensure(force, cb) {
    if (typeof force === "function") { cb = force; force = false; }
    if (cb) waiters.push(cb);
    if (status === "ready") { flush(); return true; }
    if (status === "loading") return false;
    if (status === "failed" && !force) { flush(); return false; }
    status = "loading"; failedOn = "";
    createPage();
    loadCSS();
    loadNext(0);
    return false;
  }

  /* ------------------------------------------------------- 4. trigger point
     Wrap — never replace — the tracker's own showPage, exactly as lifequest.js
     does later. Our wrapper sits underneath navInit's wrapper, so navigation
     bookkeeping (curPage, hash, recents) is untouched. */
  function installTrigger() {
    try {
      var orig = W.showPage;
      if (typeof orig !== "function" || orig.__lqboot) return;
      var w = function (id) {
        if (id === PAGE_ID) ensure();
        return orig.apply(this, arguments);
      };
      w.__lqboot = 1;
      W.showPage = w;
    } catch (e) { }
  }

  W.LQBoot = {
    version: "1.1.0",
    PAGE_ID: PAGE_ID, HUB_ID: HUB_ID, FILES: FILES, CSS: CSS,
    status: function () { return status; },
    failedOn: function () { return failedOn; },
    ensure: ensure
  };

  sr(function () { injectNav(); createPage(); syncSidebar(); installTrigger(); });
  /* navInit() rebuilds nothing, but it may run after us and the sidebar is
     built once — re-assert the hub on the same schedule lifequest.js uses. */
  setTimeout(function () { sr(function () { injectNav(); syncSidebar(); }); }, 0);
  setTimeout(function () { sr(syncSidebar); }, 400);
  setTimeout(function () { sr(syncSidebar); }, 1500);
})();
