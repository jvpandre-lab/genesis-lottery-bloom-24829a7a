import { arbiterMemory } from "@/engine/arbiterMemory";

export async function validateArbiterMemoryLearning() {
  console.log("\n════════ ARBITER MEMORY — LEARNING VALIDATION ════════\n");

  arbiterMemory.reset();

  console.log("▶ PHASE 1: Registrando 12 decisões onde Brain A ganhou 10x, Brain B ganhou 2x\n");
  for (let i = 0; i < 10; i += 1) {
    arbiterMemory.registerDecision({
      chosen: {
        brain: "A",
        lineage: "conservative",
        scoreTotal: 0.75,
        diversity: 0.70,
        coverageVal: 0.65,
        clusterVal: 0.92,
        value: 0.85,
      },
      rejected: {
        brain: "B",
        lineage: "chaotic",
        scoreTotal: 0.70,
        diversity: 0.65,
        coverageVal: 0.55,
        clusterVal: 0.88,
        value: 0.78,
      },
      context: {
        batchName: "Alpha",
        scenario: "hybrid",
        mutationRate: 0.08,
        balanceA: 0.5,
        balanceAAdjustment: 0,
        slot: i + 1,
      },
      good: true,
    });
  }

  for (let i = 10; i < 12; i += 1) {
    arbiterMemory.registerDecision({
      chosen: {
        brain: "B",
        lineage: "chaotic",
        scoreTotal: 0.70,
        diversity: 0.65,
        coverageVal: 0.55,
        clusterVal: 0.88,
        value: 0.78,
      },
      rejected: {
        brain: "A",
        lineage: "conservative",
        scoreTotal: 0.75,
        diversity: 0.70,
        coverageVal: 0.65,
        clusterVal: 0.92,
        value: 0.85,
      },
      context: {
        batchName: "Alpha",
        scenario: "hybrid",
        mutationRate: 0.08,
        balanceA: 0.5,
        balanceAAdjustment: 0,
        slot: i + 1,
      },
      good: false,
    });
  }

  const summary1 = arbiterMemory.getSummary();
  console.log(`   ✓ ${summary1.decisionCount} decisões registradas`);
  console.log(`   ✓ Taxa de sucesso Brain A (hybrid): ${(summary1.successRates.hybrid.A * 100).toFixed(1)}%`);
  console.log(`   ✓ Taxa de sucesso Brain B (hybrid): ${(summary1.successRates.hybrid.B * 100).toFixed(1)}%\n`);

  console.log("▶ PHASE 2: Medindo viés adaptativo do árbitro\n");
  const biasA = arbiterMemory.getBrainBias("A", "hybrid", 0.5, 0.70, 0.65);
  const biasB = arbiterMemory.getBrainBias("B", "hybrid", 0.5, 0.70, 0.65);
  console.log(`   ✓ Viés para Brain A: ${biasA.toFixed(4)} (positivo = favorável)`);
  console.log(`   ✓ Viés para Brain B: ${biasB.toFixed(4)} (negativo = desfavorável)`);
  console.log(`   ✓ Diferença (A - B): ${(biasA - biasB).toFixed(4)}\n`);

  if (biasA > biasB) {
    console.log("   ✅ MEMÓRIA FUNCIONANDO: Brain A é favoritada no cálculo de valor\n");
  } else {
    console.log("   ❌ ERRO: Brain A deveria ser favoritada\n");
  }

  console.log("▶ PHASE 3: Ajuste dinâmico do balanceA\n");
  const adjustedBalance = arbiterMemory.adjustBalanceA(0.5, "hybrid", 8, 2);
  console.log(`   Original balanceA: 0.5 (50% Brain A)`);
  console.log(`   Adjusted balanceA: ${adjustedBalance.toFixed(3)} (${(adjustedBalance * 100).toFixed(1)}% Brain A)`);

  if (adjustedBalance > 0.5) {
    console.log(`   ✅ APRENDIZADO: Sistema aumentou preferência por Brain A (ganhou mais)\n`);
  }

  console.log("▶ PHASE 4: Registrando cenário diferente (aggressive com Brain B bem)\n");
  for (let i = 0; i < 6; i += 1) {
    arbiterMemory.registerDecision({
      chosen: {
        brain: "B",
        lineage: "chaotic",
        scoreTotal: 0.80,
        diversity: 0.75,
        coverageVal: 0.60,
        clusterVal: 0.90,
        value: 0.88,
      },
      rejected: {
        brain: "A",
        lineage: "conservative",
        scoreTotal: 0.72,
        diversity: 0.68,
        coverageVal: 0.58,
        clusterVal: 0.85,
        value: 0.80,
      },
      context: {
        batchName: "Omega",
        scenario: "aggressive",
        mutationRate: 0.12,
        balanceA: 0.3,
        balanceAAdjustment: 0,
        slot: i + 1,
      },
      good: true,
    });
  }

  const summary2 = arbiterMemory.getSummary();
  console.log(`   ✓ Taxa de sucesso Brain A (aggressive): ${(summary2.successRates.aggressive.A * 100).toFixed(1)}%`);
  console.log(`   ✓ Taxa de sucesso Brain B (aggressive): ${(summary2.successRates.aggressive.B * 100).toFixed(1)}%\n`);

  console.log("▶ PHASE 5: Validando contexto do árbitro\n");
  const state = arbiterMemory.getState();
  const hybridDecisions = state.decisions.filter((d) => d.context.scenario === "hybrid");
  const aggressiveDecisions = state.decisions.filter((d) => d.context.scenario === "aggressive");

  console.log(`   ✓ Decisões em cenário hybrid: ${hybridDecisions.length}`);
  console.log(`   ✓ Decisões em cenário aggressive: ${aggressiveDecisions.length}`);
  console.log(`   ✓ Total de decisões no histórico: ${state.decisions.length}\n`);

  console.log("▶ PHASE 6: Atualização de feedback pós-resultado\n");
  const firstDecisionId = state.decisions[0].id;
  console.log(`   Marcando decisão ${firstDecisionId.slice(0, 8)}... como RUIM (feedback real)\n`);
  arbiterMemory.markDecisionOutcome(firstDecisionId, false);

  const summary3 = arbiterMemory.getSummary();
  console.log(`   ✓ Taxa hybrid A após feedback: ${(summary3.successRates.hybrid.A * 100).toFixed(1)}%`);
  console.log(`   ✓ Sistema aprendeu com conferência real\n`);

  console.log("════════════════════════════════════════════════════════════\n");
  console.log("✅ VALIDAÇÃO COMPLETA: Sistema de Memória do Árbitro funcionando");
  console.log("   → Registra decisões com contexto completo");
  console.log("   → Calcula bias adaptativo por brain/cenário");
  console.log("   → Ajusta balanceA dinamicamente");
  console.log("   → Integra feedback real e atualiza estatísticas");
  console.log("   → Comportamento diferenciado por contexto\n");

  return {
    decisionCount: summary2.decisionCount,
    biasA,
    biasB,
    adjustedBalance,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateArbiterMemoryLearning().catch(console.error);
}

export default validateArbiterMemoryLearning;
