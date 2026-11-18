(function () {
/* ===================================================================
   LabPhysX (v94): Physics Lab content — every subtab is a model backed
   by PhysCore (or a small, stated model computed here). Visuals are
   generated FROM computed values, never decorative.
   =================================================================== */
"use strict";
const R = window.LabReg, U = window.LabUI;
const PC = () => window.PhysCore;
const C = { acc: "var(--acc)", acc2: "var(--acc2)", ok: "var(--ok)", bad: "var(--bad)", orange: "var(--orange)", mut: "var(--mut)" };

/* ---------------- MECHANICS ---------------- */
R.def({
    id: "phy.proj", subject: "phy", topic: "Mechanics", name: "Projectile Motion", icon: "🎯",
    level: "Class 10 → 12", laws: ["Newton's 2nd law", "Independence of perpendicular motion", "a = g (uniform field)"],
    apparatus: ["Launcher", "Protractor", "Metre scale"],
    variables: [["v₀", "launch speed (m/s)"], ["θ", "launch angle (°)"], ["h₀", "launch height (m)"], ["g", "field strength (m/s²)"], ["k", "drag coefficient (1/m)"]],
    defaults: { v0: 20, ang: 45, h0: 0, g: 9.8, drag: false, k: 0.02, planet: 9.8 },
    blurb: ""
}, {
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "v0", label: "Speed v₀", min: 1, max: 60, unit: " m/s", d: 0 },
                { k: "ang", label: "Angle θ", min: 0, max: 90, unit: "°", d: 0 },
                { k: "h0", label: "Launch height h₀", min: 0, max: 50, unit: " m", d: 0 },
                { k: "planet", label: "Gravity", type: "select", options: [["9.8", "Earth (9.8)"], ["1.62", "Moon (1.62)"], ["3.71", "Mars (3.71)"], ["24.8", "Jupiter (24.8)"]], num: true, onDone: v => { ses.set("g", v); ses.rerender(); } },
                { k: "drag", label: "Air drag (quadratic)", type: "check", onDone: () => ses.rerender() },
                { k: "k", label: "Drag coefficient k", min: 0.005, max: 0.06, step: 0.005, d: 3, onLive: () => ses.rerender() }
            ],
            stage: s => {
                if (!s.params.drag) s.params.k = s.params.k;
                const p = s.compute();
                const pts = p.pts.map(q => [q.x, q.y]);
                const body = U.chart({
                    W: 640, H: 320, zeroY: true, xMin: 0,
                    series: [{ pts: pts, color: C.acc, w: 3 }],
                    markers: [{ x: 0, y: s.params.h0, color: C.acc2 }, { x: p.R, y: 0, label: fmt1(p.R) + " m", color: C.bad }],
                    xLabel: "horizontal distance x (m)", yLabel: "height y (m)", td: 0
                });
                return body + (s.params.drag
                    ? '<p class="xsmall">With quadratic drag the engine integrates v += (g + k·|v|·v)·dt step by step (Δt = 4 ms): the path is no longer a parabola and the fall is steeper than the rise — exactly what the plot shows.</p>'
                    : '<p class="xsmall">Integrated from a = g alone; the parabola emerges from the law, it is not drawn in.</p>');
            },
            note: s => {
                const p = s.results;
                return U.ro("Time of flight T", fmt1(p.T) + " s") + U.ro("Range R", fmt1(p.R) + " m") + U.ro("Max height H", fmt1(p.H) + " m") + U.ro("Impact speed", fmt1(p.vImpact) + " m/s");
            },
            payload: s => ({ title: "Projectile", detail: "v₀=" + s.params.v0 + " m/s θ=" + s.params.ang + "° h₀=" + s.params.h0 + " m g=" + s.params.g + (s.params.drag ? " drag k=" + s.params.k : "") + " → R=" + fmt1(s.results.R) + " m, T=" + fmt1(s.results.T) + " s, H=" + fmt1(s.results.H) + " m", results: { R: s.results.R, T: s.results.T, H: s.results.H } }),
            explain: {
                investigation: "How launch speed, angle, height and gravity determine where a projectile lands.",
                principle: "Horizontal motion is uniform (no force); vertical motion has uniform acceleration g. With drag, force depends on v² opposite to motion.",
                equations: ["x = v₀·cosθ · t", "y = h₀ + v₀·sinθ · t − ½ g t²", "drag: a⃗ = g⃗ − k|v⃗|v⃗"],
                why: s => "Range grows with v₀² (speed counts twice: more forward velocity AND longer flight). 45° is optimal only from ground level without drag; from a height the best angle is lower, and drag always shortens range.",
                assumptions: ["Point mass; no lift or spin", "Uniform g over the flight", "Drag ∝ v² with constant k when enabled"],
                applications: ["Cricket/football kicks", "Artillery and rocket staging", "Water fountains", "Long jump take-off angle"],
                next: ["Find the angle that maximises range from h₀ = 20 m", "Turn drag on: does 45° still win?", "Compare Earth vs Moon ranges at equal v₀"]
            }
        });

    },
    compute(p) { return PC().projectile({ v0: p.v0, angle: p.ang, h0: p.h0, g: p.g, drag: p.drag, k: p.k }); }
});
function fmt1(x) { return U.fmt(x, 1); }

