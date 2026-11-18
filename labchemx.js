(function () {
/* ===================================================================
   LabChemX (v94): Chemistry Lab subtabs.
   - Reaction Explorer runs the REAL engine (Engine.newContainer +
     addLiquid/addSolid + tickContainer) on an offscreen container and
     shows the equations the engine itself recorded.
   - Concentration / titration / reactivity / electrochemistry are
     explicit models computed here (formulas shown alongside).
   - The main bench stays the preserved singleton workspace.
   =================================================================== */
"use strict";
const R = window.LabReg, U = window.LabUI;
const C = { acc: "var(--acc)", acc2: "var(--acc2)", ok: "var(--ok)", bad: "var(--bad)", orange: "var(--orange)", mut: "var(--mut)" };
const E = () => window.Engine;
const CL = () => window.ChemLab;

/* helper: find a reagent channel from the bench catalogue (loaded with chem script) */
function chan(id) {
    const cl = CL();
    if (!cl || !cl.CHEMS) return null;
    return cl.CHEMS.find(x => x.id === id) || null;
}
function chemReady() { return !!(CL() && CL().CHEMS && E()); }

/* ---------------- REACTIONS & EQUATIONS ---------------- */
const RPAIRS = [
    ["Lead nitrate + potassium iodide", "pbn", "ki"],
    ["Sodium hydroxide + copper sulphate", "naoh", "cuso4"],
    ["Barium chloride + sodium sulphate", "bacl2", "na2so4"],
    ["Silver nitrate + sodium chloride", "agno3", "nacl"],
    ["Hydrochloric acid + sodium hydroxide", "hcl", "naoh"],
    ["Sulphuric acid + sodium hydroxide", "h2so4", "naoh"],
    ["Hydrochloric acid + sodium carbonate", "hcl", "na2co3"],
    ["Acetic acid + sodium hydroxide", "ch3cooh", "naoh"],
    ["Copper sulphate + iron nail (displacement)", "cuso4", null, "nail"],
    ["Silver nitrate + copper wire (displacement)", "agno3", null, "cu"]
];
R.def({
    id: "chem.rx", subject: "chem", topic: "Reactions & Equations", name: "Reaction Explorer", icon: "⚗️",
    level: "Class 10", laws: ["Law of conservation of mass", "Double displacement", "Neutralisation", "Displacement (reactivity series)", "Precipitation rules"],
    apparatus: ["Test tube (offscreen — the real engine computes it)"],
    variables: [["reagents", "chosen pair"], ["amount", "mL of each solution"]],
    defaults: { pair: 0, mL: 5 }
}, {
    compute(p) {
        if (!chemReady()) return null;
        const d = RPAIRS[p.pair], En = E();
        const c = En.newContainer("tube", "Reaction tube");
        const before = new Set(En.RX.keys());
        const chA = chan(d[1]); if (chA) En.addLiquid(c, chA, p.mL);
        const chB = d[2] ? chan(d[2]) : null; if (chB) En.addLiquid(c, chB, p.mL);
        if (d[3]) En.addSolid(c, d[3], 0.5);
        En.tickContainer(c, 4);
        const eqs = [...En.RX.values()].filter(r => !before.has(r.eq));
        return { c: c, eqs: eqs, ph: En.phOf ? En.phOf(c) : null, gas: c.gasType, gasRate: c.gasRate, T: c.T };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "pair", label: "Reaction", type: "select", options: RPAIRS.map((d, i) => [i, d[0]]), num: true, onDone: () => ses.rerender() },
                { k: "mL", label: "Amount of each solution", min: 1, max: 20, unit: " mL", d: 0, onLive: () => ses.rerender() }
            ],
            stage: s => {
                if (!chemReady()) return '<p class="xsmall">Bench catalogue still loading — switch to the Experiment Bench once, then return.</p>';
                const r = s.compute();
                if (!r) return '<p class="xsmall">Reagents for this pair are not in the bench catalogue on this build.</p>';
                const c = r.c;
                const En = E();
                const col = En.solnColour(c);
                let h = '<div class="rxvessel"><svg width="120" height="180" viewBox="0 0 56 160"><polygon points="8,10 8,130 28,152 48,130 48,10" fill="rgba(190,205,235,.15)" stroke="var(--glassb)" stroke-width="2"/>' +
                    (c.vol > .05 ? '<polygon points="10,' + (140 - Math.min(110, c.vol * 4)) + ' 10,130 28,150 46,130 46,' + (140 - Math.min(110, c.vol * 4)) + '" fill="rgba(' + col.rgb.map(Math.round).join(",") + ',' + Math.min(.9, col.alpha + .1) + ')"/>' : "") +
                    '</svg><div class="rxstate"><b>' + En.cname(c) + '</b><span>pH ' + (r.ph === null || r.ph === undefined ? "—" : U.fmt(r.ph, 2)) + '</span><span>T ' + U.fmt(r.T, 1) + ' °C</span>' + (r.gas ? '<span>gas: ' + r.gas + (r.gasRate > 1e-5 ? " (evolving)" : "") + '</span>' : "") + '</div></div>';
                h += r.eqs.length ? '<div class="rxeqs">' + r.eqs.map(q => '<div class="rx"><small>' + q.name + '</small><b>' + q.eq + '</b>' + (q.ion ? '<small>Ionic: ' + q.ion + '</small>' : "") + '</div>').join("") + '</div>'
                    : '<p class="xsmall">No reaction recorded by the engine for this combination — that is itself a result (e.g. no precipitate, no redox drive).</p>';
                h += '<p class="xsmall">This ran the same engine as the bench, on an offscreen tube: equations are the engine\'s own recorded reactions, not a lookup table.</p>';
                return h;
            },
            note: s => {
                if (!s.results) return U.ro("State", "engine loading");
                const r = s.results;
                return U.ro("Reactions recorded", r.eqs.length) + U.ro("Final pH", r.ph === null || r.ph === undefined ? "—" : U.fmt(r.ph, 2)) + U.ro("Temperature", U.fmt(r.T, 1) + " °C") + U.ro("Gas", r.gas || "none") +
                    (r.eqs.length ? U.why(r.eqs.map(q => q.name + ": " + q.eq).join("<br>")) : "");
            },
            payload: s => ({ title: "Reaction", detail: RPAIRS[s.params.pair][0] + " → " + (s.results && s.results.eqs.length ? s.results.eqs.map(q => q.eq).join(" ; ") : "no reaction"), results: { eqs: s.results ? s.results.eqs.length : 0 } }),
            explain: {
                investigation: "What products form when two reagents meet — and why some pairs do nothing.",
                principle: "Reactions proceed when there is a driving force: a precipitate leaves solution, a gas escapes, water forms (neutralisation), or a more reactive metal displaces a less reactive one.",
                equations: ["AB + CD → AD + CB (double displacement)", "acid + base → salt + water", "metal + salt → displacement if metal is more reactive"],
                why: s => "The engine checks solubility rules and the reactivity/redox table for every species present each tick; the equations shown are the ones it actually applied.",
                assumptions: ["Aqueous solutions at bench concentrations", "Room temperature unless heated", "Ideal mixing"],
                applications: ["Qualitative analysis (salt identification)", "Water treatment (precipitating contaminants)", "Antacid tablets", "Metal extraction"],
                next: ["Try acid + carbonate: which gas, and how would you test it?", "Predict the precipitate colour before running lead nitrate + KI"]
            }
        });
    }
});

