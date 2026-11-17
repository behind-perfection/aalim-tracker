(function () {
/* ===================================================================
   PhysCore: a principle-based physics engine, in the spirit of chemcore.
   Laws are DATA: each rule says how to derive ONE quantity from others.
   solve() propagates the knowns through the law graph until nothing new
   can be derived, and returns every value plus the chain of laws used —
   so the lab can show its reasoning, not just answers.
   Sign conventions: Cartesian (CBSE). Optics takes signed u, v, f.
   =================================================================== */
"use strict";
const LAWS = [
    { id: "v=u+at", topic: "Motion", rules: { v: { needs: ["u", "a", "t"], f: (u, a, t) => u + a * t }, u: { needs: ["v", "a", "t"], f: (v, a, t) => v - a * t }, a: { needs: ["v", "u", "t"], f: (v, u, t) => (v - u) / t }, t: { needs: ["v", "u", "a"], f: (v, u, a) => (v - u) / a } } },
    { id: "s=(u+v)t/2", topic: "Motion", rules: { s: { needs: ["u", "v", "t"], f: (u, v, t) => (u + v) / 2 * t } } },
    { id: "s=ut+½at²", topic: "Motion", rules: { s: { needs: ["u", "t", "a"], f: (u, t, a) => u * t + .5 * a * t * t }, a: { needs: ["s", "u", "t"], f: (s, u, t) => 2 * (s - u * t) / (t * t) }, u: { needs: ["s", "t", "a"], f: (s, t, a) => (s - .5 * a * t * t) / t } } },
    { id: "v²=u²+2as", topic: "Motion", rules: { v: { needs: ["u", "a", "s"], f: (u, a, s) => Math.sqrt(Math.max(0, u * u + 2 * a * s)) }, u: { needs: ["v", "a", "s"], f: (v, a, s) => Math.sqrt(Math.max(0, v * v - 2 * a * s)) }, a: { needs: ["v", "u", "s"], f: (v, u, s) => (v * v - u * u) / (2 * s) }, s: { needs: ["v", "u", "a"], f: (v, u, a) => (v * v - u * u) / (2 * a) } } },
    { id: "F=ma", topic: "Forces", rules: { F: { needs: ["m", "a"], f: (m, a) => m * a }, m: { needs: ["F", "a"], f: (F, a) => F / a }, a: { needs: ["F", "m"], f: (F, m) => F / m } } },
    { id: "W=Fs", topic: "Energy", rules: { W: { needs: ["F", "s"], f: (F, s) => F * s }, F: { needs: ["W", "s"], f: (W, s) => W / s }, s: { needs: ["W", "F"], f: (W, F) => W / F } } },
    { id: "p=mv", topic: "Forces", rules: { p: { needs: ["m", "v"], f: (m, v) => m * v }, m: { needs: ["p", "v"], f: (p, v) => p / v }, v: { needs: ["p", "m"], f: (p, m) => p / m } } },
    { id: "KE=½mv²", topic: "Energy", rules: { KE: { needs: ["m", "v"], f: (m, v) => .5 * m * v * v }, v: { needs: ["KE", "m"], f: (KE, m) => Math.sqrt(2 * KE / m) }, m: { needs: ["KE", "v"], f: (KE, v) => 2 * KE / (v * v) } } },
    { id: "PE=mgh", topic: "Energy", rules: { PE: { needs: ["m", "g", "h"], f: (m, g, h) => m * g * h }, h: { needs: ["PE", "m", "g"], f: (PE, m, g) => PE / (m * g) }, m: { needs: ["PE", "g", "h"], f: (PE, g, h) => PE / (g * h) } } },
    { id: "P=W/t", topic: "Energy", rules: { P: { needs: ["W", "t"], f: (W, t) => W / t }, W: { needs: ["P", "t"], f: (P, t) => P * t }, t: { needs: ["W", "P"], f: (W, P) => W / P } } },
    { id: "V=IR", topic: "Electricity", rules: { V: { needs: ["I", "R"], f: (I, R) => I * R }, I: { needs: ["V", "R"], f: (V, R) => V / R }, R: { needs: ["V", "I"], f: (V, I) => V / I } } },
    { id: "P=VI", topic: "Electricity", rules: { P: { needs: ["V", "I"], f: (V, I) => V * I }, V: { needs: ["P", "I"], f: (P, I) => P / I }, I: { needs: ["P", "V"], f: (P, V) => P / V } } },
    { id: "P=I²R", topic: "Electricity", rules: { P: { needs: ["I", "R"], f: (I, R) => I * I * R }, I: { needs: ["P", "R"], f: (P, R) => Math.sqrt(P / R) }, R: { needs: ["P", "I"], f: (P, I) => P / (I * I) } } },
    { id: "P=V²/R", topic: "Electricity", rules: { P: { needs: ["V", "R"], f: (V, R) => V * V / R }, V: { needs: ["P", "R"], f: (P, R) => Math.sqrt(P * R) }, R: { needs: ["V", "P"], f: (V, P) => V * V / P } } },
    { id: "E=Pt", topic: "Electricity", rules: { E: { needs: ["P", "t"], f: (P, t) => P * t }, P: { needs: ["E", "t"], f: (E, t) => E / t }, t: { needs: ["E", "P"], f: (E, P) => E / P } } },
    { id: "Q=mcΔT", topic: "Heat", rules: { Q: { needs: ["m", "c", "dT"], f: (m, c, dT) => m * c * dT }, m: { needs: ["Q", "c", "dT"], f: (Q, c, dT) => Q / (c * dT) }, c: { needs: ["Q", "m", "dT"], f: (Q, m, dT) => Q / (m * dT) }, dT: { needs: ["Q", "m", "c"], f: (Q, m, c) => Q / (m * c) } } },
    { id: "Q=mL", topic: "Heat", rules: { Q: { needs: ["m", "L"], f: (m, L) => m * L }, m: { needs: ["Q", "L"], f: (Q, L) => Q / L }, L: { needs: ["Q", "m"], f: (Q, m) => Q / m } } },
    { id: "lens 1/v−1/u=1/f", topic: "Optics", rules: { v: { needs: ["u", "foc"], f: (u, foc) => { const d = 1 / foc + 1 / u; return d === 0 ? Infinity : 1 / d; } }, u: { needs: ["v", "foc"], f: (v, foc) => { const d = 1 / v - 1 / foc; return d === 0 ? Infinity : 1 / d; } }, foc: { needs: ["u", "v"], f: (u, v) => { const d = 1 / v - 1 / u; return d === 0 ? Infinity : 1 / d; } } } },
    { id: "mirror 1/v+1/u=1/f", topic: "Optics", rules: { v: { needs: ["u", "foc"], f: (u, foc) => { const d = 1 / foc - 1 / u; return d === 0 ? Infinity : 1 / d; } }, u: { needs: ["v", "foc"], f: (v, foc) => { const d = 1 / foc - 1 / v; return d === 0 ? Infinity : 1 / d; } }, foc: { needs: ["u", "v"], f: (u, v) => { const d = 1 / v + 1 / u; return d === 0 ? Infinity : 1 / d; } } } },
    { id: "M=v/u (lens)", topic: "Optics", rules: { M: { needs: ["v", "u"], f: (v, u) => v / u }, v: { needs: ["M", "u"], f: (M, u) => M * u }, u: { needs: ["v", "M"], f: (v, M) => v / M } } },
    { id: "M=−v/u (mirror)", topic: "Optics", rules: { M2: { needs: ["v", "u"], f: (v, u) => -v / u }, v: { needs: ["M2", "u"], f: (M2, u) => -M2 * u } } },
    { id: "n₁sinθ₁=n₂sinθ₂", topic: "Optics", rules: { th2: { needs: ["n1", "n2", "th1"], f: (n1, n2, th1) => { const x = n1 * Math.sin(th1 * Math.PI / 180) / n2; return x > 1 ? NaN : Math.asin(x) * 180 / Math.PI; } }, th1: { needs: ["n1", "n2", "th2"], f: (n1, n2, th2) => { const x = n2 * Math.sin(th2 * Math.PI / 180) / n1; return x > 1 ? NaN : Math.asin(x) * 180 / Math.PI; } }, n2: { needs: ["n1", "th1", "th2"], f: (n1, th1, th2) => n1 * Math.sin(th1 * Math.PI / 180) / Math.sin(th2 * Math.PI / 180) }, n1: { needs: ["n2", "th1", "th2"], f: (n2, th1, th2) => n2 * Math.sin(th2 * Math.PI / 180) / Math.sin(th1 * Math.PI / 180) } } },
    { id: "v=fλ", topic: "Waves", rules: { v: { needs: ["freq", "lam"], f: (freq, lam) => freq * lam }, freq: { needs: ["v", "lam"], f: (v, lam) => v / lam }, lam: { needs: ["v", "freq"], f: (v, freq) => v / freq } } }
];
const UNITS = { u: "m/s or m", v: "m/s or m", a: "m/s²", t: "s", s: "m", F: "N", m: "kg", W: "J or W", p: "kg·m/s", KE: "J", PE: "J", g: "m/s²", h: "m", P: "W", V: "V", I: "A", R: "Ω", E: "J", Q: "J", c: "J/(kg·K)", dT: "K", L: "J/kg", foc: "m", M: "×", M2: "×", n1: "–", n2: "–", th1: "°", th2: "°", freq: "Hz", lam: "m" };
const TOPICS = [...new Set(LAWS.map(l => l.topic))];

function solve(knownIn, topics) {
    const vals = Object.assign({}, knownIn), trace = [];
    const laws = LAWS.filter(l => !topics || topics.includes(l.topic));
    for (let pass = 0; pass < 40; pass++) {
        let grew = false;
        for (const law of laws) for (const target in law.rules) {
            if (vals[target] !== undefined && vals[target] !== null) continue;
            const r = law.rules[target];
            if (!r.needs.every(k => typeof vals[k] === "number" && isFinite(vals[k]))) continue;
            const out = r.f(...r.needs.map(k => vals[k]));
            if (typeof out === "number" && isFinite(out)) { vals[target] = out; trace.push({ law: law.id, got: target }); grew = true; }
        }
        if (!grew) break;
    }
    return { vals, trace };
}

/* ---- projectile: exact parabola, or Euler integration with quadratic drag ---- */
function projectile(o) {
    const g = o.g || 9.8, rad = (o.angle || 0) * Math.PI / 180;
    let vx = (o.v0 || 0) * Math.cos(rad), vy = (o.v0 || 0) * Math.sin(rad);
    let x = 0, y = o.h0 || 0, t = 0, H = y;
    const pts = [{ x, y, t }];
    const k = o.drag ? (o.k || 0.02) : 0;
    const dt = 0.004;
    for (let i = 0; i < 200000; i++) {
        if (k) { const sp = Math.hypot(vx, vy); vx += -k * sp * vx * dt; vy += (-g - k * sp * vy) * dt; }
        else vy += -g * dt;
        x += vx * dt; y += vy * dt; t += dt;
        if (y > H) H = y;
        if (i % 25 === 0) pts.push({ x, y: Math.max(0, y), t });
        if (y <= 0 && vy < 0) { y = 0; pts.push({ x, y: 0, t }); break; }
    }
    return { pts, T: t, R: x, H, vImpact: Math.hypot(vx, vy) };
}

/* ---- circuit: series / parallel from Ohm + Joule ---- */
function circuit(o) {
    const rs = (o.rs || []).filter(r => r > 0);
    if (!rs.length || !(o.V > 0)) return null;
    const Req = o.mode === "series" ? rs.reduce((a, b) => a + b, 0) : 1 / rs.reduce((a, b) => a + 1 / b, 0);
    const I = o.V / Req;
    const parts = rs.map((r, i) => o.mode === "series"
        ? { i, r, I, V: I * r, P: I * I * r }
        : { i, r, V: o.V, I: o.V / r, P: o.V * o.V / r });
    return { Req, I, P: o.V * I, parts };
}

/* ---- optics: Cartesian sign convention, image from the lens/mirror formula ---- */
function optics(o) {
    const u = -Math.abs(o.u || 10);
    const f = o.f || 10;
    const inv = o.kind === "lens" ? 1 / f + 1 / u : 1 / f - 1 / u;
    if (inv === 0) return { u, v: Infinity, M: Infinity, atF: true, real: false, inverted: false };
    const v = 1 / inv;
    const M = o.kind === "lens" ? v / u : -v / u;
    const real = o.kind === "lens" ? v > 0 : v < 0;
    return { u, v, M, real, inverted: M < 0 };
}

const PhysCore = { LAWS, UNITS, TOPICS, solve, projectile, circuit, optics };
if (typeof module !== "undefined" && module.exports) module.exports = PhysCore; else window.PhysCore = PhysCore;
})();