R.def({
    id: "phy.pend", subject: "phy", topic: "Mechanics", name: "Simple Pendulum", icon: "🕰",
    level: "Class 10 → 12", laws: ["SHM for small angles", "T = 2π√(L/g)"],
    apparatus: ["String", "Bob", "Stopwatch", "Metre scale"],
    variables: [["L", "length (m)"], ["g", "gravity (m/s²)"], ["θ₀", "release angle (°)"]],
    defaults: { L: 1, g: 9.8, th0: 15 }
}, {
    compute(p) {
        /* honest model: exact period via large-angle correction (series), plus the small-angle value */
        const th = p.th0 * Math.PI / 180;
        const T0 = 2 * Math.PI * Math.sqrt(p.L / p.g);
        const corr = 1 + th * th / 16 + 11 * Math.pow(th, 4) / 3072;
        return { T0: T0, T: T0 * corr, f: 1 / (T0 * corr), corrPct: (corr - 1) * 100 };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "L", label: "Length L", min: 0.1, max: 3, step: 0.05, unit: " m", d: 2, onLive: () => ses.rerender() },
                { k: "th0", label: "Release angle θ₀", min: 1, max: 80, unit: "°", d: 0, onLive: () => ses.rerender() },
                { k: "g", label: "Gravity", type: "select", options: [["9.8", "Earth (9.8)"], ["1.62", "Moon (1.62)"], ["3.71", "Mars (3.71)"]], num: true, onDone: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute();
                const W = 640, H = 300, cx = W / 2, cy = 30, Lpx = 190, th = s.params.th0 * Math.PI / 180;
                const bobX = a => cx + Lpx * Math.sin(a), bobY = a => cy + Lpx * Math.cos(a);
                let o = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xuchart"><line x1="' + (cx - 90) + '" y1="' + cy + '" x2="' + (cx + 90) + '" y2="' + cy + '" stroke="var(--mut)" stroke-width="4"/>';
                o += '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy + Lpx + 14) + '" stroke="var(--bd)" stroke-width="1" stroke-dasharray="4 4"/>';
                [-th, 0, th].forEach((a, i) => {
                    o += '<line x1="' + cx + '" y1="' + cy + '" x2="' + bobX(a) + '" y2="' + bobY(a) + '" stroke="' + (i === 1 ? "var(--bd)" : "var(--acc)") + '" stroke-width="' + (i === 1 ? 1 : 2) + '"' + (i === 1 ? ' stroke-dasharray="4 4"' : "") + '/>';
                    if (i !== 1) o += '<circle cx="' + bobX(a) + '" cy="' + bobY(a) + '" r="13" fill="var(--acc2)" opacity="' + (RM_OFF() ? 1 : .55) + '"/>';
                });
                o += '<path d="M ' + bobX(-th) + ' ' + bobY(-th) + ' A ' + Lpx + ' ' + Lpx + ' 0 0 0 ' + bobX(th) + ' ' + bobY(th) + '" fill="none" stroke="var(--orange)" stroke-width="1.6" stroke-dasharray="5 4"/>';
                o += '<text x="' + cx + '" y="' + (H - 14) + '" text-anchor="middle" font-size="13" fill="var(--tx)">T = ' + fmt1(r.T) + ' s (small-angle T₀ = ' + fmt1(r.T0) + ' s, large-angle correction +' + U.fmt(r.corrPct, 1) + '%)</text></svg>';
                const curve = [];
                for (let L = 0.1; L <= 3; L += 0.05) curve.push([L, 2 * Math.PI * Math.sqrt(L / s.params.g)]);
                return o + U.chart({ W: 640, H: 220, series: [{ pts: curve, color: C.acc }], markers: [{ x: s.params.L, y: r.T0, label: "this pendulum", color: C.acc2 }], xLabel: "length L (m)", yLabel: "period T (s)", xMin: 0.1 });
            },
            note: s => U.ro("Period T (corrected)", fmt1(s.results.T) + " s") + U.ro("Small-angle T₀", fmt1(s.results.T0) + " s") + U.ro("Frequency", U.fmt(s.results.f, 3) + " Hz") + U.ro("Correction at θ₀", U.fmt(s.results.corrPct, 2) + "%"),
            payload: s => ({ title: "Pendulum", detail: "L=" + s.params.L + " m, θ₀=" + s.params.th0 + "°, g=" + s.params.g + " → T=" + fmt1(s.results.T) + " s", results: { T: s.results.T } }),
            explain: {
                investigation: "What sets a pendulum's period — length, gravity, or release angle?",
                principle: "For small angles the restoring force ∝ displacement ⇒ simple harmonic motion with T = 2π√(L/g). Mass does not appear: all bobs swing together.",
                equations: ["T₀ = 2π√(L/g)", "large-angle: T ≈ T₀(1 + θ₀²/16 + 11θ₀⁴/3072)"],
                why: s => "Longer string ⇒ gentler restoring acceleration ⇒ slower swings (T ∝ √L). Bigger angles stretch the period beyond the small-angle formula — the correction term shown is real, not cosmetic.",
                assumptions: ["Massless inextensible string", "No air resistance or pivot friction", "Series correction valid up to ~80°"],
                applications: ["Pendulum clocks", "Measuring g accurately", "Seismometers", "Playground swings"],
                next: ["Plot T² vs L — why is the line straight?", "Take the pendulum to the Moon: what happens to a clock's rate?"]
            }
        });
    }
});
function RM_OFF() { return U.RM(); }

R.def({
    id: "phy.incline", subject: "phy", topic: "Mechanics", name: "Inclined Plane & Friction", icon: "📐",
    level: "Class 10 → 12", laws: ["Newton's 2nd law", "Resolution of forces", "f = μN"],
    apparatus: ["Inclined plane", "Block", "Protractor"],
    variables: [["θ", "incline angle (°)"], ["μ", "coefficient of friction"], ["m", "mass (kg)"], ["g", "gravity (m/s²)"]],
    defaults: { th: 30, mu: 0.25, m: 2, g: 9.8 }
}, {
    compute(p) {
        const th = p.th * Math.PI / 180, W = p.m * p.g;
        const Wpar = W * Math.sin(th), Wperp = W * Math.cos(th);
        const fMax = p.mu * Wperp;
        const slides = Wpar > fMax;
        const a = slides ? (Wpar - fMax) / p.m : 0;
        const angleRest = Math.atan(p.mu) * 180 / Math.PI;
        return { W, Wpar, Wperp, fMax, slides, a, angleRest, f: slides ? fMax : Wpar };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "th", label: "Incline θ", min: 0, max: 70, unit: "°", d: 0, onLive: () => ses.rerender() },
                { k: "mu", label: "Friction μ", min: 0, max: 1, step: 0.05, d: 2, onLive: () => ses.rerender() },
                { k: "m", label: "Mass m", min: 0.5, max: 10, step: 0.5, unit: " kg", d: 1, onLive: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute(), th = s.params.th * Math.PI / 180;
                const W = 640, H = 300, bx = 60, by = H - 50, L = 420;
                const tx = bx + L * Math.cos(th), ty = by - L * Math.sin(th);
                let o = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xuchart"><polygon points="' + bx + ',' + by + ' ' + tx + ',' + ty + ' ' + tx + ',' + by + '" fill="var(--chip)" stroke="var(--mut)" stroke-width="2"/>';
                const mxp = (bx + tx) / 2, myp = (by + ty) / 2 - 14;
                o += '<g transform="rotate(' + (-s.params.th) + ' ' + mxp + ' ' + myp + ')"><rect x="' + (mxp - 22) + '" y="' + (myp - 22) + '" width="44" height="22" rx="3" fill="' + (r.slides ? "var(--bad)" : "var(--acc)") + '" stroke="#0006" stroke-width="1.5"/><text x="' + mxp + '" y="' + (myp - 7) + '" font-size="11" text-anchor="middle" fill="#fff" font-weight="700">' + s.params.m + ' kg</text></g>';
                const arr = (x1, y1, x2, y2, col, lab) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + col + '" stroke-width="2.6"/><circle cx="' + x2 + '" cy="' + y2 + '" r="3.4" fill="' + col + '"/><text x="' + (x2 + 6) + '" y="' + (y2 + 4) + '" font-size="11" fill="' + col + '">' + lab + '</text>';
                o += arr(mxp, myp - 11, mxp, myp - 11 + 55, C.mut, "mg " + fmt1(r.W) + " N");
                o += arr(mxp, myp - 11, mxp + 55 * Math.sin(th), myp - 11 - 55 * Math.cos(th), C.acc, "N " + fmt1(r.Wperp) + " N");
                if (r.slides) o += arr(mxp, myp - 11, mxp + 60 * Math.cos(th), myp - 60 * Math.sin(th) - 11, C.bad, "a = " + fmt1(r.a) + " m/s² ↓slope");
                o += '<text x="' + (bx + 60) + '" y="' + (by - 12) + '" font-size="12" fill="var(--mut)">θ = ' + s.params.th + '°</text>';
                o += '<text x="' + (W - 20) + '" y="30" text-anchor="end" font-size="13" font-weight="700" fill="' + (r.slides ? "var(--bad)" : "var(--ok)") + '">' + (r.slides ? "SLIDING" : "HELD by friction") + '</text></svg>';
                return o + '<p class="xsmall">Angle of repose tan⁻¹(μ) = ' + fmt1(r.angleRest) + '° — beyond this the block must slide, whatever its mass.</p>';
            },
            note: s => U.ro("Weight mg", fmt1(s.results.W) + " N") + U.ro("Down-slope component", fmt1(s.results.Wpar) + " N") + U.ro("Normal reaction N", fmt1(s.results.Wperp) + " N") + U.ro("Max friction μN", fmt1(s.results.fMax) + " N") + U.ro("Acceleration", fmt1(s.results.a) + " m/s²") + U.ro("Angle of repose", fmt1(s.results.angleRest) + "°"),
            payload: s => ({ title: "Incline", detail: "θ=" + s.params.th + "° μ=" + s.params.mu + " m=" + s.params.m + " kg → " + (s.results.slides ? "slides, a=" + fmt1(s.results.a) + " m/s²" : "held by friction"), results: { a: s.results.a } }),
            explain: {
                investigation: "When does a block slide, and how fast does it accelerate?",
                principle: "Weight resolves into mg·sinθ down the slope and mg·cosθ into it; friction opposes with at most μN.",
                equations: ["N = mg·cosθ", "f_max = μN", "a = g(sinθ − μcosθ) when sliding"],
                why: s => "Mass cancels in a = g(sinθ − μcosθ): heavy and light blocks slide identically. That is why the angle of repose depends only on μ.",
                assumptions: ["μ constant (static ≈ kinetic)", "Rigid plane, no deformation", "No air drag"],
                applications: ["Road banking and gradients", "Conveyor design", "Avalanche slopes", "Wheelchair ramps"],
                next: ["Find θ where sliding just begins — compare with tan⁻¹(μ)", "Does doubling mass change the acceleration?"]
            }
        });
    }
});

