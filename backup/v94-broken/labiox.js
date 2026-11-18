(function () {
/* ===================================================================
   LabBioX (v94): Biology Lab content — every model delegates to
   BioCore (or a small stated model). Charts are computed curves.
   =================================================================== */
"use strict";
const R = window.LabReg, U = window.LabUI;
const B = () => window.BioCore;
const C = { acc: "var(--acc)", acc2: "var(--acc2)", ok: "var(--ok)", bad: "var(--bad)", orange: "var(--orange)", mut: "var(--mut)" };

/* ---------------- PLANT PHYSIOLOGY: photosynthesis ---------------- */
R.def({
    id: "bio.photo", subject: "bio", topic: "Plant Physiology", name: "Photosynthesis Chamber", icon: "🌿",
    level: "Class 10", laws: ["Limiting factors", "Saturation kinetics", "Q10 enzyme temperature dependence", "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂"],
    apparatus: ["Water plant (Hydrilla)", "Funnel + test tube", "Lamp", "CO₂ source (NaHCO₃)", "Thermometer"],
    variables: [["light", "light intensity (%)"], ["co2", "CO₂ concentration (ppm)"], ["T", "temperature (°C)"]],
    defaults: { light: 60, co2: 400, ptemp: 25 }
}, {
    compute(p) { return B().photo({ light: p.light, co2: p.co2, temp: p.ptemp }); },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "light", label: "Light intensity", min: 0, max: 100, unit: "%", d: 0, onLive: () => ses.rerender() },
                { k: "co2", label: "CO₂ concentration", min: 0, max: 1500, step: 10, unit: " ppm", d: 0, onLive: () => ses.rerender() },
                { k: "ptemp", label: "Temperature", min: 0, max: 55, unit: " °C", d: 0, onLive: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute();
                const curve = [];
                for (let L = 0; L <= 100; L += 2) curve.push([L, B().photo({ light: L, co2: s.params.co2, temp: s.params.ptemp }).net]);
                const comp = curve.find(p => p[1] >= 0);
                return U.chart({
                    W: 620, H: 280, zeroY: true, xMin: 0, xMax: 100, series: [{ pts: curve, color: C.ok, w: 3 }],
                    markers: [{ x: s.params.light, y: r.net, label: "you", color: C.acc2 }].concat(comp ? [{ x: comp[0], y: 0, label: "compensation point", color: C.bad }] : []),
                    xLabel: "light intensity (%)", yLabel: "net O₂ rate (model units)"
                }) +
                    '<div class="factors">' + [["light", r.L, C.orange], ["CO₂", r.C, C.acc], ["temp", r.tF, C.ok]].map(f =>
                        '<div class="fbar"><div class="ftrack"><div style="width:' + Math.round(f[1] * 100) + '%;background:' + f[2] + '"></div></div><span>' + f[0] + ' factor ' + Math.round(f[1] * 100) + '%</span></div>').join("") + '</div>' +
                    '<p class="xsmall">Net rate = gross photosynthesis − respiration. Both are computed from the model; the compensation point (net = 0) is found numerically, not drawn in.</p>';
            },
            note: s => U.ro("Gross photosynthesis", U.fmt(s.results.gross, 1)) + U.ro("Respiration", U.fmt(s.results.resp, 1)) + U.ro("Net O₂ output", U.fmt(s.results.net, 1)) + U.ro("Limiting factor", s.results.limiting),
            payload: s => ({ title: "Photosynthesis", detail: "light=" + s.params.light + "% CO₂=" + s.params.co2 + " ppm T=" + s.params.ptemp + "°C → net=" + U.fmt(s.results.net, 1) + ", limiting: " + s.results.limiting, results: { net: s.results.net, limiting: s.results.limiting } }),
            explain: {
                investigation: "Which environmental factor limits photosynthesis right now, and where does the plant break even?",
                principle: "Rate = light-saturation × CO₂-saturation × enzyme-temperature curve; respiration runs its own Q10 curve in parallel.",
                equations: ["L/(L+25) light saturation", "CO₂/(CO₂+350)", "Q10: rate ×2 per +10 °C", "net = gross − respiration"],
                why: s => "The smallest factor term throttles the product — raising the others cannot help until it is lifted (Blackman's limiting-factor law). Above ~38 °C the enzyme term collapses: denaturation, not slow-down.",
                assumptions: ["Saturation (Michaelis-like) responses", "No water stress or photorespiration detail", "Model units, not µmol m⁻² s⁻¹"],
                applications: ["Greenhouse CO₂ enrichment", "Grow-light spacing", "Crop choice by climate", "Aquarium plant care"],
                next: ["Find the light % where net = 0 at 400 ppm", "Raise CO₂ to 1000 ppm: which factor now limits?"]
            }
        });
    }
});

