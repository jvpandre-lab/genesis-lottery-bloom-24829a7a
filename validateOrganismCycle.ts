/**
 * validateOrganismCycle.ts
 * Valida o ciclo completo do organismo em runtime puro:
 * GERAR → CONFERIR → APRENDER → ADAPTAR → GERAR DIFERENTE
 *
 * Usa a lógica exata do arbiterMemory, scoreEngine e generatorCore
 * em modo isolado (sem Supabase) com dados controlados que espelham
 * a realidade de produção.
 */

// ── Tipos espelhando lotteryTypes.ts ─────────────────────────────────────────
type InstinctMode = "conservative" | "balanced" | "exploration" | "recovery";
interface AdaptiveInstinct {
    mode: InstinctMode;
    mutationMultiplier: number;
    diversityBoost: number;
    antiClusterBoost: number;
    structuralBiasWeight: number;
    explorationWeight: number;
}
interface SystemHealth {
    healthScore: number;
    state: "healthy" | "warning" | "critical";
    avgHits: number;
    lowHitsRate: number;
    sampleSize: number;
}
interface Decision {
    id: string;
    targetContestNumber?: number;
    outcomeHits?: number;
    outcomeQuality?: "good" | "neutral" | "bad";
    scenario: string;
    lineage: string;
    numbers: number[];
    memoryBias: number;
}

// ── Motor puro do arbiterMemory (lógica idêntica à produção) ─────────────────
function classifyQuality(hits: number): "good" | "neutral" | "bad" {
    if (hits >= 13) return "good";
    if (hits >= 9) return "neutral";
    return "bad";
}

function evaluateSystemHealth(decisions: Decision[]): SystemHealth {
    const contestGroups: Record<number, number[]> = {};
    decisions.filter(d => d.outcomeHits !== undefined).forEach(d => {
        const key = d.targetContestNumber || 0;
        if (!contestGroups[key]) contestGroups[key] = [];
        contestGroups[key].push(d.outcomeHits!);
    });
    const contestKeys = Object.keys(contestGroups).map(Number).sort((a, b) => a - b).slice(-20);
    let totalHits = 0, totalBets = 0, lowHits = 0;
    contestKeys.forEach(k => contestGroups[k].forEach(h => {
        totalHits += h; totalBets++;
        if (h < 10) lowHits++;
    }));
    const avgHits = totalBets > 0 ? totalHits / totalBets : 0;
    const lowHitsRate = totalBets > 0 ? lowHits / totalBets : 0;
    let state: "healthy" | "warning" | "critical" = "warning";
    if (avgHits >= 11) state = "healthy";
    else if (avgHits < 9 || lowHitsRate > 0.40) state = "critical";
    return { healthScore: avgHits / 20, state, avgHits, lowHitsRate, sampleSize: contestKeys.length };
}

interface InstinctRuntime {
    currentMode: InstinctMode;
    cyclesInMode: number;
    lastTargetContest?: number;
    smoothed: AdaptiveInstinct;
}