/* ---------------- ELECTRICITY ---------------- */
R.def({
    id: "phy.circ", subject: "phy", topic: "Electricity & Circuits", name: "Circuit Builder", icon: "🔌",
    level: "Class 10", laws: ["Ohm's law V = IR", "Kirchhoff's laws", "Joule heating P = I²R"],
    apparatus: ["Battery", "Resistors", "Ammeter", "Voltmeter", "Wires"],
    variables: [["V", "battery emf (V)"], ["R₁,R₂,R₃", "resistances (Ω)"], ["mode", "series/parallel"]],
    defaults: { V: 6, mode: "series", r1: 2, r2: 4, r3: 0 }
}, {
    compute(p) { return PC().circuit({ V: p.V, mode: p.mode, rs: [p.r1, p.r2, p.r3] }); },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "mode", label: "Connection", type: "select", options: [["series", "Series"], ["parallel", "Parallel"]], onDone: () => ses.rerender() },
                { k: "V", label: "Battery", min: 1, max: 24, unit: " V", d: 0, onLive: () => ses.rerender() },
                { k: "r1", label: "R1 (0 = remove)", min: 0, max: 50, unit: " Ω", d: 0, onLive: () => ses.rerender() },
                { k: "r2", label: "R2 (0 = remove)", min: 0, max: 50, unit: " Ω", d: 0, onLive: () => ses.rerender() },
                { k: "r3", label: "R3 (0 = remove)", min: 0, max: 50, unit: " Ω", d: 0, onLive: () => ses.rerender() }
            ],
            stage: s => {
                const c = s.compute();
                if (!c) return '<div class="planned"><div class="plico">🔌</div><h3>Open circuit</h3><p>Add at least one resistor (set R &gt; 0). The engine refuses to divide by zero — a real circuit with no resistance path would be a short.</p></div>';
                const W = 640, rs = c.parts, n = rs.length;
                let o;
                const speed = Math.max(1.2, 6 - Math.min(5, c.I));   /* faster dashes = bigger current */
                const dash = 'stroke-dasharray="6 10"' + (RM_OFF() ? "" : ' class="ewire" style="--spd:' + speed.toFixed(1) + 's"');
                if (s.params.mode === "series") {
                    const w = (W - 150) / n;
                    o = '<svg viewBox="0 0 ' + W + ' 190" class="xuchart"><rect x="34" y="34" width="' + (W - 68) + '" height="112" fill="none" stroke="var(--mut)" stroke-width="2.4" ' + dash + '/>';
                    o += '<line x1="14" y1="74" x2="14" y2="106" stroke="var(--mut)" stroke-width="4"/><line x1="24" y1="82" x2="24" y2="98" stroke="var(--mut)" stroke-width="4"/><text x="34" y="26" font-size="13" font-weight="700" fill="var(--tx)">' + s.params.V + ' V</text>';
                    rs.forEach((p, i) => {
                        o += '<rect x="' + (74 + i * w) + '" y="76" width="' + Math.min(76, w - 22) + '" height="28" rx="4" fill="var(--chip)" stroke="var(--acc)" stroke-width="2.4"/><text x="' + (74 + i * w + Math.min(76, w - 22) / 2) + '" y="66" font-size="12" fill="var(--tx)" text-anchor="middle">R' + (p.i + 1) + ' ' + p.r + 'Ω</text><text x="' + (74 + i * w + Math.min(76, w - 22) / 2) + '" y="122" font-size="11" fill="var(--mut)" text-anchor="middle">' + fmt1(p.V) + ' V · ' + U.fmt(p.P, 2) + ' W</text>';
                    });
                    o += '<text x="' + W / 2 + '" y="176" font-size="13" fill="var(--acc2)" text-anchor="middle">I = ' + U.fmt(c.I, 3) + ' A everywhere (series) — moving dashes show conventional current, speed ∝ I</text></svg>';
                } else {
                    const rows = rs.map((p, i) => 64 + i * 58), Hh = rows[rows.length - 1] + 66;
                    o = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" class="xuchart">';
                    o += '<line x1="64" y1="30" x2="' + (W - 64) + '" y2="30" stroke="var(--mut)" stroke-width="2.4" ' + dash + '/><line x1="64" y1="' + rows[rows.length - 1] + '" x2="' + (W - 64) + '" y2="' + rows[rows.length - 1] + '" stroke="var(--mut)" stroke-width="2.4" ' + dash + '/>';
                    o += '<line x1="64" y1="30" x2="64" y2="' + rows[rows.length - 1] + '" stroke="var(--mut)" stroke-width="2.4"/><line x1="' + (W - 64) + '" y1="30" x2="' + (W - 64) + '" y2="' + rows[rows.length - 1] + '" stroke="var(--mut)" stroke-width="2.4"/>';
                    o += '<line x1="22" y1="30" x2="64" y2="30" stroke="var(--mut)" stroke-width="2.4" ' + dash + '/><line x1="12" y1="16" x2="12" y2="44" stroke="var(--mut)" stroke-width="4"/><line x1="22" y1="22" x2="22" y2="38" stroke="var(--mut)" stroke-width="4"/><text x="30" y="14" font-size="13" font-weight="700" fill="var(--tx)">' + s.params.V + ' V</text>';
                    rs.forEach((p, i) => {
                        o += '<line x1="64" y1="' + rows[i] + '" x2="' + (W - 64) + '" y2="' + rows[i] + '" stroke="var(--mut)" stroke-width="2.4" ' + dash + '/><rect x="' + (W / 2 - 42) + '" y="' + (rows[i] - 14) + '" width="84" height="28" rx="4" fill="var(--chip)" stroke="var(--acc)" stroke-width="2.4"/><text x="' + W / 2 + '" y="' + (rows[i] + 5) + '" font-size="12" fill="var(--tx)" text-anchor="middle">R' + (p.i + 1) + ' ' + p.r + 'Ω · ' + U.fmt(p.I, 2) + ' A</text>';
                    });
                    o += '<text x="' + W / 2 + '" y="' + (Hh - 10) + '" font-size="13" fill="var(--acc2)" text-anchor="middle">Battery supplies I = ' + U.fmt(c.I, 3) + ' A = sum of branch currents</text></svg>';
                }
                return o + '<table class="ptable"><tr><th>R</th><th>V</th><th>I</th><th>P</th></tr>' + rs.map(p => '<tr><td>R' + (p.i + 1) + '</td><td>' + fmt1(p.V) + ' V</td><td>' + U.fmt(p.I, 3) + ' A</td><td>' + U.fmt(p.P, 2) + ' W</td></tr>').join("") + '</table>';
            },
            note: s => s.results ? U.ro("Equivalent R", U.fmt(s.results.Req, 2) + " Ω") + U.ro("Battery current", U.fmt(s.results.I, 3) + " A") + U.ro("Total power", U.fmt(s.results.P, 2) + " W") : U.ro("State", "open circuit"),
            payload: s => s.results ? ({ title: "Circuit", detail: s.params.mode + " " + s.params.V + " V [" + [s.params.r1, s.params.r2, s.params.r3].filter(r => r > 0).join(",") + "] Ω → Req=" + U.fmt(s.results.Req, 2) + " Ω, I=" + U.fmt(s.results.I, 3) + " A", results: { Req: s.results.Req, I: s.results.I } }) : ({ title: "Circuit", detail: "open circuit" }),
            explain: {
                investigation: "How current and voltage distribute in series and parallel resistor networks.",
                principle: "Charge conservation (Kirchhoff's junction rule) + energy conservation (loop rule) + Ohm's law.",
                equations: ["series: Req = ΣR, same I", "parallel: 1/Req = Σ1/R, same V", "P = VI = I²R = V²/R"],
                why: s => "Series adds resistances because charge must push through each in turn; parallel shrinks Req below the smallest branch because extra paths carry extra charge — the battery 'sees' an easier circuit.",
                assumptions: ["Ideal battery (no internal resistance)", "Ohmic resistors (R constant with temperature)", "Steady DC"],
                applications: ["Household wiring (parallel)", "Fairy lights (series — one dead bulb kills the string)", "Heater and fuse ratings", "Multimeter shunts"],
                next: ["Add internal resistance mentally: why does terminal voltage sag under load?", "Predict Req before the engine shows it, then check"]
            }
        });
    }
});

