/* ============================================================================
   LIFEQUEST · lq-world.js
   Layered SVG environments + day/night + ambient life.

   Phase 2 builds the environments the character actually needs today:
   the study desk (all academic work), the bedroom (sleep/wake) and the rest
   area (breaks, untracked time). Every other area is declared in LQMapper.ROOMS
   with `built:false` and renders as an honest, minimal "not built yet" scene —
   the character is never shown doing something the room cannot yet depict.
   ========================================================================== */
(function () {
  "use strict";

  var W = 960, H = 540, FLOOR = 432;

  /* ------------------------------------------------------------ sky palettes
     Muted, atmospheric stops. Interpolated by minute-of-day so the light
     follows the real clock (or the replay clock). */
  var SKY = [
    { m: 0,    top: "#0b1020", bot: "#161c30", sun: "#dfe6f5", glow: 0.00, stars: 1 },
    { m: 270,  top: "#101a33", bot: "#2a2c46", sun: "#e6dcf0", glow: 0.05, stars: 1 },
    { m: 360,  top: "#3a4468", bot: "#c98a6a", sun: "#ffd9a8", glow: 0.45, stars: 0.35 },
    { m: 450,  top: "#6d8fc0", bot: "#e8c9a0", sun: "#fff0cf", glow: 0.85, stars: 0 },
    { m: 720,  top: "#7fa6d6", bot: "#dfe8f2", sun: "#fffbe8", glow: 1.00, stars: 0 },
    { m: 1020, top: "#6f92c4", bot: "#e6d7c0", sun: "#fff3d6", glow: 0.90, stars: 0 },
    { m: 1140, top: "#4a5580", bot: "#d99a72", sun: "#ffd0a0", glow: 0.45, stars: 0.15 },
    { m: 1230, top: "#232a48", bot: "#5a4a63", sun: "#e8d6ea", glow: 0.10, stars: 0.7 },
    { m: 1440, top: "#0b1020", bot: "#161c30", sun: "#dfe6f5", glow: 0.00, stars: 1 }
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex2rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(c1, c2, t) {
    var a = hex2rgb(c1), b = hex2rgb(c2);
    return "rgb(" + Math.round(lerp(a[0], b[0], t)) + "," + Math.round(lerp(a[1], b[1], t)) + "," + Math.round(lerp(a[2], b[2], t)) + ")";
  }
  function skyAt(min) {
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    for (var i = 0; i < SKY.length - 1; i++) {
      if (min >= SKY[i].m && min <= SKY[i + 1].m) {
        var t = (min - SKY[i].m) / Math.max(1, SKY[i + 1].m - SKY[i].m), a = SKY[i], b = SKY[i + 1];
        return {
          top: mix(a.top, b.top, t), bot: mix(a.bot, b.bot, t), sun: mix(a.sun, b.sun, t),
          glow: lerp(a.glow, b.glow, t), stars: lerp(a.stars, b.stars, t), min: min,
          night: lerp(a.stars, b.stars, t) > 0.5
        };
      }
    }
    return { top: SKY[0].top, bot: SKY[0].bot, sun: SKY[0].sun, glow: 0, stars: 1, min: min, night: true };
  }
  /* Sun/moon travel an arc across the window. */
  function orbPos(min) {
    var day = (min - 330) / 780;                       // ~05:30 → 18:30
    var t = day < 0 || day > 1 ? null : day;
    if (t === null) { var nt = ((min < 330 ? min + 1440 : min) - 1110) / 780; t = nt; }
    t = Math.max(0, Math.min(1, t));
    return { x: 26 + t * 148, y: 118 - Math.sin(t * Math.PI) * 74, isMoon: min < 330 || min > 1110 };
  }

  /* ------------------------------------------------------------- shared bits */
  function stars(seed) {
    var s = "", r = seed || 7;
    for (var i = 0; i < 22; i++) {
      r = (r * 9301 + 49297) % 233280; var f = r / 233280;
      r = (r * 9301 + 49297) % 233280; var g = r / 233280;
      s += '<circle cx="' + (20 + f * 160).toFixed(1) + '" cy="' + (28 + g * 82).toFixed(1) + '" r="' + (0.5 + g * 0.8).toFixed(2) + '" class="lq-star" style="--d:' + (i * 0.31).toFixed(2) + 's"/>';
    }
    return s;
  }
  function windowView(sky, opts) {
    var o = orbPos(sky.min);
    return '' +
      '<defs>' +
        '<linearGradient id="lqSky" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="' + sky.top + '"/><stop offset="1" stop-color="' + sky.bot + '"/>' +
        '</linearGradient>' +
        '<clipPath id="lqWinClip"><rect x="0" y="0" width="200" height="130" rx="4"/></clipPath>' +
        '<radialGradient id="lqOrb"><stop offset="0" stop-color="' + sky.sun + '" stop-opacity=".95"/><stop offset="1" stop-color="' + sky.sun + '" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<g clip-path="url(#lqWinClip)">' +
        '<rect width="200" height="130" fill="url(#lqSky)"/>' +
        '<g class="lq-stars" opacity="' + sky.stars.toFixed(2) + '">' + stars(opts && opts.seed) + '</g>' +
        '<circle class="lq-orb" cx="' + o.x.toFixed(1) + '" cy="' + o.y.toFixed(1) + '" r="' + (o.isMoon ? 9 : 13) + '" fill="' + sky.sun + '" opacity="' + (0.35 + sky.glow * 0.6).toFixed(2) + '"/>' +
        '<circle cx="' + o.x.toFixed(1) + '" cy="' + o.y.toFixed(1) + '" r="' + (o.isMoon ? 22 : 34) + '" fill="url(#lqOrb)" opacity="' + (sky.glow * 0.5).toFixed(2) + '"/>' +
        /* distant hills — layered, muted, the Alto's-Adventure horizon */
        '<path d="M0 104q34-26 70-8t64-10 66 18v26H0z" class="lq-hill3" opacity=".55"/>' +
        '<path d="M0 114q46-20 92-4t108-8v32H0z" class="lq-hill2" opacity=".7"/>' +
        '<path d="M0 124q60-12 120 0t80-4v14H0z" class="lq-hill1"/>' +
        '<g class="lq-clouds"><ellipse cx="40" cy="34" rx="20" ry="6" class="lq-cloud"/><ellipse cx="132" cy="52" rx="26" ry="7" class="lq-cloud c2"/></g>' +
      '</g>' +
      '<rect width="200" height="130" rx="4" class="lq-frame"/>' +
      '<path d="M100 0v130M0 65h200" class="lq-muntin"/>';
  }

  /* ------------------------------------------------------------------ study
     The one desk. Bookshelf, lamp, chair, rug, window. Identical for every
     academic subject — only `.lq-props` (deskProps) changes. */
  function study(sky, opts) {
    opts = opts || {};
    var lampOn = sky.night || opts.lamp;
    return '' +
      '<rect class="lq-wall" x="0" y="0" width="' + W + '" height="' + FLOOR + '"/>' +
      '<rect class="lq-wall2" x="0" y="0" width="' + W + '" height="' + (FLOOR * 0.62) + '"/>' +
      '<rect class="lq-floor" x="0" y="' + FLOOR + '" width="' + W + '" height="' + (H - FLOOR) + '"/>' +
      '<path class="lq-skirt" d="M0 ' + FLOOR + 'h' + W + '"/>' +
      /* window */
      '<g transform="translate(700,120)">' + windowView(sky, opts) + '</g>' +
      /* bookshelf */
      '<g class="lq-shelf" transform="translate(70,150)">' +
        '<rect x="0" y="0" width="230" height="282" rx="4" class="lq-wood"/>' +
        '<rect x="8" y="8" width="214" height="266" class="lq-wood2"/>' +
        [0, 1, 2, 3].map(function (r) {
          var y = 18 + r * 64, s = "";
          for (var i = 0; i < 12; i++) {
            var bw = 9 + ((i * 7 + r * 5) % 8), bh = 40 + ((i * 11 + r * 3) % 14);
            s += '<rect x="' + (14 + i * 17) + '" y="' + (y + (54 - bh)) + '" width="' + bw + '" height="' + bh + '" rx="1.4" class="lq-bk b' + ((i + r) % 5) + '"/>';
          }
          return '<g>' + s + '<rect x="8" y="' + (y + 54) + '" width="214" height="6" class="lq-wood"/></g>';
        }).join("") +
      '</g>' +
      /* framed picture + small plant */
      '<g transform="translate(360,168)"><rect width="86" height="62" rx="3" class="lq-frame2"/><path d="M8 50q20-26 38-8t32-14" class="lq-art"/><circle cx="26" cy="20" r="7" class="lq-art2"/></g>' +
      '<g class="lq-plant" transform="translate(330,' + (FLOOR - 62) + ')"><path d="M14 62h26l-4-22H18z" class="lq-pot"/><path d="M27 40c0-14-8-22-18-24 2 14 8 22 18 24zM27 40c0-16 8-24 20-26-2 16-9 24-20 26z" class="lq-leaf"/></g>' +
      /* rug */
      '<ellipse class="lq-rug" cx="590" cy="' + (FLOOR + 46) + '" rx="250" ry="34"/>' +
      /* desk (back part) + chair */
      '<g class="lq-chair" transform="translate(566,' + (FLOOR - 118) + ')">' +
        '<rect x="-4" y="-58" width="72" height="10" rx="5" class="lq-wood"/>' +
        '<rect x="52" y="-58" width="10" height="86" rx="5" class="lq-wood"/>' +
        '<rect x="0" y="24" width="64" height="9" rx="4" class="lq-wood"/>' +
        '<path d="M6 33v84M58 33v84" class="lq-leg-l"/>' +
      '</g>' +
      '<g class="lq-desk">' +
        '<rect x="430" y="' + (FLOOR - 132) + '" width="380" height="14" rx="4" class="lq-wood"/>' +
        '<rect x="442" y="' + (FLOOR - 118) + '" width="12" height="118" class="lq-wood2"/>' +
        '<rect x="786" y="' + (FLOOR - 118) + '" width="12" height="118" class="lq-wood2"/>' +
        /* lamp */
        '<g class="lq-lamp" transform="translate(466,' + (FLOOR - 176) + ')">' +
          '<path d="M0 44h26" class="lq-metal"/><path d="M13 44V16" class="lq-metal"/><path d="M13 16q14-8 22 4l-10 12z" class="lq-shade"/>' +
          (lampOn ? '<ellipse class="lq-lampglow" cx="30" cy="34" rx="34" ry="26"/>' : '') +
        '</g>' +
        /* small stack holder on the left of the desk */
        '<rect x="742" y="' + (FLOOR - 150) + '" width="52" height="18" rx="3" class="lq-wood2"/>' +
      '</g>';
  }
  /* The desk front panel is drawn after the character so a seated figure is
     correctly occluded — this is what keeps one desk for every subject. */
  function studyFront() {
    return '<g class="lq-deskfront">' +
      '<rect x="430" y="' + (FLOOR - 122) + '" width="380" height="72" rx="4" class="lq-wood3"/>' +
      '<rect x="430" y="' + (FLOOR - 132) + '" width="380" height="14" rx="4" class="lq-wood"/>' +
      '</g>';
  }

  /* ---------------------------------------------------------------- bedroom */
  function bedroom(sky, opts) {
    opts = opts || {};
    return '' +
      '<rect class="lq-wall" x="0" y="0" width="' + W + '" height="' + FLOOR + '"/>' +
      '<rect class="lq-wall2" x="0" y="0" width="' + W + '" height="' + (FLOOR * 0.62) + '"/>' +
      '<rect class="lq-floor" x="0" y="' + FLOOR + '" width="' + W + '" height="' + (H - FLOOR) + '"/>' +
      '<g transform="translate(110,140) scale(0.82)">' + windowView(sky, opts) + '</g>' +
      '<ellipse class="lq-rug" cx="560" cy="' + (FLOOR + 44) + '" rx="230" ry="30"/>' +
      /* bed */
      '<g class="lq-bed" transform="translate(430,' + (FLOOR - 96) + ')">' +
        '<rect x="0" y="20" width="330" height="26" rx="6" class="lq-wood"/>' +
        '<rect x="-6" y="-46" width="18" height="92" rx="6" class="lq-wood2"/>' +
        '<rect x="318" y="-16" width="16" height="62" rx="6" class="lq-wood2"/>' +
        '<rect x="14" y="-8" width="300" height="34" rx="8" class="lq-blanket"/>' +
        '<rect x="26" y="-16" width="72" height="22" rx="9" class="lq-pillow"/>' +
        '<path d="M14 10h300" class="lq-fold"/>' +
      '</g>' +
      /* bedside table + lamp */
      '<g transform="translate(790,' + (FLOOR - 74) + ')"><rect width="70" height="52" rx="4" class="lq-wood2"/><rect x="6" y="14" width="58" height="6" rx="3" class="lq-wood"/>' +
      '<g class="lq-lamp" transform="translate(24,-30)"><path d="M0 30h22" class="lq-metal"/><path d="M11 30V10" class="lq-metal"/><path d="M11 10q12-7 19 3l-9 10z" class="lq-shade"/>' +
      (sky.night ? '<ellipse class="lq-lampglow dim" cx="26" cy="24" rx="30" ry="22"/>' : '') + '</g></g>' +
      '<g class="lq-plant" transform="translate(330,' + (FLOOR - 56) + ')"><path d="M12 56h24l-4-20H16z" class="lq-pot"/><path d="M24 36c0-12-7-19-16-21 2 12 7 19 16 21zM24 36c0-14 7-21 18-23-2 14-8 21-18 23z" class="lq-leaf"/></g>';
  }

  /* -------------------------------------------------------------- rest area */
  function rest(sky, opts) {
    opts = opts || {};
    return '' +
      '<rect class="lq-wall" x="0" y="0" width="' + W + '" height="' + FLOOR + '"/>' +
      '<rect class="lq-wall2" x="0" y="0" width="' + W + '" height="' + (FLOOR * 0.62) + '"/>' +
      '<rect class="lq-floor" x="0" y="' + FLOOR + '" width="' + W + '" height="' + (H - FLOOR) + '"/>' +
      '<g transform="translate(660,130) scale(0.9)">' + windowView(sky, opts) + '</g>' +
      '<ellipse class="lq-rug" cx="430" cy="' + (FLOOR + 44) + '" rx="240" ry="32"/>' +
      /* armchair */
      '<g class="lq-armchair" transform="translate(330,' + (FLOOR - 104) + ')">' +
        '<rect x="-30" y="10" width="30" height="72" rx="12" class="lq-chairc"/>' +
        '<rect x="150" y="10" width="30" height="72" rx="12" class="lq-chairc"/>' +
        '<rect x="-14" y="-40" width="178" height="60" rx="16" class="lq-chairc"/>' +
        '<rect x="-14" y="14" width="178" height="34" rx="12" class="lq-chairc2"/>' +
        '<path d="M0 82v20M150 82v20" class="lq-leg-l"/>' +
      '</g>' +
      /* side table with a cup */
      '<g transform="translate(560,' + (FLOOR - 62) + ')"><rect width="66" height="44" rx="4" class="lq-wood2"/><rect x="4" y="12" width="58" height="5" rx="2" class="lq-wood"/>' +
      '<path d="M22 -12h20v14a10 10 0 0 1-20 0z" class="lq-cup"/><path d="M42 -8h6a4 4 0 0 1 0 8h-6" class="lq-cup"/></g>' +
      '<g class="lq-plant big" transform="translate(150,' + (FLOOR - 96) + ')"><path d="M18 96h40l-6-34H24z" class="lq-pot"/><path d="M38 62c0-22-13-35-30-38 4 22 14 35 30 38zM38 62c0-26 13-39 34-42-4 26-15 39-34 42z" class="lq-leaf"/></g>';
  }

  /* ------------------------------------------- honest placeholder for later */
  function unbuilt(name, phase, sky) {
    return '' +
      '<rect class="lq-void" x="0" y="0" width="' + W + '" height="' + H + '"/>' +
      '<g opacity=".5">' +
        '<path d="M0 ' + (FLOOR + 20) + 'h' + W + '" class="lq-horizon"/>' +
        '<path d="M120 ' + (FLOOR + 20) + 'V300l90-56 90 56v132z" class="lq-silhouette"/>' +
        '<path d="M470 ' + (FLOOR + 20) + 'V330h150v102z" class="lq-silhouette"/>' +
        '<path d="M720 ' + (FLOOR + 20) + 'V280q70-40 140 0v152z" class="lq-silhouette"/>' +
      '</g>' +
      '<g class="lq-unbuilt-note" transform="translate(' + (W / 2) + ',150)">' +
        '<text class="lq-t1" text-anchor="middle">' + esc(name) + '</text>' +
        '<text class="lq-t2" text-anchor="middle" y="30">This environment arrives in Phase ' + phase + '.</text>' +
        '<text class="lq-t3" text-anchor="middle" y="56">Nothing is invented: the character is shown at the study desk instead.</text>' +
      '</g>';
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var BUILDERS = { study: study, bedroom: bedroom, rest: rest };

  /* Character anchor per room + spot (feet position in scene units). */
  var SPOTS = {
    "study|desk":     { x: 600, y: FLOOR, sit: true,  scale: 1.00, cam: { x: 380, y: 120, w: 520 } },
    "bedroom|bed":    { x: 520, y: FLOOR - 62, sit: false, scale: 0.98, cam: { x: 300, y: 120, w: 620 } },
    "rest|chair":     { x: 400, y: FLOOR - 8, sit: true, scale: 1.00, cam: { x: 180, y: 130, w: 620 } },
    "rest|open":      { x: 620, y: FLOOR, sit: false, scale: 1.00, cam: { x: 320, y: 120, w: 620 } }
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

    var ambient = opt.ambient === false ? "" :
      '<g class="lq-motes">' + [0, 1, 2, 3, 4].map(function (i) {
        return '<circle class="lq-mote" cx="' + (160 + i * 165) + '" cy="' + (180 + (i % 3) * 60) + '" r="' + (1.1 + (i % 3) * 0.5) + '" style="--d:' + (i * 1.7).toFixed(1) + 's;--x:' + (18 + i * 7) + 'px"/>';
      }).join("") + '</g>' +
      (sky.night ? '<rect class="lq-nightwash" x="0" y="0" width="' + W + '" height="' + H + '"/>' : '');

    return {
      room: room, useRoom: useRoom, built: built, def: def, sky: sky,
      back: back, front: front, ambient: ambient, place: place,
      note: built ? "" : (m.note || def.name + " is not built yet"),
      lampOn: sky.night || !!opt.lamp
    };
  }

  function currentMinute() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

  window.LQWorld = {
    W: W, H: H, FLOOR: FLOOR, skyAt: skyAt, orbPos: orbPos, scene: scene,
    spot: spot, SPOTS: SPOTS, currentMinute: currentMinute, esc: esc,
    rooms: function () { return Object.keys(BUILDERS); }
  };
})();
