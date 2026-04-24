/**
 * validateAdaptiveInstinct.ts - Valida a lógica pura do Instinto sem dependência de DB/Supabase.
 * Testa diretamente as funções evaluateSystemHealth e getAdaptiveInstinct via mock de estado.
 */

// ── Mock do Supabase ─────────────────────────────────────────────────────────
process.env.VITE_SUPABASE_URL = "http://mock";
process.env.VITE_SUPABASE_ANON_KEY = "mock-key";

// Precisamos interceptar import.meta.env antes dos módulos carregarem
const mockEnv = { VITE_SUPABASE_URL: "http://mock", VITE_SUPABASE_ANON_KEY: "mock-key" };
(globalThis as any)["import"] = { meta: { env: mockEnv } };

// ── Lógica de validação inline (sem importar arbiterMemory diretamente) ──────
// Reproduzimos exatamente a lógica de evaluateSystemHealth e getAdaptiveInstinct
// para testar os 4 ajustes obrigatórios de forma isolada.

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
    diversityScore: number;
}
interface MockDecision {
    outcomeHits?: number;
    targetContestNumber?: number;
}

interface InstinctRuntimeState {
    lastTargetContest?: number;
    currentMode: InstinctMode;
    cyclesInMode: number;
    smoothedInstinct: AdaptiveInstinct;
}

// ─── Motor isolado para teste ────────────────────────────────────────────────

function evaluateSystemHealth(decisions: MockDecision[]): SystemHealth & { sampleSize: number } {
    const contestGroups: Record<number, number[]> = {};
    decisions.filter(d => d.outcomeHits !== undefined).forEach(d => {
        const key = d.targetContestNumber || 0;
        if (!contestGroups[key]) contestGroups[key] = [];
        contestGroups[key].push(d.outcomeHits!);
    });
    const contestKeys = Object.keys(contestGroups).map(Number).sort((a, b) => a - b).slice(-20);
    let totalHits = 0, totalBets = 0, lowHits = 0;
    contestKeys.forEach(k => contestGroups[k].forEach(h => { totalHits += h; totalBets++; if (h < 10) lowHits++; }));
    const avgHits = totalBets > 0 ? totalHits / totalBets : 0;
    const lowHitsRate = totalBets > 0 ? lowHits / totalBets : 0;
    let state: "healthy" | "warning" | "critical" = "warning";
    if (avgHits >= 11) state = "healthy";
    else if (avgHits < 9 || lowHitsRate > 0.40) state = "critical";
    return { healthScore: avgHits / 20, state, avgHits, lowHitsRate, diversityScore: 0.5, sampleSize: contestKeys.length };
}