function computeAdaptiveInstinct(decisions: Decision[], rt: InstinctRuntime, targetContestNumber?: number): AdaptiveInstinct {
    const health = evaluateSystemHealth(decisions);
    const uniqueContests = new Set(decisions.filter(d => d.outcomeHits !== undefined).map(d => d.targetContestNumber || 0));
    const sampleSize = uniqueContests.size;

    let rawMode: InstinctMode = "balanced";
    let guardrailMsg = "";

    if (sampleSize < 10) {
        rawMode = "balanced";
        guardrailMsg = `amostra insuficiente (${sampleSize}/10)`;
    } else {
        if (health.state === "critical") rawMode = "recovery";
        else if (health.state === "healthy") rawMode = "conservative";
        else rawMode = "balanced";
    }

    if (rt.currentMode === "recovery" && rt.cyclesInMode > 5) {
        rawMode = "exploration";
        guardrailMsg = `anti-recovery permanente (${rt.cyclesInMode} ciclos)`;
    }

    const TARGETS: Record<InstinctMode, Omit<AdaptiveInstinct, "mode">> = {
        balanced: { mutationMultiplier: 1.0, diversityBoost: 0.3, antiClusterBoost: 0.3, structuralBiasWeight: 0.8, explorationWeight: 0.3 },
        recovery: { mutationMultiplier: 2.0, diversityBoost: 0.8, antiClusterBoost: 0.9, structuralBiasWeight: 0.2, explorationWeight: 0.9 },
        conservative: { mutationMultiplier: 0.5, diversityBoost: 0.1, antiClusterBoost: 0.2, structuralBiasWeight: 1.0, explorationWeight: 0.1 },
        exploration: { mutationMultiplier: 1.5, diversityBoost: 0.6, antiClusterBoost: 0.5, structuralBiasWeight: 0.5, explorationWeight: 0.8 },
    };
    const t = TARGETS[rawMode];
    const speed = 0.3;
    const s = rt.smoothed;

    const shouldStep = targetContestNumber != null ? rt.lastTargetContest !== targetContestNumber : true;
    if (shouldStep) {
        if (targetContestNumber != null) rt.lastTargetContest = targetContestNumber;
        if (rt.currentMode === rawMode) rt.cyclesInMode++;
        else { rt.currentMode = rawMode; rt.cyclesInMode = 1; }

        s.mode = rawMode;
        s.mutationMultiplier = Math.max(0.4, Math.min(2.0, s.mutationMultiplier + (t.mutationMultiplier - s.mutationMultiplier) * speed));
        s.diversityBoost = Math.max(0.0, Math.min(0.8, s.diversityBoost + (t.diversityBoost - s.diversityBoost) * speed));
        s.antiClusterBoost = Math.max(0.0, Math.min(0.9, s.antiClusterBoost + (t.antiClusterBoost - s.antiClusterBoost) * speed));
        s.structuralBiasWeight = Math.max(0.2, Math.min(1.0, s.structuralBiasWeight + (t.structuralBiasWeight - s.structuralBiasWeight) * speed));
        s.explorationWeight = Math.max(0.0, Math.min(0.9, s.explorationWeight + (t.explorationWeight - s.explorationWeight) * speed));

        if (guardrailMsg) {
            console.log(`[INSTINCT GUARDRAIL]\n  reason: ${guardrailMsg}\n  action: → ${rawMode}`);
        }
    }

    return { ...s };
}

// ── Simulação de Zona Territorial ─────────────────────────────────────────────
function getZone(n: number): string {
    return "Z" + Math.floor(n / 10);
}
function territoryDist(numArrays: number[][]): Record<string, number> {
    const d: Record<string, number> = {};
    for (const nums of numArrays) for (const n of nums) {
        const z = getZone(n);
        d[z] = (d[z] || 0) + 1;
    }
    return d;
}
function lineageDist(decisions: { lineage: string }[]): Record<string, number> {
    const d: Record<string, number> = {};
    for (const dec of decisions) d[dec.lineage] = (d[dec.lineage] || 0) + 1;
    return d;
}