/* ---------------- SOLUTIONS & CONCENTRATIONS ---------------- */
const MMS = [["NaCl", 58.5], ["NaOH", 40], ["KOH", 56.2], ["HCl", 36.5], ["H₂SO₄", 98], ["CuSO₄·5H₂O", 249.7], ["AgNO₃", 169.9], ["KCl", 74.5], ["CaCl₂", 111], ["Na₂CO₃", 106], ["glucose C₆H₁₂O₆", 180], ["KMnO₄", 158]];
R.def({
    id: "chem.conc", subject: "chem", topic: "Solutions & Concentrations", name: "Molarity & Dilution", icon: "🧂",
    level: "Class 10 → 11", laws: ["n = m/M", "M = n/V", "M₁V₁ = M₂V₂ (dilution conserves moles)"],
    apparatus: ["Volumetric flask", "Balance", "Pipette", "Burette"],
    variables: [["m", "solute mass (g)"], ["M", "molar mass (g/mol)"], ["V", "solution volume (mL)"], ["mol", "moles"], ["c", "molarity (mol/L)"]],
    defaults: { sol: 0, mass: 5.85, V: 250, dMode: false, M1: 1, V1: 25, V2: 250 }
}, {
    compute(p) {
        const mm = MMS[p.sol][1];
        const n = p.mass / mm, mol = n / 1000 * 1000;
        const c = n / (p.V / 1000);
        const M2 = p.M1 * p.V1 / p.V2;
        return { mm: mm, n: n, c: c, M2: M2, massForTarget: null };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "dMode", label: "Mode", type: "select", options: [["false", "Make a solution (mass → molarity)"], ["true", "Dilute a solution (M₁V₁ = M₂V₂)"]], onDone: v => { ses.set("dMode", v === "true" || v === true); ses.rerender(); } },
                { k: "sol", label: "Solute", type: "select", options: MMS.map((m, i) => [i, m[0] + " (" + m[1] + " g/mol)"]), num: true, onDone: () => ses.rerender(), showIf: s => !s.params.dMode },
                { k: "mass", label: "Solute mass", min: 0.1, max: 100, step: 0.1, unit: " g", d: 2, onLive: () => ses.rerender(), showIf: s => !s.params.dMode },
                { k: "V", label: "Solution volume", min: 10, max: 1000, step: 10, unit: " mL", d: 0, onLive: () => ses.rerender(), showIf: s => !s.params.dMode },
                { k: "M1", label: "Stock molarity M₁", min: 0.01, max: 12, step: 0.01, unit: " M", d: 2, onLive: () => ses.rerender(), showIf: s => !!s.params.dMode },
                { k: "V1", label: "Stock volume taken V₁", min: 1, max: 500, unit: " mL", d: 0, onLive: () => ses.rerender(), showIf: s => !!s.params.dMode },
                { k: "V2", label: "Final volume V₂", min: 10, max: 2000, step: 10, unit: " mL", d: 0, onLive: () => ses.rerender(), showIf: s => !!s.params.dMode }
            ],
            stage: s => {
                const r = s.compute(), p = s.params;
                let h;
                if (!p.dMode) {
                    const gauge = Math.min(1, p.V / 1000);
                    h = '<div class="flaskviz"><svg width="150" height="220" viewBox="0 0 100 150"><rect x="42" y="6" width="16" height="30" fill="none" stroke="var(--glassb)" stroke-width="2.5"/><path d="M42 36 L42 60 Q12 92 12 122 Q12 142 50 142 Q88 142 88 122 Q88 92 58 60 L58 36" fill="rgba(190,205,235,.12)" stroke="var(--glassb)" stroke-width="2.5"/>' +
                        '<path d="M16 ' + (138 - gauge * 60) + ' Q50 ' + (134 - gauge * 60) + ' 84 ' + (138 - gauge * 60) + ' L84 122 Q84 138 50 138 Q16 138 16 122 Z" fill="var(--acc)" opacity=".5"/>' +
                        '<text x="50" y="100" font-size="9" text-anchor="middle" fill="var(--tx)">' + p.V + ' mL</text></svg>' +
                        '<div class="calc"><b>Working</b><code>n = m/M = ' + p.mass + " / " + r.mm + " = " + U.fmt(r.n, 4) + ' mol</code><code>c = n/V = ' + U.fmt(r.n, 4) + " / " + (p.V / 1000) + " L = " + U.fmt(r.c, 3) + ' mol/L</code></div></div>';
                } else {
                    h = '<div class="flaskviz"><svg width="260" height="150" viewBox="0 0 260 100">' +
                        '<rect x="10" y="30" width="34" height="60" rx="4" fill="none" stroke="var(--glassb)" stroke-width="2"/><rect x="12" y="' + (88 - Math.min(56, p.V1 / 5)) + '" width="30" height="' + Math.min(56, p.V1 / 5) + '" fill="var(--acc)" opacity=".65"/><text x="27" y="24" font-size="9" text-anchor="middle" fill="var(--tx)">V₁ ' + p.V1 + ' mL</text>' +
                        '<path d="M60 60 L110 60" stroke="var(--mut)" stroke-width="2" stroke-dasharray="5 4"/><text x="85" y="52" font-size="9" text-anchor="middle" fill="var(--mut)">+ water</text>' +
                        '<path d="M150 20 L150 50 Q120 70 120 85 Q120 95 175 95 Q230 95 230 85 Q230 70 200 50 L200 20" fill="none" stroke="var(--glassb)" stroke-width="2"/><rect x="124" y="' + (92 - Math.min(50, p.V2 / 20)) + '" width="102" height="' + Math.min(50, p.V2 / 20) + '" rx="6" fill="var(--acc)" opacity=".35"/><text x="175" y="16" font-size="9" text-anchor="middle" fill="var(--tx)">V₂ ' + p.V2 + ' mL</text></svg>' +
                        '<div class="calc"><b>Working</b><code>moles taken = M₁V₁ = ' + p.M1 + " × " + (p.V1 / 1000) + " L = " + U.fmt(p.M1 * p.V1 / 1000, 4) + ' mol</code><code>M₂ = M₁V₁/V₂ = ' + U.fmt(r.M2, 3) + ' mol/L</code><code>water added = ' + (p.V2 - p.V1) + ' mL</code></div></div>';
                }
                return h + '<p class="xsmall">Dilution never changes the number of moles — only the volume they sit in. That single fact is the whole M₁V₁ = M₂V₂ law.</p>';
            },
            note: s => !s.params.dMode
                ? U.ro("Molar mass M", s.results.mm + " g/mol") + U.ro("Moles n", U.fmt(s.results.n, 4) + " mol") + U.ro("Molarity c", U.fmt(s.results.c, 3) + " mol/L") + U.ro("Mass concentration", U.fmt(s.params.mass / (s.params.V / 1000), 1) + " g/L")
                : U.ro("Moles transferred", U.fmt(s.params.M1 * s.params.V1 / 1000, 4) + " mol") + U.ro("New molarity M₂", U.fmt(s.results.M2, 3) + " M") + U.ro("Dilution factor", U.fmt(s.params.V2 / s.params.V1, 1) + "×"),
            payload: s => ({ title: "Concentration", detail: s.params.dMode ? "dilute " + s.params.M1 + " M × " + s.params.V1 + " mL → " + s.params.V2 + " mL = " + U.fmt(s.results.M2, 3) + " M" : s.params.mass + " g " + MMS[s.params.sol][0] + " in " + s.params.V + " mL = " + U.fmt(s.results.c, 3) + " M", results: { M: s.params.dMode ? s.results.M2 : s.results.c } }),
            explain: {
                investigation: "How to quantify 'how strong' a solution is, and how dilution changes it.",
                principle: "Molarity counts particles per litre (chemistry happens particle-to-particle, not gram-to-gram). Dilution conserves moles.",
                equations: ["n = m/M", "c = n/V (mol/L)", "M₁V₁ = M₂V₂"],
                why: s => "Same mass in more water ⇒ fewer particles per litre ⇒ lower molarity. Molar mass converts the balance reading (grams) into the chemical currency (moles).",
                assumptions: ["Solute fully dissolves (below solubility limit)", "Volumes additive (approximately true for dilute solutions)", "Anhydrous masses unless hydrate chosen"],
                applications: ["Making standard solutions for titration", "Medicine dosing (mg per mL)", "Fertiliser feeds", "Serial dilutions in microbiology"],
                next: ["How much NaCl makes exactly 0.5 M in 250 mL? (m = cVM)", "Dilute 12 M HCl to 1 M — what V₁ per litre? (lab safety: acid into water!)"]
            }
        });
    }
});