/* ---------------- ENZYMES ---------------- */
R.def({
    id: "bio.enz", subject: "bio", topic: "Enzymes", name: "Enzyme Bench", icon: "🧫",
    level: "Class 10 → 12", laws: ["Lock-and-key / induced fit", "Michaelis–Menten kinetics", "Q10 + thermal denaturation", "pH activity profile"],
    apparatus: ["Water bath", "Buffers", "Colorimeter", "Stopwatch"],
    variables: [["T", "temperature (°C)"], ["pH", "0–14"], ["[S]", "substrate (mM)"], ["Km", "Michaelis constant (mM)"]],
    defaults: { enz: "amylase", etemp: 37, ph: 7, S: 20, curveVar: "temp" }
}, {
    compute(p) { return B().enzyme({ id: p.enz, temp: p.etemp, ph: p.ph, S: p.S }); },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "enz", label: "Enzyme", type: "select", options: Object.keys(B().ENZYMES).map(k => [k, B().ENZYMES[k].n]), onDone: () => ses.rerender() },
                { k: "etemp", label: "Temperature", min: 0, max: 80, unit: " °C", d: 0, onLive: () => ses.rerender() },
                { k: "ph", label: "pH", min: 0, max: 14, step: 0.5, d: 1, onLive: () => ses.rerender() },
                { k: "S", label: "Substrate [S]", min: 0, max: 100, unit: " mM", d: 0, onLive: () => ses.rerender() },
                { k: "curveVar", label: "Chart shows", type: "select", options: [["temp", "Activity vs temperature"], ["ph", "Activity vs pH"], ["S", "Activity vs [S] (Michaelis–Menten)"]], onDone: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute(), E = B().ENZYMES;
                let curve, spec;
                if (s.params.curveVar === "temp") {
                    curve = []; for (let T = 0; T <= 80; T += 1) curve.push([T, B().enzyme({ id: s.params.enz, temp: T, ph: s.params.ph, S: s.params.S }).activity]);
                    spec = { xMin: 0, xMax: 80, series: [{ pts: curve, color: C.acc, w: 3 }], markers: [{ x: s.params.etemp, y: r.activity, label: fmt(r.activity) + "%", color: C.acc2 }], xLabel: "temperature (°C)", yLabel: "activity (%)", yMin: 0, yMax: 100 };
                } else if (s.params.curveVar === "ph") {
                    curve = []; for (let p = 0; p <= 14; p += 0.2) curve.push([p, B().enzyme({ id: s.params.enz, temp: s.params.etemp, ph: p, S: s.params.S }).activity]);
                    spec = { xMin: 0, xMax: 14, series: [{ pts: curve, color: C.ok, w: 3 }], markers: [{ x: s.params.ph, y: r.activity, label: fmt(r.activity) + "%", color: C.acc2 }], xLabel: "pH", yLabel: "activity (%)", yMin: 0, yMax: 100 };
                } else {
                    curve = []; for (let S = 0; S <= 100; S += 1) curve.push([S, B().enzyme({ id: s.params.enz, temp: s.params.etemp, ph: s.params.ph, S: S }).activity]);
                    spec = { xMin: 0, xMax: 100, series: [{ pts: curve, color: C.orange, w: 3 }], markers: [{ x: s.params.S, y: r.activity, label: fmt(r.activity) + "%", color: C.acc2 }, { x: r.e.Km * s.params.S / Math.max(1e-9, s.params.S), y: r.activity, color: C.bad }], xLabel: "substrate [S] (mM)", yLabel: "activity (%)", yMin: 0, yMax: 100 };
                }
                return U.chart(Object.assign({ W: 620, H: 280 }, spec)) +
                    '<p class="xsmall">' + r.e.n + " — " + r.e.where + '. Activity = temp-curve × pH-curve × S/(S+Km), Km = ' + r.e.Km + ' mM. The sharp cliff past ' + r.e.tOpt + ' °C is denaturation (irreversible), not a slow-down.</p>';
            },
            note: s => U.ro("Activity", U.fmt(s.results.activity, 1) + "%") + U.ro("Temperature factor", Math.round(s.results.tC * 100) + "%") + U.ro("pH factor", Math.round(s.results.pC * 100) + "%") + U.ro("Substrate saturation", Math.round(s.results.mm * 100) + "%") + U.ro("Holding you back", s.results.worst),
            payload: s => ({ title: "Enzyme", detail: s.results.e.n + " at " + s.params.etemp + "°C pH " + s.params.ph + " [S]=" + s.params.S + " mM → " + U.fmt(s.results.activity, 1) + "%", results: { activity: s.results.activity } }),
            explain: {
                investigation: "How temperature, pH and substrate concentration each control enzyme activity.",
                principle: "Enzymes are proteins with an optimum shape: kinetics rise with collisions (Q10), collapse when the shape is destroyed (denaturation / wrong pH charge), and saturate when every active site is busy.",
                equations: ["v = Vmax·S/(Km+S)", "temp factor: Gaussian, sharp above Topt", "pH factor: Gaussian around pH optimum"],
                why: s => "Pepsin's optimum is pH 2 because the stomach is acidic; trypsin's is pH 8 for the intestine — same chemistry, different homes. Saturation flattens because adding substrate cannot add active sites.",
                assumptions: ["Single-substrate Michaelis–Menten", "No inhibitors/activators modelled", "Denaturation shown as instantaneous equilibrium, not time-dependent"],
                applications: ["Fever danger (enzyme denaturation)", "Detergent enzymes (warm, alkaline)", "Food processing (papain tenderiser)", "Drug design (active-site blockers)"],
                next: ["Compare pepsin vs trypsin at pH 7 — who survives?", "Find [S] that gives exactly half Vmax (that is Km by definition)"]
            }
        });
    }
});
function fmt(x) { return U.fmt(x, 1); }