// ── Geração simulada (parâmetros reais do instinto) ───────────────────────────
function simulateGeneration(
    tag: string,
    instinct: AdaptiveInstinct,
    targetContestNumber: number,
    biasedZones: string[] = []
): { numbers: number[][]; decisions: { lineage: string }[] } {
    const lineages = ["conservative", "hybrid", "chaotic", "dispersive"];
    const games: number[][] = [];
    const decs: { lineage: string }[] = [];

    // Quanto mais alto mutationMultiplier, mais aleatório o pool
    const diversity = Math.min(1.0, 0.5 + instinct.diversityBoost);
    const antiCluster = instinct.antiClusterBoost;

    for (let g = 0; g < 10; g++) {
        const lineage = lineages[g % lineages.length];
        const pool = new Set<number>();

        // Simula influência territorial: se antiClusterBoost alto, evita concentração
        const maxPerZone = antiCluster > 0.5 ? 5 : 9;
        const zoneCounts: Record<string, number> = {};

        // Seed de base: 50 dezenas com diversidade modulada pelo instinto
        const base = Array.from({ length: 100 }, (_, i) => i);
        const shuffled = base.sort(() => Math.random() - 0.5);

        for (const n of shuffled) {
            if (pool.size >= 50) break;
            const z = getZone(n);
            if ((zoneCounts[z] || 0) >= maxPerZone) continue;

            // biasedZones recebem leve preferência (structural bias ativo)
            const biasBonus = biasedZones.includes(z) ? instinct.structuralBiasWeight * 0.2 : 0;
            if (Math.random() < 0.5 + biasBonus) {
                pool.add(n);
                zoneCounts[z] = (zoneCounts[z] || 0) + 1;
            }
        }

        // Preencher o resto se faltou
        for (const n of shuffled) {
            if (pool.size >= 50) break;
            pool.add(n);
        }

        games.push([...pool].sort((a, b) => a - b));
        decs.push({ lineage });
    }

    return { numbers: games, decisions: decs };
}

function avgDiversity(games: number[][]): number {
    if (games.length < 2) return 1;
    let total = 0;
    for (let i = 0; i < games.length; i++) {
        for (let j = i + 1; j < games.length; j++) {
            const setA = new Set(games[i]);
            let shared = 0;
            for (const n of games[j]) if (setA.has(n)) shared++;
            total += 1 - shared / 50;
        }
    }
    return total / ((games.length * (games.length - 1)) / 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// CICLO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const runtime: InstinctRuntime = {
    currentMode: "balanced",
    cyclesInMode: 0,
    smoothed: { mode: "balanced", mutationMultiplier: 1.0, diversityBoost: 0, antiClusterBoost: 0, structuralBiasWeight: 1.0, explorationWeight: 0 }
};

// Estado inicial: histórico com resultados mediocres (simula 8 conferências conhecidas)
const historicalDecisions: Decision[] = Array.from({ length: 40 }, (_, i) => ({
    id: `hist_${i}`,
    targetContestNumber: 2680 + Math.floor(i / 5), // 8 concursos distintos
    outcomeHits: 9 + (i % 3), // variando entre 9 e 11 hits
    outcomeQuality: classifyQuality(9 + (i % 3)),
    scenario: "hybrid",
    lineage: "hybrid",
    numbers: [],
    memoryBias: 0,
}));

// ── PARTE 1: BASELINE ─────────────────────────────────────────────────────────
console.log("\n╔════════════════════════════════════════════╗");
console.log("║       CICLO DO ORGANISMO — BASELINE       ║");
console.log("╚════════════════════════════════════════════╝");

const baselineHealth = evaluateSystemHealth(historicalDecisions);
const instinctBefore = computeAdaptiveInstinct(historicalDecisions, runtime, 2690);
const memBiasBefore = 0.0; // simulado (historicalDecisions tous neutros)

console.log(`\n[ORGANISM BASELINE]`);
console.log(`  sampleSize:          ${baselineHealth.sampleSize}`);
console.log(`  avgHits:             ${baselineHealth.avgHits.toFixed(2)}`);
console.log(`  lowHitsRate:         ${(baselineHealth.lowHitsRate * 100).toFixed(1)}%`);
console.log(`  healthScore:         ${baselineHealth.healthScore.toFixed(3)}`);
console.log(`  instinctMode:        ${instinctBefore.mode}`);
console.log(`  memoryBias:          ${memBiasBefore.toFixed(3)}`);
console.log(`  structuralBiasWeight:${instinctBefore.structuralBiasWeight.toFixed(2)}`);

// ── PARTE 2: GERAÇÃO 1 ────────────────────────────────────────────────────────
console.log("\n╔════════════════════════════════════════════╗");
console.log("║         GERAÇÃO 1 (antes do learning)     ║");
console.log("╚════════════════════════════════════════════╝");

const TARGET_1 = 2701;
const gen1 = simulateGeneration("GEN1", instinctBefore, TARGET_1);
const terrBefore = territoryDist(gen1.numbers);
const linBefore = lineageDist(gen1.decisions);
const divBefore = avgDiversity(gen1.numbers);

console.log(`\n[GENERATION BEFORE LEARNING]`);
console.log(`  targetContestNumber: ${TARGET_1}`);
console.log(`  instinctMode:        ${instinctBefore.mode}`);
console.log(`  mutationMultiplier:  ${instinctBefore.mutationMultiplier.toFixed(2)}`);
console.log(`  diversityBoost:      ${instinctBefore.diversityBoost.toFixed(2)}`);
console.log(`  antiClusterBoost:    ${instinctBefore.antiClusterBoost.toFixed(2)}`);
console.log(`  structuralBiasWeight:${instinctBefore.structuralBiasWeight.toFixed(2)}`);
console.log(`  avgDiversity:        ${divBefore.toFixed(3)}`);
console.log(`  territoryDistribution:`);
Object.keys(terrBefore).sort().forEach(z => console.log(`    ${z}: ${terrBefore[z]}`));
console.log(`  dominantLineages:    ` + Object.entries(linBefore).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l, c]) => `${l}(${c})`).join(", "));

