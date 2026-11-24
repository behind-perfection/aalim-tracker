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
    var x = Math.round((40 + t * 120) / P) * P;        /* whole pixels */
    var y = Math.round((110 - Math.sin(t * Math.PI) * 68) / P) * P;
    return { x: x, y: y, isMoon: min < 330 || min > 1110 };
  }

  /* ------------------------------------------------------------- star field
     Deterministic 1-pixel stars; CSS twinkles them in discrete steps. */
  function stars(seed) {
    var s = "", r = seed || 7;
    for (var i = 0; i < 18; i++) {
      r = (r * 9301 + 49297) % 233280; var f = r / 233280;
      r = (r * 9301 + 49297) % 233280; var g = r / 233280;
      s += px(Math.round(2 + f * 44), Math.round(2 + g * 14), 1, 1, "lq-star",
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
        /* sky bands, top to bottom, each 8 px with a 1 px dither seam */
        px(0, 0, 48, 8, "lq-sky g" + b[0]) +
        dith(0, 8, 48, 1, "lqDithA") +
        px(0, 9, 48, 7, "lq-sky g" + b[1]) +
        dith(0, 16, 48, 1, "lqDithA") +
        px(0, 17, 48, 7, "lq-sky g" + b[2]) +
        dith(0, 24, 48, 1, "lqDithB") +
        px(0, 25, 48, 7, "lq-sky g" + b[3]) +
        /* stars over the night bands */
        '<g class="lq-stars" opacity="' + sky.stars.toFixed(2) + '">' + stars(opts && opts.seed) + '</g>' +
        /* sun or moon, a pixel disc with a 1 px crescent cut for the moon */
        (function (ox, oy) {
          return o.isMoon
            ? dith(ox - 4, oy - 4, 8, 8, "lqDithB", "lq-orbhalo") + disc(ox, oy, 3, "lq-orb") + px(ox - 1, oy - 2, 2, 2, "lq-sky g" + b[0])
            : dith(ox - 5, oy - 5, 10, 10, "lqDithB", "lq-orbhalo") + disc(ox, oy, 4, "lq-orb");
        })(Math.round(o.x / P), Math.round(o.y / P)) +
        /* clouds: three blocky rows each, drifting in whole pixels */
        '<g class="lq-clouds">' +
          '<g class="lq-cloud">' + blob(10, 6, [4, 8, 10], "lq-cloud") + '</g>' +
          '<g class="lq-cloud c2">' + blob(32, 12, [6, 12, 14, 10], "lq-cloud") + '</g>' +
        '</g>' +
        /* hills: stepped silhouettes, three depths */
        px(0, 24, 48, 8, "lq-hill3") + px(4, 22, 10, 2, "lq-hill3") + px(28, 21, 12, 3, "lq-hill3") +
        px(0, 27, 48, 5, "lq-hill2") + px(12, 25, 14, 2, "lq-hill2") + px(36, 26, 8, 1, "lq-hill2") +
        px(0, 30, 48, 2, "lq-hill1") + px(6, 29, 8, 1, "lq-hill1") + px(24, 29, 10, 1, "lq-hill1") +
      '</g>' +
      /* frame + muntins: 1-pixel lines, drawn last so they stay crisp */
      px(0, 0, 48, 1, "lq-frame") + px(0, 31, 48, 1, "lq-frame") +
      px(0, 0, 1, 32, "lq-frame") + px(47, 0, 1, 32, "lq-frame") +
      px(24, 1, 1, 30, "lq-muntin") + px(1, 16, 46, 1, "lq-muntin");
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
      /* floorboard seams every 12 px */
      px(20, fy + 6, 26, 1, "lq-floor2") + px(70, fy + 12, 30, 1, "lq-floor2") +
      px(130, fy + 6, 24, 1, "lq-floor2") + px(180, fy + 14, 26, 1, "lq-floor2") +
      /* window */
      '<g transform="translate(' + (176 * P) + ',' + (30 * P) + ')">' + windowView(sky, opts) + '</g>' +
      /* bookshelf: 4 shelves of spines in four greys */
      '<g class="lq-shelf" transform="translate(' + (18 * P) + ',' + (38 * P) + ')">' +
        px(0, 0, 58, 71, "lq-wood") + px(2, 2, 54, 67, "lq-wood2") +
        [0, 1, 2, 3].map(function (r) {
          var y = 4 + r * 17, s = "";
          for (var i = 0; i < 12; i++) {
            var bw = 2 + ((i * 7 + r * 5) % 3), bh = 10 + ((i * 11 + r * 3) % 4);
            s += px(3 + i * 4.4 | 0, y + (13 - bh), bw, bh, "lq-bk b" + ((i + r) % 4));
          }
          return s + px(2, y + 13, 54, 2, "lq-wood");
        }).join("") +
      '</g>' +
      /* framed pixel picture: a tiny mountain and sun */
      '<g transform="translate(' + (90 * P) + ',' + (42 * P) + ')">' +
        px(0, 0, 22, 16, "lq-frame2") + px(1, 1, 20, 14, "lq-art") +
        px(4, 9, 3, 4, "lq-art2") + px(7, 7, 3, 6, "lq-art2") + px(10, 10, 3, 3, "lq-art2") +
        px(15, 3, 3, 3, "lq-art2") +
      '</g>' +
      /* plant: pot + three blocky fronds */
      '<g class="lq-plant" transform="translate(' + (82 * P) + ',' + (fy - 16) * P + ')">' +
        px(2, 10, 8, 6, "lq-pot") + px(3, 9, 6, 1, "lq-pot") +
        px(5, 4, 2, 6, "lq-leaf") + px(2, 2, 3, 3, "lq-leaf") + px(7, 1, 3, 4, "lq-leaf") +
      '</g>' +
      /* rug: a stepped pixel oval with a dithered border */
      '<g class="lq-rugwrap">' +
        px(116, fy + 4, 68, 12, "lq-rug") + px(122, fy + 2, 56, 2, "lq-rug") + px(122, fy + 16, 56, 2, "lq-rug") +
        dith(116, fy + 4, 68, 1, "lqDithB", "lq-rug2") + dith(116, fy + 15, 68, 1, "lqDithB", "lq-rug2") +
      '</g>' +
      /* chair behind the desk: seat at fy-8, exactly where the rig sits */
      '<g class="lq-chair" transform="translate(' + (142 * P) + ',' + (fy - 6) * P + ')">' +
        px(13, -16, 3, 16, "lq-wood2") + px(11, -18, 7, 2, "lq-wood2") +
        px(1, 0, 16, 2, "lq-wood") + px(2, 2, 2, 4, "lq-wood2") + px(14, 2, 2, 4, "lq-wood2") +
      '</g>' +
      /* desk: top at fy-12, front panel down to the floor; lamp on the left */
      '<g class="lq-desk">' +
        px(108, fy - 12, 95, 2, "lq-wood") +
        '<g class="lq-lamp" transform="translate(' + (190 * P) + ',' + (fy - 23) * P + ')">' +
          px(0, 10, 7, 1, "lq-metal") + px(3, 4, 1, 6, "lq-metal") +
          px(1, 1, 8, 3, "lq-shade") + px(2, 0, 6, 1, "lq-shade") +
          (lampOn ? dith(-3, 4, 13, 8, "lqGlow", "lq-lampglow") : "") +
        '</g>' +
        px(176, fy - 17, 12, 5, "lq-wood2") +
      '</g>';
  }
  /* The desk front panel is drawn after the character so a seated figure is
     correctly occluded — this is what keeps one desk for every subject. */
  function studyFront() {
    var fy = FLOOR / P;
    return '<g class="lq-deskfront">' +
      px(108, fy - 10, 95, 10, "lq-wood3") +
      px(108, fy - 12, 95, 2, "lq-wood") +
      dith(108, fy - 10, 95, 1, "lqDithB", "lq-woodseam") +
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
      '<g transform="translate(' + (120 * P) + ',' + (30 * P) + ')">' + windowView(sky, opts) + '</g>' +
      /* rug */
      px(108, fy + 4, 62, 11, "lq-rug") + px(114, fy + 2, 50, 2, "lq-rug") + px(114, fy + 15, 50, 2, "lq-rug") +
      /* bed: headboard, frame, blanket whose top is where the rig lies */
      '<g class="lq-bed" transform="translate(' + (108 * P) + ',' + (fy - 18) * P + ')">' +
        px(-2, -12, 5, 20, "lq-wood2") + px(80, -4, 4, 12, "lq-wood2") +
        px(4, 0, 75, 8, "lq-blanket") +
        px(4, 3, 75, 1, "lq-fold") +
        px(7, -3, 18, 4, "lq-pillow") +
        px(4, 8, 75, 2, "lq-wood2") +
        px(5, 10, 3, 8, "lq-wood2") + px(76, 10, 3, 8, "lq-wood2") +
      '</g>' +
      /* bedside table + lamp, head side of the bed */
      '<g transform="translate(' + (88 * P) + ',' + (fy - 12) * P + ')">' +
        px(0, 0, 18, 10, "lq-wood2") + px(1, 3, 16, 2, "lq-wood") + px(2, 10, 2, 2, "lq-wood2") + px(14, 10, 2, 2, "lq-wood2") +
        '<g class="lq-lamp" transform="translate(' + 6 * P + ',' + -9 * P + ')">' +
          px(0, 8, 6, 1, "lq-metal") + px(2, 4, 1, 4, "lq-metal") + px(1, 1, 5, 3, "lq-shade") + px(2, 0, 3, 1, "lq-shade") +
          (sky.night ? dith(0, 3, 8, 6, "lqGlow", "lq-lampglow dim") : "") +
        '</g>' +
      '</g>' +
      /* plant */
      '<g class="lq-plant" transform="translate(' + (204 * P) + ',' + (fy - 14) * P + ')">' +
        px(2, 8, 7, 6, "lq-pot") + px(4, 3, 2, 5, "lq-leaf") + px(1, 1, 3, 3, "lq-leaf") + px(6, 0, 3, 4, "lq-leaf") +
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
      '<g transform="translate(' + (166 * P) + ',' + (33 * P) + ')">' + windowView(sky, opts) + '</g>' +
      px(82, fy + 4, 64, 11, "lq-rug") + px(88, fy + 2, 52, 2, "lq-rug") + px(88, fy + 15, 52, 2, "lq-rug") +
      /* armchair: seat cushion top at fy-8, exactly where the rig reclines */
      '<g class="lq-armchair" transform="translate(' + (82 * P) + ',' + fy * P + ')">' +
        px(4, -22, 38, 14, "lq-chairc") +
        px(0, -12, 8, 14, "lq-chairc") + px(38, -12, 8, 14, "lq-chairc") +
        px(4, -6, 38, 4, "lq-chairc2") + px(4, -5, 38, 1, "lq-fold") +
        px(6, 2, 3, 2, "lq-wood2") + px(37, 2, 3, 2, "lq-wood2") +
      '</g>' +
      /* side table with a pixel cup */
      '<g transform="translate(' + (124 * P) + ',' + (fy - 12) * P + ')">' +
        px(0, 0, 17, 2, "lq-wood") + px(1, 2, 15, 8, "lq-wood2") + px(2, 10, 2, 2, "lq-wood2") + px(13, 10, 2, 2, "lq-wood2") +
        px(6, -4, 5, 4, "lq-cup") + px(11, -3, 2, 2, "lq-cup") +
      '</g>' +
      /* big plant */
      '<g class="lq-plant big" transform="translate(' + (38 * P) + ',' + (fy - 24) * P + ')">' +
        px(4, 16, 10, 8, "lq-pot") + px(8, 8, 2, 8, "lq-leaf") +
        px(3, 4, 5, 5, "lq-leaf") + px(10, 2, 5, 6, "lq-leaf") + px(6, 0, 4, 4, "lq-leaf") +
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
    "bedroom|bed":    { x: 540, y: FLOOR - 62, sit: false, scale: 0.98, cam: { x: 300, y: 160, w: 480 } },
    /* feet on the floor, hips on the cushion top (fy-8) */
    "rest|chair":     { x: 400, y: FLOOR, sit: true,  scale: 1.00, cam: { x: 160, y: 168, w: 480 } },
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
