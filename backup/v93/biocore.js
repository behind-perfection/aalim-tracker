(function () {
/* ===================================================================
   BioCore: process models built from biological laws, not canned answers.
   - Photosynthesis: saturated light & CO2 responses (limiting factors)
     multiplied by an enzyme temperature curve (Q10 rise + denaturation);
     respiration runs its own Q10 curve, so the compensation point EMERGES.
   - Enzymes: temperature × pH × Michaelis–Menten substrate saturation.
   - Genetics: Mendel's laws as an algorithm — gametes by segregation and
     independent assortment, offspring by combination. Any cross works.
   - Ecology: energy flow with the 10% law (efficiency adjustable).
   =================================================================== */
"use strict";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const q10 = (T, base, ref) => base * Math.pow(2, (T - ref) / 10);
const denat = (T, Td, w) => T <= Td ? 1 : Math.exp(-Math.pow((T - Td) / w, 2));
const gauss = (x, opt, w) => Math.exp(-Math.pow((x - opt) / w, 2));

/* ---- photosynthesis chamber ---- */
function photo(o) {
    const light = clamp(o.light ?? 50, 0, 100), co2 = clamp(o.co2 ?? 400, 0, 1500), T = clamp(o.temp ?? 25, 0, 55);
    const L = light / (light + 25);              // light saturation (half-saturation 25%)
    const C = co2 / (co2 + 350);                 // CO2 saturation
    const tF = clamp(Math.pow(2, (T - 20) / 10) * denat(T, 38, 5), 0, 4) / 4; // enzyme curve, peak ≈30-38°C
    const gross = 100 * L * C * tF;              // µmol O2 / m² / h (model units)
    const resp = clamp(q10(T, 8, 20), 0, 40) * denat(T, 45, 4);
    const net = gross - resp;
    const factors = { light: L, co2: C, temperature: tF };
    const limiting = Object.keys(factors).reduce((a, b) => (factors[a] <= factors[b] ? a : b));
    return { gross, resp, net, limiting, factors, L, C, tF };
}

/* ---- enzyme bench ---- */
const ENZYMES = {
    amylase: { n: "Amylase (saliva)", phOpt: 6.8, phW: 1.7, tOpt: 37, tWc: 14, tWh: 6, Km: 5, where: "mouth — breaks starch into sugars" },
    pepsin: { n: "Pepsin (stomach)", phOpt: 2, phW: 1.4, tOpt: 37, tWc: 14, tWh: 6, Km: 8, where: "stomach — digests protein in acid" },
    trypsin: { n: "Trypsin (small intestine)", phOpt: 8, phW: 1.5, tOpt: 37, tWc: 14, tWh: 6, Km: 6, where: "small intestine — continues protein digestion" },
    catalase: { n: "Catalase (cells)", phOpt: 7, phW: 2, tOpt: 37, tWc: 14, tWh: 6, Km: 4, where: "inside cells — splits harmful H₂O₂ into water + O₂" }
};
function enzyme(o) {
    const e = ENZYMES[o.id] || ENZYMES.amylase;
    const T = clamp(o.temp ?? 37, 0, 80), ph = clamp(o.ph ?? 7, 0, 14), S = clamp(o.S ?? 10, 0, 100);
    const w = T <= e.tOpt ? e.tWc : e.tWh;                 // slow rise, sharp denaturation
    const tC = gauss(T, e.tOpt, w);
    const pC = gauss(ph, e.phOpt, e.phW);
    const mm = S / (S + e.Km);                              // Michaelis–Menten
    const activity = 100 * tC * pC * mm;
    const worst = [["temperature", tC], ["pH", pC], ["substrate", mm]].sort((a, b) => a[1] - b[1])[0];
    return { activity, tC, pC, mm, worst: worst[0], e };
}

/* ---- genetics: Mendel as an algorithm ---- */
function gametes(g) { // g = [{A:"T",a:"t",gen:"Tt"}, ...] one entry per trait
    let combos = [""];
    for (const tr of g) {
        const al = [tr.gen[0], tr.gen[1]];
        combos = combos.flatMap(c => al.map(a => c + a));
    }
    return [...new Set(combos)];
}
function cross(o) {
    const traits = o.traits; // [{dom:"T", rec:"t", p1:"Tt", p2:"Tt"}] (1 or 2 traits)
    const gs1 = gametes(traits.map(t => ({ gen: t.p1 })));
    const gs2 = gametes(traits.map(t => ({ gen: t.p2 })));
    const grid = gs1.map(a => gs2.map(b => a + b));
    const geno = {}, pheno = {};
    for (const row of grid) for (const g of row) {
        // split combined genotype back per trait (alleles interleaved: trait0 from each parent)
        const per = [];
        let idx = 0;
        for (const t of traits) { per.push([g[idx], g[idx + traits.length]]); idx++; }
        const gk = per.map((p, i) => {
            const d = traits[i].dom, r = traits[i].rec;
            const has = p.includes(d);
            const homo = p[0] === p[1];
            return homo ? p[0] + p[1] : d + r;
        }).join(" ");
        const pk = per.map((p, i) => (p.includes(traits[i].dom) ? traits[i].domName || "dominant" : traits[i].rName || "recessive")).join(" + ");
        geno[gk] = (geno[gk] || 0) + 1; pheno[pk] = (pheno[pk] || 0) + 1;
    }
    const total = grid.length * grid[0].length;
    return { grid, geno, pheno, total };
}

/* ---- ecology: energy flow, 10% law ---- */
function chain(o) {
    const eff = clamp((o.eff ?? 10) / 100, 0.01, 0.3);
    const levels = [{ name: o.names?.[0] || "Producers", kJ: o.producerkJ ?? 10000 }];
    for (let i = 1; i < (o.levels ?? 4); i++)
        levels.push({ name: o.names?.[i] || (i === 1 ? "Herbivores" : i === 2 ? "Carnivores" : "Top carnivores"), kJ: levels[i - 1].kJ * eff });
    return { levels, eff };
}

const BioCore = { photo, enzyme, ENZYMES, cross, chain };
if (typeof module !== "undefined" && module.exports) module.exports = BioCore; else window.BioCore = BioCore;
})();