/* ---------------- GENETICS ---------------- */
const TRAITS = [["Pea height", "T", "t", "Tall", "Dwarf"], ["Seed colour", "Y", "y", "Yellow", "Green"], ["Flower colour", "P", "p", "Purple", "White"]];
R.def({
    id: "bio.gen", subject: "bio", topic: "Genetics", name: "Mendelian Crosses", icon: "🧬",
    level: "Class 10 → 12", laws: ["Law of segregation", "Law of independent assortment", "Dominance"],
    apparatus: ["Punnett square", "Pea plant trait records"],
    variables: [["P1,P2", "parent genotypes"], ["trait", "dominant/recessive allele pair"], ["dihybrid", "two traits at once"]],
    defaults: { trait: 0, p1: "Tt", p2: "Tt", di: false, p1b: "Yy", p2b: "Yy" },
    blurb: ""
}, {
    compute(p) {
        const t1 = TRAITS[p.trait], t2 = TRAITS[(p.trait + 1) % 3];
        const traits = [{ dom: t1[1], rec: t1[2], p1: p.p1, p2: p.p2, domName: t1[3], rName: t1[4] }];
        if (p.di) traits.push({ dom: t2[1], rec: t2[2], p1: p.p1b, p2: p.p2b, domName: t2[3], rName: t2[4] });
        return B().cross({ traits: traits });
    },
    mount(ses) {
        const gOpts = (t, cur) => [[t[1] + t[1], t[1] + t[1]], [t[1] + t[2], t[1] + t[2]], [t[2] + t[2], t[2] + t[2]]].map(o => [o[0], o[1]]);
        U.buildView(ses, {
            controls: [
                { k: "trait", label: "Trait", type: "select", options: TRAITS.map((t, i) => [i, t[0] + " (" + t[1] + "/" + t[2] + ")"]), num: true, onDone: v => { ses.set("p1", TRAITS[v][1] + TRAITS[v][2]); ses.set("p2", TRAITS[v][1] + TRAITS[v][2]); ses.rerender(); rebuildGen(ses); } },
                { k: "p1", label: "Parent 1", type: "select", options: gOpts(TRAITS[ses.params.trait], ses.params.p1), onDone: () => ses.rerender() },
                { k: "p2", label: "Parent 2", type: "select", options: gOpts(TRAITS[ses.params.trait], ses.params.p2), onDone: () => ses.rerender() },
                { k: "di", label: "Dihybrid cross (adds " + TRAITS[(ses.params.trait + 1) % 3][0] + ")", type: "check", onDone: () => { ses.rerender(); rebuildGen(ses); } }
            ],
            stage: s => {
                const r = s.compute();
                const half = r.grid[0][0].length / 2;
                let h = '<table class="pgrid"><tr><th></th>' + r.grid[0].map((_, j) => '<th>' + r.grid[0][j].slice(half) + '</th>').join("") + '</tr>' +
                    r.grid.map(row => '<tr><th>' + row[0].slice(0, half) + '</th>' + row.map(g => '<td>' + g + '</td>').join("") + '</tr>').join("") + '</table>';
                const ph = Object.entries(r.pheno).sort((a, b) => b[1] - a[1]);
                h += '<div class="ratio">' + ph.map(p2 => '<span class="rc"><b>' + p2[1] + '</b>' + p2[0] + '</span>').join("") + '</div>';
                h += '<p class="xsmall">Gametes are generated by the algorithm (segregation + assortment), then every fertilisation combination is enumerated — the square is a computation, not a template.</p>';
                return h;
            },
            note: s => {
                const r = s.results;
                return U.ro("Offspring boxes", r.total) + "<b>Genotypes</b><br>" + Object.entries(r.geno).map(e => e[0] + " ×" + e[1]).join(", ") +
                    U.why("Phenotype ratio " + Object.entries(r.pheno).sort((a, b) => b[1] - a[1]).map(e => e[1]).join(":") + (s.params.di ? " — the classic 9:3:3:1 appears only when both parents are doubly heterozygous." : ""));
            },
            payload: s => ({ title: "Cross", detail: s.params.p1 + "×" + s.params.p2 + (s.params.di ? " ; " + s.params.p1b + "×" + s.params.p2b : "") + " → " + Object.entries(s.results.pheno).sort((a, b) => b[1] - a[1]).map(e => e[1]).join(":"), results: { pheno: s.results.pheno } }),
            explain: {
                investigation: "What offspring ratios follow from parent genotypes, and why.",
                principle: "Alleles segregate into gametes (one per trait); different traits assort independently; dominance masks recessives in heterozygotes.",
                equations: ["monohybrid Aa×Aa → 1:2:1 geno, 3:1 pheno", "dihybrid AaBb×AaBb → 9:3:3:1"],
                why: s => "Ratios are counting outcomes of equally likely gamete meetings — change a parent to homozygous and whole columns collapse, which the square shows immediately.",
                assumptions: ["Single-gene traits, complete dominance", "No linkage, crossing over, or lethality", "Large offspring numbers (ratios are probabilities)"],
                applications: ["Genetic counselling", "Crop & animal breeding", "Paternity/blood-type logic", "Understanding carrier status"],
                next: ["Cross Tt × tt — why 1:1?", "Try Yy × YY and predict before looking"]
            }
        });
        function rebuildGen(s) { s.dom.ctl.querySelectorAll(".xu-ctl").forEach(x => x.remove ? 0 : 0); }
    }
});

