/* ============================================================================
   LIFEQUEST · lq-character.js — one anonymous character, in pixels.

   The rig is drawn on the same 4-unit pixel grid as the environments
   (LQWorld.P): every rect is a whole pixel, so the character never blurs and
   never breaks scale when a room changes. Nothing is curved or rounded.

   Motion is frame-swapping, the handheld way: each pose carries two
   hand-drawn frames (.fa / .fb) inside `.alt` groups and CSS flips between
   them with steps(1). No rotation, no easing, no sub-pixel travel — the
   silhouette stays pixel-perfect in every frame. Poses themselves
   (stand / sit / recline / lie) are pre-drawn groups toggled by data-pose.

   JavaScript only sets data-anim / data-pose / data-skin / data-outfit /
   data-acc on the root <g>; the desk materials (deskProps) are the one thing
   that varies between academic subjects, drawn on the same desk.
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

  /* Appearance is grayscale only: skin and outfit pick TONES, not hues.
     Six skin tones from pale to deep, eight outfits from light to dark —
     the same choice the player always had, now on the monochrome ramp. */
  var SKINS = ["#e8e8e8", "#d2d2d2", "#b4b4b4", "#8f8f8f", "#f4f4f4", "#6b6b6b"];
  var OUTFITS = [
    { name: "Everyday", shirt: "#a8a8a8", trouser: "#4c4c4c" },
    { name: "Focus",    shirt: "#8f8f8f", trouser: "#3d3d3d" },
    { name: "Warm",     shirt: "#7a7a7a", trouser: "#454545" },
    { name: "Calm",     shirt: "#b4b4b4", trouser: "#565656" },
    { name: "Bright",   shirt: "#c9c9c9", trouser: "#4a4a4a" },
    { name: "Night",    shirt: "#5c5c5c", trouser: "#333333" },
    { name: "Studio",   shirt: "#969696", trouser: "#424242" },
    { name: "Formal",   shirt: "#f2f2f2", trouser: "#2e2e2e" }
  ];
  var ACCESSORIES = [
    null,
    { name: "Round glasses", draw: '<g class="lq-acc"><rect x="-4" y="-22" width="3" height="3" class="lq-accl"/><rect x="1" y="-22" width="3" height="3" class="lq-accl"/><rect x="-1" y="-21" width="2" height="1" class="lq-accb"/></g>' },
    { name: "Cap", draw: '<g class="lq-cap"><rect x="-4" y="-25" width="8" height="2"/><rect x="-3" y="-26" width="6" height="1"/><rect x="4" y="-24" width="4" height="1"/></g>' },
    { name: "Hood", draw: '<g class="lq-hood"><rect x="-5" y="-25" width="9" height="3"/><rect x="-5" y="-22" width="2" height="4"/><rect x="3" y="-22" width="2" height="4"/></g>' },
    { name: "Headphones", draw: '<g class="lq-band"><rect x="-4" y="-26" width="9" height="1"/><rect x="-5" y="-23" width="2" height="4" class="lq-pad"/><rect x="4" y="-23" width="2" height="4" class="lq-pad"/></g>' },
    { name: "Scarf", draw: '<g class="lq-scarf"><rect x="-4" y="-17" width="8" height="2"/><rect x="-2" y="-15" width="2" height="4"/></g>' },
    { name: "Watch", draw: '<rect x="5" y="-14" width="2" height="2" class="lq-watch"/>' },
    { name: "Hair tuft", draw: '<g class="lq-hair"><rect x="0" y="-27" width="2" height="2"/><rect x="2" y="-26" width="2" height="1"/></g>' },
    { name: "Backpack strap", draw: '<g class="lq-strap"><rect x="-3" y="-17" width="1" height="6"/><rect x="-2" y="-15" width="1" height="4"/><rect x="1" y="-17" width="1" height="6"/><rect x="0" y="-15" width="1" height="4"/></g>' },
    { name: "Desk lamp pin", draw: '<rect x="-1" y="-27" width="2" height="2" class="lq-pin"/>' }
  ];

  /* one pixel = LQWorld.P scene units; local helper so this file stands alone */
  function px(x, y, w, h, cls, extra) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' +
      (cls ? ' class="' + cls + '"' : "") + (extra || "") + "/>";
  }

  /* ---------------------------------------------------------------- the rig
     Local pixel units: feet at y=0, head top near y=-23. Drawn facing right.
     Every pose is pre-drawn; `.alt` groups carry the two motion frames. */
  function headBlock() {
    return '<g class="lq-head">' +
        px(-3, -23, 7, 6, "lq-skin") +
        px(-4, -24, 8, 2, "lq-hair") + px(-4, -22, 1, 4, "lq-hair") + px(3, -22, 1, 2, "lq-hair") + px(-2, -22, 3, 1, "lq-hair") +
        '<g class="lq-face">' + px(2, -21, 1, 1, "lq-eye") + px(2, -19, 1, 1, "lq-mouth") + '</g>' +
        '<g class="lq-acc-g"></g>' +
      '</g>';
  }

  function rig() {
    return '' +
      '<g class="lq-fig" data-anim="idle" data-pose="stand" data-skin="0" data-outfit="0" data-acc="-1">' +
        '<g class="lq-body">' +

          /* ------------------------------------ standing pose (24 px tall) */
          '<g class="lq-p-stand">' +
            px(-4, 0, 9, 1, "lq-shadow") +
            '<g class="lq-legs lq-alt">' +
              '<g class="fa">' +
                '<g class="lq-leg lq-leg-b">' + px(-2, -11, 3, 6, "lq-thigh") + '<g class="lq-knee">' + px(-2, -5, 2, 4, "lq-shin") + px(-2, -1, 4, 1, "lq-foot") + '</g></g>' +
                '<g class="lq-leg lq-leg-f">' + px(0, -11, 3, 6, "lq-thigh lq-thigh-f") + '<g class="lq-knee">' + px(1, -5, 2, 4, "lq-shin lq-shin-f") + px(0, -1, 4, 1, "lq-foot lq-foot-f") + '</g></g>' +
              '</g>' +
              '<g class="fb">' +
                '<g class="lq-leg lq-leg-b">' + px(-3, -11, 3, 6, "lq-thigh") + '<g class="lq-knee">' + px(-3, -5, 2, 4, "lq-shin") + px(-4, -1, 4, 1, "lq-foot") + '</g></g>' +
                '<g class="lq-leg lq-leg-f">' + px(1, -11, 3, 6, "lq-thigh lq-thigh-f") + '<g class="lq-knee">' + px(2, -5, 2, 4, "lq-shin lq-shin-f") + px(2, -1, 4, 1, "lq-foot lq-foot-f") + '</g></g>' +
              '</g>' +
            '</g>' +
            '<g class="lq-breathe">' +
              '<g class="lq-torso">' + px(-3, -17, 7, 6, "lq-shirt") + px(-3, -11, 7, 1, "lq-shirt2") + '</g>' +
              '<g class="lq-arm lq-arm-b lq-alt">' +
                '<g class="fa">' + px(-4, -17, 2, 5, "lq-sleeve") + '<g class="lq-elbow">' + px(-4, -12, 2, 3, "lq-fore") + px(-4, -10, 2, 2, "lq-hand lq-hand-b") + '</g></g>' +
                '<g class="fb">' + px(-5, -17, 2, 5, "lq-sleeve") + '<g class="lq-elbow">' + px(-5, -12, 2, 3, "lq-fore") + px(-5, -10, 2, 2, "lq-hand lq-hand-b") + '</g></g>' +
              '</g>' +
              headBlock() +
              '<g class="lq-arm lq-arm-f lq-alt">' +
                '<g class="fa">' + px(2, -17, 2, 5, "lq-sleeve lq-sleeve-f") + '<g class="lq-elbow">' + px(2, -12, 2, 3, "lq-fore lq-fore-f") + px(2, -10, 2, 2, "lq-hand") + '<g class="lq-held"></g>' + '</g></g>' +
                '<g class="fb">' + px(3, -17, 2, 5, "lq-sleeve lq-sleeve-f") + '<g class="lq-elbow">' + px(3, -12, 2, 3, "lq-fore lq-fore-f") + px(3, -10, 2, 2, "lq-hand") + '<g class="lq-held"></g>' + '</g></g>' +
              '</g>' +
            '</g>' +
          '</g>' +

          /* ------------------------- sitting pose: hips on a 6 px seat */
          '<g class="lq-p-sit">' +
            px(-3, 0, 8, 1, "lq-shadow") +
            '<g class="lq-legs">' +
              '<g class="lq-leg lq-leg-b">' + px(-2, -6, 5, 2, "lq-thigh") + '<g class="lq-knee">' + px(1, -4, 2, 3, "lq-shin") + px(0, -1, 4, 1, "lq-foot") + '</g></g>' +
              '<g class="lq-leg lq-leg-f">' + px(-1, -6, 5, 2, "lq-thigh lq-thigh-f") + '<g class="lq-knee">' + px(2, -4, 2, 3, "lq-shin lq-shin-f") + px(2, -1, 4, 1, "lq-foot lq-foot-f") + '</g></g>' +
            '</g>' +
            '<g class="lq-breathe">' +
              '<g class="lq-torso">' + px(-3, -12, 7, 6, "lq-shirt") + px(-3, -6, 7, 1, "lq-shirt2") + '</g>' +
              '<g class="lq-arm lq-arm-b">' + px(-4, -12, 2, 3, "lq-sleeve") + '<g class="lq-elbow">' + px(-4, -13, 4, 2, "lq-fore") + px(-1, -13, 2, 2, "lq-hand lq-hand-b") + '</g></g>' +
              headBlock() +
              '<g class="lq-arm lq-arm-f lq-alt">' +
                '<g class="fa">' + px(1, -12, 2, 3, "lq-sleeve lq-sleeve-f") + '<g class="lq-elbow">' + px(2, -13, 4, 2, "lq-fore lq-fore-f") + px(5, -13, 2, 2, "lq-hand") + '<g class="lq-held"></g>' + '</g></g>' +
                '<g class="fb">' + px(1, -12, 2, 3, "lq-sleeve lq-sleeve-f") + '<g class="lq-elbow">' + px(2, -14, 4, 2, "lq-fore lq-fore-f") + px(5, -14, 2, 2, "lq-hand") + '<g class="lq-held"></g>' + '</g></g>' +
              '</g>' +
            '</g>' +
          '</g>' +

          /* --------------------------------------- recline pose (armchair) */
          '<g class="lq-p-recline">' +
            px(-3, 0, 9, 1, "lq-shadow") +
            '<g class="lq-legs">' +
              '<g class="lq-leg lq-leg-b">' + px(-1, -6, 6, 2, "lq-thigh") + '<g class="lq-knee">' + px(4, -5, 2, 4, "lq-shin") + px(4, -1, 4, 1, "lq-foot") + '</g></g>' +
              '<g class="lq-leg lq-leg-f">' + px(0, -6, 6, 2, "lq-thigh lq-thigh-f") + '<g class="lq-knee">' + px(5, -5, 2, 4, "lq-shin lq-shin-f") + px(5, -1, 4, 1, "lq-foot lq-foot-f") + '</g></g>' +
            '</g>' +
            '<g class="lq-breathe">' +
              '<g class="lq-torso">' + px(-4, -12, 7, 6, "lq-shirt") + px(-4, -6, 7, 1, "lq-shirt2") + '</g>' +
              '<g class="lq-arm lq-arm-b">' + px(-5, -11, 2, 3, "lq-sleeve") + '<g class="lq-elbow">' + px(-5, -9, 3, 2, "lq-fore") + '</g></g>' +
              headBlock() +
              '<g class="lq-arm lq-arm-f">' + px(1, -11, 4, 2, "lq-sleeve lq-sleeve-f") + '<g class="lq-elbow">' + px(4, -11, 2, 2, "lq-hand") + '<g class="lq-held"></g>' + '</g></g>' +
            '</g>' +
          '</g>' +

          /* --------------------------------------------- lying pose (bed) */
          '<g class="lq-p-lie">' +
            '<g class="lq-legs"></g>' +
            '<g class="lq-breathe">' +
              '<g class="lq-head">' +
                px(-15, -6, 6, 5, "lq-skin") +
                px(-16, -7, 7, 2, "lq-hair") + px(-16, -5, 1, 3, "lq-hair") +
                '<g class="lq-face">' + px(-11, -4, 1, 1, "lq-eye") + '</g>' +
                '<g class="lq-acc-g"></g>' +
              '</g>' +
              px(-12, -4, 3, 2, "lq-pillow") + px(-12, -6, 3, 2, "lq-pillow") +
              '<g class="lq-torso">' + px(-9, -5, 14, 3, "lq-shirt") + '</g>' +
              '<g class="lq-arm lq-arm-f">' + px(-6, -6, 5, 2, "lq-sleeve lq-sleeve-f") + '<g class="lq-elbow">' + px(-2, -6, 2, 2, "lq-hand") + '<g class="lq-held"></g>' + '</g></g>' +
              '<g class="lq-arm lq-arm-b"></g>' +
              px(-9, -3, 24, 3, "lq-blanket2") +
            '</g>' +
          '</g>' +

        '</g>' +
      '</g>';
  }

  /* ------------------------------------------------------- desk materials
     Drawn ON the desk surface in the same pixel grid (1 unit = 1 px of the
     240×135 grid). The desk, chair and room never change — this is the only
     thing that varies between academic subjects. */
  var GLYPH = {
    maths:      px(2, 10, 14, 1, "lq-ink") + px(2, 2, 1, 9, "lq-ink") + px(4, 8, 2, 2, "lq-ink") + px(6, 6, 2, 2, "lq-ink") + px(8, 4, 2, 2, "lq-ink") + px(11, 3, 3, 1, "lq-ink") + px(13, 1, 2, 2, "lq-ink2"),
    physics:    px(3, 11, 10, 1, "lq-ink") + px(13, 10, 2, 1, "lq-ink") + px(14, 9, 1, 1, "lq-ink") + px(6, 8, 1, 3, "lq-ink") + px(5, 4, 3, 1, "lq-ink2") + px(4, 5, 1, 1, "lq-ink2") + px(8, 5, 1, 1, "lq-ink2"),
    chemistry:  px(6, 2, 4, 1, "lq-ink") + px(5, 3, 1, 6, "lq-ink") + px(10, 3, 1, 6, "lq-ink") + px(6, 9, 4, 1, "lq-ink") + px(7, 5, 2, 2, "lq-ink2") + px(11, 4, 3, 1, "lq-ink") + px(11, 7, 3, 1, "lq-ink"),
    biology:    px(4, 2, 8, 1, "lq-ink") + px(3, 3, 1, 6, "lq-ink") + px(12, 3, 1, 6, "lq-ink") + px(4, 9, 8, 1, "lq-ink") + px(7, 5, 3, 3, "lq-ink2") + px(5, 4, 1, 1, "lq-ink") + px(10, 7, 1, 1, "lq-ink"),
    history:    px(2, 10, 16, 1, "lq-ink") + px(4, 6, 1, 4, "lq-ink") + px(9, 4, 1, 6, "lq-ink") + px(14, 7, 1, 3, "lq-ink") + px(3, 5, 2, 1, "lq-ink2") + px(8, 3, 2, 1, "lq-ink2") + px(13, 6, 2, 1, "lq-ink2"),
    geography:  px(2, 2, 14, 1, "lq-ink") + px(2, 11, 14, 1, "lq-ink") + px(2, 2, 1, 10, "lq-ink") + px(15, 2, 1, 10, "lq-ink") + px(8, 3, 1, 8, "lq-ink2") + px(3, 6, 12, 1, "lq-ink2") + px(4, 4, 3, 1, "lq-ink") + px(10, 8, 3, 1, "lq-ink") + px(17, 4, 4, 4, "lq-globe") + px(18, 3, 2, 1, "lq-globe") + px(18, 8, 2, 1, "lq-globe"),
    astronomy:  px(3, 3, 1, 1, "lq-ink2") + px(8, 2, 1, 1, "lq-ink2") + px(13, 5, 1, 1, "lq-ink2") + px(6, 8, 1, 1, "lq-ink2") + px(11, 9, 1, 1, "lq-ink2") + px(4, 3, 4, 1, "lq-ink") + px(9, 3, 1, 2, "lq-ink") + px(9, 5, 4, 1, "lq-ink") + px(7, 6, 1, 2, "lq-ink") + px(7, 8, 4, 1, "lq-ink"),
    economics:  px(2, 11, 15, 1, "lq-ink") + px(4, 7, 2, 4, "lq-ink2") + px(8, 4, 2, 7, "lq-ink2") + px(12, 8, 2, 3, "lq-ink2") + px(3, 5, 1, 1, "lq-ink") + px(6, 3, 1, 1, "lq-ink") + px(7, 4, 1, 1, "lq-ink") + px(10, 6, 1, 1, "lq-ink"),
    political:  px(2, 4, 15, 1, "lq-ink") + px(8, 1, 3, 1, "lq-ink") + px(6, 2, 7, 1, "lq-ink") + px(4, 5, 1, 6, "lq-ink") + px(8, 5, 1, 6, "lq-ink") + px(12, 5, 1, 6, "lq-ink") + px(2, 11, 15, 1, "lq-ink"),
    english:    px(3, 3, 12, 1, "lq-ink") + px(3, 5, 12, 1, "lq-ink") + px(3, 7, 9, 1, "lq-ink") + px(3, 9, 11, 1, "lq-ink") + px(12, 10, 1, 1, "lq-ink2") + px(13, 9, 1, 1, "lq-ink2") + px(14, 8, 1, 1, "lq-ink2") + px(15, 7, 2, 1, "lq-ink2"),
    hindi:      px(3, 3, 13, 1, "lq-ink") + px(4, 4, 1, 6, "lq-ink") + px(8, 4, 1, 4, "lq-ink") + px(8, 8, 3, 1, "lq-ink") + px(12, 4, 1, 6, "lq-ink") + px(14, 4, 1, 4, "lq-ink") + px(3, 11, 13, 1, "lq-ink2"),
    it:         px(2, 2, 16, 8, "lq-mon") + px(3, 3, 14, 6, "lq-mon2") + px(4, 4, 6, 1, "lq-code") + px(4, 6, 9, 1, "lq-code") + px(4, 8, 4, 1, "lq-code") + px(8, 10, 2, 1, "lq-mon") + px(5, 11, 8, 1, "lq-key"),
    book:       px(2, 3, 7, 9, "lq-page") + px(10, 3, 7, 9, "lq-page") + px(9, 3, 1, 9, "lq-ink2") + px(4, 5, 3, 1, "lq-ink2") + px(4, 7, 3, 1, "lq-ink2") + px(12, 5, 3, 1, "lq-ink2") + px(12, 7, 3, 1, "lq-ink2"),
    notes:      px(3, 2, 14, 11, "lq-page") + px(5, 4, 10, 1, "lq-ink2") + px(5, 6, 10, 1, "lq-ink2") + px(5, 8, 7, 1, "lq-ink2") + px(13, 11, 1, 1, "lq-ink") + px(14, 10, 1, 1, "lq-ink") + px(15, 9, 2, 1, "lq-ink")
  };

  /* Small study objects — desk-sized only. A theoretical subject never gets
     laboratory apparatus: chemistry gets a molecular model card, not glassware. */
  var OBJECT = {
    maths:      px(0, 6, 12, 1, "lq-obj") + px(1, 5, 10, 1, "lq-obj2") + px(2, 2, 6, 1, "lq-obj") + px(3, 3, 1, 2, "lq-obj"),
    physics:    px(6, 1, 1, 5, "lq-obj") + px(5, 6, 3, 3, "lq-obj2") + px(2, 10, 9, 1, "lq-obj"),
    chemistry:  px(2, 3, 2, 2, "lq-obj2") + px(7, 1, 2, 2, "lq-obj2") + px(7, 6, 2, 2, "lq-obj2") + px(4, 4, 3, 1, "lq-obj") + px(4, 5, 3, 1, "lq-obj") + px(6, 3, 1, 3, "lq-obj"),
    biology:    px(6, 2, 1, 8, "lq-obj") + px(4, 3, 2, 3, "lq-obj2") + px(7, 1, 2, 4, "lq-obj2") + px(5, 6, 2, 2, "lq-obj2"),
    history:    px(1, 3, 3, 7, "lq-obj2") + px(5, 5, 3, 5, "lq-obj") + px(2, 2, 1, 1, "lq-obj"),
    geography:  px(2, 2, 8, 8, "lq-globe") + px(3, 1, 6, 1, "lq-globe") + px(3, 10, 6, 1, "lq-globe") + px(5, 2, 1, 8, "lq-obj") + px(2, 5, 8, 1, "lq-obj") + px(4, 11, 4, 1, "lq-obj2"),
    astronomy:  px(6, 3, 3, 3, "lq-obj2") + px(5, 4, 1, 1, "lq-obj2") + px(9, 4, 1, 1, "lq-obj2") + px(2, 9, 11, 1, "lq-obj") + px(7, 6, 1, 3, "lq-obj"),
    economics:  px(1, 8, 12, 1, "lq-obj") + px(2, 5, 2, 3, "lq-obj2") + px(6, 3, 2, 5, "lq-obj2") + px(10, 6, 2, 2, "lq-obj2"),
    political:  px(1, 8, 12, 1, "lq-obj") + px(3, 4, 1, 4, "lq-obj2") + px(6, 4, 1, 4, "lq-obj2") + px(9, 4, 1, 4, "lq-obj2") + px(2, 3, 9, 1, "lq-obj2") + px(6, 1, 1, 2, "lq-obj"),
    english:    px(3, 2, 8, 6, "lq-page") + px(4, 3, 6, 1, "lq-ink2") + px(4, 5, 6, 1, "lq-ink2") + px(9, 8, 1, 1, "lq-obj") + px(10, 7, 1, 1, "lq-obj") + px(11, 6, 2, 1, "lq-obj"),
    hindi:      px(2, 2, 10, 1, "lq-obj") + px(3, 3, 1, 5, "lq-obj2") + px(6, 3, 1, 4, "lq-obj2") + px(9, 3, 1, 5, "lq-obj2") + px(4, 9, 6, 1, "lq-obj"),
    it:         px(1, 1, 11, 7, "lq-mon") + px(2, 2, 9, 5, "lq-mon2") + px(3, 3, 5, 1, "lq-code") + px(3, 5, 7, 1, "lq-code") + px(4, 9, 6, 1, "lq-key"),
    book:       px(1, 2, 6, 8, "lq-obj2") + px(7, 2, 6, 8, "lq-obj") + px(6, 2, 1, 8, "lq-ink2"),
    notes:      px(2, 2, 10, 8, "lq-page") + px(4, 4, 6, 1, "lq-ink2") + px(4, 6, 6, 1, "lq-ink2") + px(10, 8, 1, 1, "lq-obj") + px(11, 7, 2, 1, "lq-obj")
  };

  /* A subject's desk set: a closed stack, an open notebook with the subject's
     own diagram, and one small study object. Nothing else changes. */
  function deskProps(key, opt) {
    var M = (window.LQMapper && window.LQMapper.PROPS) || {};
    var p = M[key] || M.generic || { cover: "g3", accent: "g6", prop: "notes", label: "Study" };
    opt = opt || {};
    var g = GLYPH[p.prop] || GLYPH.notes;
    var w = opt.w || 24, h = opt.h || 10;
    return '' +
      '<g class="lq-deskprops" data-subject="' + key + '">' +
        /* closed stack of books, tones follow the subject */
        '<g class="lq-stack">' +
          px(0, h - 3, 9, 1, "lq-cov c0") +
          px(1, h - 4, 8, 1, "lq-cov c1") +
          px(1, h - 5, 7, 1, "lq-cov c2") +
        '</g>' +
        /* open notebook with the subject diagram */
        '<g class="lq-note" transform="translate(' + Math.round(w * 0.30) + ',' + (h - 9) + ')">' +
          px(0, 1, 13, 8, "lq-page") + px(6, 1, 1, 8, "lq-pagefold") +
          '<g transform="translate(1,1)">' + g + '</g>' +
        '</g>' +
        /* pencil + the one subject-specific object */
        '<g class="lq-pencil">' + px(Math.round(w * 0.80), h - 2, 5, 1, "lq-penbody") + px(Math.round(w * 0.80) + 5, h - 2, 1, 1, "lq-pentip") + '</g>' +
        '<g class="lq-obj" transform="translate(' + Math.round(w * 0.82) + ',' + (h - 12) + ')">' + (OBJECT[p.prop] || "") + '</g>' +
      '</g>';
  }

  /* Object the character holds, in pixels, sized to the hand. */
  function held(kind, key) {
    if (kind === "read" || kind === "deen" || kind === "quran")
      return '<g class="lq-book">' + px(-3, -3, 7, 4, "lq-page") + px(0, -3, 1, 4, "lq-pagefold") + '</g>';
    if (kind === "write" || kind === "exam" || kind === "study" || kind === "revise" || kind === "draw")
      return '<g class="lq-pen">' + px(0, -1, 4, 1, "lq-penbody") + px(4, -1, 1, 1, "lq-pentip") + '</g>';
    if (kind === "type")
      return '<g class="lq-keys">' + px(-1, 0, 3, 1, "lq-key") + '</g>';
    if (kind === "eat")
      return '<g>' + px(-1, -2, 3, 3, "lq-cupheld") + '</g>';
    if (kind === "experiment")
      return '<g class="lq-flask">' + px(0, -3, 2, 2, "lq-glass") + px(-1, -1, 4, 3, "lq-glass") + px(0, 0, 2, 1, "lq-liquid") + '</g>';
    if (kind === "flash")
      return '<g>' + px(-3, -3, 6, 4, "lq-page") + px(-2, -2, 4, 1, "lq-ink2") + '</g>';
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

    /* every pose group carries its own accessory + held slots */
    var ai = Number(c.accessory);
    var accHtml = (ai >= 0 && ACCESSORIES[ai]) ? ACCESSORIES[ai].draw : "";
    var accGs = fig.querySelectorAll(".lq-acc-g");
    for (var i = 0; i < accGs.length; i++) accGs[i].innerHTML = accHtml;

    var heldHtml = opt.noProp ? "" : held(anim, m.subjectKey);
    var heldGs = fig.querySelectorAll(".lq-held");
    for (var j = 0; j < heldGs.length; j++) heldGs[j].innerHTML = heldHtml;
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
