/* ============================================================================
   tools/pixel-preview.js — rasterize the REAL LIFEQUEST scene to a PNG.

   There is no browser or SVG rasterizer in this environment, and an art change
   that nobody has looked at is just a guess. Pixel art is the one style that can
   be rendered by hand: axis-aligned rectangles with flat fills. So this tool

     1. loads the shipped modules (lq-store … lq-world) into jsdom,
     2. asks LQMapper/LQWorld/LQCharacter for the real scene markup,
     3. resolves every class to a flat colour using lifequest.css itself
        (no palette is duplicated here — the CSS is the source of truth),
     4. rasterizes <rect> and axis-aligned <path> onto an integer grid,
     5. writes a PNG with a hand-rolled encoder (zlib is in node core).

   Curves, gradients, filters and text are reported as SKIPPED rather than
   approximated: if the preview is missing something, the art is not pixel art
   yet. That is the check this tool exists to make.

   Usage:
     node tools/pixel-preview.js [room] [anim] [minute] [theme] [scale]
     node tools/pixel-preview.js study study 600 light 1
   Writes preview/<room>-<anim>-<minute>-<theme>.png
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const MODULES = ["lq-store.js", "lq-adapter.js", "lq-mapper.js", "lq-character.js", "lq-world.js"];

/* ------------------------------------------------------------ PNG encoder */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePNG(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;                       /* filter: none */
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
  ]));
}

/* ------------------------------------------------- palette from the real CSS */
function hexToRgb(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);            /* #rrggbbaa → drop alpha */
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function loadPalette(theme) {
  const css = fs.readFileSync(path.join(ROOT, "lifequest.css"), "utf8");
  /* 1. custom properties on the stage, per theme. Blocks gated by
        [data-skin]/[data-outfit] are kept apart: they apply per figure. */
  const vars = {};
  const attrVars = { skin: {}, outfit: {} };
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim(), body = m[2];
    const isDark = /\[data-theme=dark\]/.test(sel);
    if (isDark && theme !== "dark") continue;   /* neutral blocks apply to both themes */
    const am = /\.lq-fig\[data-(skin|outfit)="(\d+)"\]/.exec(sel);
    body.split(";").forEach(d => {
      const mm = /^\s*(--[\w-]+)\s*:\s*([^;]+)/.exec(d);
      if (!mm) return;
      if (am) (attrVars[am[1]][am[2]] = attrVars[am[1]][am[2]] || {})[mm[1]] = mm[2].trim();
      else vars[mm[1]] = mm[2].trim();
    });
  }
  /* 2. class → fill / stroke / opacity */
  const rules = [];
  re.lastIndex = 0;
  while ((m = re.exec(css))) {
    const sel = m[1].trim(), body = m[2];
    if (!/fill|stroke|opacity/.test(body)) continue;
    const cls = (sel.match(/\.[\w-]+(?:\.[\w-]+)?/g) || []).filter(c => c !== ".");
    if (!cls.length) continue;
    const pick = (prop) => {
      const mm = new RegExp("(?:^|[;\\s])" + prop + "\\s*:\\s*([^;}]+)").exec(body);
      return mm ? mm[1].trim() : null;
    };
    rules.push({ sel: cls[cls.length - 1], fill: pick("fill"), stroke: pick("stroke"), opacity: pick("opacity"), sw: pick("stroke-width") });
  }
  const resolve = (v) => {
    if (!v) return null;
    if (v === "none") return null;
    const vm = /^var\((--[\w-]+)\)$/.exec(v);
    if (vm) return vars[vm[1]] || null;
    return /^#/.test(v) ? v : null;
  };
  return {
    vars, attrVars,
    /* palette scoped to one figure's skin/outfit, like the browser's cascade */
    forFig(skin, outfit) {
      const extra = Object.assign({}, attrVars.skin[String(skin | 0)], attrVars.outfit[String(outfit | 0)]);
      const base = this;
      return {
        forClass(cn) {
          const r = base.forClass(cn);
          if (!r) return r;
          const fix = v => { const m = /^var\((--[\w-]+)\)$/.exec(v || ""); return m ? (extra[m[1]] || vars[m[1]] || null) : v; };
          return { fill: fix(r.fill), stroke: fix(r.stroke), opacity: r.opacity };
        }
      };
    },
    forClass(className) {
      /* most specific match wins: ".lq-bk.b3" before ".lq-bk" */
      const parts = className.split(/\s+/);
      let best = null, bestScore = -1;
      rules.forEach(r => {
        const need = r.sel.replace(/^\./, "").split(".");
        if (need.every(n => parts.indexOf(n) >= 0)) {
          if (need.length > bestScore) { bestScore = need.length; best = r; }
        }
      });
      if (!best) return null;
      const fill = resolve(best.fill), stroke = resolve(best.stroke);
      return { fill, stroke, opacity: best.opacity ? parseFloat(best.opacity) : 1 };
    }
  };
}