/* ---------------- ECOLOGY ---------------- */
R.def({
    id: "bio.chain", subject: "bio", topic: "Ecology", name: "Energy Flow & Food Chains", icon: "🕸",
    level: "Class 10", laws: ["10% energy-transfer law (Lindeman)", "Conservation of energy", "Pyramid of energy"],
    apparatus: ["Ecosystem energy records"],
    variables: [["producer kJ", "energy captured"], ["levels", "trophic levels"], ["efficiency %", "transfer fraction"]],
    defaults: { prod: 10000, lv: 4, eff: 10 }
}, {
    compute(p) { return B().chain({ producerkJ: p.prod, levels: p.lv, eff: p.eff }); },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "prod", label: "Producer energy", min: 1000, max: 100000, step: 500, unit: " kJ", d: 0, onLive: () => ses.rerender() },
                { k: "lv", label: "Trophic levels", min: 2, max: 5, d: 0, onLive: () => ses.rerender() },
                { k: "eff", label: "Transfer efficiency", min: 2, max: 25, unit: "%", d: 0, onLive: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute(), mx = r.levels[0].kJ;
                const cols = [C.ok, C.acc, C.orange, C.bad, C.acc2];
                let h = '<div class="pyr">' + r.levels.map((l, i) =>
                    '<div class="pyrl" style="width:' + Math.max(8, l.kJ / mx * 100) + '%;background:' + cols[i] + '"><b>' + l.name + '</b> ' + U.fmt(l.kJ, 0) + ' kJ <small>(' + (i ? U.fmt(l.kJ / mx * 100, 2) : "100") + '% of producers)</small></div>').join("") + '</div>';
                const curve = []; for (let i = 0; i < r.levels.length; i++) curve.push([i, r.levels[i].kJ]);
                h += U.chart({ W: 620, H: 220, series: [{ pts: curve, color: C.acc, w: 3 }], xLabel: "trophic level", yLabel: "energy (kJ)", xMin: 0, xMax: Math.max(1, r.levels.length - 1), xTicks: r.levels.map((l, i) => i), td: 0 });
                return h;
            },
            note: s => U.ro("Efficiency", (s.results.eff * 100).toFixed(0) + "%") + U.ro("Top level energy", U.fmt(s.results.levels[s.results.levels.length - 1].kJ, 1) + " kJ") + U.ro("Lost as heat/waste", U.fmt(s.results.levels[0].kJ - s.results.levels[s.results.levels.length - 1].kJ, 0) + " kJ"),
            payload: s => ({ title: "Food chain", detail: s.params.prod + " kJ, " + s.params.lv + " levels, " + s.params.eff + "% → top " + U.fmt(s.results.levels[s.results.levels.length - 1].kJ, 1) + " kJ", results: { top: s.results.levels[s.results.levels.length - 1].kJ } }),
            explain: {
                investigation: "Why food chains are short and top predators are rare.",
                principle: "Each transfer keeps only a fraction of energy (respiration, heat, waste take the rest); energy pyramids can never invert.",
                equations: ["E_next = E_prev × efficiency", "10% law: 4 levels ⇒ 0.1% of producer energy remains"],
                why: s => "Multiply repeatedly by a fraction and numbers crash: at 10%, a 5-level chain leaves one-thousandth of the base — ecosystems cannot support many such levels.",
                assumptions: ["Constant efficiency per level", "Steady-state ecosystem", "Energy in kJ per unit area per year"],
                applications: ["Why vegetarian diets feed more people", "Conservation: apex predators need huge ranges", "Fisheries quotas", "Pest-control economics"],
                next: ["Slide efficiency to 20%: does a 5th level become viable?", "Compute how many kg of grain 'cost' 1 kg of beef at 10%"]
            }
        });
    }
});