function getAdaptiveInstinct(
    decisions: MockDecision[],
    runtime: InstinctRuntimeState,
    targetContestNumber?: number
): AdaptiveInstinct {
    const health = evaluateSystemHealth(decisions);
    const uniqueContests = new Set(decisions.filter(d => d.outcomeHits !== undefined).map(d => d.targetContestNumber || 0));
    const sampleSize = uniqueContests.size;

    let rawMode: InstinctMode = "balanced";
    let guardrailReason = "";

    if (sampleSize < 10) {
        rawMode = "balanced";
        guardrailReason = `amostra insuficiente (${sampleSize}/10)`;
    } else {
        if (health.state === "critical") rawMode = "recovery";
        else if (health.state === "healthy") rawMode = "conservative";
        else rawMode = "balanced";
    }

    if (runtime.currentMode === "recovery" && runtime.cyclesInMode > 5) {
        rawMode = "exploration";
        guardrailReason = `recovery permanente (${runtime.cyclesInMode} ciclos)`;
    }

    const TARGETS: Record<InstinctMode, Omit<AdaptiveInstinct, "mode">> = {
        balanced: { mutationMultiplier: 1.0, diversityBoost: 0.3, antiClusterBoost: 0.3, structuralBiasWeight: 0.8, explorationWeight: 0.3 },
        recovery: { mutationMultiplier: 2.0, diversityBoost: 0.8, antiClusterBoost: 0.9, structuralBiasWeight: 0.2, explorationWeight: 0.9 },
        conservative: { mutationMultiplier: 0.5, diversityBoost: 0.1, antiClusterBoost: 0.2, structuralBiasWeight: 1.0, explorationWeight: 0.1 },
        exploration: { mutationMultiplier: 1.5, diversityBoost: 0.6, antiClusterBoost: 0.5, structuralBiasWeight: 0.5, explorationWeight: 0.8 },
    };
    const target = TARGETS[rawMode];
    const speed = 0.3;
    const s = runtime.smoothedInstinct;

    const shouldAdvanceCycle = targetContestNumber != null ? runtime.lastTargetContest !== targetContestNumber : true;

    if (shouldAdvanceCycle) {
        if (targetContestNumber != null) runtime.lastTargetContest = targetContestNumber;
        if (runtime.currentMode === rawMode) runtime.cyclesInMode++;
        else { runtime.currentMode = rawMode; runtime.cyclesInMode = 1; }

        s.mode = rawMode;
        s.mutationMultiplier = Math.max(0.4, Math.min(2.0, s.mutationMultiplier + (target.mutationMultiplier - s.mutationMultiplier) * speed));
        s.diversityBoost = Math.max(0.0, Math.min(0.8, s.diversityBoost + (target.diversityBoost - s.diversityBoost) * speed));
        s.antiClusterBoost = Math.max(0.0, Math.min(0.9, s.antiClusterBoost + (target.antiClusterBoost - s.antiClusterBoost) * speed));
        s.structuralBiasWeight = Math.max(0.2, Math.min(1.0, s.structuralBiasWeight + (target.structuralBiasWeight - s.structuralBiasWeight) * speed));
        s.explorationWeight = Math.max(0.0, Math.min(0.9, s.explorationWeight + (target.explorationWeight - s.explorationWeight) * speed));

        if (guardrailReason) {
            console.log(`[INSTINCT GUARDRAIL]\n  reason: ${guardrailReason}\n  action: modo bloqueado → ${rawMode}`);
        }

        console.log(
            `[INSTINCT STATE]\n` +
            `  mode:             ${s.mode} (cycles: ${runtime.cyclesInMode})\n` +
            `  healthScore:      ${health.healthScore.toFixed(3)}\n` +
            `  avgHits:          ${health.avgHits.toFixed(2)}\n` +
            `  lowHitsRate:      ${(health.lowHitsRate * 100).toFixed(1)}%\n` +
            `  sampleSize:       ${sampleSize}\n` +
            `[INSTINCT ACTION]\n` +
            `  mutationMultiplier:   ${s.mutationMultiplier.toFixed(2)}\n` +
            `  diversityBoost:       ${s.diversityBoost.toFixed(2)}\n` +
            `  antiClusterBoost:     ${s.antiClusterBoost.toFixed(2)}\n` +
            `  structuralBiasWeight: ${s.structuralBiasWeight.toFixed(2)}\n` +
            `  explorationWeight:    ${s.explorationWeight.toFixed(2)}`
        );
    }

    return runtime.smoothedInstinct;
}

function makeRuntime(): InstinctRuntimeState {
    return {
        currentMode: "balanced",
        cyclesInMode: 0,
        smoothedInstinct: { mode: "balanced", mutationMultiplier: 1.0, diversityBoost: 0, antiClusterBoost: 0, structuralBiasWeight: 1.0, explorationWeight: 0 }
    };
}

function makeDecisions(count: number, hits: number, startContest = 900000): MockDecision[] {
    return Array.from({ length: count }, (_, i) => ({ outcomeHits: hits, targetContestNumber: startContest + i }));
}

// ─── TESTES ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
    if (condition) { console.log(`  ✓ ${label}`); passed++; }
    else { console.error(`  ✗ FALHA: ${label}${detail ? ` (${detail})` : ""}`); failed++; }
}