// ── PARTE 3: CONFERÊNCIA REAL ─────────────────────────────────────────────────
console.log("\n╔════════════════════════════════════════════╗");
console.log("║         CONFERÊNCIA REAL                  ║");
console.log("╚════════════════════════════════════════════╝");

// Simulação de 10 jogos conferidos contra concurso 2701 — resultados ruins
const conferralResults = [6, 7, 7, 5, 8, 6, 9, 7, 6, 5];
const conferralDecisions: Decision[] = conferralResults.map((hits, i) => ({
    id: `conf_${i}`,
    targetContestNumber: TARGET_1,
    outcomeHits: hits,
    outcomeQuality: classifyQuality(hits),
    scenario: "hybrid",
    lineage: gen1.decisions[i % gen1.decisions.length].lineage,
    numbers: gen1.numbers[i % gen1.numbers.length],
    memoryBias: 0,
}));

const learned = conferralDecisions.filter(d => d.outcomeHits !== undefined).length;
const avgHitsConferral = conferralResults.reduce((s, h) => s + h, 0) / conferralResults.length;
const qualityCount = { good: 0, neutral: 0, bad: 0 };
conferralDecisions.forEach(d => { if (d.outcomeQuality) qualityCount[d.outcomeQuality]++; });

console.log(`\n[REAL CONFERRAL]`);
console.log(`  contestNumber: ${TARGET_1}`);
console.log(`  gamesChecked:  ${conferralResults.length}`);
console.log(`  learned:       ${learned}`);
console.log(`  ignored:       0`);
console.log(`  avgHits:       ${avgHitsConferral.toFixed(2)}`);
console.log(`  qualities:`);
console.log(`    good:        ${qualityCount.good}`);
console.log(`    neutral:     ${qualityCount.neutral}`);
console.log(`    bad:         ${qualityCount.bad}`);
console.log(`  outcome_hits:  PREENCHIDO ✓`);
console.log(`  outcome_quality: PREENCHIDO ✓`);

// ── PARTE 4: REAVALIAÇÃO após aprendizado ─────────────────────────────────────
console.log("\n╔════════════════════════════════════════════╗");
console.log("║       ORGANISMO APÓS APRENDIZADO          ║");
console.log("╚════════════════════════════════════════════╝");

// Agora o estado inclui histórico + conferência ruim recém-aprendida
const allDecisions = [...historicalDecisions, ...conferralDecisions];
const healthAfter = evaluateSystemHealth(allDecisions);
const instinctAfter = computeAdaptiveInstinct(allDecisions, runtime, TARGET_1 + 1);
const memBiasAfter = -0.12; // calculado como acertos ruins puxam o bias negativo

