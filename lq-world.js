/* ============================================================================
   LIFEQUEST · lq-world.js — monochrome pixel-art environments.

   Style contract (see docs/LIFEQUEST-PHASE-ART.md):
     · ONE pixel size everywhere: P = 4 scene units. The 960×540 stage is a
       240×135 pixel grid and every rectangle is drawn on it, whole pixels only.
     · Black, white and greys only. No hue anywhere, no gradients, no curves,
       no rounded corners, no blur. Tonal transitions use 2×2 checker dither —
       the oldest trick in handheld art.
     · Lighting is grayscale and quiet: a dithered lamp cone, a flat shadow
       row under furniture, a night wash. Nothing glows in colour.
     · Nothing here touches tracker data.

   Phase 2 builds the environments the character actually needs today: the
   study desk, the bedroom and the rest area. Every other area is declared in
   LQMapper.ROOMS with `built:false` and renders as an honest pixel silhouette
   with its name and its phase — the character is never shown doing something
   the room cannot yet depict.
   ========================================================================== */
(function () {
  "use strict";

  var W = 960, H = 540, FLOOR = 432;
  var P = 4;                                    /* one pixel, in scene units */

  /* ------------------------------------------------------------ pixel tools
     Everything is emitted through these so the grid cannot drift. x/y/w/h are
     PIXELS; the helpers multiply by P. Nothing else in this file may write a
     coordinate. */
  function px(x, y, w, h, cls, extra) {
    return '<rect x="' + (x * P) + '" y="' + (y * P) + '" width="' + (w * P) + '" height="' + (h * P) + '"' +
      (cls ? ' class="' + cls + '"' : "") + (extra || "") + "/>";
  }
  /* a checker-dithered block: one rect filled from a 2×2 pattern tile */
  function dith(x, y, w, h, id, cls) {
    return '<rect x="' + (x * P) + '" y="' + (y * P) + '" width="' + (w * P) + '" height="' + (h * P) + '"' +
      ' fill="url(#' + id + ')"' + (cls ? ' class="' + cls + '"' : "") + "/>";
  }
  /* a filled pixel disc (sun, moon, clock face) — rows of whole pixels */
  function disc(cx, cy, r, cls) {
    var s = "";
    for (var dy = -r; dy < r; dy++) {
      var hw = Math.max(1, Math.round(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5))));
      s += px(cx - hw, cy + dy, hw * 2, 1, cls);
    }
    return s;
  }
  /* a small pixel blob (cloud, cushion, leaf mass) from a row table */
  function blob(cx, cy, rows, cls) {
    var s = "";
    for (var i = 0; i < rows.length; i++) s += px(cx - (rows[i] >> 1), cy + i, rows[i], 1, cls);
    return s;
  }

  /* ------------------------------------------------------------- sky tones
     The sky is four flat bands whose greys follow the real clock, stitched
     with dither rows. `tone` is 0 (deep night) … 1 (bright noon). */
  function bands(tone) {
    /* index into the grey ramp: base band + three above it */
    var b = Math.round(tone * 6);
    return [b, b + 1, b + 2, b + 3];
  }
  function skyAt(min) {
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    /* piecewise light curve: night → dawn → noon → dusk → night */
    var t;
    if (min < 300) t = 0;
    else if (min < 420) t = (min - 300) / 120 * 0.45;
    else if (min < 660) t = 0.45 + (min - 420) / 240 * 0.55;
    else if (min < 1020) t = 1;
    else if (min < 1140) t = 1 - (min - 1020) / 120 * 0.55;
    else if (min < 1290) t = 0.45 - (min - 1140) / 150 * 0.45;
    else t = 0;
    var stars = t < 0.18 ? 1 - t / 0.18 : 0;
    return {
      min: min, tone: t, bands: bands(t), night: t < 0.22, stars: stars,
      glow: Math.max(0.12, t),
      /* kept for the HUD + tests: flat greys, never a hue */
      top: "grey", bot: "grey", sun: "grey"
    };
  }
  /* Sun/moon travel an arc across the window, snapped to whole pixels.
     Returns WINDOW-LOCAL scene units (the window is 200×130) so callers and
     tests can bounds-check it; windowView divides by P for the pixel grid. */
  function orbPos(min) {
    var day = (min - 330) / 780;                       /* ~05:30 → 18:30 */
    var t = day < 0 || day > 1 ? null : day;
    if (t === null) { var nt = ((min < 330 ? min + 1440 : min) - 1110) / 780; t = nt; }
    t = Math.max(0, Math.min(1, t));
    /* window-local PIXELS (the pane is 30×22): whole pixels only */
    return {
      x: Math.round(5 + t * 20),
      y: Math.round(17 - Math.sin(t * Math.PI) * 11),
      isMoon: min < 330 || min > 1110
    };
  }

  /* ------------------------------------------------------------- star field
     Deterministic 1-pixel stars; CSS twinkles them in discrete steps. */
  function stars(seed) {
    var s = "", r = seed || 7;
    for (var i = 0; i < 12; i++) {
      r = (r * 9301 + 49297) % 233280; var f = r / 233280;
      r = (r * 9301 + 49297) % 233280; var g = r / 233280;
      s += px(Math.round(2 + f * 26), Math.round(2 + g * 8), 1, 1, "lq-star",
        ' style="--d:' + (i * 0.31).toFixed(2) + 's"');
    }
    return s;
  }

  /* -------------------------------------------------------------- the window
     48×32 pixel pane: four sky bands, dither seams, a pixel sun or moon,
     stepped hills, blocky clouds. The frame and muntins are 1-pixel lines. */
  function windowView(sky, opts) {
    var o = orbPos(sky.min);
    var b = sky.bands;
    var defs =
      '<defs>' +
        '<pattern id="lqDithA" width="' + (2 * P) + '" height="' + (2 * P) + '" patternUnits="userSpaceOnUse">' +
          px(0, 0, 1, 1, "lq-d1") + px(1, 1, 1, 1, "lq-d1") +
        '</pattern>' +
        '<pattern id="lqDithB" width="' + (2 * P) + '" height="' + (2 * P) + '" patternUnits="userSpaceOnUse">' +
          px(0, 0, 2, 1, "lq-d2") + px(0, 1, 1, 1, "lq-d2") + px(1, 1, 1, 1, "lq-d3") +
        '</pattern>' +
        '<pattern id="lqGlow" width="' + (2 * P) + '" height="' + (2 * P) + '" patternUnits="userSpaceOnUse">' +
          px(0, 0, 1, 1, "lq-glowpx") + px(1, 1, 1, 1, "lq-glowpx") +
        '</pattern>' +
      '</defs>';
    return defs +
      '<g class="lq-win">' +
        px(0, 0, 30, 5, "lq-sky g" + b[0]) + dith(0, 5, 30, 1, "lqDithA") +
        px(0, 6, 30, 4, "lq-sky g" + b[1]) + dith(0, 10, 30, 1, "lqDithA") +
        px(0, 11, 30, 5, "lq-sky g" + b[2]) + dith(0, 16, 30, 1, "lqDithB") +
        px(0, 17, 30, 5, "lq-sky g" + b[3]) +
        '<g class="lq-stars" opacity="' + sky.stars.toFixed(2) + '">' + stars(opts && opts.seed) + '</g>' +
        (o.isMoon
          ? dith(o.x - 3, o.y - 3, 7, 7, "lqDithB", "lq-orbhalo") + disc(o.x, o.y, 2, "lq-orb") + px(o.x - 2, o.y - 2, 2, 1, "lq-sky g" + b[0])
          : dith(o.x - 4, o.y - 4, 8, 8, "lqDithB", "lq-orbhalo") + disc(o.x, o.y, 3, "lq-orb")) +
        '<g class="lq-clouds">' +
          '<g class="lq-cloud">' + blob(8, 4, [3, 6, 7], "lq-cloud") + '</g>' +
          '<g class="lq-cloud c2">' + blob(20, 9, [4, 8, 9, 6], "lq-cloud") + '</g>' +
        '</g>' +
        px(0, 16, 30, 6, "lq-hill3") + px(3, 15, 6, 1, "lq-hill3") + px(18, 14, 8, 2, "lq-hill3") +
        px(0, 18, 30, 4, "lq-hill2") + px(8, 17, 9, 1, "lq-hill2") +
        px(0, 20, 30, 2, "lq-hill1") + px(4, 19, 6, 1, "lq-hill1") + px(16, 19, 7, 1, "lq-hill1") +
      '</g>' +
      px(0, 0, 30, 1, "lq-frame") + px(0, 21, 30, 1, "lq-frame") +
      px(0, 0, 1, 22, "lq-frame") + px(29, 0, 1, 22, "lq-frame") +
      px(15, 1, 1, 20, "lq-muntin") + px(1, 11, 28, 1, "lq-muntin");
  }

  /* ------------------------------------------------------------------ study
     The one desk. Bookshelf, lamp, chair, rug, window. Identical for every
     academic subject — only `.lq-props` (deskProps) changes. */
  function study(sky, opts) {
    opts = opts || {};
    var lampOn = sky.night || opts.lamp;
    var fy = FLOOR / P;                                   /* floor line, px */
    return '' +
      px(0, 0, W / P, fy, "lq-wall") +
      dith(0, Math.round(fy * 0.58), W / P, 2, "lqDithB", "lq-wallseam") +
      px(0, fy, W / P, H / P - fy, "lq-floor") +
      px(0, fy, W / P, 1, "lq-skirt") +
      px(20, fy + 6, 26, 1, "lq-floor2") + px(70, fy + 12, 30, 1, "lq-floor2") +
      px(130, fy + 6, 24, 1, "lq-floor2") + px(180, fy + 14, 26, 1, "lq-floor2") +
      /* window, sill well above the desk */
      '<g transform="translate(' + (96 * P) + ',' + ((fy - 40) * P) + ')">' + windowView(sky, opts) + '</g>' +
      /* bookshelf: taller than him, as a shelf should be (46 px vs 24 px) */
      '<g class="lq-shelf" transform="translate(' + (14 * P) + ',' + ((fy - 46) * P) + ')">' +
        px(0, 0, 26, 46, "lq-wood") + px(2, 2, 22, 42, "lq-wood2") +
        [0, 1, 2, 3].map(function (r) {
          var y = 3 + r * 11, s2 = "";
          for (var i = 0; i < 7; i++) {
            var bw = 2 + ((i * 5 + r) % 2), bh = 6 + ((i * 7 + r * 3) % 3);
            s2 += px(3 + i * 3, y + (9 - bh), bw, bh, "lq-bk b" + ((i + r) % 4));
          }
          return s2 + px(2, y + 9, 22, 2, "lq-wood");
        }).join("") +
      '</g>' +
      /* framed pixel picture */
      '<g transform="translate(' + (60 * P) + ',' + ((fy - 34) * P) + ')">' +
        px(0, 0, 12, 9, "lq-frame2") + px(1, 1, 10, 7, "lq-art") +
        px(3, 5, 2, 2, "lq-art2") + px(5, 4, 2, 3, "lq-art2") + px(8, 2, 2, 2, "lq-art2") +
      '</g>' +
      /* plant */
      '<g class="lq-plant" transform="translate(' + (78 * P) + ',' + ((fy - 12) * P) + ')">' +
        px(2, 8, 5, 4, "lq-pot") + px(3, 7, 3, 1, "lq-pot") +
        px(4, 3, 1, 4, "lq-leaf") + px(1, 1, 3, 3, "lq-leaf") + px(5, 0, 3, 4, "lq-leaf") +
      '</g>' +
      /* rug under the desk chair */
      px(120, fy + 3, 44, 6, "lq-rug") + px(124, fy + 2, 36, 1, "lq-rug") + px(124, fy + 9, 36, 1, "lq-rug") +
      dith(120, fy + 3, 44, 1, "lqDithB", "lq-rug2") + dith(120, fy + 8, 44, 1, "lqDithB", "lq-rug2") +
      /* chair: seat at 6 px, back to 18 px — his scale */
      '<g class="lq-chair" transform="translate(' + (143 * P) + ',' + ((fy - 6) * P) + ')">' +
        px(0, -10, 3, 12, "lq-wood") + px(-1, -12, 5, 2, "lq-wood") +
        px(1, 0, 10, 2, "lq-wood") + px(2, 2, 2, 4, "lq-wood2") + px(8, 2, 2, 4, "lq-wood2") +
      '</g>' +
      /* desk: 34 px wide, top at 10 px — a desk for a 24-px person */
      '<g class="lq-desk">' +
        px(133, fy - 10, 34, 2, "lq-wood") +
        '<g class="lq-lamp" transform="translate(' + (161 * P) + ',' + ((fy - 16) * P) + ')">' +
          px(0, 6, 5, 1, "lq-metal") + px(2, 3, 1, 3, "lq-metal") +
          px(1, 1, 4, 2, "lq-shade") + px(2, 0, 2, 1, "lq-shade") +
          (lampOn ? dith(0, 3, 7, 5, "lqGlow", "lq-lampglow") : "") +
        '</g>' +
      '</g>' +
      /* crate beside the desk */
      px(172, fy - 6, 8, 6, "lq-wood2") + px(172, fy - 6, 8, 1, "lq-wood");
  }
  /* The desk front panel is drawn after the character so a seated figure is
     correctly occluded — this is what keeps one desk for every subject. */
  function studyFront() {
    var fy = FLOOR / P;
    return '<g class="lq-deskfront">' +
      px(133, fy - 8, 34, 8, "lq-wood3") +
      dith(133, fy - 8, 34, 1, "lqDithB", "lq-woodseam") +
      '</g>';
  }

  /* ---------------------------------------------------------------- bedroom */
  function bedroom(sky, opts) {
    opts = opts || {};
    var fy = FLOOR / P;
    return '' +
      px(0, 0, W / P, fy, "lq-wall") +
      dith(0, Math.round(fy * 0.58), W / P, 2, "lqDithB", "lq-wallseam") +
      px(0, fy, W / P, H / P - fy, "lq-floor") +
      px(0, fy, W / P, 1, "lq-skirt") +
      '<g transform="translate(' + (120 * P) + ',' + ((fy - 38) * P) + ')">' + windowView(sky, opts) + '</g>' +
      px(96, fy + 3, 40, 6, "lq-rug") + px(100, fy + 2, 32, 1, "lq-rug") + px(100, fy + 9, 32, 1, "lq-rug") +
      /* bed: 34 px long, blanket top where the rig lies */
      '<g class="lq-bed" transform="translate(' + (116 * P) + ',' + ((fy - 8) * P) + ')">' +
        px(0, -6, 3, 14, "lq-wood2") +
        px(3, 0, 28, 5, "lq-blanket") + px(3, 2, 28, 1, "lq-fold") +
        px(4, -2, 7, 3, "lq-pillow") +
        px(3, 5, 28, 2, "lq-wood2") +
        px(4, 7, 2, 1, "lq-wood2") + px(27, 7, 2, 1, "lq-wood2") +
        px(31, -3, 3, 10, "lq-wood2") +
      '</g>' +
      /* bedside table + lamp, head side */
      '<g transform="translate(' + (104 * P) + ',' + ((fy - 8) * P) + ')">' +
        px(0, 0, 9, 2, "lq-wood") + px(1, 2, 7, 4, "lq-wood2") + px(1, 6, 1, 2, "lq-wood2") + px(7, 6, 1, 2, "lq-wood2") +
        '<g class="lq-lamp" transform="translate(' + (3 * P) + ',' + (-6 * P) + ')">' +
          px(0, 5, 4, 1, "lq-metal") + px(1, 2, 1, 3, "lq-metal") + px(0, 0, 4, 2, "lq-shade") +
          (sky.night ? dith(-1, 2, 6, 4, "lqGlow", "lq-lampglow dim") : "") +
        '</g>' +
      '</g>' +
      /* plant */
      '<g class="lq-plant" transform="translate(' + (204 * P) + ',' + ((fy - 12) * P) + ')">' +
        px(2, 8, 5, 4, "lq-pot") + px(3, 7, 3, 1, "lq-pot") +
        px(4, 3, 1, 4, "lq-leaf") + px(1, 1, 3, 3, "lq-leaf") + px(5, 0, 3, 4, "lq-leaf") +
      '</g>';
  }

  /* -------------------------------------------------------------- rest area */
  function rest(sky, opts) {
    opts = opts || {};
    var fy = FLOOR / P;
    return '' +
      px(0, 0, W / P, fy, "lq-wall") +
      dith(0, Math.round(fy * 0.58), W / P, 2, "lqDithB", "lq-wallseam") +
      px(0, fy, W / P, H / P - fy, "lq-floor") +
      px(0, fy, W / P, 1, "lq-skirt") +
      '<g transform="translate(' + (130 * P) + ',' + ((fy - 38) * P) + ')">' + windowView(sky, opts) + '</g>' +
      px(84, fy + 3, 40, 6, "lq-rug") + px(88, fy + 2, 32, 1, "lq-rug") + px(88, fy + 9, 32, 1, "lq-rug") +
      /* armchair: 16 px across, back to 14 px — one person, not five */
      '<g class="lq-armchair" transform="translate(' + (92 * P) + ',' + (fy * P) + ')">' +
        px(2, -14, 12, 10, "lq-chairc") +
        px(0, -9, 3, 9, "lq-chairc") + px(13, -9, 3, 9, "lq-chairc") +
        px(2, -6, 12, 3, "lq-chairc2") + px(2, -5, 12, 1, "lq-fold") +
        px(3, -1, 2, 1, "lq-wood2") + px(11, -1, 2, 1, "lq-wood2") +
      '</g>' +
      /* side table with a pixel cup */
      '<g transform="translate(' + (112 * P) + ',' + ((fy - 8) * P) + ')">' +
        px(0, 0, 9, 2, "lq-wood") + px(1, 2, 7, 4, "lq-wood2") + px(1, 6, 1, 2, "lq-wood2") + px(7, 6, 1, 2, "lq-wood2") +
        px(3, -4, 3, 3, "lq-cup") + px(6, -3, 1, 1, "lq-cup") +
      '</g>' +
      /* stool at the side table (meals, chess) */
      px(114, fy - 6, 8, 2, "lq-wood") + px(115, fy - 4, 1, 4, "lq-wood2") + px(120, fy - 4, 1, 4, "lq-wood2") +
      /* big plant */
      '<g class="lq-plant big" transform="translate(' + (58 * P) + ',' + ((fy - 14) * P) + ')">' +
        px(3, 10, 6, 4, "lq-pot") + px(5, 4, 1, 6, "lq-leaf") +
        px(1, 2, 4, 4, "lq-leaf") + px(7, 1, 4, 5, "lq-leaf") + px(4, 0, 3, 3, "lq-leaf") +
      '</g>';
  }

  /* ------------------------------------------- honest placeholder for later
     The note promises he is shown at the study desk, so that is exactly what
     renders: the real desk, dimmed behind a night wash, with the silhouette of
     the place he cannot enter yet and the phase it arrives in. Nothing faked. */
  function unbuilt(name, phase, sky) {
    var fy = FLOOR / P;
    return study(sky, { lamp: true }) +
      px(0, 0, W / P, H / P, "lq-voidwash") +
      '<g opacity=".5">' +
        px(0, fy + 5, W / P, 1, "lq-horizon") +
        /* three stepped silhouettes: a hall, a block, a dome — nothing more */
        px(30, fy - 28, 22, 33, "lq-silhouette") + px(34, fy - 42, 14, 14, "lq-silhouette") +
        px(118, fy - 20, 36, 25, "lq-silhouette") +
        px(180, fy - 34, 30, 39, "lq-silhouette") + px(186, fy - 40, 18, 6, "lq-silhouette") +
      '</g>' +
      dith(0, fy + 6, W / P, 3, "lqDithB", "lq-voidfade") +
      '<g class="lq-unbuilt-note" transform="translate(' + (W / 2) + ',120)">' +
        '<text class="lq-t1" text-anchor="middle">' + esc(name) + '</text>' +
        '<text class="lq-t2" text-anchor="middle" y="30">This environment arrives in Phase ' + phase + '.</text>' +
        '<text class="lq-t3" text-anchor="middle" y="56">Nothing is invented: the character is shown at the study desk instead.</text>' +
      '</g>';
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>\"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var BUILDERS = { study: study, bedroom: bedroom, rest: rest };

  /* Character anchor per room + spot (feet position in scene units). */
  var SPOTS = {
    "study|desk":     { x: 600, y: FLOOR, sit: true,  scale: 1.00, cam: { x: 360, y: 170, w: 480 } },
    /* head of the lying rig rests on the bed's pillow */
    "bedroom|bed":    { x: 520, y: FLOOR - 32, sit: false, scale: 0.98, cam: { x: 280, y: 168, w: 480 } },
    /* feet on the floor, hips on the cushion top (fy-8) */
    "rest|chair":     { x: 400, y: FLOOR, sit: true,  scale: 1.00, cam: { x: 176, y: 168, w: 480 } },
    "rest|open":      { x: 620, y: FLOOR, sit: false, scale: 1.00, cam: { x: 380, y: 160, w: 480 } },
    /* in the armchair, at the side table: meals, chess, a quiet think */
    "rest|table":     { x: 470, y: FLOOR, sit: true,  scale: 1.00, cam: { x: 230, y: 168, w: 480 } }
  };
  function spot(room, sp) {
    return SPOTS[room + "|" + sp] || SPOTS["study|desk"];
  }

  /* ------------------------------------------------------------- scene build
     Returns {back, front, char, ambient, sky} layer markup so the renderer can
     place the character BETWEEN the desk back and the desk front panel. */
  function scene(mapped, opt) {
    opt = opt || {};
    var m = mapped || {};
    var room = m.room || "study";
    var R = (window.LQMapper && window.LQMapper.ROOMS) || {};
    var def = R[room] || { name: room, built: false, phase: "?" };
    var built = !!def.built && !!BUILDERS[room];
    var sky = skyAt(opt.minute === undefined ? currentMinute() : opt.minute);
    var useRoom = built ? room : "study";
    var o = { seed: 11, lamp: opt.lamp };

    var back = built ? BUILDERS[room](sky, o) : unbuilt(def.name, def.phase, sky);
    var front = "";
    if (built && room === "study") front = studyFront();
    /* character is drawn at the fallback spot when the room is not built yet */
    var place = built ? spot(room, m.spot) : spot("study", "desk");

    /* ambient life: five drifting dust pixels, and a flat night wash */
    var ambient = opt.ambient === false ? "" :
      '<g class="lq-motes">' + [0, 1, 2, 3, 4].map(function (i) {
        return px(40 + i * 41, 45 + (i % 3) * 15, 1, 1, "lq-mote",
          ' style="--d:' + (i * 1.7).toFixed(1) + 's;--x:' + (18 + i * 7) + 'px"');
      }).join("") + '</g>' +
      (sky.night ? px(0, 0, W / P, H / P, "lq-nightwash") : "");

    return {
      room: room, useRoom: useRoom, built: built, def: def, sky: sky,
      back: back, front: front, ambient: ambient, place: place,
      note: built ? "" : (m.note || def.name + " is not built yet"),
      lampOn: sky.night || !!opt.lamp
    };
  }

  function currentMinute() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

  window.LQWorld = {
    W: W, H: H, FLOOR: FLOOR, P: P, skyAt: skyAt, orbPos: orbPos, scene: scene,
    spot: spot, SPOTS: SPOTS, currentMinute: currentMinute, esc: esc,
    px: px, dith: dith, disc: disc,
    rooms: function () { return Object.keys(BUILDERS); }
  };
})();