/* ---------------- ACIDS, BASES & SALTS ---------------- */
R.def({
    id: "chem.acid", subject: "chem", topic: "Acids, Bases & Salts", name: "pH & Titration Curves", icon: "🧪",
    level: "Class 10 → 12", laws: ["pH = −log₁₀[H⁺]", "Kw = [H⁺][OH⁻] = 10⁻¹⁴", "Strong acid–strong base neutralisation", "Indicator ranges"],
    apparatus: ["Burette", "Pipette", "Conical flask", "pH meter", "Indicators"],
    variables: [["Ca", "acid molarity (M)"], ["Cb", "base molarity (M)"], ["Va", "acid volume (mL)"], ["Vb", "base added (mL)"]],
    defaults: { Ca: 0.1, Cb: 0.1, Va: 25, Vb: 25 }
}, {
    compute(p) {
        /* strong acid vs strong base: exact pH from excess H+/OH- */
        const nA = p.Ca * p.Va / 1000, nB = p.Cb * p.Vb / 1000;
        const Vt = (p.Va + p.Vb) / 1000;
        let ph;
        const excess = nA - nB;
        if (Math.abs(excess) < 1e-12) ph = 7;
        else if (excess > 0) ph = -Math.log10(excess / Vt);
        else ph = 14 + Math.log10(-excess / Vt);
        const curve = [];
        for (let v = 0; v <= Math.max(50, p.Va * p.Ca / p.Cb * 2); v += 0.5) {
            const ex = nA - p.Cb * v / 1000, Vx = (p.Va + v) / 1000;
            let y;
            if (Math.abs(ex) < 1e-12) y = 7;
            else if (ex > 0) y = -Math.log10(ex / Vx);
            else y = 14 + Math.log10(-ex / Vx);
            curve.push([v, Math.max(0, Math.min(14, y))]);
        }
        const veq = p.Ca * p.Va / p.Cb;
        return { ph: Math.max(0, Math.min(14, ph)), curve: curve, veq: veq, nA: nA, nB: nB };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "Ca", label: "Acid molarity Ca (HCl)", min: 0.01, max: 1, step: 0.01, unit: " M", d: 2, onLive: () => ses.rerender() },
                { k: "Va", label: "Acid volume Va", min: 5, max: 50, unit: " mL", d: 0, onLive: () => ses.rerender() },
                { k: "Cb", label: "Base molarity Cb (NaOH)", min: 0.01, max: 1, step: 0.01, unit: " M", d: 2, onLive: () => ses.rerender() },
                { k: "Vb", label: "Base added Vb", min: 0, max: 100, step: 0.5, unit: " mL", d: 1, onLive: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute();
                const ind = (lo, hi, acidCol, baseCol, name) => '<span class="indchip">' + name + ': <b style="color:' + (r.ph < lo ? acidCol : r.ph > hi ? baseCol : "var(--mut)") + '">' + (r.ph < lo ? "acid colour" : r.ph > hi ? "base colour" : "transition") + '</b> (' + lo + "–" + hi + ')</span>';
                return U.chart({
                    W: 620, H: 300, xMin: 0, yMin: 0, yMax: 14, series: [{ pts: r.curve, color: C.acc, w: 3 }],
                    markers: [{ x: r.veq, y: 7, label: "equivalence " + U.fmt(r.veq, 1) + " mL", color: C.bad }, { x: s.params.Vb, y: r.ph, label: "pH " + U.fmt(r.ph, 2), color: C.acc2 }],
                    xLabel: "NaOH added (mL)", yLabel: "pH", yTicks: [0, 2, 4, 7, 10, 12, 14]
                }) + '<div class="inds">' + ind(3.1, 4.4, "#dc2626", "#facc15", "Methyl orange") + ind(8.3, 10, "#e9e2cf", "#db2777", "Phenolphthalein") + ind(4.5, 8.3, "#dc2626", "#1d4ed8", "Litmus") + '</div>' +
                    '<p class="xsmall">Strong acid–strong base: pH from the excess ion, pH = −log[H⁺] or 14 + log[OH⁻]. The near-vertical jump at equivalence is why one drop can flip an indicator.</p>';
            },
            note: s => U.ro("Current pH", U.fmt(s.results.ph, 2)) + U.ro("Equivalence at", U.fmt(s.results.veq, 2) + " mL") + U.ro("Acid moles", U.fmt(s.results.nA * 1000, 3) + " mmol") + U.ro("Base moles added", U.fmt(s.results.nB * 1000, 3) + " mmol") + U.ro("At equivalence?", Math.abs(s.params.Vb - s.results.veq) < 0.25 ? "YES — salt + water" : s.params.Vb < s.results.veq ? "not yet — acid in excess" : "past it — base in excess"),
            payload: s => ({ title: "Titration", detail: "Ca=" + s.params.Ca + " M Va=" + s.params.Va + " mL, Cb=" + s.params.Cb + " M, Vb=" + s.params.Vb + " mL → pH " + U.fmt(s.results.ph, 2), results: { ph: s.results.ph } }),
            explain: {
                investigation: "How pH changes through a titration and how indicators signal the end-point.",
                principle: "Neutralisation H⁺ + OH⁻ → H₂O; pH is the log scale of whichever ion is in excess; indicators are weak acids whose two forms have different colours.",
                equations: ["pH = −log₁₀[H⁺]", "[H⁺][OH⁻] = 10⁻¹⁴", "CaVa = CbVb at equivalence"],
                why: s => "The log scale compresses huge concentration changes: 99.9% neutralised is still pH ~4, then one drop jumps to ~10 — the vertical region is the signature of strong–strong titration.",
                assumptions: ["Strong acid + strong base only (weak-acid curves need Ka — planned extension)", "Ideal dilute solutions, 25 °C", "No CO₂ absorption"],
                applications: ["Finding unknown concentrations (volumetric analysis)", "Antacid tablet testing", "Pool/water chemistry", "Acid spill neutralisation"],
                next: ["Set Vb exactly at equivalence: what is the pH and why exactly 7?", "Double Ca: how does the equivalence volume shift?"]
            }
        });
    }
});