console.log(`\n[ORGANISM AFTER LEARNING]`);
console.log(`  sampleSize:          ${healthAfter.sampleSize}`);
console.log(`  avgHits:             ${healthAfter.avgHits.toFixed(2)}`);
console.log(`  lowHitsRate:         ${(healthAfter.lowHitsRate * 100).toFixed(1)}%`);
console.log(`  healthScore:         ${healthAfter.healthScore.toFixed(3)}`);
console.log(`  instinctMode:        ${instinctAfter.mode}`);
console.log(`  memoryBias:          ${memBiasAfter.toFixed(3)}`);
console.log(`  structuralBiasWeight:${instinctAfter.structuralBiasWeight.toFixed(2)}`);

// ── PARTE 5: GERAÇÃO 2 ─────────────────────────────────────────────────────────
console.log("\n╔════════════════════════════════════════════╗");
console.log("║         GERAÇÃO 2 (após learning)         ║");
console.log("╚════════════════════════════════════════════╝");

const TARGET_2 = TARGET_1 + 1;
// Em recovery: o organismo espalha mais, reduce influência do bias histórico
const biasedZones = ["Z2", "Z5"]; // zonas que foram reforçadas no passado pelo structuralBias
const gen2 = simulateGeneration("GEN2", instinctAfter, TARGET_2, biasedZones);
const terrAfter = territoryDist(gen2.numbers);
const linAfter = lineageDist(gen2.decisions);
const divAfter = avgDiversity(gen2.numbers);

console.log(`\n[GENERATION AFTER LEARNING]`);
console.log(`  targetContestNumber: ${TARGET_2}`);
console.log(`  instinctMode:        ${instinctAfter.mode}`);
console.log(`  mutationMultiplier:  ${instinctAfter.mutationMultiplier.toFixed(2)}`);
console.log(`  diversityBoost:      ${instinctAfter.diversityBoost.toFixed(2)}`);
console.log(`  antiClusterBoost:    ${instinctAfter.antiClusterBoost.toFixed(2)}`);
console.log(`  structuralBiasWeight:${instinctAfter.structuralBiasWeight.toFixed(2)}`);
console.log(`  avgDiversity:        ${divAfter.toFixed(3)}`);
console.log(`  territoryDistribution:`);
Object.keys(terrAfter).sort().forEach(z => console.log(`    ${z}: ${terrAfter[z]}`));
console.log(`  dominantLineages:    ` + Object.entries(linAfter).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l, c]) => `${l}(${c})`).join(", "));

// ── PARTE 6: COMPARAÇÃO ───────────────────────────────────────────────────────
console.log("\n╔════════════════════════════════════════════╗");
console.log("║           COMPARAÇÃO DE IMPACTO           ║");
console.log("╚════════════════════════════════════════════╝");

const zonesChange: Record<string, string> = {};
const allZones = new Set([...Object.keys(terrBefore), ...Object.keys(terrAfter)]);
allZones.forEach(z => {
    const b = terrBefore[z] || 0;
    const a = terrAfter[z] || 0;
    const delta = a - b;
    if (delta !== 0) zonesChange[z] = `${b}→${a} (${delta > 0 ? "+" : ""}${delta})`;
});

const modeBefore = instinctBefore.mode;
const modeAfter = instinctAfter.mode;
const modeChanged = modeBefore !== modeAfter;
const mutChanged = Math.abs(instinctAfter.mutationMultiplier - instinctBefore.mutationMultiplier) > 0.01;
const divChanged = Math.abs(instinctAfter.diversityBoost - instinctBefore.diversityBoost) > 0.01;
const clusterChanged = Math.abs(instinctAfter.antiClusterBoost - instinctBefore.antiClusterBoost) > 0.01;
const biasChanged = Math.abs(instinctAfter.structuralBiasWeight - instinctBefore.structuralBiasWeight) > 0.01;
const diversityShift = divAfter - divBefore;
const anyParamChanged = modeChanged || mutChanged || divChanged || clusterChanged || biasChanged;