/* ------------------------------------------------------------- rasterizer */
function parseNum(s, d) { const n = parseFloat(s); return Number.isFinite(n) ? n : (d || 0); }

function rasterize(svgMarkup, pal, opts, charPal) {
  const dom = new JSDOM("<!doctype html><body></body>");
  const doc = dom.window.document;
  doc.body.innerHTML = "<svg xmlns='http://www.w3.org/2000/svg'>" + svgMarkup + "</svg>";
  const svg = doc.body.querySelector("svg");
  const W = opts.w, H = opts.h;
  const buf = Buffer.alloc(W * H * 3);
  const bg = hexToRgb(opts.background);
  for (let i = 0; i < W * H; i++) { buf[i * 3] = bg[0]; buf[i * 3 + 1] = bg[1]; buf[i * 3 + 2] = bg[2]; }
  const skipped = [];

  const OX = opts.ox || 0, OY = opts.oy || 0;
  function setPx(x, y, rgb, alpha) {
    x = Math.floor(x - OX); y = Math.floor(y - OY);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) buf[i + c] = Math.round(buf[i + c] * (1 - alpha) + rgb[c] * alpha);
  }
  function fillRect(x, y, w, h, rgb, alpha) {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++)
      for (let i = Math.floor(x); i < Math.floor(x + w); i++) setPx(i, j, rgb, alpha);
  }
  function strokeRect(x, y, w, h, sw, rgb, alpha) {
    const t = Math.max(1, sw);
    fillRect(x, y, w, t, rgb, alpha); fillRect(x, y + h - t, w, t, rgb, alpha);
    fillRect(x, y, t, h, rgb, alpha); fillRect(x + w - t, y, t, h, rgb, alpha);
  }

  const patterns = {};
  svg.querySelectorAll("pattern").forEach(pt => {
    const id = pt.getAttribute("id");
    const tw = parseNum(pt.getAttribute("width")) * opts.scale, th = parseNum(pt.getAttribute("height")) * opts.scale;
    const tiles = [];
    pt.querySelectorAll("rect").forEach(r => {
      const c = (r.getAttribute("class") || "").split(/\s+/);
      const stt = pal.forClass(c.join(" ")) || {};
      const hex = stt.fill && /^#/.test(stt.fill) ? stt.fill : null;
      if (!hex) return;
      tiles.push({ x: parseNum(r.getAttribute("x")), y: parseNum(r.getAttribute("y")),
        w: parseNum(r.getAttribute("width")), h: parseNum(r.getAttribute("height")),
        rgb: hexToRgb(hex), a: (stt.opacity === undefined ? 1 : stt.opacity) });
    });
    patterns[id] = { tw, th, tiles };
  });
  function paintPattern(X, Y, Wd, Hd, id, alpha) {
    const p = patterns[id]; if (!p) { skipped.push("pattern #" + id); return; }
    for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd; i++) {
      const lx = i % p.tw, ly = j % p.th;
      for (const t of p.tiles) {
        if (lx >= t.x && lx < t.x + t.w && ly >= t.y && ly < t.y + t.h)
          setPx(X + i, Y + j, t.rgb, alpha * t.a);
      }
    }
  }

  function walk(node, tx, ty, sc, inheritedOpacity, curPal, curPose) {
    curPal = curPal || pal; curPose = curPose || "";
    for (const el of node.children) {
      const tag = el.tagName.toLowerCase();
      let nx = tx, ny = ty, ns = sc;
      const tr = el.getAttribute && el.getAttribute("transform");
      if (tr) {
        const t = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/.exec(tr);
        if (t) { nx += parseNum(t[1]) * ns; ny += parseNum(t[2]) * ns; }
        const s = /scale\(\s*(-?[\d.]+)/.exec(tr);
        if (s) ns *= parseNum(s[1]);
        if (/rotate|skew|matrix/.test(tr)) skipped.push(tag + " transform:" + tr.slice(0, 40));
      }
      const ownOp = el.getAttribute && el.getAttribute("opacity");
      const op = inheritedOpacity * (ownOp !== null && ownOp !== undefined ? parseFloat(ownOp) : 1);

      if (tag === "g") {
        const gc = (el.getAttribute && el.getAttribute("class")) || "";
        const cp = /lq-layer-char/.test(gc) ? (charPal || pal) : curPal;
        let pose = curPose;
        if (/\blq-fig\b/.test(gc)) pose = el.getAttribute("data-pose") || pose;
        /* pose groups: only the active one; .fb is the second motion frame */
        const pm = /\blq-p-(\w+)\b/.exec(gc);
        if (pm && pose && pm[1] !== pose) continue;
        if (/\bfb\b/.test(gc.split(/\s+/).join(" "))) continue;
        walk(el, nx, ny, ns, op, cp, pose); continue;
      }

      const cls = (el.getAttribute && el.getAttribute("class")) || "";
      const style = (el.getAttribute && el.getAttribute("style")) || "";
      const inlineFill = /fill:\s*(#[0-9a-fA-F]{3,8})/.exec(style);
      let st = curPal.forClass(cls) || { fill: null, stroke: null, opacity: 1 };
      let fillHex = (el.getAttribute && el.getAttribute("fill")) || (inlineFill && inlineFill[1]) || st.fill;
      let pat = fillHex && /^url\(#(.+)\)$/.exec(fillHex);
      if (fillHex && !pat && !/^#[0-9a-fA-F]{3,8}$/.test(fillHex)) fillHex = null;
      const strokeHex = (el.getAttribute && el.getAttribute("stroke")) || st.stroke;
      const alpha = op * (st.opacity === undefined ? 1 : st.opacity);

      if (tag === "rect") {
        const x = parseNum(el.getAttribute("x")) * 1, y = parseNum(el.getAttribute("y"));
        const w = parseNum(el.getAttribute("width")), h = parseNum(el.getAttribute("height"));
        const X = nx + x * ns, Y = ny + y * ns, Wd = w * ns, Hd = h * ns;
        if (el.getAttribute("rx")) skipped.push("rect rx (rounded corner) " + cls);
        if (pat) paintPattern(X, Y, Wd, Hd, pat[1], alpha);
        else if (fillHex && fillHex !== "none") fillRect(X, Y, Wd, Hd, hexToRgb(fillHex), alpha);
        if (strokeHex) strokeRect(X, Y, Wd, Hd, parseNum(el.getAttribute("stroke-width"), 1) * ns, hexToRgb(strokeHex), alpha);
      } else if (tag === "path") {
        const d = el.getAttribute("d") || "";
        const curved = /[qcats]/i.test(d.replace(/M|L|H|V|Z/gi, ""));
        if (curved) { skipped.push("curved path " + cls + " d=" + d.slice(0, 34)); continue; }
        /* axis-aligned path: trace H/V segments as 1-px-thick pixel runs */
        let cx = 0, cy = 0;
        const seg = /([MLHVZ])\s*(-?[\d.]+)?[ ,]*(-?[\d.]+)?/gi;
        let s2;
        const thick = parseNum(el.getAttribute("stroke-width"), 1) * ns;
        while ((s2 = seg.exec(d))) {
          const cmd = s2[1].toUpperCase();
          if (cmd === "M") { cx = parseNum(s2[2]); cy = parseNum(s2[3]); }
          else if (cmd === "L") {
            const x2 = parseNum(s2[2]), y2 = parseNum(s2[3]);
            if (strokeHex) {
              if (Math.abs(x2 - cx) < 0.01) fillRect(nx + cx * ns - thick / 2, ny + Math.min(cy, y2) * ns, thick, Math.abs(y2 - cy) * ns, hexToRgb(strokeHex), alpha);
              else fillRect(nx + Math.min(cx, x2) * ns, ny + cy * ns - thick / 2, Math.abs(x2 - cx) * ns, thick, hexToRgb(strokeHex), alpha);
            }
            cx = x2; cy = y2;
          } else if (cmd === "H") {
            const x2 = parseNum(s2[2]);
            if (strokeHex) fillRect(nx + Math.min(cx, x2) * ns, ny + cy * ns - thick / 2, Math.abs(x2 - cx) * ns, thick, hexToRgb(strokeHex), alpha);
            cx = x2;
          } else if (cmd === "V") {
            const y2 = parseNum(s2[2]);
            if (strokeHex) fillRect(nx + cx * ns - thick / 2, ny + Math.min(cy, y2) * ns, thick, Math.abs(y2 - cy) * ns, hexToRgb(strokeHex), alpha);
            cy = y2;
          }
        }
        if (fillHex) skipped.push("filled path (not rasterized) " + cls);
      } else if (tag === "circle" || tag === "ellipse") {
        skipped.push(tag + " " + cls);
      } else if (tag === "text") {
        skipped.push("text " + cls);
      } else if (tag === "defs") {
        continue;                       /* patterns inside are consumed above */
      } else if (tag === "lineargradient" || tag === "radialgradient" || tag === "clippath") {
        skipped.push(tag + " (gradient/clip — not pixel art)");
      } else if (tag !== "svg") {
        skipped.push("unsupported <" + tag + ">");
      }
    }
  }
  walk(svg, 0, 0, opts.scale, 1);
  return { buf, skipped };
}

/* ------------------------------------------------------------------- main */
(async function main() {
  const room = process.argv[2] || "study";
  const anim = process.argv[3] || "study";
  const minute = parseInt(process.argv[4] || "600", 10);
  const theme = process.argv[5] || "light";
  const scale = parseFloat(process.argv[6] || "1");
  const subject = process.argv[7] || "Mathematics";
  const optsSkin = parseInt(process.argv[8] || "0", 10);
  const optsOutfit = parseInt(process.argv[9] || "0", 10);

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "dangerously", url: "http://localhost/",
    beforeParse(win) {
      win.ResizeObserver = class { observe() { } unobserve() { } disconnect() { } };
      win.matchMedia = () => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } });
    }
  });
  const w = dom.window;
  for (const f of MODULES) w.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));

  const mapped = w.eval(`LQMapper.map({kind:${JSON.stringify(anim)},subject:${JSON.stringify(subject)},label:"",source:"preview",room:${JSON.stringify(room)}})`);
  if (mapped.room !== room) mapped.room = room;             /* force the room under test */
  const sc = w.eval(`(function(){ var m = ${JSON.stringify(mapped)}; m.room = ${JSON.stringify(room)}; return LQWorld.scene(m, {minute:${minute}, ambient:true}); })()`);
  let rig = w.eval("LQCharacter.rig()");
  { /* apply() sets data-pose/anim/skin/outfit + accessories + held props.
       The holder MUST be an <svg>: in an HTML div the parser would swallow
       self-closing <rect/> tags (foreign-content parsing rules). */
    const holder = w.document.createElement("div");
    holder.innerHTML = "<svg>" + rig + "</svg>";
    w.LQCharacter.apply(holder.querySelector(".lq-fig"), mapped, {});
    rig = holder.querySelector("svg").innerHTML;
  }
  const place = sc.place;

  const P = w.LQWorld.P || 4;
  const props = !process.env.LQ_NOPROPS && (room === "study" || !sc.built)
    ? `<g transform="translate(${place.x - 60},${w.LQWorld.FLOOR - 40 - 10 * P}) scale(${P})">` +
      w.eval(`LQCharacter.deskProps(${JSON.stringify(mapped.subjectKey || "generic")}, {w:24,h:10})`) + `</g>`
    : "";
  const svg =
    `<g class="lq-layer-back">${sc.back}</g>` +
    `<g class="lq-layer-props">${props}</g>` +
    (process.env.LQ_NOCHAR ? "" : `<g class="lq-layer-char" transform="translate(${place.x},${place.y}) scale(${place.scale * P})">${rig}</g>`) +
    `<g class="lq-layer-front">${sc.front}</g>` +
    `<g class="lq-layer-ambient">${sc.ambient}</g>`;

  const pal = loadPalette(theme);
  const W = Math.round(960 * scale), H = Math.round(540 * scale);
  const t0 = Date.now();
  const cam = (place && place.cam) || { x: 0, y: 0, w: 960 };
  const CW = 960 * scale, CH = 540 * scale;         /* output size of the crop */
  const factor = CW / cam.w;                        /* whole-pixel zoom */
  const { buf, skipped } = rasterize(svg, pal, {
    w: CW, h: CH, scale: factor, ox: cam.x * factor, oy: cam.y * factor,
    background: theme === "dark" ? "#101010" : "#dcdcdc"
  }, pal.forFig(optsSkin, optsOutfit));

  const out = path.join(ROOT, "preview");
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, `${room}-${anim}-${minute}-${theme}.png`);
  writePNG(file, W, H, buf);

  /* how monochrome is the result? count distinct hues actually painted */
  const hues = new Set();
  for (let i = 0; i < buf.length; i += 3) {
    const r = buf[i], g = buf[i + 1], b = buf[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn > 6) hues.add(`${r},${g},${b}`);
  }
  console.log(`wrote ${path.relative(ROOT, file)} (${W}×${H}) in ${Date.now() - t0}ms`);
  console.log(`room=${sc.room} built=${sc.built} note=${JSON.stringify(sc.note || "")}`);
  console.log(`NON-GREY pixels painted: ${hues.size} distinct colours${hues.size ? " → " + [...hues].slice(0, 6).join(" ") : " (monochrome ✓)"}`);
  const counts = {};
  skipped.forEach(s => { const k = s.split(" ")[0] + " " + (s.split(" ")[1] || ""); counts[k] = (counts[k] || 0) + 1; });
  const keys = Object.keys(counts);
  console.log(`SKIPPED (not rasterizable as pixel art): ${skipped.length} element(s)${keys.length ? "\n  " + keys.slice(0, 14).map(k => `${k} ×${counts[k]}`).join("\n  ") : ""}`);
  w.close();
})();