/* ---------------- HUMAN PHYSIOLOGY ---------------- */
R.def({
    id: "bio.cardiac", subject: "bio", topic: "Human Physiology", name: "Cardiac Output & O₂ Delivery", icon: "❤️",
    level: "Class 10 → 12", laws: ["CO = SV × HR (Fick principle basis)", "O₂ delivery = CO × CaO₂", "Homeostasis / negative feedback"],
    apparatus: ["Spirometer (conceptual)", "Pulse oximeter (conceptual)"],
    variables: [["HR", "heart rate (bpm)"], ["SV", "stroke volume (mL)"], ["CaO₂", "arterial O₂ content (mL O₂/100 mL)"]],
    defaults: { hr: 72, sv: 70, cao2: 20, exer: 0, fit: 0 },
    blurb: "A Fick-principle model of circulation during exercise and training."
}, {
    compute(p) {
        /* exercise raises HR (chronotropic) and SV modestly; fitness raises SV, lowers resting HR */
        const hrEff = p.hr * (1 + 0.9 * p.exer / 100) * (1 - 0.12 * p.fit / 100);
        const svEff = p.sv * (1 + 0.35 * p.exer / 100) * (1 + 0.25 * p.fit / 100);
        const CO = hrEff * svEff / 1000;                 /* L/min */
        const DO2 = CO * p.cao2 * 10;                    /* mL O2/min (CaO2 per 100 mL) */
        return { hr: hrEff, sv: svEff, CO: CO, DO2: DO2, maxCO: 22 - 0.1 * 15 /* illustrative ceiling */ };
    },
    mount(ses) {
        U.buildView(ses, {
            controls: [
                { k: "hr", label: "Resting heart rate", min: 40, max: 120, unit: " bpm", d: 0, onLive: () => ses.rerender() },
                { k: "sv", label: "Stroke volume", min: 40, max: 120, unit: " mL", d: 0, onLive: () => ses.rerender() },
                { k: "cao2", label: "Arterial O₂ content", min: 10, max: 22, step: 0.5, unit: " mL/100mL", d: 1, onLive: () => ses.rerender() },
                { k: "exer", label: "Exercise intensity", min: 0, max: 100, unit: "%", d: 0, onLive: () => ses.rerender() },
                { k: "fit", label: "Fitness (training) level", min: 0, max: 100, unit: "%", d: 0, onLive: () => ses.rerender() }
            ],
            stage: s => {
                const r = s.compute();
                const curve = [];
                for (let e = 0; e <= 100; e += 2) {
                    const hr = s.params.hr * (1 + 0.9 * e / 100) * (1 - 0.12 * s.params.fit / 100);
                    const sv = s.params.sv * (1 + 0.35 * e / 100) * (1 + 0.25 * s.params.fit / 100);
                    curve.push([e, hr * sv / 1000]);
                }
                return U.chart({
                    W: 620, H: 280, xMin: 0, xMax: 100, yMin: 0, series: [{ pts: curve, color: C.bad, w: 3 }],
                    markers: [{ x: s.params.exer, y: r.CO, label: U.fmt(r.CO, 1) + " L/min", color: C.acc2 }],
                    xLabel: "exercise intensity (%)", yLabel: "cardiac output (L/min)"
                }) + '<p class="xsmall">Model: HR rises ×(1+0.9·E), SV rises ×(1+0.35·E); training shifts both (higher SV, lower resting HR — the athlete\'s heart). All curves are computed, not illustrated.</p>';
            },
            note: s => U.ro("Effective HR", U.fmt(s.results.hr, 0) + " bpm") + U.ro("Effective SV", U.fmt(s.results.sv, 0) + " mL") + U.ro("Cardiac output", U.fmt(s.results.CO, 2) + " L/min") + U.ro("O₂ delivery", U.fmt(s.results.DO2, 0) + " mL/min"),
            payload: s => ({ title: "Cardiac output", detail: "HR=" + s.params.hr + " SV=" + s.params.sv + " exer=" + s.params.exer + "% fit=" + s.params.fit + "% → CO=" + U.fmt(s.results.CO, 2) + " L/min", results: { CO: s.results.CO, DO2: s.results.DO2 } }),
            explain: {
                investigation: "How the circulatory system meets oxygen demand during exercise.",
                principle: "Cardiac output = stroke volume × heart rate; O₂ delivery = CO × arterial O₂ content. Exercise and training change both factors (homeostatic negative feedback via the medulla).",
                equations: ["CO = SV × HR", "DO₂ = CO × CaO₂ × 10", "athlete: SV↑, resting HR↓"],
                why: s => "At rest ~5 L/min suffices; heavy exercise demands 20+ L/min. Untrained people get there mostly via HR (they max out sooner); trained hearts get there via SV — efficient and sustainable.",
                assumptions: ["Linear chronotropic/inotropic response (real response saturates near HRmax ≈ 220 − age)", "Constant CaO₂ (no altitude/anaemia model)", "Steady state, no O₂ debt dynamics"],
                applications: ["Fitness testing (VO₂max)", "Clinical cardiac monitoring", "Altitude physiology", "Training programme design"],
                next: ["Push exercise to 100% at fitness 0 vs 100 — compare CO", "Halve CaO₂ (anaemia): what must CO do to compensate?"]
            }
        });
    }
});