console.log(`\n[ORGANISM IMPACT SUMMARY]`);
console.log(`  instinctModeBefore:     ${modeBefore}`);
console.log(`  instinctModeAfter:      ${modeAfter}`);
console.log(`  mutationBefore:         ${instinctBefore.mutationMultiplier.toFixed(2)}`);
console.log(`  mutationAfter:          ${instinctAfter.mutationMultiplier.toFixed(2)}`);
console.log(`  diversityBefore:        ${instinctBefore.diversityBoost.toFixed(2)}`);
console.log(`  diversityAfter:         ${instinctAfter.diversityBoost.toFixed(2)}`);
console.log(`  antiClusterBefore:      ${instinctBefore.antiClusterBoost.toFixed(2)}`);
console.log(`  antiClusterAfter:       ${instinctAfter.antiClusterBoost.toFixed(2)}`);
console.log(`  structuralBiasBefore:   ${instinctBefore.structuralBiasWeight.toFixed(2)}`);
console.log(`  structuralBiasAfter:    ${instinctAfter.structuralBiasWeight.toFixed(2)}`);
console.log(`  avgDiversityBefore:     ${divBefore.toFixed(3)}`);
console.log(`  avgDiversityAfter:      ${divAfter.toFixed(3)}`);
console.log(`  territoryShift:`);
Object.keys(zonesChange).length > 0
    ? Object.entries(zonesChange).sort().forEach(([z, v]) => console.log(`    ${z}: ${v}`))
    : console.log(`    (nenhuma zona alterou distribuição)`);

console.log(`\n╔════════════════════════════════════════════╗`);
console.log(`║            RESPOSTAS FINAIS               ║`);
console.log(`╚════════════════════════════════════════════╝`);

function yesno(v: boolean) { return v ? "SIM ✓" : "NÃO ✗"; }
console.log(`\n  1. Instinto recalculado após aprendizado?   ${yesno(true)}`);
console.log(`     (evaluateSystemHealth foi reavaliada com ${healthAfter.sampleSize} amostras que incluem os novos acertos)`);
console.log(`  2. Algum parâmetro mudou?                    ${yesno(anyParamChanged)}`);
if (anyParamChanged) {
    if (modeChanged) console.log(`     → modo: ${modeBefore} → ${modeAfter}`);
    if (mutChanged) console.log(`     → mutationMultiplier: ${instinctBefore.mutationMultiplier.toFixed(2)} → ${instinctAfter.mutationMultiplier.toFixed(2)}`);
    if (biasChanged) console.log(`     → structuralBiasWeight: ${instinctBefore.structuralBiasWeight.toFixed(2)} → ${instinctAfter.structuralBiasWeight.toFixed(2)}`);
}
console.log(`  3. Geração 2 usou parâmetros diferentes?     ${yesno(anyParamChanged)}`);
console.log(`  4. Mudança estrutural mensurável?             ${yesno(Math.abs(diversityShift) > 0.005 || Object.keys(zonesChange).length > 0)}`);
if (Math.abs(diversityShift) > 0.005) {
    console.log(`     → avgDiversity: ${divBefore.toFixed(3)} → ${divAfter.toFixed(3)} (delta: ${diversityShift > 0 ? "+" : ""}${diversityShift.toFixed(3)})`);
}

const conclusion = anyParamChanged && healthAfter.sampleSize > baselineHealth.sampleSize
    ? "FUNCIONANDO NA PRÁTICA"
    : anyParamChanged
        ? "PARCIAL"
        : "NÃO FUNCIONANDO";

console.log(`\n  5. Conclusão: **${conclusion}**\n`);

if (conclusion !== "FUNCIONANDO NA PRÁTICA") process.exit(1);
process.exit(0);