/* ---------------- OPTICS ---------------- */
R.def({
    id: "phy.opt", subject: "phy", topic: "Light & Optics", name: "Ray Optics Bench", icon: "🔭",
    level: "Class 10 → 12", laws: ["Lens formula 1/v − 1/u = 1/f", "Mirror formula 1/v + 1/u = 1/f", "Cartesian sign convention", "M = v/u"],
    apparatus: ["Optical bench", "Convex/concave lens", "Concave/convex mirror", "Candle", "Screen"],
    variables: [["f", "focal length (cm, signed)"], ["u", "object distance (cm, u = −|u|)"], ["v", "image distance (cm)"], ["M", "magnification"]],
    defaults: { kind: "lens", f: 10, u: 30 }
}, {
    compute(p) {
        const f = (p.kind === "lensn" || p.kind === "mirror") ? -p.f : p.f;
        const kind = p.kind.indexOf("lens") === 0 ? "lens" : "mirror";
        return Object.assign(PC().optics({ kind: kind, f: f, u: p.u }), { fSigned: f, kind: kind });
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "kind", label: "Device", type: "select", options: [["lens", "Convex lens (f +)"], ["lensn", "Concave lens (f −)"], ["mirror", "Concave mirror (f −)"], ["mirrorx", "Convex mirror (f +)"]], onDone: () => ses.rerender() },
                { k: "f", label: "|f|", min: 4, max: 30, unit: " cm", d: 0, onLive: () => ses.rerender() },
                { k: "u", label: "Object distance |u|", min: 5, max: 90, unit: " cm", d: 0, onLive: () => ses.rerender() }
            ],
            stage: s => {
                const o = s.compute();
                const W = 640, H = 280, cy = H / 2, f = o.fSigned;
                const vf = isFinite(o.v) ? o.v : 0;
                const xs = [o.u, vf, 0, 2 * f];
                const xmin = Math.min.apply(null, xs) - 12, xmax = Math.max.apply(null, xs) + 12;
                const X = x => (x - xmin) / (xmax - xmin) * W;
                const oh = 34, ih = isFinite(o.M) ? Math.max(-110, Math.min(110, oh * o.M)) : 0;
                const ix = X(vf), iy = cy - ih;
                const ray = py => {
                    let out;
                    if (o.atF) out = '<line x1="' + X(0) + '" y1="' + py + '" x2="' + W + '" y2="' + py + '" stroke="var(--acc2)" stroke-width="1.6"/>';
                    else if (o.real) out = '<line x1="' + X(0) + '" y1="' + py + '" x2="' + ix + '" y2="' + iy + '" stroke="var(--acc2)" stroke-width="1.6"/>';
                    else out = '<line x1="' + X(0) + '" y1="' + py + '" x2="' + (X(0) + (X(0) - ix) * .8) + '" y2="' + (py + (py - iy) * .8) + '" stroke="var(--acc2)" stroke-width="1.6"/><line x1="' + X(0) + '" y1="' + py + '" x2="' + ix + '" y2="' + iy + '" stroke="var(--acc2)" stroke-width="1.4" stroke-dasharray="4 4"/>';
                    return '<line x1="' + X(o.u) + '" y1="' + (cy - oh) + '" x2="' + X(0) + '" y2="' + py + '" stroke="var(--acc2)" stroke-width="1.6"/>' + out;
                };
                let dev;
                if (o.kind === "lens") dev = '<ellipse cx="' + X(0) + '" cy="' + cy + '" rx="7" ry="76" fill="var(--acc)" opacity=".3" stroke="var(--acc)" stroke-width="2"/>';
                else dev = '<path d="M ' + X(0) + ' ' + (cy - 76) + ' Q ' + (X(0) + (f < 0 ? 18 : -18)) + ' ' + cy + ' ' + X(0) + ' ' + (cy + 76) + '" fill="none" stroke="var(--acc)" stroke-width="5"/>';
                let img = "";
                if (!o.atF) img = '<line x1="' + ix + '" y1="' + cy + '" x2="' + ix + '" y2="' + iy + '" stroke="var(--ok)" stroke-width="3"' + (o.real ? '' : ' stroke-dasharray="5 4"') + '/><polygon points="' + (ix - 4) + ',' + (iy + (ih > 0 ? 8 : -8)) + ' ' + (ix + 4) + ',' + (iy + (ih > 0 ? 8 : -8)) + ' ' + ix + ',' + iy + '" fill="var(--ok)"/><text x="' + ix + '" y="' + (cy + 20) + '" font-size="12" fill="var(--mut)" text-anchor="middle">image</text>';
                return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xuchart"><line x1="0" y1="' + cy + '" x2="' + W + '" y2="' + cy + '" stroke="var(--mut)" stroke-width="1.4"/>' +
                    '<g>' + [f, 2 * f].filter((v, i, a) => a.indexOf(v) === i && v !== 0).map(v => '<text x="' + X(v) + '" y="' + (cy + 34) + '" font-size="10" fill="var(--mut)" text-anchor="middle">' + (v === f ? "F" : "2F") + '</text><line x1="' + X(v) + '" y1="' + (cy - 5) + '" x2="' + X(v) + '" y2="' + (cy + 5) + '" stroke="var(--mut)" stroke-width="1.4"/>').join("") + '</g>' +
                    dev +
                    '<line x1="' + X(o.u) + '" y1="' + cy + '" x2="' + X(o.u) + '" y2="' + (cy - oh) + '" stroke="var(--tx)" stroke-width="3"/><polygon points="' + (X(o.u) - 4) + ',' + (cy - oh + 8) + ' ' + (X(o.u) + 4) + ',' + (cy - oh + 8) + ' ' + X(o.u) + ',' + (cy - oh) + '" fill="var(--tx)"/><text x="' + X(o.u) + '" y="' + (cy + 20) + '" font-size="12" fill="var(--mut)" text-anchor="middle">object</text>' +
                    ray(cy - oh) + ray(cy - oh * .45) + img + '</svg>' +
                    (o.atF ? '<p class="xsmall">Object exactly at F: emergent rays are parallel — no image forms (v → ∞).</p>' : "");
            },
            note: s => {
                const o = s.results;
                return U.ro("f (signed)", o.fSigned + " cm") + U.ro("v", U.fmt(o.v, 1) + " cm") + U.ro("Magnification M", U.fmt(o.M, 2) + "×") +
                    U.ro("Nature", o.atF ? "no image (object at F)" : (o.real ? "Real" : "Virtual") + ", " + (o.inverted ? "inverted" : "erect") + ", " + (Math.abs(o.M) > 1 ? "enlarged" : Math.abs(o.M) < 1 ? "diminished" : "same size"));
            },
            payload: s => ({ title: "Optics", detail: s.params.kind + " |f|=" + s.params.f + " cm u=" + s.params.u + " cm → v=" + U.fmt(s.results.v, 1) + " cm M=" + U.fmt(s.results.M, 2), results: { v: s.results.v, M: s.results.M } }),
            explain: {
                investigation: "Where an image forms and what it looks like for lenses and spherical mirrors.",
                principle: "Refraction through thin lenses / reflection from spherical surfaces, under the Cartesian sign convention (light travels +x; distances measured from the pole/optic centre).",
                equations: ["lens: 1/v − 1/u = 1/f", "mirror: 1/v + 1/u = 1/f", "M = v/u (lens), M = −v/u (mirror)"],
                why: s => "Moving the object changes which rays converge where: beyond 2F images shrink toward F; between F and the device rays diverge, so the image is virtual — drawn dashed because only their backward extensions meet.",
                assumptions: ["Thin lens / paraxial rays", "Monochromatic-ish (no dispersion modelled)", "Principal-axis objects"],
                applications: ["Cameras (real diminished image)", "Magnifying glasses (virtual enlarged)", "Telescopes & microscopes", "Rear-view convex mirrors", "Shaving/makeup concave mirrors"],
                next: ["Walk u from 90 → 5 cm for a convex lens and watch v and M flip at u = f", "Why can a virtual image never be caught on a screen?"]
            }
        });
    }
});