/* ---------------- METALS & NON-METALS ---------------- */
const SERIES = [["K", -2.93], ["Na", -2.71], ["Ca", -2.87], ["Mg", -2.37], ["Al", -1.66], ["Zn", -0.76], ["Fe", -0.44], ["Pb", -0.13], ["H", 0], ["Cu", 0.34], ["Ag", 0.80], ["Au", 1.50]];
R.def({
    id: "chem.metals", subject: "chem", topic: "Metals & Non-metals", name: "Reactivity & Displacement", icon: "⚒️",
    level: "Class 10", laws: ["Reactivity series", "Displacement: more reactive metal wins", "Standard electrode potentials E°"],
    apparatus: ["Test tubes", "Metal strips", "Salt solutions", "Dilute acids"],
    variables: [["metal", "solid metal"], ["ion", "metal ion in solution"], ["E°cell", "cell potential (V)"]],
    defaults: { metal: 5, ion: 9 }
}, {
    compute(p) {
        const m = SERIES[p.metal], i = SERIES[p.ion];
        const works = m[1] < i[1];
        const Ecell = i[1] - m[1];
        return { m: m, i: i, works: works, Ecell: Ecell, withAcid: m[1] < 0 };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "metal", label: "Solid metal", type: "select", options: SERIES.map((s2, i) => [i, s2[0] + " (E° = " + s2[1] + " V)"]), num: true, onDone: () => ses.rerender() },
                { k: "ion", label: "Solution contains ions of", type: "select", options: SERIES.filter(s2 => s2[0] !== "H").map((s2, i) => [SERIES.indexOf(s2), s2[0] + "²⁺/⁺ ions (E° = " + s2[1] + " V)"]), num: true, onDone: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute();
                const W = 620, H = 260;
                const idx = SERIES.map(x => x[0]);
                const my = i2 => 24 + (i2 + 0.5) / SERIES.length * (H - 48);
                let o = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xuchart">';
                o += '<text x="60" y="16" font-size="11" fill="var(--mut)">most reactive (loses e⁻ easily)</text><text x="60" y="' + (H - 6) + '" font-size="11" fill="var(--mut)">least reactive</text>';
                SERIES.forEach((x, i2) => {
                    const sel = i2 === s.params.metal || i2 === s.params.ion;
                    o += '<rect x="50" y="' + my(i2) + '" width="' + (340 + x[1] * 90) + '" height="13" rx="6" fill="' + (sel ? (i2 === s.params.metal ? "var(--acc)" : "var(--orange)") : "var(--chip)") + '" stroke="var(--bd)"/><text x="' + (404 + x[1] * 90) + '" y="' + (my(i2) + 11) + '" font-size="11" font-weight="' + (sel ? 800 : 400) + '" fill="var(--tx)">' + x[0] + ' ' + x[1] + ' V</text>';
                });
                const a = my(s.params.metal), b = my(s.params.ion);
                o += '<path d="M30 ' + a + ' Q14 ' + ((a + b) / 2) + ' 30 ' + b + '" fill="none" stroke="' + (r.works ? "var(--ok)" : "var(--bad)") + '" stroke-width="2.6" marker-end=""/>';
                o += '<text x="' + (W - 20) + '" y="' + H / 2 + '" font-size="14" font-weight="800" text-anchor="end" fill="' + (r.works ? "var(--ok)" : "var(--bad)") + '">' + (r.works ? "DISPLACES ✔" : "no reaction ✘") + '</text></svg>';
                return o + '<div class="calc"><b>Prediction</b><code>' + r.m[0] + "(s) + " + r.i[0] + "ⁿ⁺(aq) → " + (r.works ? r.m[0] + "ⁿ⁺(aq) + " + r.i[0] + "(s)   E°cell = +" + U.fmt(r.Ecell, 2) + " V" : "nothing — " + r.m[0] + " cannot push out " + r.i[0]) + '</code><code>with dilute acid: ' + (r.withAcid ? r.m[0] + " reacts, releasing H₂ (metal is above hydrogen)" : r.m[0] + " does not (below hydrogen — like Cu, Ag, Au)") + '</code></div>';
            },
            note: s => U.ro("Metal E°", s.results.m[1] + " V") + U.ro("Ion E°", s.results.i[1] + " V") + U.ro("E°cell", (s.results.works ? "+" : "") + U.fmt(s.results.Ecell, 2) + " V") + U.ro("Displacement", s.results.works ? "yes" : "no") + U.ro("Reacts with dilute acid", s.results.withAcid ? "yes (H₂ gas)" : "no"),
            payload: s => ({ title: "Displacement", detail: s.results.m[0] + " in " + s.results.i[0] + " solution → " + (s.results.works ? "displaces (E°cell +" + U.fmt(s.results.Ecell, 2) + " V)" : "no reaction"), results: { works: s.results.works, E: s.results.Ecell } }),
            explain: {
                investigation: "Which metal displaces which from solution — the reactivity series as a predictive law.",
                principle: "A more reactive metal (more negative E°) donates electrons to a less reactive metal's ions; the greater the E° gap, the stronger the drive.",
                equations: ["M(s) + Nⁿ⁺(aq) → Mⁿ⁺(aq) + N(s) if E°(M) < E°(N)", "E°cell = E°(cathode) − E°(anode) > 0 ⇒ spontaneous"],
                why: s => "Reactivity is really 'how badly the metal wants to stay as an ion'. Potassium gives electrons to almost anything; gold keeps them — that is why gold is found native and potassium never is.",
                assumptions: ["Standard conditions (1 M, 25 °C)", "Aqueous solutions (K/Na/Ca react with WATER first — violent!)", "E° predicts feasibility, not speed"],
                applications: ["Galvanising (Zn protects Fe)", "Thermite welding (Al displaces Fe)", "Copper extraction", "Why aluminium doesn't rust away (oxide skin)"],
                next: ["Why does the bench show Zn darkening CuSO₄ blue → green?", "Find two metals where E°cell ≈ 0.5 V"]
            }
        });
    }
});

