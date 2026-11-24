/* ============================================================================
   LIFEQUEST · lq-character.js
   One anonymous character, one reusable SVG rig, consistent proportions.

   Motion is CSS-driven: JavaScript only sets `data-anim` / `data-pose` /
   `data-skin` / `data-outfit` on the root <g>. That keeps the frame cost near
   zero (the compositor runs the keyframes) and makes every state reusable.

   Seated academic work is drawn at the SAME desk; only `deskProps(subjectKey)`
   changes the books, notebooks and diagrams on it.
   ========================================================================== */
(function () {
  "use strict";

  /* Every animation state the rig supports. `pose` is the body arrangement,
     `anim` is the motion layered on top of it. */
  var ANIMS = {
    idle:      { pose: "stand", label: "Idle" },
    walk:      { pose: "stand", label: "Walking" },
    run:       { pose: "stand", label: "Running" },
    explore:   { pose: "stand", label: "Exploring" },
    stand:     { pose: "stand", label: "Standing" },
    sit:       { pose: "sit",   label: "Sitting" },
    study:     { pose: "sit",   label: "Studying" },
    write:     { pose: "sit",   label: "Writing" },
    exam:      { pose: "sit",   label: "Writing an exam" },
    revise:    { pose: "sit",   label: "Revising" },
    flash:     { pose: "sit",   label: "Flashcards" },
    read:      { pose: "sit",   label: "Reading" },
    think:     { pose: "sit",   label: "Thinking" },
    type:      { pose: "sit",   label: "Typing" },
    draw:      { pose: "sit",   label: "Drawing" },
    build:     { pose: "stand", label: "Working on a project" },
    experiment:{ pose: "stand", label: "Experimenting" },
    attend:    { pose: "sit",   label: "Attending class" },
    exercise:  { pose: "stand", label: "Exercising" },
    karate:    { pose: "stand", label: "Karate practice" },
    eat:       { pose: "sit",   label: "Eating" },
    rest:      { pose: "recline", label: "Resting" },
    watch:     { pose: "sit",   label: "Watching" },
    perform:   { pose: "stand", label: "Performing" },
    sleep:     { pose: "lie",   label: "Sleeping" },
    wake:      { pose: "sit",   label: "Waking up" }
  };

  var SKINS = ["#e8c39e", "#d9a878", "#b9825a", "#8d5a3b", "#f0d5bb", "#6b4227"];
  var OUTFITS = [
    { name: "Everyday",  shirt: "#4a6fa5", trouser: "#33405a" },
    { name: "Focus",     shirt: "#3f7d6f", trouser: "#2f3b4a" },
    { name: "Warm",      shirt: "#8a5a3b", trouser: "#3a3f4a" },
    { name: "Calm",      shirt: "#6a7a9a", trouser: "#414a5c" },
    { name: "Bright",    shirt: "#b06a4a", trouser: "#3d4454" },
    { name: "Night",     shirt: "#3c4258", trouser: "#2a2f3f" },
    { name: "Studio",    shirt: "#5a7a5a", trouser: "#3a4038" },
    { name: "Formal",    shirt: "#f2f4f8", trouser: "#2c3140" }
  ];
  var ACCESSORIES = [
    null,
    { name: "Round glasses", draw: '<circle cx="-3.4" cy="-1.2" r="2.6" class="lq-acc"/><circle cx="3.4" cy="-1.2" r="2.6" class="lq-acc"/><path d="M-0.8-1.2h1.6" class="lq-acc-l"/>' },
    { name: "Cap", draw: '<path d="M-7-4.6a7 7 0 0 1 14 0z" class="lq-cap"/><path d="M6.6-4.6h5.4a1.4 1.4 0 0 1 0 2.8H6.6z" class="lq-cap"/>' },
    { name: "Hood", draw: '<path d="M-8.6-1a8.6 8.6 0 0 1 17.2 0z" class="lq-hood"/>' },
    { name: "Headphones", draw: '<path d="M-7.6-2.4a7.6 7.6 0 0 1 15.2 0" class="lq-band"/><rect x="-9.4" y="-3.4" width="3.4" height="5.6" rx="1.6" class="lq-pad"/><rect x="6" y="-3.4" width="3.4" height="5.6" rx="1.6" class="lq-pad"/>' },
    { name: "Scarf", draw: '<path d="M-6.4 8.4q6.4 3.4 12.8 0l-1 4.2q-5.4 2.4-10.8 0z" class="lq-scarf"/>' },
    { name: "Watch", draw: '<rect x="8.4" y="14" width="3" height="4" rx="1" class="lq-watch"/>' },
    { name: "Hair tuft", draw: '<path d="M-1-9.4q3-4.6 6.6-2.2q-2.6 0.2-3.4 2.6z" class="lq-tuft"/>' },
    { name: "Backpack strap", draw: '<path d="M-4.6-6.4 2.6 8.2" class="lq-strap"/><path d="M4.6-6.4-2.6 8.2" class="lq-strap"/>' },
    { name: "Desk lamp pin", draw: '<circle cx="0" cy="-9.6" r="1.5" class="lq-pin"/>' }
  ];

  /* ---------------------------------------------------------------- the rig
     Local units: feet at y=0, head top near y=-72. Drawn facing right. */
  function rig() {
    return '' +
      '<g class="lq-fig" data-anim="idle" data-pose="stand" data-skin="0" data-outfit="0" data-acc="-1">' +
        '<ellipse class="lq-shadow" cx="0" cy="1" rx="15" ry="3.4"/>' +
        '<g class="lq-body">' +
          /* legs: thigh + shin, nested so both joints can bend */
          '<g class="lq-legs">' +
            '<g class="lq-leg lq-leg-b"><rect class="lq-thigh" x="-3.1" y="-30" width="6.2" height="17" rx="3.1"/>' +
              '<g class="lq-knee"><rect class="lq-shin" x="-2.7" y="-14.6" width="5.4" height="15" rx="2.7"/><rect class="lq-foot" x="-2.7" y="-1.6" width="8.4" height="3.2" rx="1.6"/></g></g>' +
            '<g class="lq-leg lq-leg-f"><rect class="lq-thigh" x="-3.1" y="-30" width="6.2" height="17" rx="3.1"/>' +
              '<g class="lq-knee"><rect class="lq-shin" x="-2.7" y="-14.6" width="5.4" height="15" rx="2.7"/><rect class="lq-foot" x="-2.7" y="-1.6" width="8.4" height="3.2" rx="1.6"/></g></g>' +
          '</g>' +
          /* torso */
          '<g class="lq-torso"><path class="lq-shirt" d="M-7.4-52.5q7.4-3.6 14.8 0l1.8 22.6q-9.2 3.4-18.4 0z"/></g>' +
          /* back arm */
          '<g class="lq-arm lq-arm-b"><rect class="lq-sleeve" x="-2.6" y="-51" width="5.2" height="14" rx="2.6"/>' +
            '<g class="lq-elbow"><rect class="lq-fore" x="-2.2" y="-38" width="4.4" height="13" rx="2.2"/><circle class="lq-hand" cx="0" cy="-24.6" r="2.5"/></g></g>' +
          /* head */
          '<g class="lq-head"><circle class="lq-skin" cx="0" cy="-58.6" r="9.2"/>' +
            '<path class="lq-hair" d="M-9.2-60.4a9.2 9.2 0 0 1 18.4 0q-2.6-3.4-9.2-3.2q-6.6-0.2-9.2 3.2z"/>' +
            '<g class="lq-face"><circle class="lq-eye" cx="-3.4" cy="-57.6" r="0.95"/><circle class="lq-eye" cx="3.4" cy="-57.6" r="0.95"/>' +
            '<path class="lq-mouth" d="M-2-53.8q2 1.5 4 0"/></g>' +
            '<g class="lq-acc-g"></g>' +
          '</g>' +
          /* front arm */
          '<g class="lq-arm lq-arm-f"><rect class="lq-sleeve" x="-2.6" y="-51" width="5.2" height="14" rx="2.6"/>' +
            '<g class="lq-elbow"><rect class="lq-fore" x="-2.2" y="-38" width="4.4" height="13" rx="2.2"/><circle class="lq-hand" cx="0" cy="-24.6" r="2.5"/>' +
            '<g class="lq-held"></g></g></g>' +
        '</g>' +
      '</g>';
  }

  /* ------------------------------------------------------- desk materials
     Drawn ON the desk surface. The desk, chair and room never change — this is
     the only thing that varies between academic subjects. */
  var GLYPH = {
    maths: '<path class="lq-ink" d="M2 4v14h18"/><path class="lq-ink" d="M4 16q5-1 8-6t8-4"/><text class="lq-tx" x="13" y="11">x²</text>',
    physics: '<path class="lq-ink" d="M2 18 14 5h6"/><circle class="lq-ink-f" cx="11" cy="9" r="1.8"/><path class="lq-ink" d="M11 9 18 13"/><path class="lq-ink" d="M18 13l-2.6-0.4M18 13l-0.5-2.5"/>' +
             '<path class="lq-ink" d="M3 3q4 4 8 0" opacity=".7"/>',
    chemistry: '<path class="lq-ink" d="M9 5l4.4 2.5v5L9 15l-4.4-2.5v-5z"/><path class="lq-ink" d="M13.4 7.5l3.6-2M13.4 12.5l3.6 2M4.6 12.5 1 14.6"/>' +
               '<text class="lq-tx" x="16" y="17">→</text>',
    biology: '<ellipse class="lq-ink" cx="10" cy="10" rx="8" ry="6"/><circle class="lq-ink-f" cx="9" cy="10" r="2.2"/><path class="lq-ink" d="M2 10q3-3 6 0t6 0"/>' +
             '<path class="lq-ink" d="M17 15q3 1 4 4" opacity=".7"/>',
    history: '<path class="lq-ink" d="M2 16h18"/><circle class="lq-ink-f" cx="5" cy="16" r="1.3"/><circle class="lq-ink-f" cx="11" cy="16" r="1.3"/><circle class="lq-ink-f" cx="17" cy="16" r="1.3"/>' +
             '<path class="lq-ink" d="M6 12V6h3v6M13 12V4h3v8"/>',
    geography: '<path class="lq-ink" d="M2 4h18v13H2z"/><path class="lq-ink" d="M2 8.4h18M2 12.6h18M8 4v13M14 4v13" opacity=".55"/>' +
               '<path class="lq-ink" d="M4 14q3-4 6-1t6-3" /><circle class="lq-globe" cx="24" cy="9" r="4"/><path class="lq-ink" d="M20 9h8M24 5v8" opacity=".6"/>',
    astronomy: '<path class="lq-ink" d="M2 3h18v15H2z"/><circle class="lq-ink-f" cx="6" cy="7" r="1"/><circle class="lq-ink-f" cx="12" cy="5.5" r="1.2"/><circle class="lq-ink-f" cx="17" cy="9" r="1"/>' +
               '<circle class="lq-ink-f" cx="9" cy="13" r="1"/><path class="lq-ink" d="M6 7l6-1.5 5 3.5-8 4z" opacity=".7"/><text class="lq-tx" x="14" y="17">♄</text>',
    economics: '<path class="lq-ink" d="M2 17h18M3 17V9M8 17V5M13 17v-6M18 17v-9"/><path class="lq-ink" d="M2 12q6 3 10-2t8 1" opacity=".7"/>',
    political: '<path class="lq-ink" d="M4 17V8M9 17V8M14 17V8M19 17V8M2 8h19L11.5 3z"/><path class="lq-ink" d="M2 17h19"/>',
    english: '<path class="lq-ink" d="M3 5h16M3 8.4h16M3 11.8h12M3 15.2h14" opacity=".85"/><path class="lq-ink" d="M17 17l4-6" /><path class="lq-ink-f" d="M21 11l1.6-1.2-0.6 2z"/>',
    hindi: '<path class="lq-ink" d="M3 6h16"/><path class="lq-ink" d="M5 6v8M9 6v6q0 3 3 3M14 6v8M18 6v5" /><path class="lq-ink" d="M3 17h16" opacity=".5"/>',
    it: '<rect class="lq-mon" x="1" y="2" width="22" height="15" rx="1.6"/><path class="lq-code" d="M4 6h9M4 9h14M4 12h6"/><rect class="lq-key" x="6" y="18" width="14" height="2.4" rx="1"/>',
    book: '<path class="lq-ink" d="M3 4h8v14H3zM11 4h8v14h-8z"/><path class="lq-ink" d="M5 8h4M5 11h4M13 8h4M13 11h4" opacity=".6"/>',
    notes: '<path class="lq-ink" d="M3 3h16v15H3z"/><path class="lq-ink" d="M6 7h10M6 10h10M6 13h7" opacity=".6"/><path class="lq-ink" d="M17 19l4-5" />'
  };

  /* A subject's desk set: a closed stack, an open notebook with the subject's
     own diagram, and one small study object. Nothing else changes. */
  function deskProps(key, opt) {
    var M = (window.LQMapper && window.LQMapper.PROPS) || {};
    var p = M[key] || M.generic || { cover: "#5a6472", accent: "#e3e8ef", prop: "notes", label: "Study" };
    opt = opt || {};
    var g = GLYPH[p.prop] || GLYPH.notes;
    var w = opt.w || 92, h = opt.h || 34;
    return '' +
      '<g class="lq-deskprops" data-subject="' + key + '">' +
        /* closed stack of books, spine colours follow the subject */
        '<g class="lq-stack">' +
          '<rect x="2" y="' + (h - 12) + '" width="34" height="5" rx="1.4" fill="' + p.cover + '" opacity=".95"/>' +
          '<rect x="4" y="' + (h - 17) + '" width="30" height="5" rx="1.4" fill="' + p.cover + '" opacity=".72"/>' +
          '<rect x="6" y="' + (h - 21.5) + '" width="26" height="4.5" rx="1.4" fill="' + p.accent + '" opacity=".8"/>' +
        '</g>' +
        /* open notebook with the subject diagram */
        '<g class="lq-note" transform="translate(' + (w * 0.30) + ',' + (h - 27) + ')">' +
          '<path d="M0 2h44v25H0z" fill="' + p.accent + '" opacity=".95"/>' +
          '<path d="M22 2v25" stroke="' + p.cover + '" stroke-opacity=".35" stroke-width="1"/>' +
          '<g transform="translate(3,4) scale(0.82)">' + g + '</g>' +
          '<path class="lq-lines" d="M26 8h14M26 12h14M26 16h10" stroke="' + p.cover + '" stroke-opacity=".4" stroke-width="1" fill="none"/>' +
        '</g>' +
        /* pencil + the one subject-specific object */
        '<g class="lq-pencil" transform="translate(' + (w * 0.78) + ',' + (h - 9) + ') rotate(-14)">' +
          '<rect x="0" y="0" width="20" height="2.6" rx="1.2" fill="' + p.cover + '"/>' +
          '<path d="M20 0l4 1.3-4 1.3z" fill="#e8d9b8"/></g>' +
        '<g class="lq-obj" transform="translate(' + (w * 0.80) + ',' + (h - 30) + ')">' + (OBJECT[p.prop] || "") + '</g>' +
      '</g>';
  }
  /* Small study objects — desk-sized only. A theoretical subject never gets
     laboratory apparatus: chemistry gets a molecular model card, not glassware. */
  var OBJECT = {
    maths: '<rect x="0" y="6" width="18" height="2.4" rx="1" fill="#c9b48a"/><path d="M2 6l14-4" stroke="#c9b48a" stroke-width="2" fill="none"/>',
    physics: '<circle cx="8" cy="2" r="1.6" fill="#8f9bb3"/><path d="M8 3.6v7" stroke="#8f9bb3" stroke-width="1"/><path d="M2 12h12" stroke="#8f9bb3" stroke-width="1.4"/>',
    chemistry: '<g opacity=".95"><circle cx="5" cy="6" r="2.6" fill="#2f7d6f"/><circle cx="12" cy="3" r="2.2" fill="#4aa392"/><circle cx="12" cy="10" r="2.2" fill="#4aa392"/><path d="M5 6l7-3M5 6l7 4" stroke="#2f7d6f" stroke-width="1"/></g>',
    biology: '<path d="M8 12c0-5 3-8 7-9-1 5-3 8-7 9z" fill="#4f9a4a"/><path d="M8 12l6-8" stroke="#2f6b2c" stroke-width=".8"/>',
    history: '<path d="M2 12V2h4v10z" fill="#b39a6a"/><path d="M8 12V4h4v8z" fill="#c9b48a"/>',
    geography: '<circle cx="8" cy="6" r="6" fill="#2f6f8f"/><path d="M2 6h12M8 0v12M3.6 2.2q4.4 3.8 0 7.6M12.4 2.2q-4.4 3.8 0 7.6" stroke="#d6ecf5" stroke-width=".7" fill="none"/><path d="M8 12v3M5 15h6" stroke="#7a8a9a" stroke-width="1"/>',
    astronomy: '<path d="M2 13h12M8 13V6" stroke="#9aa3c0" stroke-width="1"/><circle cx="8" cy="4" r="2.4" fill="#3c3f7a"/><circle cx="8" cy="4" r="4.4" fill="none" stroke="#9aa3c0" stroke-width=".6" opacity=".7"/>',
    economics: '<path d="M2 13h13" stroke="#8a7a3a" stroke-width="1"/><path d="M3 13V8M7 13V4M11 13V9" stroke="#b39a4a" stroke-width="2"/>',
    political: '<path d="M1 13h14M3 13V6M7 13V6M11 13V6M1 6h14L8 1z" fill="#8a6a9a" opacity=".85"/>',
    english: '<path d="M2 2q6-2 12 0v11q-6-2-12 0z" fill="#c9a2ab"/><path d="M8 2v11" stroke="#8a4a5a" stroke-width=".7"/>',
    hindi: '<path d="M2 3h12M4 3v9M8 3v7M12 3v9" stroke="#c07a3a" stroke-width="1.2" fill="none"/>',
    it: '<rect x="1" y="1" width="14" height="10" rx="1.2" fill="#2b3644"/><path d="M3 4h6M3 6.6h9M3 9h4" stroke="#7fd1c1" stroke-width=".9"/>',
    book: '<path d="M2 2h12v11H2z" fill="#8a7a6a"/><path d="M8 2v11" stroke="#5a4a3a" stroke-width=".8"/>',
    notes: '<rect x="2" y="2" width="12" height="11" rx="1" fill="#dfe4ec"/><path d="M4 5h8M4 8h8M4 11h5" stroke="#9aa3b3" stroke-width=".8"/>'
  };

  /* Object the character holds while reading (a book), scaled to the hand. */
  function held(kind, key) {
    var M = (window.LQMapper && window.LQMapper.PROPS) || {};
    var p = M[key] || M.generic || { cover: "#5a6472" };
    if (kind === "read") return '<g class="lq-book" transform="translate(-6,-26)"><path d="M0 0h13v9H0z" fill="' + p.cover + '"/><path d="M6.5 0v9" stroke="#fff" stroke-opacity=".35"/></g>';
    if (kind === "write" || kind === "exam" || kind === "study" || kind === "revise") return '<g class="lq-pen" transform="translate(-1.4,-27) rotate(18)"><rect width="9" height="1.5" rx=".7" fill="#d8c39a"/><path d="M9 0l2 .75L9 1.5z" fill="#4a4a55"/></g>';
    if (kind === "draw") return '<g class="lq-pen" transform="translate(-1.4,-27) rotate(28)"><rect width="8" height="1.6" rx=".8" fill="#b06a4a"/></g>';
    if (kind === "eat") return '<g transform="translate(-2,-27)"><rect width="6" height="4" rx="1.4" fill="#c9a06a"/></g>';
    if (kind === "experiment") return '<g class="lq-flask" transform="translate(-3,-28)"><path d="M2 0h4v3l3 6H-1l3-6z" fill="#bcd9e8" opacity=".9"/><path d="M2 0h4" stroke="#7a8a9a" stroke-width="1"/></g>';
    if (kind === "flash") return '<g transform="translate(-5,-28)"><rect width="10" height="7" rx="1" fill="#f0f2f6"/><path d="M2 2.4h6M2 4.6h4" stroke="#9aa3b3" stroke-width=".7"/></g>';
    if (kind === "deen" || kind === "quran") return '<g transform="translate(-6,-26)"><path d="M0 0h13v9H0z" fill="#2f6b4f"/><path d="M6.5 0v9" stroke="#fff" stroke-opacity=".3"/></g>';
    return "";
  }

  /* ------------------------------------------------------------ apply state */
  function apply(fig, mapped, opt) {
    if (!fig) return;
    opt = opt || {};
    var m = mapped || {};
    var anim = ANIMS[m.anim] ? m.anim : "idle";
    var pose = m.pose || ANIMS[anim].pose;
    fig.setAttribute("data-anim", anim);
    fig.setAttribute("data-pose", pose);
    fig.setAttribute("data-subject", String(m.subjectKey || "generic"));
    fig.setAttribute("data-academic", m.academic ? "1" : "0");
    fig.setAttribute("data-practical", m.practical ? "1" : "0");

    var st = (window.LQStore && window.LQStore.get()) || {};
    var c = (st && st.char) || {};
    fig.setAttribute("data-skin", String(c.skin | 0));
    fig.setAttribute("data-outfit", String(c.outfit | 0));
    fig.setAttribute("data-acc", String(c.accessory === undefined ? -1 : c.accessory));

    var accG = fig.querySelector(".lq-acc-g");
    if (accG) {
      var ai = Number(c.accessory);
      accG.innerHTML = (ai >= 0 && ACCESSORIES[ai]) ? ACCESSORIES[ai].draw : "";
    }
    var heldG = fig.querySelector(".lq-held");
    if (heldG) heldG.innerHTML = opt.noProp ? "" : held(anim, m.subjectKey);
    return fig;
  }

  function skinAt(i) { return SKINS[Math.max(0, Math.min(SKINS.length - 1, i | 0))]; }
  function outfitAt(i) { return OUTFITS[Math.max(0, Math.min(OUTFITS.length - 1, i | 0))] || OUTFITS[0]; }
  function accessoryAt(i) { return i >= 0 ? ACCESSORIES[i] : null; }

  window.LQCharacter = {
    ANIMS: ANIMS, SKINS: SKINS, OUTFITS: OUTFITS, ACCESSORIES: ACCESSORIES,
    rig: rig, apply: apply, deskProps: deskProps, held: held, GLYPH: GLYPH, OBJECT: OBJECT,
    skinAt: skinAt, outfitAt: outfitAt, accessoryAt: accessoryAt,
    animNames: function () { return Object.keys(ANIMS); }
  };
})();
