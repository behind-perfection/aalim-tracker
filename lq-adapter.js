/* ============================================================================
   LIFEQUEST · lq-adapter.js — TrackerAdapter
   STRICTLY READ-ONLY view over Command Centre data. Nothing here ever writes.

   The tracker is the single source of truth; this module only *selects* and
   *shapes* what is already recorded, and it is honest about precision:

     exact:true   → a real clock time is known (live timer, recorded wake/bed)
     exact:"hour" → only the hour is known (study entries logged the same day)
     exact:false  → only a date + duration exists, so the event is NOT placed
                    on the clock (see Decision D / "strict" timeline policy)
   ========================================================================== */
(function () {
  "use strict";

  var g = function (n) { try { return eval("typeof " + n + "!==\"undefined\" ? " + n + " : undefined"); } catch (e) { return undefined; } };
  var num = function (v, d) { var n = Number(v); return Number.isFinite(n) ? n : (d || 0); };
  var arr = function (v) { return Array.isArray(v) ? v : []; };
  var pad = function (n) { return String(n).padStart(2, "0"); };

  function dkey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function todayKey() { return dkey(new Date()); }
  function okDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }
  function hm(m) { m = Math.max(0, Math.round(num(m))); return m < 60 ? m + "m" : Math.floor(m / 60) + "h " + pad(m % 60) + "m"; }
  function t2m(t) { var p = String(t || "00:00").split(":").map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }
  function m2t(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }

  var S = function () { return g("state") || null; };

  /* ------------------------------------------------------------------ live
     Reads the two persisted live timers. `pomo` and `rt` are top-level `let`
     bindings in the tracker script, so they are visible to this classic script
     by bare name — we read the live objects, never a stale copy. */
  /* ── Phase 3: what the running focus block is actually FOR ───────────────
     `pomo.target.v` is one of  "hw:<id>" | "plan:<text>" | "res:<id>" |
     "learn:<pid>|<lid>" | "chap:<Subject>|<Chapter>" | "" (free focus).
     We resolve it with the TRACKER'S OWN resolveTarget() — never a copy of its
     rules — then classify it, so the character does the right kind of work:

       homework / plan / chapter  → the study desk, that exact subject
       a project ("res:")         → project work
       a project learning item    → the desk IF its subject is literally one of
                                    the tracked school subjects, otherwise
                                    project work (binding academic-desk rule)
       free focus                 → the desk, typed subject or generic study

     Returns null when there is nothing to resolve. */
  function intent(t) {
    if (!t) return null;
    var r = null;
    try { var f = g("resolveTarget"); if (typeof f === "function" && t.v) r = f(t.v); } catch (e) { }
    r = r || t;
    var out = {
      kind: "study", subject: String(r.subject || t.subject || "").trim(),
      label: String(r.label || t.label || "Focus session"), chapter: "",
      target: t, v: String(r.v || t.v || "")
    };
    var key = String(r.k || "");
    if (r.hw) {                                   /* homework */
      var h = homeworkOf(r.hw);
      out.kind = "homework";
      out.subject = String((h && h.subject) || out.subject);
      out.label = "Homework · " + String((h && h.title) || out.label);
      out.homeworkId = r.hw;
    } else if (r.learn && r.res) {                /* a project's learning item */
      var pr = projectOf(r.res), ls = String(out.subject || "");
      var academic = ls && subjects().some(function (s) { return s.toLowerCase() === ls.toLowerCase(); });
      if (academic) { out.kind = "study"; out.label = "Learning · " + ls; }
      else {
        out.kind = "project";
        out.cat = String((pr && pr.cat) || "");
        out.projectId = r.res; out.learnId = r.learn;
        out.subject = String((pr && pr.subject) || out.cat || "Project");
      }
    } else if (r.res) {                           /* project work */
      var p2 = projectOf(r.res);
      out.kind = "project";
      out.cat = String((p2 && p2.cat) || "");
      out.projectId = r.res;
      out.subject = String((p2 && p2.subject) || out.cat || "Project");
      out.label = String((p2 && p2.title) ? out.cat + ": " + p2.title : out.label);
    } else if (key.indexOf("|") > 0) {            /* a syllabus chapter: revision */
      out.kind = "revision";
      out.subject = key.split("|")[0];
      out.chapter = key.split("|")[1];
      out.label = out.subject + ": " + out.chapter;
    } else if (r.plan) {                          /* a free-text plan item */
      out.kind = "plan";
      out.label = String(r.plan);
    }
    return out;
  }

  /* A free-focus block has no target object, but the user typed a subject into
     the focus field — that is an explicit declaration, not an inference. */
  function freeSubject() {
    try {
      var el = document.getElementById("pomoSubject");
      if (el && typeof el.value === "string") return el.value.trim();
    } catch (e) { }
    return "";
  }

  function livePomo() {
    var p = g("pomo");
    if (!p || !p.running) return null;
    if (p.day && p.day !== todayKey()) return null;              // stale from another day
    var endMs = num(p.end, 0), totalS = num(p.total, 0) || 1500;
    var startMs = endMs ? endMs - totalS * 1000 : Date.now();
    var t = p.target || null;
    var isFocus = p.mode === "focus";
    var it = isFocus ? intent(t) : null;
    /* free focus: the subject the user typed is what the tracker itself will
       log when the block finishes (logFocus uses exactly this fallback) */
    var free = isFocus && !it ? freeSubject() : "";
    return {
      source: "pomo", kind: isFocus ? (it ? it.kind : "study") : "break",
      subject: isFocus ? (it ? it.subject : free) : "",
      chapter: isFocus && it ? it.chapter : "",
      cat: isFocus && it ? it.cat : "",
      projectId: isFocus && it ? it.projectId : "",
      homeworkId: isFocus && it ? it.homeworkId : "",
      label: isFocus ? (it ? it.label : "Focus session") : "Break",
      target: t, intent: it, startedAt: startMs, elapsedMs: Math.max(0, Date.now() - startMs),
      endsAt: endMs, mode: p.mode, cycle: num(p.cycle, 0),
      at: m2t(new Date(startMs).getHours() * 60 + new Date(startMs).getMinutes()),
      exact: true
    };
  }
  function liveRead() {
    var r = g("rt");
    if (!r || !r.run) return null;
    var st = num(r.st, 0), acc = num(r.acc, 0);
    var book = bookOf(r.book);
    return {
      source: "reading", kind: "reading",
      subject: (book && book.s) || "Reading",
      label: book ? String(book.t) : "Reading",
      bookId: r.book || "", book: book,
      startedAt: st, elapsedMs: acc + Math.max(0, Date.now() - st),
      at: st ? m2t(new Date(st).getHours() * 60 + new Date(st).getMinutes()) : "",
      exact: !!st
    };
  }
  /* Virtual Lab: observed read-only through the store the iframe writes. */
  function labStore() {
    try { return JSON.parse(localStorage.getItem("aalimLabStore") || "null"); } catch (e) { return null; }
  }
  function liveLab(maxAgeMs) {
    var db = labStore(); if (!db) return null;
    var rec = null;
    arr(db.sessions).concat(arr(db.runs)).forEach(function (s) {
      if (!s || typeof s !== "object") return;
      var u = num(s.updated || s.at || s.created, 0);
      if (u && (!rec || u > num(rec.updated || rec.at || rec.created, 0))) rec = s;
    });
    if (!rec) return null;
    var u = num(rec.updated || rec.at || rec.created, 0);
    if (!u || Date.now() - u > num(maxAgeMs, 20 * 60000)) return null;
    var expId = String(rec.expId || rec.id || "");
    return {
      source: "lab", kind: "lab", subject: String(rec.subject || ""),
      label: String(rec.name || expId).replace(/\s·.*$/, ""),
      expId: expId, expKey: expId.split("#")[0], at: u, exact: true, startedAt: u
    };
  }
  function live() {
    var p = livePomo(); if (p) return p;
    var r = liveRead(); if (r) return r;
    return liveLab();
  }

  /* ------------------------------------------------------------- lookups */
  function bookOf(id) {
    var st = S(); if (!st || !id) return null;
    return arr(st.library).filter(function (b) { return b && b.id === id; })[0] || null;
  }
  function subjects() {
    var sy = g("syllabus");
    return sy && typeof sy === "object" ? Object.keys(sy) : [];
  }
  function projectOf(id) {
    var st = S(); if (!st || !id) return null;
    return arr(st.research).filter(function (r) { return r && r.id === id; })[0] || null;
  }
  function homeworkOf(id) {
    var st = S(); if (!st || !id) return null;
    return arr(st.homework).filter(function (h) { return h && h.id === id; })[0] || null;
  }

  /* --------------------------------------------- anchored (clock-known) */
  function dayAnchored(k) {
    var st = S(), out = [];
    if (!st || !okDate(k)) return out;
    var dl = (st.dayLog || {})[k] || {};

    if (dl.wake) out.push({ id: "wake:" + k, kind: "wake", subject: "", label: "Woke up", at: String(dl.wake), mins: 0, exact: true, source: "dayLog" });
    if (dl.bed) out.push({ id: "bed:" + k, kind: "sleep", subject: "", label: "Went to sleep", at: String(dl.bed), mins: 0, exact: true, source: "dayLog" });

    arr(st.study).forEach(function (x, i) {
      if (!x || x.date !== k) return;
      var mins = num(x.mins, 0); if (mins <= 0) return;
      var reading = String(x.note || "").indexOf("📖") === 0;
      if (x.h === undefined || x.h === null || x.h === "") return;   // no clock time → not anchored
      var h = Math.max(0, Math.min(23, Math.round(num(x.h, 0))));
      out.push({
        id: "study:" + k + ":" + i, kind: reading ? "reading" : "study",
        subject: String(x.subject || (reading ? "Reading" : "General")),
        label: reading ? String(x.note || "").replace(/^📖\s*/, "") : String(x.note || x.type || "Study"),
        at: pad(h) + ":00", mins: mins, exact: "hour", source: "study", batch: String(x.type || "")
      });
    });

    /* the live block, if it belongs to this day */
    var lv = live();
    if (lv && lv.startedAt && dkey(new Date(lv.startedAt)) === k && lv.exact === true && lv.at) {
      out.push({
        id: "live:" + lv.source, kind: lv.kind, subject: lv.subject || "", label: lv.label,
        at: lv.at, mins: Math.round(num(lv.elapsedMs, 0) / 60000), exact: true, source: lv.source, live: true
      });
    }
    return out.sort(function (a, b) { return t2m(a.at) - t2m(b.at); });
  }

  /* ----------------------------- duration-only records (never positioned) */
  function dayRecords(k) {
    var st = S(), out = [];
    if (!st || !okDate(k)) return out;
    /* `allowZero` — some real records carry an amount instead of a duration
       (Qur'an pages, lift sets, a completed paper). They are still events. */
    var push = function (o, allowZero) { if (!o) return; if (num(o.mins, 0) > 0 || allowZero) out.push(o); };

    arr(st.study).forEach(function (x, i) {
      if (!x || x.date !== k) return;
      if (x.h !== undefined && x.h !== null && x.h !== "") return;   // already anchored
      var reading = String(x.note || "").indexOf("📖") === 0;
      push({
        id: "study:" + k + ":" + i, kind: reading ? "reading" : "study",
        subject: String(x.subject || (reading ? "Reading" : "General")),
        label: reading ? String(x.note || "").replace(/^📖\s*/, "") : String(x.note || x.type || "Study"),
        mins: num(x.mins, 0), exact: false, source: "study"
      });
    });
    arr(st.runs).forEach(function (x, i) { if (x && x.date === k) push({ id: "run:" + k + ":" + i, kind: "run", subject: "Physical", label: "Run in place" + (x.steps ? " · " + num(x.steps) + " steps" : ""), mins: num(x.mins, 0), exact: false, source: "runs", effort: x.effort }); });
    arr(st.karate).forEach(function (x, i) { if (x && x.date === k) push({ id: "karate:" + k + ":" + i, kind: "karate", subject: "Physical", label: "Karate" + (x.focus ? " · " + x.focus : ""), mins: num(x.mins, 0), exact: false, source: "karate", focus: x.focus }); });
    arr(st.workouts).forEach(function (x, i) { if (x && x.date === k) push({ id: "wo:" + k + ":" + i, kind: "workout", subject: "Physical", label: String(x.note || "Workout"), mins: num(x.mins, 0), exact: false, source: "workouts" }); });
    arr(st.hobbyLog).forEach(function (x, i) {
      if (!x || x.date !== k) return;
      var sec = arr(st.hobbySec).filter(function (s) { return s && s.id === x.sec; })[0] || null;
      push({
        id: "hb:" + k + ":" + i, kind: "hobby", subject: (sec && sec.n) || "Hobby",
        label: ((sec && sec.ic) || "⭐") + " " + String(x.title || (sec && sec.n) || "Practice") + (x.focus ? " · " + x.focus : ""),
        mins: num(x.mins, 0), exact: false, source: "hobbyLog", sec: x.sec, secName: (sec && sec.n) || "", icon: (sec && sec.ic) || "⭐",
        focus: String(x.focus || ""), title: String(x.title || ""), amount: x.val === "" ? null : num(x.val, 0)
      });
    });
    /* extraLog: skip the kinds already counted by their own arrays (tracker's own de-dup rule) */
    var skip = {};
    try { var kn = g("kindNames"); if (typeof kn === "function") { ["karate", "run"].forEach(function (kk) { arr(kn(kk)).forEach(function (n) { skip[n] = 1; }); }); } } catch (e) { }
    /* the tracker's own definition of each activity: name → {kind, cat, measure}.
       We classify from THAT, never by guessing at the label. */
    var defs = {};
    arr(st.extra).forEach(function (e) { if (e && e.name) defs[e.name] = e; });
    arr(st.extraLog).forEach(function (x, i) {
      if (!x || x.date !== k || skip[x.activity]) return;
      var def = defs[x.activity] || null;
      push({
        id: "ex:" + k + ":" + i, kind: "extra", subject: String(x.activity || "Activity"),
        label: String(x.activity || "Activity") + (x.note ? " · " + x.note : ""),
        mins: num(x.mins, 0), exact: false, source: "extraLog",
        extraKind: String((def && def.kind) || ""), cat: String((def && def.cat) || ""),
        measure: String((def && def.measure) || "minutes"), amount: x.val === "" ? null : num(x.val, 0)
      });
    });
    arr(st.quran).forEach(function (x, i) { if (x && x.date === k) push({ id: "quran:" + k + ":" + i, kind: "deen", subject: "Deen", label: "Qur'an · " + (x.p || "") + (x.n ? " · " + x.n : ""), mins: 0, exact: false, source: "quran", amount: x.p }, true); });
    arr(st.movies).forEach(function (x, i) { if (x && (x.d === k || x.date === k)) push({ id: "movie:" + k + ":" + i, kind: "watch", subject: "Rest", label: String(x.t || "Movie"), mins: num(x.m, 0), exact: false, source: "movies", rating: num(x.r, 0) }); });
    arr(st.papers).forEach(function (x, i) { if (x && x.date === k) push({ id: "paper:" + k + ":" + i, kind: "exam", subject: String(x.subject || ""), label: String(x.name || "Past paper"), mins: num(x.took, 0), exact: false, source: "papers", score: num(x.score, 0), max: num(x.max, 0) }, true); });
    arr(st.lifts).forEach(function (x, i) { if (x && x.date === k) push({ id: "lift:" + k + ":" + i, kind: "strength", subject: "Physical", label: String(x.ex || "Strength") + " · " + num(x.sets, 0) + "×" + num(x.reps, 0), mins: 0, exact: false, source: "lifts" }, true); });
    var dl = (st.dayLog || {})[k] || {};
    arr(dl.idle).forEach(function (x, i) { push({ id: "idle:" + k + ":" + i, kind: "idle", subject: "", label: "Untracked / idle" + (x.n ? " · " + x.n : ""), mins: num(x.m, 0), exact: false, source: "dayLog" }); });

    /* ── Phase 3: the rest of the real, dated evidence ─────────────────────
       Every event below carries mins:0 ON PURPOSE. Their minutes already live
       in `state.study` (a finished focus block writes a study record AND adds
       to homework.spent / plan.mins), so counting them again would double-count
       the same work. They are markers of what really happened, never of time. */

    /* homework completed that day */
    arr(st.homework).forEach(function (h, i) {
      if (!h || h.done !== k) return;
      push({
        id: "hw:" + k + ":" + (h.id || i), kind: "homework", subject: String(h.subject || ""),
        label: String(h.title || "Homework"), mins: 0, exact: false, source: "homework",
        derived: true, spent: num(h.spent, 0), onTime: !!(h.due && h.done && h.done <= h.due)
      }, true);
    });
    /* day-plan items ticked off (skipping ones that are just a homework alias) */
    arr((st.plan || {})[k]).forEach(function (p, i) {
      if (!p || !p.done || p.hw) return;
      var pk = "";
      try { var f = g("planKey"); if (typeof f === "function") pk = String(f(p.t) || ""); } catch (e) { }
      push({
        id: "plan:" + k + ":" + i, kind: pk ? "revision" : "plan", subject: pk ? pk.split("|")[0] : "",
        chapter: pk ? pk.split("|")[1] : "", label: String(p.t || "Planned work"), mins: 0,
        exact: false, source: "plan", derived: true, loggedMins: num(p.mins, 0)
      }, true);
    });
    /* a mistake analysed that day is real revision work */
    arr(st.mistakes).forEach(function (m, i) {
      if (!m || m.date !== k) return;
      push({
        id: "mistake:" + k + ":" + (m.id || i), kind: "revision", subject: String(m.subject || ""),
        chapter: String(m.chapter || ""), label: "Mistake analysis" + (m.reason ? " · " + m.reason : ""),
        mins: 0, exact: false, source: "mistakes", marksLost: num(m.lost, 0), fixed: !!m.fixed
      }, true);
    });
    /* a topic explained in your own words (Feynman) */
    arr(st.feynman).forEach(function (f, i) {
      if (!f || f.date !== k) return;
      push({ id: "feynman:" + k + ":" + i, kind: "feynman", subject: String(f.topic || ""), label: "Explained: " + String(f.topic || "a topic"), mins: 0, exact: false, source: "feynman", status: String(f.status || "") }, true);
    });
    /* question-bank practice (the tracker stamps `last` on the day you practise) */
    arr(st.questions).forEach(function (q, i) {
      if (!q || q.last !== k) return;
      push({ id: "q:" + k + ":" + i, kind: "questions", subject: String(q.subject || ""), chapter: String(q.chapter || ""), label: "Question bank · " + String(q.type || "practice"), mins: 0, exact: false, source: "questions", right: num(q.right, 0), wrong: num(q.wrong, 0) }, true);
    });
    /* a test result recorded for that day */
    arr(st.marks).forEach(function (m, i) {
      if (!m || m.date !== k) return;
      push({ id: "mark:" + k + ":" + i, kind: "exam", subject: String(m.subject || ""), label: String(m.test || "Test") + " · " + num(m.score, 0) + "/" + num(m.max, 0), mins: 0, exact: false, source: "marks", result: true, score: num(m.score, 0), max: num(m.max, 0) }, true);
    });
    /* a scheduled exam actually completed that day */
    arr(st.exams).forEach(function (e, i) {
      if (!e || e.done !== k) return;
      push({ id: "exam:" + k + ":" + (e.id || i), kind: "exam", subject: String(e.name || ""), label: String(e.name || "Exam") + (e.type ? " · " + e.type : ""), mins: 0, exact: false, source: "exams", result: true }, true);
    });
    /* project work: a research note written or a test recorded that day */
    arr(st.research).forEach(function (r) {
      if (!r || !r.id) return;
      arr(r.notes).forEach(function (n, i) {
        if (!n || n.d !== k) return;
        push({ id: "resnote:" + k + ":" + r.id + ":" + i, kind: "project", subject: String(r.subject || r.cat || "Project"), label: String(r.cat || "Project") + " note · " + String(r.title || ""), mins: 0, exact: false, source: "research", cat: String(r.cat || ""), projectId: r.id, noteKind: String(n.k || "") }, true);
      });
      arr(r.tests).forEach(function (t, i) {
        if (!t || t.d !== k) return;
        push({ id: "restest:" + k + ":" + r.id + ":" + i, kind: "project", subject: String(r.subject || r.cat || "Project"), label: "Test · " + String(t.t || r.title || ""), mins: 0, exact: false, source: "research", cat: String(r.cat || ""), projectId: r.id, test: true }, true);
      });
    });
    /* business / money logged that day */
    arr(st.bizLog).forEach(function (b, i) {
      if (!b || b.date !== k) return;
      push({ id: "biz:" + k + ":" + i, kind: "biz", subject: String(b.v || "Business"), label: String(b.v || "Business") + (b.t ? " · " + b.t : "") + (b.n ? " · " + b.n : ""), mins: 0, exact: false, source: "bizLog", amount: num(b.a, 0) }, true);
    });
    /* a weekly review written that day = reflection */
    arr(st.reviews).forEach(function (r, i) {
      if (!r || r.date !== k) return;
      push({ id: "review:" + k + ":" + (r.id || i), kind: "reflection", subject: "", label: "Weekly review" + (r.wk ? " · " + r.wk : ""), mins: 0, exact: false, source: "reviews", goals: arr(r.goals).length }, true);
    });
    /* prayers actually marked that day (the tracker stores no clock time) */
    var pr = (st.prayers || {})[k] || {};
    var NAMES = g("PRAYERS") || ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    arr(NAMES).forEach(function (n, i) {
      if (!pr[n]) return;
      push({ id: "prayer:" + k + ":" + n, kind: "prayer", subject: "Deen", label: "Prayer · " + n, mins: 0, exact: false, source: "prayers", order: i }, true);
    });
    /* meals logged that day */
    var MEALS = [["b", "Breakfast"], ["l", "Lunch"], ["d", "Dinner"]];
    MEALS.forEach(function (m) {
      if (!(dl.meals || {})[m[0]]) return;
      push({ id: "meal:" + k + ":" + m[0], kind: "meal", subject: "", label: m[1], mins: 0, exact: false, source: "dayLog" }, true);
    });
    /* a rest day claimed that week — rest is part of life, and it is recorded */
    if (arr(st.gam && st.gam.rest).indexOf(k) >= 0) {
      push({ id: "restday:" + k, kind: "restday", subject: "", label: "Rest day", mins: 0, exact: false, source: "gam" }, true);
    }
    return out;
  }

  /* -------------------------------------------------- configured schedule */
  function schedule(k) {
    var out = [], st = S();
    try {
      var dc = g("dayCover");
      if (typeof dc !== "function" || !okDate(k)) return out;
      var d = new Date(k + "T12:00:00");
      var cv = dc(d);
      if (!cv || !cv.arr) return out;
      var NAMES = { 1: "School", 2: "Tuition", 3: "Scheduled block" };
      var i = 0;
      while (i < cv.arr.length) {
        var code = cv.arr[i];
        if (code) {
          var j = i; while (j < cv.arr.length && cv.arr[j] === code) j++;
          out.push({ code: code, label: NAMES[code] || "Scheduled", startMin: cv.wake + i, at: m2t(cv.wake + i), mins: j - i, exact: true, source: "dayCfg" });
          i = j;
        } else i++;
      }
    } catch (e) { }
    return out;
  }
  function sleepOf(k) {
    var st = S(); if (!st) return { bed: "", wake: "", mins: 0 };
    var dl = (st.dayLog || {})[k] || {};
    var mins = 0;
    try { var sm = g("sleepMins"); if (typeof sm === "function") mins = num(sm(dl), 0); } catch (e) { }
    if (!mins && dl.bed && dl.wake) mins = (t2m(dl.wake) - t2m(dl.bed) + 1440) % 1440;
    return { bed: String(dl.bed || ""), wake: String(dl.wake || ""), mins: mins };
  }
  function dayWindow(k) {
    var st = S(), s = sleepOf(k);
    var wake = s.wake || (st && st.settings && st.settings.wake) || "06:00";
    var bed = s.bed || (st && st.settings && st.settings.sleep) || "22:00";
    return { wake: wake, bed: bed, startMin: t2m(wake), len: ((t2m(bed) - t2m(wake) + 1440) % 1440) || 1440 };
  }

  /* ------------------------------------------------------------- mastery */
  function mastery() {
    var st = S(), out = {};
    var statuses = g("statuses") || [];
    if (!st || !st.progress || !statuses.length) return out;
    subjects().forEach(function (sj) {
      var o = { total: 0, mastered: 0, revised: 0, started: 0, stage: {} };
      statuses.forEach(function (s) { o.stage[s] = 0; });
      Object.keys(st.progress).forEach(function (key) {
        if (key.indexOf(sj + "|") !== 0) return;
        var v = st.progress[key]; o.total++;
        if (o.stage[v] !== undefined) o.stage[v]++;
        if (v === "Mastered") o.mastered++;
        if (v === "Revised" || v === "Mastered") o.revised++;
        if (v && v !== "Not Started") o.started++;
      });
      out[sj] = o;
    });
    return out;
  }
  function dates() {
    var st = S(); if (!st) return [];
    var set = {};
    var add = function (d) { if (okDate(d)) set[d] = 1; };
    /* every array whose records carry their own date */
    ["study", "runs", "karate", "hobbyLog", "extraLog", "workouts", "quran", "movies",
      "papers", "mistakes", "feynman", "marks", "bizLog", "lifts"].forEach(function (k) {
        arr(st[k]).forEach(function (x) { if (x) add(x.date || x.d); });
      });
    /* records whose date field means "the day this happened" */
    arr(st.homework).forEach(function (h) { if (h) add(h.done); });
    arr(st.exams).forEach(function (e) { if (e) add(e.done); });
    arr(st.reviews).forEach(function (r) { if (r) add(r.date); });
    arr(st.questions).forEach(function (q) { if (q) add(q.last); });
    arr(st.research).forEach(function (r) {
      if (!r) return;
      arr(r.notes).forEach(function (n) { if (n) add(n.d); });
      arr(r.tests).forEach(function (t) { if (t) add(t.d); });
    });
    /* day-keyed maps */
    Object.keys(st.dayLog || {}).forEach(add);
    Object.keys(st.plan || {}).forEach(add);
    Object.keys(st.prayers || {}).forEach(add);
    arr(st.gam && st.gam.rest).forEach(add);
    return Object.keys(set).sort();
  }
  function totals(k) {
    var mins = 0;
    try { var am = g("activityMins"); if (typeof am === "function") return { all: num(am(k), 0) }; } catch (e) { }
    dayAnchored(k).concat(dayRecords(k)).forEach(function (x) { mins += num(x.mins, 0); });
    return { all: mins };
  }

  /* ------------------------------------------------------------- snapshot */
  function snapshot(k) {
    k = okDate(k) ? k : todayKey();
    return {
      date: k, isToday: k === todayKey(),
      window: dayWindow(k), sleep: sleepOf(k),
      schedule: schedule(k), anchored: dayAnchored(k), records: dayRecords(k),
      totals: totals(k), live: k === todayKey() ? live() : null
    };
  }

  window.LQAdapter = {
    dkey: dkey, todayKey: todayKey, okDate: okDate, hm: hm, t2m: t2m, m2t: m2t,
    live: live, livePomo: livePomo, liveRead: liveRead, liveLab: liveLab,
    dayAnchored: dayAnchored, dayRecords: dayRecords, schedule: schedule,
    sleepOf: sleepOf, dayWindow: dayWindow, mastery: mastery, dates: dates,
    totals: totals, snapshot: snapshot, subjects: subjects,
    bookOf: bookOf, projectOf: projectOf, homeworkOf: projectOf && homeworkOf
  };
})();