/* ---------------- ELECTROCHEMISTRY ---------------- */
R.def({
    id: "chem.elec", subject: "chem", topic: "Electrochemistry", name: "Galvanic Cell Builder", icon: "🔋",
    level: "Class 10 → 12", laws: ["Redox: oxidation loses e⁻, reduction gains", "E°cell = E°cathode − E°anode", "Electrons flow anode → cathode externally"],
    apparatus: ["Two half-cells", "Salt bridge", "Voltmeter", "Wires"],
    variables: [["anode", "oxidation half-cell"], ["cathode", "reduction half-cell"], ["E°cell", "emf (V)"]],
    defaults: { a: 5, c: 9 }
}, {
    compute(p) {
        const A = SERIES[p.a], Cc = SERIES[p.c];
        if (A[0] === Cc[0]) return { E: 0, same: true, A: A, C: Cc };
        /* the more negative E° is the anode by definition; if the user picked otherwise, the cell runs backwards */
        const anode = A[1] < Cc[1] ? A : Cc, cathode = A[1] < Cc[1] ? Cc : A;
        const E = cathode[1] - anode[1];
        return { E: E, same: false, anode: anode, cathode: cathode, pickedA: A, flipped: A[1] > Cc[1] };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "a", label: "Left half-cell (you connect as −)", type: "select", options: SERIES.map((s2, i) => [i, s2[0] + "/" + s2[0] + "ⁿ⁺ (E° " + s2[1] + " V)"]), num: true, onDone: () => ses.rerender() },
                { k: "c", label: "Right half-cell (you connect as +)", type: "select", options: SERIES.map((s2, i) => [i, s2[0] + "/" + s2[0] + "ⁿ⁺ (E° " + s2[1] + " V)"]), num: true, onDone: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute();
                if (r.same) return '<div class="planned"><div class="plico">🔋</div><h3>Identical half-cells</h3><p>E°cell = 0 — no potential difference, no current. A battery needs two different redox couples.</p></div>';
                const W = 620, H = 300;
                const beaker = (x, label, col) => '<path d="M' + (x - 70) + ' 120 L' + (x - 70) + ' 230 Q' + (x - 70) + ' 246 ' + (x - 54) + ' 246 L' + (x + 54) + ' 246 Q' + (x + 70) + ' 246 ' + (x + 70) + ' 230 L' + (x + 70) + ' 120" fill="rgba(190,205,235,.12)" stroke="var(--glassb)" stroke-width="2.4"/><rect x="' + (x - 66) + '" y="160" width="132" height="82" rx="8" fill="' + col + '" opacity=".45"/><rect x="' + (x - 10) + '" y="96" width="20" height="120" rx="3" fill="#9aa7b3" stroke="#0004"/><text x="' + x + '" y="270" font-size="13" text-anchor="middle" font-weight="700" fill="var(--tx)">' + label + '</text>';
                let o = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xuchart">';
                o += beaker(150, r.anode[0] + " (ANODE −, oxidation)", "var(--acc)");
                o += beaker(470, r.cathode[0] + " (CATHODE +, reduction)", "var(--orange)");
                o += '<path d="M280 150 Q310 132 340 150" fill="none" stroke="var(--ok)" stroke-width="7" opacity=".7"/><text x="310" y="176" font-size="10" text-anchor="middle" fill="var(--ok)">salt bridge (ions keep charge balance)</text>';
                o += '<line x1="150" y1="96" x2="150" y2="60" stroke="var(--tx)" stroke-width="2.6"/><line x1="470" y1="96" x2="470" y2="60" stroke="var(--tx)" stroke-width="2.6"/><line x1="150" y1="60" x2="270" y2="60" stroke="var(--tx)" stroke-width="2.6"' + (U.RM() ? "" : ' stroke-dasharray="7 9" class="ewire" style="--spd:2s"') + '/><line x1="350" y1="60" x2="470" y2="60" stroke="var(--tx)" stroke-width="2.6"' + (U.RM() ? "" : ' stroke-dasharray="7 9" class="ewire" style="--spd:2s"') + '/>';
                o += '<circle cx="310" cy="60" r="20" fill="var(--chip)" stroke="var(--tx)" stroke-width="2.4"/><text x="310" y="65" font-size="12" text-anchor="middle" font-weight="800" fill="var(--tx)">V</text><text x="310" y="30" font-size="14" text-anchor="middle" font-weight="800" fill="var(--acc2)">' + U.fmt(r.E, 2) + ' V</text>';
                o += '<text x="200" y="82" font-size="11" fill="var(--acc2)" text-anchor="middle">e⁻ flow →</text>';
                o += '<text x="' + (W / 2) + '" y="' + (H - 8) + '" font-size="12" text-anchor="middle" fill="var(--tx)">' + r.anode[0] + " → " + r.anode[0] + "ⁿ⁺ + ne⁻ (oxidation)   |   " + r.cathode[0] + "ⁿ⁺ + ne⁻ → " + r.cathode[0] + ' (reduction)</text></svg>';
                return o + (r.flipped ? '<p class="xsmall">Note: you wired ' + r.pickedA[0] + ' as the negative terminal, but chemistry decides — ' + r.anode[0] + ' has the more negative E°, so it is the real anode. The voltmeter would read ' + U.fmt(r.E, 2) + ' V the other way round.</p>' : '<p class="xsmall">Anode = more negative E° (oxidation, loses electrons). Electrons travel through the WIRE from anode to cathode; ions travel through the salt bridge.</p>');
            },
            note: s => s.results.same ? U.ro("E°cell", "0 V (identical)") : U.ro("Anode (−)", s.results.anode[0] + ", E° " + s.results.anode[1] + " V") + U.ro("Cathode (+)", s.results.cathode[0] + ", E° " + s.results.cathode[1] + " V") + U.ro("E°cell", U.fmt(s.results.E, 2) + " V") + U.ro("Spontaneous?", s.results.E > 0 ? "yes" : "no"),
            payload: s => ({ title: "Galvanic cell", detail: s.results.same ? "identical half-cells" : s.results.anode[0] + "|" + s.results.cathode[0] + " → E°cell " + U.fmt(s.results.E, 2) + " V", results: { E: s.results.E } }),
            explain: {
                investigation: "How chemical energy becomes electrical energy, and which electrode is which.",
                principle: "Split a redox reaction in space: oxidation at the anode releases electrons into the wire; reduction at the cathode consumes them; the salt bridge completes the circuit ionically.",
                equations: ["E°cell = E°cathode − E°anode", "anode: M → Mⁿ⁺ + ne⁻", "cathode: Nⁿ⁺ + ne⁻ → N"],
                why: s => "The greater the gap in electron-hunger (E°), the harder electrons are pushed — the Daniell cell (Zn|Cu) gives the classic 1.10 V.",
                assumptions: ["Standard conditions (1 M, 25 °C, 1 atm)", "Ideal salt bridge (no liquid junction potential)", "Reversible electrodes"],
                applications: ["All batteries (Leclanché, Li-ion)", "Electroplating (run it backwards!)", "Corrosion as a short-circuited cell", "pH meters (glass electrode)"],
                next: ["Build exactly 1.10 V (find the pair)", "Which combination makes the biggest voltage in the list? (K|Au — but potassium meets water first!)"]
            }
        });
    }
});