/* ---------------- CELL BIOLOGY (interactive diagram — reference, honest about scope) ---------------- */
R.def({
    id: "bio.cell", subject: "bio", topic: "Cell Biology", name: "Cell Explorer", icon: "🔬",
    level: "Class 10", laws: ["Cell theory", "Structure ↔ function"],
    apparatus: ["Light microscope (virtual)", "Labelled slides"],
    variables: [["cell type", "animal / plant"], ["structure", "tap to inspect"]],
    defaults: { cell: "animal", sel: "" },
    blurb: "Interactive labelled diagram. Simulation of transport across membranes is planned."
}, {
    compute(p) { return { sel: p.sel }; },
    mount(ses) {
        const PARTS = {
            animal: [
                ["Nucleus", 250, 150, 46, "Control centre: holds DNA, directs protein synthesis and cell division."],
                ["Mitochondrion", 120, 90, 20, "Powerhouse: aerobic respiration releases ATP from glucose."],
                ["Ribosome", 330, 220, 8, "Protein factories; some free, some on rough ER."],
                ["Cell membrane", 480, 160, 10, "Selectively permeable boundary controlling what enters/leaves."],
                ["Cytoplasm", 170, 220, 16, "Jelly-like site of many metabolic reactions."],
                ["Endoplasmic reticulum", 350, 90, 22, "Transport network; rough ER (with ribosomes) makes proteins, smooth ER makes lipids."]
            ],
            plant: [
                ["Nucleus", 250, 150, 42, "Control centre with DNA."],
                ["Chloroplast", 130, 100, 22, "Site of photosynthesis: chlorophyll captures light to make glucose."],
                ["Cell wall", 480, 160, 10, "Rigid cellulose wall: support and protection."],
                ["Vacuole", 330, 180, 55, "Large sap-filled sac: keeps the cell turgid."],
                ["Cell membrane", 462, 160, 8, "Controls movement of substances inside the wall."],
                ["Mitochondrion", 150, 230, 18, "Respiration releases ATP — yes, plants respire too."]
            ]
        };
        U.buildView(ses, {
            controls: [
                { k: "cell", label: "Cell type", type: "select", options: [["animal", "Animal cell"], ["plant", "Plant cell"]], onDone: () => ses.rerender() }
            ],
            stage: s => {
                const parts = PARTS[s.params.cell];
                const W = 620, H = 320;
                let o = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="xuchart">';
                if (s.params.cell === "animal") o += '<circle cx="250" cy="160" r="145" fill="var(--chip)" stroke="var(--acc)" stroke-width="4"/>';
                else o += '<rect x="70" y="30" width="420" height="270" rx="26" fill="var(--chip)" stroke="var(--ok)" stroke-width="7"/><rect x="82" y="42" width="396" height="246" rx="18" fill="none" stroke="var(--acc)" stroke-width="3"/>';
                parts.forEach(p => {
                    const on = s.params.sel === p[0];
                    o += '<circle cx="' + p[1] + '" cy="' + p[2] + '" r="' + p[3] + '" fill="' + (on ? "var(--acc2)" : "var(--acc)") + '" opacity="' + (on ? .9 : .55) + '" class="cellpart" data-p="' + p[0] + '" style="cursor:pointer"><title>' + p[0] + '</title></circle>' +
                        '<text x="' + p[1] + '" y="' + (p[2] + p[3] + 13) + '" font-size="10.5" fill="var(--tx)" text-anchor="middle" style="pointer-events:none">' + p[0] + '</text>';
                });
                if (s.params.cell === "animal") { o += '<circle cx="250" cy="150" r="16" fill="var(--acc2)" opacity=".8"/>'; }
                o += '</svg>';
                const sel = parts.find(p => p[0] === s.params.sel);
                o += '<div class="cellinfo">' + (sel ? '<b>' + sel[0] + '</b><p>' + sel[4] + '</p>' : '<p class="xsmall">Tap any labelled structure to read its function. (Animal vs plant: cell wall, chloroplasts and a big vacuole are the three giveaways.)</p>') + '</div>';
                const host = document.createElement("div");
                host.innerHTML = o;
                host.querySelectorAll(".cellpart").forEach(c => c.addEventListener("click", () => { s.set("sel", c.dataset.p); s.rerender(); }));
                return host;
            },
            note: s => {
                const parts = PARTS[s.params.cell];
                return parts.map(p => U.ro(p[0], s.params.sel === p[0] ? "✔ inspecting" : "")).join("") +
                    U.why("Cell theory: all living things are made of cells; cells come from pre-existing cells. Structure matches function — flat red cells carry O₂, long nerve cells carry signals, root-hair cells have huge surface area for water.");
            },
            payload: s => ({ title: "Cell explorer", detail: s.params.cell + " cell, inspecting: " + (s.params.sel || "none") }),
            explain: {
                investigation: "Which structures cells contain and what each one does.",
                principle: "Cell theory + structure–function relationship.",
                equations: ["surface area : volume limits cell size (SA ∝ r², V ∝ r³)"],
                why: s => "As a cell grows, volume outpaces surface area — diffusion cannot keep up, which is why cells stay microscopic and big organisms are multicellular.",
                assumptions: ["Schematic, not to scale", "Transport/osmosis simulation: planned next module"],
                applications: ["Medicine (organelle diseases)", "Biotech (engineered cells)", "Understanding stains under the microscope"],
                next: ["List three structures plant cells have that animal cells lack", "Why do muscle cells pack mitochondria?"]
            }
        });
    }
});

/* ---------------- BIOLOGICAL EXPERIMENTS (planned) ---------------- */
R.def({
    id: "bio.exps", subject: "bio", topic: "Biological Experiments", name: "Guided Bio Experiments", icon: "🧪",
    level: "Class 10", laws: ["Experimental method"],
    planned: true,
    blurb: "Step-guided wet-lab simulations (osmosis in potato strips, transpiration potometer, starch test on leaves) driven by the existing models. Registered in the architecture; model integration is the next milestone."
});
})();
