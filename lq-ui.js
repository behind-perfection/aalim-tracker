/* ============================================================================
   LIFEQUEST · lq-ui.js
   One page, eight minimal panels. The world gets most of the screen space;
   everything else is a slim overlay panel, per the confirmed design decision.

   Panels are built lazily on first open so the tracker's boot cost is unchanged.
   Nothing in this file writes to tracker records.
   ========================================================================== */
(function () {
  "use strict";
  var W = window;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function prefs() { try { return W.LQStore.get().prefs; } catch (e) { return {}; } }
  function g() { try { return W.LQStore.get(); } catch (e) { return {}; } }

  var PANELS = [
    { id: "world",   ic: "🌄", label: "World",       phase: 2, built: true },
    { id: "char",    ic: "🧍", label: "Character",   phase: 2, built: true },
    { id: "day",     ic: "🕰", label: "Daily Life",  phase: 2, built: true },
    { id: "map",     ic: "🗺", label: "Map",         phase: 2, built: true },
    { id: "skills",  ic: "🌿", label: "Skill Trees", phase: 6, built: false },
    { id: "miles",   ic: "🏔", label: "Milestones",  phase: 6, built: false },
    { id: "journal", ic: "📜", label: "Journal",     phase: 5, built: false },
    { id: "stats",   ic: "📈", label: "Statistics",  phase: 5, built: false }
  ];
  var cur = "world";
  var built = {};                 // which panels have been rendered once
  var previewFig = null, previewStage = null;

  /* ------------------------------------------------------------------ shell */
  function shell() {
    return '' +
      '<div class="lq-page" id="lqPage">' +
        '<div class="lq-tabs" role="tablist">' +
          PANELS.map(function (p) {
            return '<button type="button" role="tab" class="lq-tab" data-p="' + p.id + '" ' +
              'aria-selected="' + (p.id === cur) + '">' + p.ic + '<span>' + esc(p.label) + '</span>' +
              (p.built ? '' : '<i class="lq-soon" title="Arrives in Phase ' + p.phase + '">·' + p.phase + '</i>') + '</button>';
          }).join("") +
        '</div>' +
        '<div class="lq-body">' +
          '<section class="lq-panel" id="lqp-world" role="tabpanel"></section>' +
          '<section class="lq-panel" id="lqp-char" role="tabpanel" hidden></section>' +
          '<section class="lq-panel" id="lqp-day" role="tabpanel" hidden></section>' +
          '<section class="lq-panel" id="lqp-map" role="tabpanel" hidden></section>' +
          '<section class="lq-panel" id="lqp-skills" role="tabpanel" hidden></section>' +
          '<section class="lq-panel" id="lqp-miles" role="tabpanel" hidden></section>' +
          '<section class="lq-panel" id="lqp-journal" role="tabpanel" hidden></section>' +
          '<section class="lq-panel" id="lqp-stats" role="tabpanel" hidden></section>' +
        '</div>' +
      '</div>';
  }

  function show(id) {
    if (!PANELS.some(function (p) { return p.id === id; })) id = "world";
    cur = id;
    try { W.LQStore.uiSet({ panel: id }); } catch (e) { }
    PANELS.forEach(function (p) {
      var el = $("lqp-" + p.id); if (!el) return;
      el.hidden = p.id !== id;
      var t = document.querySelector('.lq-tab[data-p="' + p.id + '"]');
      if (t) t.setAttribute("aria-selected", String(p.id === id));
    });
    render(id);
    /* the render loop only runs while the world is on screen */
    if (W.LQRender) W.LQRender.setActive(id === "world");
  }

  /* --------------------------------------------------------------- panels */
  function render(id) {
    var el = $("lqp-" + id); if (!el) return;
    if (id === "world") return renderWorld(el);
    if (id === "char") return renderChar(el);
    if (id === "day") return renderDay(el);
    if (id === "map") return renderMap(el);
    if (id === "skills") return renderSkills(el);
    if (id === "miles") return renderMiles(el);
    if (id === "journal") return renderJournal(el);
    if (id === "stats") return renderStats(el);
  }

  /* ---- World ---------------------------------------------------------- */
  function renderWorld(el) {
    if (!built.world) {
      el.innerHTML =
        '<div class="lq-worldbar">' +
          '<div class="lq-now" id="lqNow"></div>' +
          '<div class="lq-ctrls">' +
            '<button type="button" class="secondary" data-a="zoomout" title="Zoom out">−</button>' +
            '<button type="button" class="secondary" data-a="zoomin" title="Zoom in">+</button>' +
            '<button type="button" class="secondary" data-a="ambient" id="lqAmbBtn"></button>' +
            '<button type="button" class="secondary" data-a="motion" id="lqMotBtn"></button>' +
            '<button type="button" class="secondary" data-a="live" id="lqLiveBtn"></button>' +
          '</div>' +
        '</div>' +
        '<div id="lqStageHost"></div>' +
        '<p class="lq-hint muted" id="lqHint"></p>';
      W.LQRender.mount($("lqStageHost"));
      built.world = true;
    }
    var p = prefs();
    var ab = $("lqAmbBtn"); if (ab) ab.textContent = p.ambient === false ? "🌫 Ambient: off" : "✨ Ambient: on";
    var mb = $("lqMotBtn"); if (mb) mb.textContent = p.reducedMotion ? "🐢 Motion: reduced" : "🌊 Motion: full";
    var lb = $("lqLiveBtn"); if (lb) lb.textContent = p.livePaused ? "▶ Resume live" : "⏸ Pause live";
    W.LQRender.setAmbient(p.ambient !== false);
    W.LQRender.setReduced(p.reducedMotion);
    var hint = $("lqHint");
    if (hint) hint.textContent = "He only does what you have actually recorded. Nothing is invented, and nothing here writes to your tracker.";
    refreshNow();
  }

  function refreshNow() {
    var el = $("lqNow"); if (!el) return;
    var m = W.LQMapper.current();
    var live = W.LQAdapter.live();
    var A = W.LQAdapter;
    el.innerHTML =
      '<span class="lq-now-dot" data-on="' + (live ? "1" : "0") + '"></span>' +
      '<b>' + esc(m.label || "No recorded activity") + '</b>' +
      '<span class="muted">' + esc(m.roomName || "") + '</span>' +
      (live && live.startedAt ? '<span class="muted">' + esc(A.hm(Math.round((Date.now() - live.startedAt) / 60000))) + ' so far</span>' : '') +
      (live ? '' : '<span class="muted">Start your focus timer or reading timer and he begins too.</span>');
    W.LQRender.setLive(live);
    W.LQRender.setRoomName(m.roomName);
    W.LQRender.setActivity(m, { live: live });
  }

  /* ---- Character ------------------------------------------------------ */
  function renderChar(el) {
    var st = g(), c = st.char || {};
    var C = W.LQCharacter;
    if (!built.char) {
      el.innerHTML =
        '<div class="lq-chargrid">' +
          '<div class="card"><h2>Appearance</h2>' +
            '<div class="lq-prev" id="lqPrev"></div>' +
            '<div class="lq-field"><label>Skin</label><div class="lq-sw" id="lqSkin"></div></div>' +
            '<div class="lq-field"><label>Outfit</label><select id="lqOutfit"></select></div>' +
            '<div class="lq-field"><label>Accessory</label><select id="lqAcc"></select></div>' +
            '<p class="muted lq-small">Customisation never changes his proportions or how he moves — he stays recognisable.</p>' +
            '<button type="button" class="secondary" id="lqResetGame">↺ Reset appearance &amp; preferences</button>' +
            '<p class="muted lq-small">Game data only. Your tracker records, milestones and journal are never touched.</p>' +
          '</div>' +
          '<div class="card"><h2>Animation states</h2>' +
            '<p class="muted lq-small">Preview only. Choosing one here does <b>not</b> record anything and does not override your real activity.</p>' +
            '<div class="lq-anims" id="lqAnims"></div>' +
            '<button type="button" class="secondary" id="lqBackLive">↩ Back to live activity</button>' +
          '</div>' +
          '<div class="card"><h2>Journey</h2><div id="lqJourney"></div></div>' +
        '</div>';
      /* a second, independent rig for previews */
      var host = $("lqPrev");
      host.innerHTML = '<svg viewBox="280 90 400 380" preserveAspectRatio="xMidYMid meet" class="lq-prevsvg">' +
        '<rect x="280" y="90" width="400" height="380" class="lq-prevbg"/>' +
        '<g transform="translate(480,430) scale(2.6)">' + C.rig() + '</g></svg>';
      previewFig = host.querySelector(".lq-fig");
      previewStage = host.querySelector("svg");

      var sk = $("lqSkin");
      sk.innerHTML = C.SKINS.map(function (s, i) {
        return '<button type="button" class="lq-swbtn" data-i="' + i + '" style="background:' + s + '" aria-label="Skin ' + (i + 1) + '"></button>';
      }).join("");
      var of = $("lqOutfit");
      of.innerHTML = C.OUTFITS.map(function (o, i) { return '<option value="' + i + '">' + esc(o.name) + '</option>'; }).join("");
      var ac = $("lqAcc");
      ac.innerHTML = '<option value="-1">None</option>' + C.ACCESSORIES.map(function (a, i) {
        return a ? '<option value="' + i + '">' + esc(a.name) + '</option>' : "";
      }).join("");
      var an = $("lqAnims");
      an.innerHTML = C.animNames().map(function (a) {
        return '<button type="button" class="lq-an" data-a="' + a + '">' + esc(C.ANIMS[a].label) + '</button>';
      }).join("");
      built.char = true;
    }
    $("lqSkin").className = "lq-sw";
    Array.prototype.forEach.call($("lqSkin").children, function (b) {
      b.classList.toggle("on", Number(b.dataset.i) === Number(c.skin || 0));
    });
    $("lqOutfit").value = String(c.outfit || 0);
    $("lqAcc").value = String(c.accessory === undefined ? -1 : c.accessory);
    applyPreview();

    var j = $("lqJourney"), ms = (st.milestones || []);
    j.innerHTML = ms.length
      ? '<ul class="lq-list">' + ms.slice(-8).reverse().map(function (m) {
          return '<li><b>' + esc(m.label || m.kind) + '</b><span class="muted">' + esc(new Date(m.at).toLocaleDateString()) + '</span></li>';
        }).join("") + '</ul>'
      : '<p class="muted">No milestones yet. They are earned from real tracker records — completed chapters, finished books, completed projects, saved weekly reviews.</p>';
  }
  function applyPreview(animName) {
    if (!previewFig) return;
    var C = W.LQCharacter;
    var m = animName
      ? { anim: animName, pose: C.ANIMS[animName] && C.ANIMS[animName].pose, subjectKey: curSubject(), academic: C.ANIMS[animName] && /^(study|write|exam|revise|flash|read|think|type|draw|attend)$/.test(animName) }
      : W.LQMapper.current();
    C.apply(previewFig, m);
    Array.prototype.forEach.call(document.querySelectorAll(".lq-an"), function (b) {
      b.classList.toggle("on", b.dataset.a === m.anim);
    });
  }
  function curSubject() {
    try { return (W.LQMapper.current() || {}).subjectKey || "maths"; } catch (e) { return "maths"; }
  }

  /* ---- Daily Life ----------------------------------------------------- */
  function renderDay(el) {
    var A = W.LQAdapter, k = A.todayKey();
    var snap = A.snapshot(k);
    var live = snap.live;
    var rows = snap.anchored.map(function (e) {
      var m = W.LQMapper.map(e);
      return '<div class="lq-tl" data-exact="' + esc(e.exact) + '">' +
        '<span class="lq-tl-t">' + esc(e.at) + '</span>' +
        '<span class="lq-tl-b"><b>' + esc(e.label) + '</b>' +
          (e.subject ? '<i>' + esc(e.subject) + '</i>' : '') +
          (e.mins ? '<u>' + esc(A.hm(e.mins)) + '</u>' : '') +
          (e.exact === "hour" ? '<em title="Only the hour is recorded">~hour</em>' : '') +
          '<small>' + esc(m.roomName) + ' · ' + esc(W.LQRender.animLabel(m.anim)) + '</small></span>' +
        '<button type="button" class="secondary lq-tl-go" data-at="' + esc(A.t2m(e.at)) + '" data-k="' + esc(e.id) + '">Show</button>' +
        '</div>';
    }).join("");
    /* Two honest groups: what has a real duration, and what the tracker records
       as having happened without storing how long it took. Markers never add
       minutes anywhere — the tracker's own activityMins() stays authoritative. */
    var timed = snap.records.filter(function (e) { return Number(e.mins) > 0; });
    var marks = snap.records.filter(function (e) { return !(Number(e.mins) > 0); });
    var recRow = function (e) {
      var m = W.LQMapper.map(e);
      return '<div class="lq-rec" data-kind="' + esc(e.kind) + '"><b>' + esc(e.label) + '</b>' +
        (e.mins ? '<span>' + esc(A.hm(e.mins)) + '</span>' : '<span class="muted">recorded</span>') +
        '<small>' + esc(m.roomName) + ' · ' + esc(W.LQRender.animLabel(m.anim)) +
        (m.built === false ? ' · not built yet' : '') + '</small></div>';
    };
    var recs = timed.map(recRow).join("");
    var markRows = marks.map(recRow).join("");
    el.innerHTML =
      '<div class="lq-daygrid">' +
        '<div class="card"><h2>Right now</h2>' +
          (live
            ? '<p><b>' + esc(live.label) + '</b>' + (live.subject ? ' <span class="muted">· ' + esc(live.subject) + '</span>' : '') + '</p>' +
              '<p class="muted lq-small">Started ' + esc(live.at || "—") + ' · ' + esc(A.hm(Math.round(live.elapsedMs / 60000))) + ' elapsed · source: ' + esc(live.source) + '</p>'
            : '<p class="muted">No timer is running. He is idle — nothing is assumed.</p>') +
          '<div class="lq-mini" id="lqMini"></div>' +
        '</div>' +
        '<div class="card"><h2>Today · ' + esc(k) + '</h2>' +
          '<p class="muted lq-small">Only activities with a real recorded time appear on the clock. Sleep ' +
          esc(snap.sleep.mins ? A.hm(snap.sleep.mins) : "not logged") +
          (snap.sleep.wake ? ' · woke ' + esc(snap.sleep.wake) : '') + '.</p>' +
          (rows || '<p class="muted">Nothing with a recorded clock time today.</p>') +
        '</div>' +
        '<div class="card"><h2>Recorded today, time not specified</h2>' +
          '<p class="muted lq-small">These have a date and a duration only. They are real, but their clock time is unknown — so they are listed, not placed.</p>' +
          (recs ? '<div class="lq-recs">' + recs + '</div>' : '<p class="muted">Nothing else logged today.</p>') +
        '</div>' +
        '<div class="card"><h2>Recorded today, no duration stored</h2>' +
          '<p class="muted lq-small">Markers of what happened — a homework item ticked, a prayer, a meal, a project note, an exam sat, a plan item. ' +
          'The tracker stores the fact but not the minutes, so none are invented here and none are added to any total.</p>' +
          (markRows ? '<div class="lq-recs">' + markRows + '</div>' : '<p class="muted">Nothing of this kind today.</p>') +
        '</div>' +
        '<div class="card"><h2>Replay a previous day</h2>' +
          '<div class="lq-replayrow"><select id="lqDay"></select>' +
          '<select id="lqSpeed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select>' +
          '<button type="button" class="action" id="lqPlay">▶ Watch the day</button></div>' +
          '<p class="muted lq-small">Playback arrives in Phase 5. The list below is already real: every date with recorded activity.</p>' +
          '<div id="lqDayList" class="lq-daylist"></div>' +
        '</div>' +
      '</div>';

    var ds = A.dates().slice(-40).reverse();
    $("lqDay").innerHTML = ds.map(function (d) { return '<option value="' + d + '">' + d + (d === k ? " (today)" : "") + '</option>'; }).join("") || '<option value="">No recorded days yet</option>';
    $("lqDayList").innerHTML = ds.slice(0, 14).map(function (d) {
      var t = A.totals(d);
      return '<button type="button" class="lq-daybtn" data-d="' + d + '">' + d + '<span>' + esc(A.hm(t.all)) + '</span></button>';
    }).join("") || '<p class="muted">No recorded days yet.</p>';
    /* mini stage for "right now" */
    var mini = $("lqMini");
    if (mini && W.LQCharacter) {
      mini.innerHTML = '<svg viewBox="420 200 320 260" class="lq-prevsvg"><g transform="translate(580,430) scale(1.7)">' + W.LQCharacter.rig() + '</g></svg>';
      var f = mini.querySelector(".lq-fig");
      W.LQCharacter.apply(f, live ? W.LQMapper.map(live) : W.LQMapper.current());
    }
  }

  /* ---- Map ------------------------------------------------------------ */
  function renderMap(el) {
    var R = W.LQMapper.ROOMS, st = g();
    var areas = {};
    Object.keys(R).forEach(function (k) {
      var r = R[k];
      (areas[r.area] = areas[r.area] || []).push({ id: k, name: r.name, built: r.built, phase: r.phase });
    });
    var NAMES = {
      home: "The Home", academy: "The Academy", library: "The Library", lab: "The Laboratory",
      observatory: "The Observatory", workshop: "The Workshop", city: "The City",
      garden: "The Garden", sanctuary: "The Quiet Sanctuary", screen: "Recreation"
    };
    var MEANING = {
      home: "Bedroom, study desk, bookshelf, computer, rest",
      academy: "Formal education — classrooms, exam hall",
      library: "Reading, literature, vocabulary, commonplace book",
      lab: "Only real experiments — Virtual Lab sessions",
      observatory: "Astronomy and mathematical exploration",
      workshop: "Engineering, programming, drawing, invention",
      city: "Economics, political science, business, society",
      garden: "Physical development, running, karate, consistency",
      sanctuary: "Reflection, Qur'an reading, stillness"
    };
    el.innerHTML =
      '<div class="card"><h2>The world</h2>' +
      '<p class="muted lq-small">One connected world. Areas unlock as the environments are built — and later through your real milestones. He walks to an area only when you have actually recorded that activity.</p>' +
      '<div class="lq-map">' + Object.keys(areas).map(function (a) {
        var list = areas[a];
        var anyBuilt = list.some(function (x) { return x.built; });
        return '<div class="lq-area" data-built="' + (anyBuilt ? 1 : 0) + '">' +
          '<b>' + esc(NAMES[a] || a) + '</b>' +
          '<span class="muted">' + esc(MEANING[a] || "") + '</span>' +
          '<div class="lq-rooms">' + list.map(function (r) {
            return '<span class="lq-room ' + (r.built ? "on" : "") + '">' + esc(r.name) + (r.built ? '' : '<i>Phase ' + r.phase + '</i>') + '</span>';
          }).join("") + '</div></div>';
      }).join("") + '</div>' +
      '<p class="muted lq-small">Chapter: <b>' + esc(chapterName(st.chapter && st.chapter.current)) + '</b> — ' +
      'the village, the modest home, the school and distant mountains. Later chapters unlock from real milestones you configure, never automatically.</p></div>';
  }
  function chapterName(n) {
    return ["", "The Beginning — Class 10", "The Foundation — higher secondary", "The University", "The Explorer", "The Builder", "The Contributor"][Number(n) || 1] || "The Beginning";
  }

  /* ---- Phase-gated panels: honest placeholders ------------------------ */
  function renderSkills(el) {
    var m = W.LQAdapter.mastery(), rows = Object.keys(m).map(function (sj) {
      var o = m[sj];
      return '<div class="lq-sk"><b>' + esc(sj) + '</b>' +
        '<div class="progress"><div class="fill" style="width:' + (o.total ? Math.round(o.revised / o.total * 100) : 0) + '%"></div></div>' +
        '<span class="muted">' + o.revised + '/' + o.total + ' revised or mastered · ' + o.mastered + ' mastered</span></div>';
    }).join("");
    el.innerHTML = '<div class="card"><h2>🌿 Skill Trees</h2>' +
      '<p class="muted lq-small">The visual trees arrive in <b>Phase 6</b>. What you see below is already real evidence from your Syllabus tracker — time invested and demonstrated mastery are kept apart, and nothing is rated that you have not recorded.</p>' +
      (rows || '<p class="muted">No chapter progress recorded yet.</p>') + '</div>';
  }
  function renderMiles(el) {
    var st = g(), ms = st.milestones || [];
    el.innerHTML = '<div class="card"><h2>🏔 Milestones & world changes</h2>' +
      '<p class="muted lq-small">Milestone awarding and world evolution arrive in <b>Phase 6</b>. Each one will carry a reference to the tracker record that earned it, so nothing can be awarded twice and nothing is granted for opening a tab.</p>' +
      (ms.length ? '<ul class="lq-list">' + ms.slice().reverse().map(function (x) {
        return '<li><b>' + esc(x.label || x.kind) + '</b><span class="muted">' + esc(x.ref) + '</span></li>';
      }).join("") + '</ul>' : '<p class="muted">No milestones recorded yet.</p>') + '</div>';
  }
  function renderJournal(el) {
    var ds = W.LQAdapter.dates().slice(-10).reverse();
    el.innerHTML = '<div class="card"><h2>📜 Journal</h2>' +
      '<p class="muted lq-small">The generated life history arrives in <b>Phase 5</b>, written from real tracker events only. These are the dates that already have records:</p>' +
      (ds.length ? '<ul class="lq-list">' + ds.map(function (d) {
        var t = W.LQAdapter.totals(d);
        return '<li><b>' + esc(d) + '</b><span class="muted">' + esc(W.LQAdapter.hm(t.all)) + ' recorded</span></li>';
      }).join("") + '</ul>' : '<p class="muted">No recorded days yet.</p>') + '</div>';
  }
  function renderStats(el) {
    var A = W.LQAdapter, m = A.mastery();
    var tot = Object.keys(m).reduce(function (a, k) { a += m[k].total; return a; }, 0);
    var rev = Object.keys(m).reduce(function (a, k) { a += m[k].revised; return a; }, 0);
    var days = A.dates();
    el.innerHTML = '<div class="card"><h2>📈 Statistics</h2>' +
      '<p class="muted lq-small">Long-term progression panels arrive in <b>Phase 5</b>. Current real totals from your tracker:</p>' +
      '<div class="statline"><div class="stat"><strong>' + days.length + '</strong><span class="muted">days with records</span></div>' +
      '<div class="stat"><strong>' + rev + '/' + tot + '</strong><span class="muted">chapters revised or mastered</span></div>' +
      '<div class="stat"><strong>' + ((g().milestones || []).length) + '</strong><span class="muted">milestones</span></div></div></div>';
  }

  /* ------------------------------------------------------------- events */
  function onClick(e) {
    var t = e.target.closest ? e.target.closest("[data-p],[data-a],.lq-swbtn,.lq-an,.lq-daybtn,#lqBackLive,#lqPlay,#lqResetGame") : null;
    if (!t) return;
    if (t.dataset.p) return show(t.dataset.p);
    if (t.classList.contains("lq-swbtn")) {
      W.LQStore.mutate(function (s) { s.char.skin = Number(t.dataset.i); });
      return renderChar($("lqp-char"));
    }
    if (t.classList.contains("lq-an")) return applyPreview(t.dataset.a);
    if (t.id === "lqBackLive") return applyPreview(null);
    if (t.id === "lqResetGame") {
      /* GAME DATA ONLY — cosmetics and preferences. Milestones, journal and
         `seen` stay (they are evidence from real records), and no tracker
         record is ever read-write here. */
      W.LQStore.reset();
      W.LQRender.setAmbient(true);
      W.LQRender.setReduced(false);
      renderChar($("lqp-char"));
      if (built.world) renderWorld($("lqp-world"));
      applyPreview(null);
      try { if (W.hofToast) W.hofToast("LifeQuest appearance and preferences reset. Your tracker data is untouched."); } catch (e) { }
      return;
    }
    if (t.classList.contains("lq-daybtn")) {
      var d = t.dataset.d, snap = W.LQAdapter.snapshot(d);
      var first = snap.anchored[0] || snap.records[0] || null;
      W.LQMapper && show("world");
      if (first) {
        var m = W.LQMapper.map(first);
        W.LQRender.setActivity(m, { minute: first.at ? W.LQAdapter.t2m(first.at) : W.LQWorld.currentMinute(), snap: true });
      }
      return;
    }
    if (t.id === "lqPlay") {
      try { if (W.hofToast) W.hofToast("Day playback arrives in Phase 5 — the date list above is already real."); } catch (e) { }
      return;
    }
    var a = t.dataset.a;
    if (a === "zoomin") return W.LQRender.zoom(1.35);
    if (a === "zoomout") return W.LQRender.zoom(1 / 1.35);
    if (a === "ambient") { W.LQStore.mutate(function (s) { s.prefs.ambient = s.prefs.ambient === false; }); return renderWorld($("lqp-world")); }
    if (a === "motion") { W.LQStore.mutate(function (s) { s.prefs.reducedMotion = !s.prefs.reducedMotion; }); return renderWorld($("lqp-world")); }
    if (a === "live") { W.LQStore.mutate(function (s) { s.prefs.livePaused = !s.prefs.livePaused; }); return renderWorld($("lqp-world")); }
  }
  function onChange(e) {
    var t = e.target;
    if (t.id === "lqOutfit") { W.LQStore.mutate(function (s) { s.char.outfit = Number(t.value); }); applyPreview(); }
    if (t.id === "lqAcc") { W.LQStore.mutate(function (s) { s.char.accessory = Number(t.value); }); applyPreview(); }
    if (t.id === "lqSpeed") { W.LQStore.mutate(function (s) { s.prefs.replaySpeed = Number(t.value); }); }
    if (t.id === "lqDay") { /* selection only; playback in Phase 5 */ }
  }

  function init(root) {
    root.innerHTML = shell();
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    try { cur = W.LQStore.uiGet().panel || "world"; } catch (e) { }
    show(cur);
  }
  function refresh() {
    if (cur === "world") refreshNow();
    else if (cur === "day") renderDay($("lqp-day"));
  }

  window.LQUI = {
    PANELS: PANELS, init: init, show: show, refresh: refresh, render: render,
    chapterName: chapterName, current: function () { return cur; }
  };
})();
