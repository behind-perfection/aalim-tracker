/* ============================================================================
   LIFEQUEST · lifequest.js — boot & integration
   Follows the existing `#vlab` bolt-on precedent exactly: create the page at
   runtime, wrap (never replace) the tracker's own functions, and route every
   entry point through `safeRun` so a game failure can never break the tracker.

   Runs synchronously at the end of <body>, i.e. BEFORE `setTimeout(navInit,0)`
   in the tracker script — so the hub is present when the sidebar is built.
   ========================================================================== */
(function () {
  "use strict";
  var W = window;
  var VERSION = "0.2.0-phase2";
  var HUB_ID = "quest", PAGE_ID = "lq", HUB_KEY = "9";
  var uiReady = false, pollT = 0, refreshT = 0, lastSig = "";

  var sr = function (fn) { try { if (typeof W.safeRun === "function") W.safeRun(fn); else fn(); } catch (e) { } };

  function ready() { return !!(W.LQStore && W.LQAdapter && W.LQMapper && W.LQCharacter && W.LQWorld && W.LQRender && W.LQUI); }

  /* ------------------------------------------------------- 1. navigation
     HUBS and NAVF are `const` arrays in the tracker script, so they can be
     extended without editing a single line of existing code. */
  function injectNav() {
    try {
      if (typeof HUBS === "undefined" || !HUBS.some) return;
      if (HUBS.some(function (h) { return h && h.id === HUB_ID; })) return;
      HUBS.push({ id: HUB_ID, ic: "🌄", l: "LifeQuest", k: HUB_KEY, pages: [[PAGE_ID, "LifeQuest"]] });
      if (typeof NAVF !== "undefined" && NAVF.push && !NAVF.some(function (n) { return n && n.id === PAGE_ID; })) {
        NAVF.push({ id: PAGE_ID, ic: "🌄", l: "LifeQuest", g: "LifeQuest", h: HUB_ID, lock: false });
      }
    } catch (e) { }
  }

  /* ------------------------------------------------- 1b. sidebar & palette
     `navInit()` builds #side ONCE from HUBS, and it is scheduled with
     setTimeout(…,0) — which can fire while the parser is still waiting on our
     external <script src> files. So the hub may be injected after the sidebar
     was already built. This patch is idempotent and runs from both orders. */
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
      /* keep the shortcut hint truthful now that there is a ninth hub */
      var menu = document.getElementById("menu");
      if (menu) {
        var hint = menu.querySelector(".muted");
        if (hint && hint.textContent.indexOf("1–8 tabs") >= 0) hint.textContent = hint.textContent.replace("1–8 tabs", "1–" + HUB_KEY + " tabs");
      }
    } catch (e) { }
  }

  /* ----------------------------------------------------------- 2. the page */
  function createPage() {
    var main = document.querySelector("main");
    if (!main || document.getElementById(PAGE_ID)) return document.getElementById(PAGE_ID);
    var sec = document.createElement("section");
    sec.id = PAGE_ID;
    sec.className = "page";
    sec.setAttribute("aria-label", "LifeQuest");
    sec.innerHTML = '<div class="card lq-boot"><p class="muted">Preparing the world…</p></div>';
    main.appendChild(sec);
    return sec;
  }
  function ensureUI() {
    if (uiReady) return true;
    var sec = document.getElementById(PAGE_ID);
    if (!sec) sec = createPage();
    sr(function () { W.LQStore.get(); });            // normalise state.lq in memory, no write
    sr(function () { W.LQUI.init(sec); });
    uiReady = true;
    return uiReady;
  }

  /* ------------------------------------------------------- 3. live refresh */
  function signature() {
    var lv = null;
    try { lv = W.LQAdapter.live(); } catch (e) { }
    if (!lv) return "idle";
    return [lv.source, lv.mode || "", lv.kind, lv.subject || "", lv.label || "",
      lv.startedAt ? Math.round(lv.startedAt / 60000) : "", lv.bookId || lv.expId || ""].join("|");
  }
  function refresh(force) {
    if (!uiReady) return;
    var sig = signature();
    if (!force && sig === lastSig) return;
    lastSig = sig;
    sr(function () { W.LQUI.refresh(); });
  }
  function onTimer() { refresh(true); }
  /* tracker data changed (any save()) — debounced, and never re-entrant */
  function onTrackerChanged() {
    clearTimeout(refreshT);
    refreshT = setTimeout(function () { refresh(true); }, 400);
  }

  /* ------------------------------------------------------ 4. wrap, don't replace */
  function wrap(name, after) {
    try {
      var orig = W[name];
      if (typeof orig !== "function" || orig.__lq) return;
      var w = function () {
        var r = orig.apply(this, arguments);
        try { after.apply(null, arguments); } catch (e) { }
        return r;
      };
      w.__lq = 1;
      W[name] = w;
    } catch (e) { }
  }
  function installWrappers() {
    /* navigation: start/stop the render loop only while the page is on screen */
    wrap("showPage", function (id) {
      syncSidebar();          /* cheap + idempotent: covers every load order */
      var on = id === PAGE_ID;
      if (on) { ensureUI(); refresh(true); }
      sr(function () { W.LQRender.setActive(on); });
      if (on) startPoll(); else stopPoll();
    });
    /* tracker writes */
    wrap("save", onTrackerChanged);
    /* focus timer lifecycle */
    ["pomoToggle", "pomoStop", "pomoSkip", "pomoReset", "pomoDone", "runStart", "pomoPick"].forEach(function (n) { wrap(n, onTimer); });
    /* reading timer lifecycle */
    ["rtToggle", "rtStop"].forEach(function (n) { wrap(n, onTimer); });
    /* sleep / wake change the room */
    ["sleepNow", "wokeNow", "sleepSave"].forEach(function (n) { wrap(n, function () { refresh(true); }); });
  }

  /* --------------------------------------------------------- 5. polling */
  function startPoll() {
    stopPoll();
    pollT = setInterval(function () {
      if (document.hidden) return;
      refresh(false);                       // cheap: signature compare
      sr(function () { if (W.LQUI.current() === "world") W.LQUI.refresh(); });
    }, 1000);
  }
  function stopPoll() { if (pollT) { clearInterval(pollT); pollT = 0; } }

  /* ------------------------------------- 6. cross-document + tab visibility
     The Virtual Lab runs in a same-origin iframe and writes localStorage; the
     parent receives a `storage` event. That is how lab activity is observed
     without editing any lab code. */
  function installListeners() {
    W.addEventListener("storage", function (e) {
      if (!e || !e.key) return;
      if (e.key === "aalimLabStore" || e.key === "aalimPomoV2" || e.key === "aalimReadT" || e.key === "aalimTrackerV2") refresh(true);
    });
    document.addEventListener("visibilitychange", function () {
      sr(function () { W.LQRender.setVisible(!document.hidden); });
      if (document.hidden) stopPoll();
      else if (typeof curPage !== "undefined" && curPage === PAGE_ID) { startPoll(); refresh(true); }
    });
    /* theme changes recolour the scene through CSS custom properties only */
    W.addEventListener("online", function () { refresh(false); });
  }

  /* ------------------------------------------------------------ 7. boot */
  function boot() {
    if (!ready()) return;
    injectNav();
    createPage();
    installWrappers();
    installListeners();
    /* `navInit()` may already have built the sidebar from the old 8 hubs (its
       setTimeout(0) can fire while the parser waits on our <script src>), or it
       may not have run yet. Patch the sidebar either way, and retry briefly so
       a late `navInit()` still ends up showing LifeQuest. */
    syncSidebar();
    setTimeout(syncSidebar, 60);
    setTimeout(syncSidebar, 400);
    setTimeout(syncSidebar, 1500);
    /* apply stored game prefs to the renderer defaults */
    sr(function () {
      var p = W.LQStore.get().prefs;
      W.LQRender.setAmbient(p.ambient !== false);
      W.LQRender.setReduced(!!p.reducedMotion);
      W.LQRender.setVisible(!document.hidden);
    });
    /* if the app restored directly onto the LifeQuest page, build it now */
    sr(function () {
      if (typeof curPage !== "undefined" && curPage === PAGE_ID) ensureUI();
      else if (document.getElementById(PAGE_ID) && document.getElementById(PAGE_ID).classList.contains("active")) ensureUI();
    });
  }

  W.LQ = {
    version: VERSION, boot: boot, ready: ready, ensureUI: ensureUI,
    onTrackerChanged: onTrackerChanged, onTimer: onTimer, refresh: refresh,
    signature: signature, startPoll: startPoll, stopPoll: stopPoll,
    PAGE_ID: PAGE_ID, HUB_ID: HUB_ID,
    /* read-only conveniences for tests and the console */
    now: function () { try { return W.LQMapper.current(); } catch (e) { return null; } },
    live: function () { try { return W.LQAdapter.live(); } catch (e) { return null; } },
    snapshot: function (k) { try { return W.LQAdapter.snapshot(k); } catch (e) { return null; } }
  };

  sr(boot);
})();