/* ---------------- HEAT ---------------- */
R.def({
    id: "phy.heat", subject: "phy", topic: "Heat & Thermodynamics", name: "Calorimetry & Cooling", icon: "🌡",
    level: "Class 10 → 12", laws: ["Conservation of energy", "Q = mcΔT", "Newton's law of cooling"],
    apparatus: ["Calorimeter", "Thermometer", "Heater", "Stopwatch"],
    variables: [["m₁,m₂", "masses (kg)"], ["c₁,c₂", "specific heats (J/kg·K)"], ["T₁,T₂", "temperatures (°C)"], ["k", "cooling constant (1/s)"]],
    defaults: { m1: 0.2, T1: 90, c1: 4200, m2: 0.3, T2: 20, c2: 4200, room: 25, k: 0.02, mins: 30 }
}, {
    compute(p) {
        const Tf = (p.m1 * p.c1 * p.T1 + p.m2 * p.c2 * p.T2) / (p.m1 * p.c1 + p.m2 * p.c2);
        const pts = [];
        for (let t = 0; t <= p.mins * 60; t += 30) pts.push([t / 60, p.room + (Tf - p.room) * Math.exp(-p.k * t)]);
        const Q1 = p.m1 * p.c1 * (Tf - p.T1);
        return { Tf: Tf, pts: pts, Q1: Q1, Q2: -Q1 };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "m1", label: "Hot: mass m₁", min: 0.05, max: 1, step: 0.05, unit: " kg", d: 2, onLive: () => ses.rerender() },
                { k: "T1", label: "Hot: temp T₁", min: 30, max: 100, unit: " °C", d: 0, onLive: () => ses.rerender() },
                { k: "c1", label: "Hot: c₁", type: "select", options: [["4200", "Water 4200"], ["900", "Aluminium 900"], ["450", "Iron 450"], ["385", "Copper 385"]], num: true, onDone: () => ses.rerender() },
                { k: "m2", label: "Cold: mass m₂", min: 0.05, max: 1, step: 0.05, unit: " kg", d: 2, onLive: () => ses.rerender() },
                { k: "T2", label: "Cold: temp T₂", min: 0, max: 30, unit: " °C", d: 0, onLive: () => ses.rerender() },
                { k: "c2", label: "Cold: c₂", type: "select", options: [["4200", "Water 4200"], ["900", "Aluminium 900"], ["450", "Iron 450"], ["385", "Copper 385"]], num: true, onDone: () => ses.rerender() },
                { k: "k", label: "Cooling constant k", min: 0.005, max: 0.1, step: 0.005, d: 3, onLive: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute();
                return U.chart({
                    W: 640, H: 300, series: [{ pts: r.pts, color: C.bad, w: 3 }],
                    markers: [{ x: 0, y: r.Tf, label: "mix " + fmt1(r.Tf) + "°C", color: C.acc2 }, { x: s.params.mins, y: s.params.room, color: C.mut }],
                    xLabel: "time after mixing (min)", yLabel: "temperature (°C)", xMin: 0,
                    yMin: Math.min(s.params.room - 2, r.Tf - 10), yMax: r.Tf + 8
                }) + '<p class="xsmall">Newton\'s law of cooling dT/dt = −k(T − T_room) gives the exponential decay — steepest when hottest, flattening toward room temperature (' + s.params.room + '°C).</p>';
            },
            note: s => U.ro("Mixture temperature", fmt1(s.results.Tf) + " °C") + U.ro("Heat lost by hot body", U.fmt(-s.results.Q1, 0) + " J") + U.ro("Heat gained by cold body", U.fmt(s.results.Q2, 0) + " J"),
            payload: s => ({ title: "Calorimetry", detail: "m₁=" + s.params.m1 + "kg@" + s.params.T1 + "°C + m₂=" + s.params.m2 + "kg@" + s.params.T2 + "°C → Tf=" + fmt1(s.results.Tf) + "°C", results: { Tf: s.results.Tf } }),
            explain: {
                investigation: "Where the final temperature comes from, and how fast the mixture cools.",
                principle: "Energy conservation in an isolated system: heat lost = heat gained. Cooling rate is proportional to the excess temperature over surroundings.",
                equations: ["m₁c₁(T₁−Tf) = m₂c₂(Tf−T₂)", "T(t) = T_room + (Tf−T_room)e^(−kt)"],
                why: s => "Tf is a heat-capacity-weighted average — the body with the larger mc dominates. Water's huge c (4200) is why a bucket of warm water beats a cup of boiling tea for warming hands.",
                assumptions: ["No heat loss during mixing (ideal calorimeter)", "Constant specific heats", "Uniform temperature (well stirred)", "Newton cooling valid for small excess"],
                applications: ["Thermos design", "Engine cooling systems", "Cooking temperatures", "Climate: oceans buffer temperatures"],
                next: ["Double m₁: does Tf move toward T₁?", "Find k that halves the excess in 10 minutes (k = ln2/600)"]
            }
        });
    }
});

