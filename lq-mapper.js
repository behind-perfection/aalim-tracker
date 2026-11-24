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

  /* ------------------------------------------------------------------------
     byKeywords(txt) — classify a NON-academic activity from the tracker's own
     words (its activity kind, its category, the focus the user typed). Used for
     extra-curricular logs and for the user's own hobby sections.

     Deliberate omissions:
       · nothing here ever returns the laboratory — only a real Virtual Lab
         experiment (source "lab") does;
       · nothing here ever returns the observatory — astronomy stays at the desk.
     Returns null when nothing matches, so the caller can stay honest.
     ------------------------------------------------------------------------ */
  /* Word-bounded on purpose: a loose /art/ would match "Smart revision" and a
     loose /run/ would match "Pruning". These words classify only NON-academic
     activities, and only after the binding academic-desk rule has been checked. */
  var KEYWORDS = [
    [/\b(karate|kickboxing|boxing|martial arts?|taekwondo|judo|self[- ]defen\w*)\b/i, "garden", "mat", "karate", "stand"],
    [/\b(run|runs|running|jog\w*|sprint\w*|cardio|cycling|swim\w*|cricket|football|badminton|basketball|volleyball|skipping|sports?)\b/i, "garden", "track", "exercise", "stand"],
    [/\b(yoga|stretch\w*|gym|lifting|strength|push[- ]?ups?|squats?|planks?|workouts?|fitness)\b/i, "garden", "mat", "exercise", "stand"],
    [/\b(qur'?an|deen|prayers?|salah|namaz|islam\w*|hifz|surah\w*|ayah\w*|mosque)\b/i, "sanctuary", "mat", "read", "sit"],
    [/\b(draw\w*|sketch\w*|paint\w*|art|arts|artwork|colour\w*|color\w*|portrait\w*|doodle\w*)\b/i, "workshop", "easel", "draw", "sit"],
    [/\b(writ\w*|essay\w*|poems?|poetry|stor(y|ies)|journal\w*|calligraphy)\b/i, "workshop", "desk", "write", "sit"],
    [/\b(code|coding|program\w*|software|web ?dev\w*|python|javascript|html|css|app dev\w*)\b/i, "workshop", "computer", "type", "sit"],
    [/\b(robot\w*|electron\w*|engineer\w*|invent\w*|makers?|build\w*|circuits?|arduino|3d print\w*|prototype\w*)\b/i, "workshop", "bench", "build", "stand"],
    [/\b(music|guitar|sing\w*|instrument\w*|piano|tabla|flute|vocals?)\b/i, "rest", "open", "perform", "stand"],
    [/\b(act|acting|drama|theatre|theater|debate\w*|speech\w*|recit\w*)\b/i, "rest", "open", "perform", "stand"],
    [/\b(cook\w*|bak\w*|kitchen|recipes?)\b/i, "rest", "table", "eat", "sit"],
    [/\b(garden|gardening|plants?|grow\w*|nature walk|birdwatch\w*)\b/i, "garden", "open", "explore", "stand"],
    [/\b(read|reading|books?|literature|novels?)\b/i, "library", "chair", "read", "sit"],
    [/\b(chess|puzzles?|sudoku|rubik'?s?|games?)\b/i, "rest", "table", "think", "sit"],
    [/\b(clean\w*|tidy\w*|organis\w*|organiz\w*|chores?)\b/i, "rest", "open", "explore", "stand"]
  ];
  function byKeywords(txt) {
    var s = String(txt || "");
    if (!s.trim()) return null;
    for (var i = 0; i < KEYWORDS.length; i++) {
      if (KEYWORDS[i][0].test(s)) {
        return { room: KEYWORDS[i][1], spot: KEYWORDS[i][2], anim: KEYWORDS[i][3], pose: KEYWORDS[i][4], matched: KEYWORDS[i][0].source };
      }
    }
    return null;
  }

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
      var focus = String(ev.focus || "").toLowerCase();
      out.subject = ev.secName || subject || "Hobby"; out.label = label || out.subject;
      if (sec === "draw" || /draw|sketch|paint|art/i.test(nm)) { out.room = "workshop"; out.spot = "easel"; out.anim = "draw"; out.pose = "sit"; }
      else if (sec === "lang" || /language|vocab|arabic|urdu|french/i.test(nm)) { out.room = "study"; out.spot = "desk"; out.anim = "read"; out.pose = "sit"; out.academic = false; }
      else if (sec === "act" || /act|drama|theatre/i.test(nm)) { out.room = "rest"; out.spot = "open"; out.anim = "perform"; out.pose = "stand"; }
      else if (sec === "chem" || /chemistry/i.test(nm)) {
        /* The binding rule: chemistry THEORY is desk work, and nothing here ever
           claims the laboratory. A home-safe experiment is practical work at the
           workshop bench — not the school laboratory, and not desk theory. */
        if (/experiment|demo|practical|home-safe/i.test(focus)) { out.room = "workshop"; out.spot = "bench"; out.anim = "build"; out.pose = "stand"; }
        else {
          out.room = "study"; out.spot = "desk"; out.anim = "study"; out.pose = "sit";
          out.academic = true; out.subjectKey = "chemistry"; out.props = props("chemistry");
          out.subject = "Chemistry";
        }
      }
      else {
        var hh = byKeywords(nm + " " + focus + " " + label);
        if (hh) { out.room = hh.room; out.spot = hh.spot; out.anim = hh.anim; out.pose = hh.pose; }
        else { out.room = "workshop"; out.spot = "bench"; out.anim = "build"; out.pose = "sit"; }
      }
      return finish(out);
    }

    /* 7 ── Business: city. */
    if (kind === "biz" || src === "biz" || src === "bizLog") { out.room = "city"; out.spot = "stall"; out.anim = "write"; out.pose = "stand"; out.subject = subject || "Business"; out.label = label || "Business work"; return finish(out); }

    /* 7b ── Life at home: meals, a claimed rest day, weekly reflection.
             None of these is academic, and none is ever dressed up as study. */
    if (kind === "meal") { out.room = "rest"; out.spot = "table"; out.anim = "eat"; out.pose = "sit"; out.label = label || "Meal"; return finish(out); }
    if (kind === "restday" || kind === "rest") { out.room = "rest"; out.spot = "chair"; out.anim = "rest"; out.pose = "recline"; out.label = label || "Rest day"; return finish(out); }
    if (kind === "reflection" || src === "reviews") { out.room = "rest"; out.spot = "chair"; out.anim = "think"; out.pose = "sit"; out.label = label || "Reflection"; return finish(out); }

    /* 7c ── Extra-curricular activity, classified from the tracker's OWN
             definition of that activity (state.extra: name → kind/category),
             never guessed from the label alone. */
    if (kind === "extra" || src === "extraLog") {
      var ek = String(ev.extraKind || "").toLowerCase(), ecat = String(ev.cat || "").toLowerCase();
      var txt = (ek + " " + ecat + " " + subject + " " + label).toLowerCase();
      out.subject = subject || label || "Activity";
      out.label = label || subject || "Activity";
      /* BINDING RULE FIRST: if the logged activity is literally one of the
         tracked school subjects, it is academic work and belongs at the desk,
         whatever else the label says. */
      var akey = exactSubject(subject, label);
      if (akey) {
        out.room = "study"; out.spot = "desk"; out.pose = "sit"; out.anim = "study";
        out.academic = true; out.subjectKey = akey; out.props = props(akey);
        out.subject = props(akey).label;
        return finish(out);
      }
      var hit = byKeywords(txt);
      if (hit) {
        out.room = hit.room; out.spot = hit.spot; out.anim = hit.anim; out.pose = hit.pose;
        if (out.room === "sanctuary") out.subject = "Deen";
      } else {
        /* Unrecognised: honest generic movement, never an invented activity. */
        out.room = "rest"; out.spot = "open"; out.anim = "explore"; out.pose = "stand";
        out.note = "Unmapped activity — shown generically";
      }
      return finish(out);
    }

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

    /* 9b ── A day-plan item the user ticked off. When the tracker could resolve
             it to a syllabus chapter it already arrives as "revision" (desk,
             that subject). What is left is an intention with no subject we can
             prove, so it is shown as desk work and labelled with the user's own
             words — never as a subject we guessed. */
    if (kind === "plan") {          /* NOT src==="plan": a plan item that the
                                       tracker resolved to a real syllabus
                                       chapter arrives as kind "revision" and
                                       must keep its subject (rule 4). */
      var ph = byKeywords(label + " " + subject);
      if (ph) { out.room = ph.room; out.spot = ph.spot; out.anim = ph.anim; out.pose = ph.pose; }
      else {
        out.room = "study"; out.spot = "desk"; out.pose = "sit"; out.anim = "study";
        out.subjectKey = "generic"; out.props = props("generic");
        out.note = "Planned item — no subject recorded, so none is claimed";
      }
      out.subject = subject || ""; out.label = label || "Planned work";
      return finish(out);
    }

    /* 10 ── ACADEMIC STUDY: always the same desk, exact subject. */
    if (ACADEMIC[kind] || kind === "exam" || src === "study" || src === "papers" || src === "homework") {
      out.room = "study"; out.spot = "desk"; out.pose = "sit"; out.academic = true;
      /* the recorded chapter names the topic, so it decides the materials:
         "Science" + "Acids, Bases and Salts" is chemistry, not physics. */
      out.subjectKey = subjectKey(subject, String(ev.chapter || "") + " " + label);
      out.props = props(out.subjectKey);
      out.subject = out.props.label !== "Study" ? out.props.label : (subject || "Study");
      if (kind === "exam" || src === "papers") { out.anim = "exam"; out.label = label || "Mock test"; }
      else if (kind === "revision") { out.anim = "revise"; out.label = label || "Revision"; }
      else if (kind === "flash") { out.anim = "flash"; out.label = label || "Flashcards"; }
      else if (kind === "feynman") { out.anim = "think"; out.label = label || "Feynman explanation"; }
      else if (kind === "homework") { out.anim = "write"; out.label = label || "Homework"; }
      else if (kind === "questions") { out.anim = "write"; out.label = label || "Question bank practice"; }
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