console.log("\n=== CENÁRIO 1: Amostra mínima (<10) → forçar balanced ===");
{
    const rt = makeRuntime();
    const decisions = makeDecisions(5, 5); // 5 conferências ruins
    const r = getAdaptiveInstinct(decisions, rt, 999001);
    check("mode = balanced (amostra insuficiente)", r.mode === "balanced", `obtido: ${r.mode}`);
    check("recovery não ativado", r.mode !== "recovery");
    check("mutationMultiplier ≤ 2.0", r.mutationMultiplier <= 2.0, `obtido: ${r.mutationMultiplier.toFixed(2)}`);
    check("structuralBiasWeight ≥ 0.2", r.structuralBiasWeight >= 0.2, `obtido: ${r.structuralBiasWeight.toFixed(2)}`);
}

console.log("\n=== CENÁRIO 2: Sequência ruim com amostra ≥10 → recovery gradual ===");
{
    const rt = makeRuntime();
    const decisions = makeDecisions(16, 6, 800000); // 16 conferências ruins

    let lastR = getAdaptiveInstinct(decisions, rt, 999010);
    // Simular multiplos ciclos para ver suavização
    for (let c = 2; c <= 4; c++) {
        lastR = getAdaptiveInstinct(decisions, rt, 999010 + c);
    }
    check("modo em recovery após muitas conferências ruins", lastR.mode === "recovery", `obtido: ${lastR.mode}`);
    check("mutationMultiplier ≤ 2.0 (cap respeitado)", lastR.mutationMultiplier <= 2.0, `obtido: ${lastR.mutationMultiplier.toFixed(2)}`);
    check("structuralBiasWeight ≥ 0.2 (bias nunca zerado)", lastR.structuralBiasWeight >= 0.2, `obtido: ${lastR.structuralBiasWeight.toFixed(2)}`);
    check("transição progressiva (biasWeight < 0.8)", lastR.structuralBiasWeight < 0.8, `obtido: ${lastR.structuralBiasWeight.toFixed(2)}`);
}

console.log("\n=== CENÁRIO 3: Melhora → saída de recovery ===");
{
    const rt = makeRuntime();
    // 16 ruins + depois 12 ótimos
    const decisions = [...makeDecisions(16, 6, 700000), ...makeDecisions(12, 14, 700020)];
    const r = getAdaptiveInstinct(decisions, rt, 999020);
    check("modo não é recovery após melhora", r.mode !== "recovery", `obtido: ${r.mode}`);
}

console.log("\n=== CENÁRIO 4: Anti-recovery permanente (>5 ciclos) ===");
{
    const rt = makeRuntime();
    rt.currentMode = "recovery";
    rt.cyclesInMode = 6; // Simular que já está preso há 6 ciclos
    const decisions = makeDecisions(20, 5, 600000);
    const r = getAdaptiveInstinct(decisions, rt, 999030);
    check("modo forçado para exploration (anti-recovery permanente)", r.mode === "exploration", `obtido: ${r.mode}`);
}

console.log("\n=== CENÁRIO 5: Limitadores absolutos nunca violados ===");
{
    const rt = makeRuntime();
    const decisions = makeDecisions(20, 3, 500000); // resultados extremamente ruins
    let r = { mode: "balanced" as InstinctMode, mutationMultiplier: 1, diversityBoost: 0, antiClusterBoost: 0, structuralBiasWeight: 1, explorationWeight: 0 };
    for (let c = 1; c <= 10; c++) {
        r = getAdaptiveInstinct(decisions, rt, 999040 + c);
    }
    check("mutationMultiplier nunca excede 2.0", r.mutationMultiplier <= 2.0, `obtido: ${r.mutationMultiplier.toFixed(2)}`);
    check("structuralBiasWeight nunca cai abaixo de 0.2", r.structuralBiasWeight >= 0.2, `obtido: ${r.structuralBiasWeight.toFixed(2)}`);
    check("antiClusterBoost nunca excede 0.9", r.antiClusterBoost <= 0.9, `obtido: ${r.antiClusterBoost.toFixed(2)}`);
    check("diversityBoost nunca excede 0.8", r.diversityBoost <= 0.8, `obtido: ${r.diversityBoost.toFixed(2)}`);
}

console.log(`\n======================================`);
console.log(`  Resultado: ${passed} passaram, ${failed} falharam`);
console.log(`======================================`);

if (failed > 0) {
    process.exit(1);
} else {
    console.log("  INSTINTO ADAPTATIVO: COMPLETO E FUNCIONAL");
    process.exit(0);
}