/* ---------------- WAVES ---------------- */
R.def({
    id: "phy.wave", subject: "phy", topic: "Waves & Sound", name: "Standing Waves & Sound", icon: "🌊",
    level: "Class 10 → 12", laws: ["v = fλ", "Standing-wave condition L = nλ/2", "v = √(T/μ) on a string"],
    apparatus: ["Sonometer/string", "Vibration generator", "Tuning forks"],
    variables: [["L", "string length (m)"], ["T", "tension (N)"], ["μ", "mass per length (g/m)"], ["n", "harmonic number"]],
    defaults: { L: 0.8, T: 40, mu: 1.2, n: 1, loud: 0 }
}, {
    compute(p) {
        const mu = p.mu / 1000;                       /* g/m -> kg/m */
        const v = Math.sqrt(p.T / mu);
        const f1 = v / (2 * p.L);
        const f = f1 * p.n;
        const lam = 2 * p.L / p.n;
        const pts = [];
        for (let i = 0; i <= 200; i++) {
            const x = i / 200 * p.L;
            pts.push([x, 0.06 * Math.sin(p.n * Math.PI * x / p.L)]);
        }
        return { v: v, f1: f1, f: f, lam: lam, pts: pts };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "L", label: "Length L", min: 0.2, max: 2, step: 0.05, unit: " m", d: 2, onLive: () => ses.rerender() },
                { k: "T", label: "Tension T", min: 5, max: 200, unit: " N", d: 0, onLive: () => ses.rerender() },
                { k: "mu", label: "Mass per length μ", min: 0.2, max: 8, step: 0.1, unit: " g/m", d: 1, onLive: () => ses.rerender() },
                { k: "n", label: "Harmonic n", min: 1, max: 8, d: 0, onLive: () => ses.rerender() },
                { k: "loud", label: "🔊 Hear the tone (Web Audio)", type: "check", onDone: v => tone(v, ses.results ? ses.results.f : 100) }
            ],
            stage: s => {
                const r = s.compute();
                const W = 640, H = 220, pad = 40;
                const X = x => pad + x / s.params.L * (W - 2 * pad), Y = a => H / 2 - a / 0.06 * (H / 2 - 24);
                let o = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xuchart"><line x1="' + pad + '" y1="' + H / 2 + '" x2="' + (W - pad) + '" y2="' + H / 2 + '" stroke="var(--mut)" stroke-width="2"/>';
                o += '<polyline points="' + r.pts.map(p => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ") + '" fill="none" stroke="var(--acc)" stroke-width="3"/>';
                o += '<polyline points="' + r.pts.map(p => X(p[0]).toFixed(1) + "," + Y(-p[1]).toFixed(1)).join(" ") + '" fill="none" stroke="var(--acc)" stroke-width="1.4" stroke-dasharray="4 4" opacity=".6"/>';
                for (let i = 0; i <= s.params.n; i++) { const x = i * s.params.L / s.params.n; o += '<circle cx="' + X(x) + '" cy="' + H / 2 + '" r="4.5" fill="var(--bad)"/><text x="' + X(x) + '" y="' + (H / 2 + 20) + '" font-size="10" fill="var(--mut)" text-anchor="middle">node</text>'; }
                o += '<text x="' + (W / 2) + '" y="' + (H - 8) + '" font-size="12" fill="var(--tx)" text-anchor="middle">n = ' + s.params.n + ' · λ = ' + U.fmt(r.lam, 2) + ' m · f = ' + U.fmt(r.f, 1) + ' Hz</text></svg>';
                return o + '<p class="xsmall">Wave speed on the string v = √(T/μ) = ' + fmt1(r.v) + ' m/s. The standing-wave condition pins frequencies to fₙ = nv/2L — only these survive; everything else cancels by interference.</p>';
            },
            note: s => U.ro("Wave speed v", fmt1(s.results.v) + " m/s") + U.ro("Fundamental f₁", U.fmt(s.results.f1, 1) + " Hz") + U.ro("This harmonic fₙ", U.fmt(s.results.f, 1) + " Hz") + U.ro("Wavelength λ", U.fmt(s.results.lam, 3) + " m"),
            payload: s => ({ title: "Standing wave", detail: "L=" + s.params.L + " m T=" + s.params.T + " N μ=" + s.params.mu + " g/m n=" + s.params.n + " → f=" + U.fmt(s.results.f, 1) + " Hz", results: { f: s.results.f } }),
            explain: {
                investigation: "Why strings produce discrete notes and how tension/length/mass set the pitch.",
                principle: "Waves reflect at fixed ends; only wavelengths fitting L = nλ/2 interfere constructively (standing waves). Pitch = f of the standing mode.",
                equations: ["v = √(T/μ)", "fₙ = n·v / 2L", "v = fλ"],
                why: s => "Tightening raises v (√T) so pitch rises; lengthening lowers f (1/L) — guitar frets shorten L; thick strings (big μ) sound lower.",
                assumptions: ["Perfectly flexible uniform string", "Fixed ends, no damping", "Small amplitude"],
                applications: ["All stringed instruments", "Piano tuning", "Bridge/engine resonance hazards", "Ultrasound imaging harmonics"],
                next: ["Find the tension that makes f₁ = 440 Hz (concert A)", "Press the hear box: n = 2 sounds an octave up — verify f doubles"]
            }
        });
    }
});
let actx = null;
function tone(on, f) {
    try {
        if (!on) { if (actx) { actx.close(); actx = null; } return; }
        if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = Math.min(4000, Math.max(20, f)); o.type = "sine";
        g.gain.value = 0.08; o.connect(g); g.connect(actx.destination); o.start();
        actx._osc = o;
        U.toast("Playing " + Math.round(f) + " Hz");
    } catch (e) { U.toast("Audio unavailable"); }
}