/* ---------------- PRACTICAL RECORDS (shared workspace view) ---------------- */
R.def({
    id: "ws.practicals", subject: "ws", topic: "Practicals", name: "Practical Records", icon: "📋",
    level: "Class 10", laws: ["Experimental method"],
    variables: [],
    defaults: { only: "all" }
}, {
    mount(ses) {
        const root = ses.el;
        root.className = "xview-inner wview pracwrap";
        const render = () => {
            const cl = CL();
            if (!cl || !cl.ACTS) { root.innerHTML = '<p class="xsmall">Bench data still loading…</p>'; return; }
            const done = cl.doneGet();
            let tot = 0, got = 0;
            cl.ACTS.forEach(a => { if (a[2]) { tot += a[2].length; a[2].forEach((c2, j) => { }); } });
            Object.keys(done).forEach(k => { if (done[k]) got++; });
            let h = '<div class="pracbar"><b>📋 Practical records</b><span>' + got + ' / ' + tot + ' observations verified on the bench</span><div class="ftrack"><div style="width:' + (tot ? Math.round(got / tot * 100) : 0) + '%;background:var(--ok)"></div></div></div>';
            cl.ACTS.forEach((a, i) => {
                const checks = a[2] || [];
                const nDone = checks.filter((c2, j) => done[i + "." + j]).length;
                h += '<div class="prac' + (checks.length && nDone === checks.length ? " done" : "") + '"><div class="prachead"><b>' + a[0] + '</b>' + (checks.length ? '<span class="pchip">' + (nDone === checks.length ? "✅ completed" : nDone + "/" + checks.length) + '</span>' : '<span class="pchip free">free exploration</span>') + '</div>' +
                    '<p>' + a[1] + '</p>' +
                    (checks.length ? '<div class="prachecks">' + checks.map((c2, j) => '<div class="' + (done[i + "." + j] ? "ck on" : "ck") + '">' + (done[i + "." + j] ? "✔" : "○") + " " + c2[0] + '</div>').join("") + '</div>' : "") +
                    '<button type="button" class="btn sm" data-bench="' + i + '">🧪 Open bench for this</button></div>';
            });
            root.innerHTML = h;
            root.querySelectorAll("[data-bench]").forEach(b => b.onclick = () => {
                U.Shell.applyView("chem.bench");
                U.toast("Bench opened — follow the procedure, the observations tick off automatically");
            });
        };
        render();
        ses.exp.onShow = render;
    },
    onShow(ses) { if (ses.onShowHook) ses.onShowHook(); }
});
})();
