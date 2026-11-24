/* ============================================================================
   LIFEQUEST · lq-mapper.js — ActivityMapper
   Translates real tracker activity into character behaviour.

   ╔══════════════════════════════════════════════════════════════════════╗
   ║ BINDING RULE (user directive, v97)                                   ║
   ║ Academic work ALWAYS happens seated at the SAME study desk, studying  ║
   ║ the exact subject logged. Only the books, notebooks, diagrams and     ║
   ║ desk materials change with the subject.                               ║
   ║                                                                      ║
   ║  · Never send him to the laboratory because the subject is Chemistry.║
   ║  · Never send him to the observatory for theoretical astronomy.      ║
   ║  · Never animate a practical experiment during theoretical study.    ║
   ║  · ONLY a real Virtual Lab experiment puts him in the laboratory.    ║
   ╚══════════════════════════════════════════════════════════════════════╝

   Studying chemistry  → desk, chemistry notebook and molecular diagram.
   Doing a chemistry experiment (Virtual Lab) → laboratory, apparatus.
   ========================================================================== */
(function () {
  "use strict";

  var A = function () { return window.LQAdapter || null; };
  var arr = function (v) { return Array.isArray(v) ? v : []; };

  /* ------------------------------------------------------- desk materials
     One entry per academic subject. `cover` is the book/notebook colour,
     `prop` selects the SVG drawn ON THE DESK. The desk never changes. */
  var PROPS = {
    maths:     { label: "Mathematics",            cover: "#3b6fd4", accent: "#cfe0ff", prop: "maths" },
    physics:   { label: "Physics",                cover: "#4a5f8a", accent: "#d7e3f7", prop: "physics" },
    chemistry: { label: "Chemistry",              cover: "#2f7d6f", accent: "#d3efe8", prop: "chemistry" },
    biology:   { label: "Biology",                cover: "#3f7d3a", accent: "#dcf0d6", prop: "biology" },
    history:   { label: "History",                cover: "#8a6a3b", accent: "#f0e4cd", prop: "history" },
    geography: { label: "Geography",              cover: "#2f6f8f", accent: "#d6ecf5", prop: "geography" },
    astronomy: { label: "Astronomy (theory)",      cover: "#3c3f7a", accent: "#dfe0f7", prop: "astronomy" },
    economics: { label: "Economics",              cover: "#7a6a2f", accent: "#f2ecc9", prop: "economics" },
    political: { label: "Political Science",      cover: "#6a4a7a", accent: "#e9dcf5", prop: "political" },
    english:   { label: "English",                cover: "#8a4a5a", accent: "#f7dfe4", prop: "english" },
    hindi:     { label: "Hindi",                  cover: "#b06a2f", accent: "#f7e6cf", prop: "hindi" },
    it:        { label: "Information Technology", cover: "#3a4a5a", accent: "#dbe6f0", prop: "it" },
    reading:   { label: "Reading",                cover: "#6a5a4a", accent: "#ece2d4", prop: "book" },
    generic:   { label: "Study",                  cover: "#5a6472", accent: "#e3e8ef", prop: "notes" }
  };

  /* Science sub-discipline detection — used ONLY to pick desk materials.
     It never moves the character: chemistry theory stays at the desk. */
  var SCI = [
    [/chem|acid|base|salt|metal|non-?metal|carbon compound|reaction|equation|periodic|mole|electrochem|corros/i, "chemistry"],
    [/bio|life process|cell|tissue|heredity|reproduc|evolution|ecolog|photosynth|respirat|neuron|control and coordination|human eye|environment/i, "biology"],
    [/physic|light|reflect|refract|lens|mirror|electric|magnet|current|voltage|resistan|circuit|energy|power|motion|force|gravity|work and energy|source of energy|astronom|star|planet|solar system|universe/i, "physics"]
  ];

  function subjects() { var a = A(); return a ? a.subjects() : []; }

  /* Canonical subject key from a free-text subject / label / chapter. */
  function subjectKey(text, chapter) {
    var t = String(text || "").toLowerCase(), c = String(chapter || "").toLowerCase();
    var both = t + " " + c;
    var list = subjects();

    /* exact-ish match against the real syllabus subject names first */
    for (var i = 0; i < list.length; i++) {
      var sj = list[i], low = sj.toLowerCase();
      if (t === low || (low.indexOf(t) === 0 && t.length > 2) || t.indexOf(low) === 0) return canon(sj, both);
    }
    /* keyword match on the real subject names (handles "Maths", "Pol. Science") */
    for (var j = 0; j < list.length; j++) {
      var parts = list[j].toLowerCase().split(/[^a-z0-9]+/).filter(function (p) { return p.length > 3; });
      for (var q = 0; q < parts.length; q++) if (t.indexOf(parts[q]) >= 0) return canon(list[j], both);
    }
    /* common short forms */
    if (/math|algebra|geometr|trigonometr|arithmet|mensurat|statistic/i.test(both)) return "maths";
    if (/history|civili|revolution|medieval|ancient|nationalis|industrial/i.test(both)) return "history";
    if (/geograph|climate|soil|vegetation|monsoon|map|continent|ocean|atlas/i.test(both)) return "geography";
    if (/econom|market|money|banking|income|poverty|globalis|sector/i.test(both)) return "economics";
    if (/political|civics|constitution|democra|power ?sharing|federal|party|parties/i.test(both)) return "political";
    if (/english|literature|grammar|essay|comprehension|prose|poem/i.test(both)) return "english";
    if (/hindi|स्पर्श|संचयन|व्याकरण/i.test(both)) return "hindi";
    if (/\bit\b|information technology|402|computer|programming|code|software/i.test(both)) return "it";
    if (/science|neet|cbse science/i.test(both)) {
      for (var s = 0; s < SCI.length; s++) if (SCI[s][0].test(both)) return SCI[s][1];
      return "physics";
    }
    for (var k = 0; k < SCI.length; k++) if (SCI[k][0].test(both)) return SCI[k][1];
    return "generic";
  }
  function canon(syllabusName, both) {
    var n = String(syllabusName || "").toLowerCase();
    if (n.indexOf("math") === 0) return "maths";
    if (n.indexOf("science") === 0) {
      for (var s = 0; s < SCI.length; s++) if (SCI[s][0].test(both || "")) return SCI[s][1];
      return "physics";
    }
    if (n.indexOf("history") === 0) return "history";
    if (n.indexOf("geography") === 0) return "geography";
    if (n.indexOf("political") === 0) return "political";
    if (n.indexOf("economics") === 0) return "economics";
    if (n.indexOf("hindi") === 0) return "hindi";
    if (n.indexOf("information") === 0 || n.indexOf("it ") === 0) return "it";
    if (n.indexOf("english") === 0) return "english";
    return subjectKeyFallback(n, both);
  }
  function subjectKeyFallback(n, both) {
    for (var k = 0; k < SCI.length; k++) if (SCI[k][0].test(both || n)) return SCI[k][1];
    return "generic";
  }

  function props(key) { return PROPS[key] || PROPS.generic; }

  /* Exact match against the REAL syllabus subject list. Used for reading: only
     a book whose subject is literally one of the tracked subjects counts as
     academic study at the desk. "Literature", "Philosophy", "Self-help" and
     every other reading-list subject stay in the library — reading for its own
     sake is not a study session, and we do not guess otherwise. */
  function exactSubject(text, ctx) {
    var t = String(text || "").trim().toLowerCase();
    if (!t) return null;
    var list = subjects();
    for (var i = 0; i < list.length; i++) {
      if (list[i].toLowerCase() === t) return canon(list[i], (t + " " + String(ctx || "")).toLowerCase());
    }
    return null;
  }

  /* ------------------------------------------------------------------ rooms
     `built` records which environments actually exist yet, so the renderer can
     be honest instead of pretending. Phase 2 builds home + bedroom. */
  var ROOMS = {
    study:     { name: "Study desk",     built: true,  area: "home",   phase: 2 },
    bedroom:   { name: "Bedroom",        built: true,  area: "home",   phase: 2 },
    rest:      { name: "Rest area",      built: true,  area: "home",   phase: 2 },
    library:   { name: "Library",        built: false, area: "library", phase: 6 },
    lab:       { name: "Laboratory",     built: false, area: "lab",    phase: 6 },
    academy:   { name: "Academy",        built: false, area: "academy", phase: 6 },
    observatory:{ name: "Observatory",   built: false, area: "observatory", phase: 6 },
    workshop:  { name: "Workshop",       built: false, area: "workshop", phase: 6 },
    city:      { name: "City",           built: false, area: "city",   phase: 6 },
    garden:    { name: "Garden",         built: false, area: "garden", phase: 6 },
    sanctuary: { name: "Quiet Sanctuary",built: false, area: "sanctuary", phase: 6 },
    screen:    { name: "Recreation",     built: false, area: "home",   phase: 6 }
  };

  var ACADEMIC = { study: 1, revision: 1, exam: 1, homework: 1, flash: 1, feynman: 1, questions: 1 };

  /* ------------------------------------------------------------------- map
     ev = one event from LQAdapter (anchored, record, or live signal). */
  function map(ev) {
    ev = ev || {};
    var kind = String(ev.kind || ""), src = String(ev.source || "");
    var subject = String(ev.subject || ""), label = String(ev.label || "");
    var out = {
      room: "study", spot: "desk", anim: "idle", pose: "stand",
      subjectKey: "generic", subject: "", label: label || "Idle",
      props: PROPS.generic, kind: kind, source: src, academic: false, note: ""
    };

    /* 1 ── The ONLY path into the laboratory: a real Virtual Lab experiment. */
    if (src === "lab" || kind === "lab") {
      out.room = "lab"; out.spot = "bench"; out.anim = "experiment"; out.pose = "stand";
      out.subject = subject || "Experiment"; out.subjectKey = subjectKey(subject, label);
      out.label = label || "Virtual Lab experiment";
      out.props = props(out.subjectKey); out.practical = true;
      return finish(out);
    }

    /* 2 ── Sleep and waking: bedroom. */
    if (kind === "sleep") { out.room = "bedroom"; out.spot = "bed"; out.anim = "sleep"; out.pose = "lie"; out.label = "Sleeping"; return finish(out); }
    if (kind === "wake")  { out.room = "bedroom"; out.spot = "bed"; out.anim = "wake";  out.pose = "stand"; out.label = "Waking up"; return finish(out); }

    /* 3 ── Physical development: garden / training area. */
    if (kind === "run")      { out.room = "garden"; out.spot = "track"; out.anim = "run"; out.pose = "stand"; out.label = label || "Running"; return finish(out); }
    if (kind === "karate")   { out.room = "garden"; out.spot = "mat"; out.anim = "karate"; out.pose = "stand"; out.subject = "Karate"; out.label = label || "Karate practice"; return finish(out); }
    if (kind === "workout" || kind === "strength") { out.room = "garden"; out.spot = "mat"; out.anim = "exercise"; out.pose = "stand"; out.label = label || "Workout"; return finish(out); }

    /* 4 ── Deen: quiet sanctuary. */
    if (kind === "deen" || kind === "prayer") { out.room = "sanctuary"; out.spot = "mat"; out.anim = "read"; out.pose = "sit"; out.subject = "Deen"; out.label = label || "Qur'an reading"; out.props = PROPS.reading; return finish(out); }

    /* 5 ── A logged break is a rest; untracked time is a neutral idle.
           Neither is ever dressed up as an activity we did not record. */
    if (kind === "break") { out.room = "rest"; out.spot = "chair"; out.anim = "rest"; out.pose = "sit"; out.label = "Break"; return finish(out); }
    if (kind === "idle") { out.room = "rest"; out.spot = "chair"; out.anim = "idle"; out.pose = "sit"; out.label = label || "No recorded activity"; return finish(out); }
    if (kind === "watch") { out.room = "screen"; out.spot = "sofa"; out.anim = "watch"; out.pose = "sit"; out.label = label || "Watching"; return finish(out); }

    /* 6 ── Projects / creative work: workshop (computer, bench, animation). */
    if (src === "research" || kind === "project") {
      out.room = "workshop"; out.spot = "bench"; out.pose = "sit";
      var cat = String(ev.cat || "").toLowerCase();
      if (/program|code|software|computer/i.test(cat + " " + label)) { out.spot = "computer"; out.anim = "type"; out.label = label || "Programming"; }
      else if (/anim|film|video/i.test(cat + " " + label)) { out.spot = "station"; out.anim = "draw"; out.label = label || "Animation work"; }
      else if (/novel|writ|story/i.test(cat + " " + label)) { out.spot = "desk"; out.anim = "write"; out.label = label || "Writing"; }
      else { out.anim = "build"; out.label = label || "Project work"; }
      out.subject = subject || "Project";
      return finish(out);
    }
    if (kind === "hobby") {
      var sec = String(ev.sec || "").toLowerCase(), nm = String(ev.secName || subject || "").toLowerCase();
      if (ev.sec === "draw" || /draw|sketch|paint|art/i.test(nm)) { out.room = "workshop"; out.spot = "easel"; out.anim = "draw"; out.pose = "sit"; }
      else if (ev.sec === "lang" || /language|vocab|arabic|urdu|french/i.test(nm)) { out.room = "study"; out.spot = "desk"; out.anim = "read"; out.pose = "sit"; out.academic = false; }
      else if (ev.sec === "act" || /act|drama|theatre/i.test(nm)) { out.room = "rest"; out.spot = "open"; out.anim = "perform"; out.pose = "stand"; }
      else { out.room = "workshop"; out.spot = "bench"; out.anim = "build"; out.pose = "sit"; }
      out.subject = ev.secName || subject || "Hobby"; out.label = label || out.subject;
      return finish(out);
    }

    /* 7 ── Business: city. */
    if (kind === "biz" || src === "biz") { out.room = "city"; out.spot = "stall"; out.anim = "write"; out.pose = "stand"; out.subject = "Business"; out.label = label || "Business work"; return finish(out); }

    /* 8 ── Scheduled attendance (school / tuition) — formal education. */
    if (src === "dayCfg") {
      out.room = "academy"; out.spot = ev.code === 2 ? "tuition" : "classroom";
      out.anim = "attend"; out.pose = "sit"; out.label = label || "School";
      out.subject = label || "School";
      return finish(out);
    }

    /* 9 ── Reading. Academic subject ⇒ desk (rule 4). Otherwise ⇒ library. */
    if (kind === "reading") {
      var bk = ev.book || (A() && ev.bookId ? A().bookOf(ev.bookId) : null);
      var bsub = String((bk && bk.s) || subject || "");
      var btitle = String((bk && bk.t) || label || "");
      /* only a literal syllabus subject counts as academic study (rule 4) */
      var key = exactSubject(bsub, btitle);
      var academicBook = !!key;
      out.subjectKey = academicBook ? key : "reading";
      out.props = props(out.subjectKey);
      out.subject = bsub || (bk && bk.t) || "Reading";
      out.label = String((bk && bk.t) || label || "Reading");
      out.pose = "sit"; out.anim = "read";
      if (academicBook) { out.room = "study"; out.spot = "desk"; out.academic = true; }
      else { out.room = "library"; out.spot = "chair"; }
      return finish(out);
    }

    /* 10 ── ACADEMIC STUDY: always the same desk, exact subject. */
    if (ACADEMIC[kind] || kind === "exam" || src === "study" || src === "papers" || src === "homework") {
      out.room = "study"; out.spot = "desk"; out.pose = "sit"; out.academic = true;
      out.subjectKey = subjectKey(subject, label);
      out.props = props(out.subjectKey);
      out.subject = out.props.label !== "Study" ? out.props.label : (subject || "Study");
      if (kind === "exam" || src === "papers") { out.anim = "exam"; out.label = label || "Mock test"; }
      else if (kind === "revision") { out.anim = "revise"; out.label = label || "Revision"; }
      else if (kind === "flash") { out.anim = "flash"; out.label = label || "Flashcards"; }
      else if (kind === "feynman") { out.anim = "think"; out.label = label || "Feynman explanation"; }
      else if (kind === "homework") { out.anim = "write"; out.label = label || "Homework"; }
      else { out.anim = "study"; out.label = label || ("Studying " + out.subject); }
      return finish(out);
    }

    /* 11 ── Fallback: honest generic idle, never an invented activity. */
    out.room = "rest"; out.spot = "chair"; out.anim = "idle"; out.pose = "sit";
    out.label = label || "No recorded activity";
    return finish(out);
  }

  function finish(out) {
    var r = ROOMS[out.room] || ROOMS.study;
    out.roomName = r.name;
    out.built = !!r.built;
    out.area = r.area;
    /* If the environment is not built yet we still say so honestly and show the
       character in the study environment rather than inventing a scene. */
    if (!r.built) { out.fallbackRoom = "study"; out.note = r.name + " is not built yet (Phase " + r.phase + ")"; }
    /* Rule guard: theoretical study must never be dressed as practical work. */
    if (out.academic) { out.practical = false; if (out.room !== "study") { out.room = "study"; out.spot = "desk"; } }
    return out;
  }

  /* Convenience: what should the character be doing RIGHT NOW? */
  function current() {
    var a = A();
    var lv = a && a.live();
    if (lv) return map(lv);
    return map({ kind: "idle", source: "none", label: "" });
  }

  window.LQMapper = {
    PROPS: PROPS, ROOMS: ROOMS, ACADEMIC: ACADEMIC,
    subjectKey: subjectKey, exactSubject: exactSubject, props: props, map: map, current: current,
    isAcademicKind: function (k) { return !!ACADEMIC[k]; }
  };
})();