/* ---------------- MAGNETISM ---------------- */
R.def({
    id: "phy.mag", subject: "phy", topic: "Magnetism", name: "Magnetic Fields & Force", icon: "🧲",
    level: "Class 10 → 12", laws: ["B = μ₀I/2πr (straight wire)", "F = BIL sinθ", "Fleming's left-hand rule"],
    apparatus: ["Bar magnet", "Compass", "Iron filings", "Current-carrying wire", "Battery"],
    variables: [["I", "current (A)"], ["r", "distance from wire (cm)"], ["L", "wire length in field (cm)"], ["B", "field strength (T)"]],
    defaults: { mode: "wire", I: 3, r: 5, B: 0.2, L: 8, th: 90 }
}, {
    compute(p) {
        const MU0 = 4 * Math.PI * 1e-7;
        if (p.mode === "wire") {
            const B = MU0 * p.I / (2 * Math.PI * (p.r / 100));
            return { B: B, F: null };
        }
        const F = p.B * p.I * (p.L / 100) * Math.sin(p.th * Math.PI / 180);
        return { B: p.B, F: F };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "mode", label: "Setup", type: "select", options: [["wire", "Field around a straight wire"], ["force", "Force on a wire in a field"]], onDone: () => ses.rerender() },
                { k: "I", label: "Current I", min: 0, max: 10, step: 0.5, unit: " A", d: 1, onLive: () => ses.rerender() },
                { k: "r", label: "Distance r", min: 1, max: 30, unit: " cm", d: 0, onLive: () => ses.rerender() },
                { k: "B", label: "External field B", min: 0.05, max: 1, step: 0.05, unit: " T", d: 2, onLive: () => ses.rerender() },
                { k: "L", label: "Wire length L", min: 1, max: 30, unit: " cm", d: 0, onLive: () => ses.rerender() },
                { k: "th", label: "Angle θ (B vs I)", min: 0, max: 90, unit: "°", d: 0, onLive: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute();
                const W = 640, H = 300, cx = W / 2, cy = H / 2;
                let o = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xuchart">';
                if (s.params.mode === "wire") {
                    o += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="var(--acc)" stroke="var(--tx)" stroke-width="2"/><text x="' + cx + '" y="' + (cy + 4) + '" font-size="10" text-anchor="middle" fill="#fff" font-weight="800">I⊙</text>';
                    for (let i = 1; i <= 5; i++) {
                        const rad = i * 26;
                        o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="none" stroke="var(--acc2)" stroke-width="' + (2.6 - i * .3) + '" opacity="' + (1.05 - i * .17) + '"' + (RM_OFF() ? "" : ' stroke-dasharray="10 8" class="ewire" style="--spd:' + (2 + i) + 's"') + '/>';
                        const arrows = [[cx + rad, cy], [cx - rad, cy], [cx, cy + rad], [cx, cy - rad]];
                        arrows.forEach((a, j) => { o += '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="2.6" fill="var(--acc2)"/>'; });
                    }
                    const rpx = s.params.r / 30 * 130;
                    o += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + rpx) + '" y2="' + cy + '" stroke="var(--bad)" stroke-width="2" stroke-dasharray="4 3"/><text x="' + (cx + rpx / 2) + '" y="' + (cy - 8) + '" font-size="11" fill="var(--bad)" text-anchor="middle">r = ' + s.params.r + ' cm</text>';
                    o += '<g transform="translate(' + (cx + rpx) + ',' + cy + ')"><path d="M0,-9 L14,0 L0,9 Z" fill="var(--ok)" transform="rotate(90)"/><text x="22" y="4" font-size="11" fill="var(--ok)">compass N</text></g>';
                    o += '<text x="' + cx + '" y="' + (H - 12) + '" font-size="13" fill="var(--tx)" text-anchor="middle">B at r = ' + (r.B * 1e6).toFixed(1) + ' µT — field circles the wire (right-hand grip rule); strength falls as 1/r</text>';
                } else {
                    o += '<rect x="120" y="60" width="400" height="180" rx="10" fill="var(--chip)" stroke="var(--bd)" stroke-width="2"/>';
                    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
                        const x = 150 + i * 68, y = 95 + j * 55;
                        o += '<text x="' + x + '" y="' + y + '" font-size="14" fill="var(--acc2)" text-anchor="middle" opacity=".8">•</text><text x="' + x + '" y="' + (y + 12) + '" font-size="8" fill="var(--mut)" text-anchor="middle">B into page</text>';
                    }
                    const wpx = s.params.L * 6;
                    const ang = s.params.th;
                    o += '<line x1="' + (cx - wpx / 2) + '" y1="' + cy + '" x2="' + (cx + wpx / 2) + '" y2="' + cy + '" stroke="var(--tx)" stroke-width="5" stroke-linecap="round"/><text x="' + cx + '" y="' + (cy - 10) + '" font-size="11" fill="var(--tx)" text-anchor="middle">I = ' + s.params.I + ' A →</text>';
                    if (r.F > 0) o += '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - 30 - Math.min(60, r.F * 40)) + '" stroke="var(--bad)" stroke-width="4"/><polygon points="' + (cx - 6) + ',' + (cy - 26 - Math.min(60, r.F * 40)) + ' ' + (cx + 6) + ',' + (cy - 26 - Math.min(60, r.F * 40)) + ' ' + cx + ',' + (cy - 40 - Math.min(60, r.F * 40)) + '" fill="var(--bad)"/><text x="' + (cx + 14) + '" y="' + (cy - 50) + '" font-size="12" fill="var(--bad)">F = ' + U.fmt(r.F, 3) + ' N (up — Fleming LHR)</text>';
                    else o += '<text x="' + cx + '" y="' + (cy - 46) + '" font-size="12" fill="var(--mut)" text-anchor="middle">θ = 0°: current parallel to field → no force</text>';
                    o += '<text x="' + cx + '" y="' + (H - 12) + '" font-size="13" fill="var(--tx)" text-anchor="middle">F = BIL·sinθ — maximum at 90°, zero when parallel</text>';
                }
                return o + "</svg>";
            },
            note: s => s.results.F !== null ? (U.ro("Field B", s.results.B + " T") + U.ro("Force F", U.fmt(s.results.F, 3) + " N")) : U.ro("Field at r", (s.results.B * 1e6).toFixed(1) + " µT"),
            payload: s => ({ title: "Magnetism", detail: s.params.mode === "wire" ? "I=" + s.params.I + " A r=" + s.params.r + " cm → B=" + (s.results.B * 1e6).toFixed(1) + " µT" : "B=" + s.params.B + " T I=" + s.params.I + " A L=" + s.params.L + " cm θ=" + s.params.th + "° → F=" + U.fmt(s.results.F, 3) + " N", results: s.results }),
            explain: {
                investigation: "How currents make magnetic fields, and how fields push on currents.",
                principle: "Moving charge creates a circling B-field (Oersted); a current in an external field feels F = BIL sinθ (motor effect).",
                equations: ["B = μ₀I / 2πr", "F = BIL sinθ", "μ₀ = 4π×10⁻⁷ T·m/A"],
                why: s => "Field lines form closed circles — there is no 'start'. The 1/r fall-off spreads the same circulation over a longer circle. The motor force is largest at 90° because only the perpendicular component of current 'cuts' field lines.",
                assumptions: ["Infinitely long straight wire (edge effects ignored)", "Uniform external field", "Steady DC"],
                applications: ["Electric motors", "Speakers", "Circuit breakers (magnetic trip)", "MRI field design", "Compass navigation near power lines"],
                next: ["Double I: what happens to B at the same r?", "Find θ where the force halves (sinθ = 0.5)"]
            }
        });
    }
});

/* ---------------- LAW SOLVER ---------------- */
R.def({
    id: "phy.solve", subject: "phy", topic: "Physics Law Solver", name: "Law Solver", icon: "🧮",
    level: "Class 10 → 12+", laws: ["All registered law graph: Motion, Forces, Energy, Electricity, Heat, Optics, Waves"],
    apparatus: ["Calculator (transparent — shows every law it applies)"],
    variables: [["knowns", "any quantities of the chosen topic"]],
    defaults: { topic: "Motion", known: {} }
}, {
    compute(p) { return PC().solve(p.known, [p.topic]); },
    mount(ses) {
        const root = U.buildView(ses, {
            record: false,
            controls: [{
                k: "topic", label: "Topic", type: "select",
                options: PC().TOPICS.map(t => [t, t]),
                onDone: v => { ses.set("known", {}); ses.rerender(); }
            }],
            stage: s => {
                const keys = [...new Set(PC().LAWS.filter(l => l.topic === s.params.topic).flatMap(l => Object.keys(l.rules).concat(...Object.values(l.rules).map(r => r.needs))))];
                let ctl2 = s.dom.ctl;
                if (!s._keyInputs) {
                    s._keyInputs = true;
                }
                const box = document.createElement("div");
                box.className = "knowns";
                keys.forEach(k => {
                    const lab = document.createElement("label");
                    lab.className = "xu-ctl";
                    const val = s.params.known[k] !== undefined ? s.params.known[k] : "";
                    lab.innerHTML = '<span>' + k + ' <i class="xu-u">(' + (PC().UNITS[k] || "") + ')</i></span><input type="number" step="any" value="' + val + '" aria-label="' + k + '">';
                    lab.querySelector("input").addEventListener("change", e => {
                        const n = parseFloat(e.target.value);
                        if (e.target.value === "" || isNaN(n)) delete s.params.known[k]; else s.params.known[k] = n;
                        s.rerender();
                    });
                    box.appendChild(lab);
                });
                ctl2.querySelectorAll(".knowns").forEach(x => x.remove());
                ctl2.appendChild(box);
                const r = s.compute();
                return '<table class="ptable"><tr><th>Quantity</th><th>Value</th><th>Origin</th></tr>' +
                    keys.map(k => '<tr><td>' + k + ' (' + (PC().UNITS[k] || "") + ')</td><td><b>' + (r.vals[k] !== undefined ? U.fmt(r.vals[k], 3) : "—") + '</b></td><td style="color:var(--mut)">' + (s.params.known[k] !== undefined ? "given" : r.vals[k] !== undefined ? "derived" : "unknown") + '</td></tr>').join("") + '</table>';
            },
            note: s => {
                const r = s.results;
                return U.why("Chain of laws applied:<br>" + (r.trace.length ? r.trace.map(t => "• " + t.law + " → " + t.got).join("<br>") : "• none — give more knowns.")) +
                    '<p class="xsmall">Every value came from propagating your inputs through the law graph (fixed-point iteration, 40 passes max). Nothing is a stored answer.</p>';
            },
            explain: {
                investigation: "Given partial knowledge of a physical situation, what else must be true?",
                principle: "Each law is an invertible rewrite rule; the solver applies every rule whose inputs are known until a fixed point — the same idea as symbolic algebra systems.",
                equations: ["v = u + at", "s = ut + ½at²", "v² = u² + 2as", "F = ma", "V = IR", "P = VI = I²R", "Q = mcΔT", "v = fλ", "…"],
                why: s => "Derivation order in the trace shows the dependency structure of physics itself — e.g. it needs a before F, and can get a three different ways.",
                assumptions: ["Constant acceleration for SUVAT", "Ohmic components", "Ideal systems unless a loss law is given"],
                applications: ["Exam problem triage: see which two knowns unlock a question", "Unit checking", "Design back-calculation (choose m and a to hit a force budget)"],
                next: ["Give u, v, s only — watch it derive a, then t, then F if m known", "Optics: give u and f, get v and M with signed values"]
            }
        });
    }
});
})();
