import { describe, it, expect, beforeEach } from "vitest";
import { arbiterMemory } from "@/engine/arbiterMemory";

describe("Arbiter Memory — Learning System", () => {
  beforeEach(() => {
    arbiterMemory.reset();
  });

  it("registra e persiste decisões do árbitro", () => {
    const recordId = arbiterMemory.registerDecision({
      chosen: {
        brain: "A",
        lineage: "conservative",
        scoreTotal: 0.70,
        diversity: 0.72,
        coverageVal: 0.60,
        clusterVal: 0.90,
        value: 0.80,
      },
      rejected: {
        brain: "B",
        lineage: "chaotic",
        scoreTotal: 0.68,
        diversity: 0.65,
        coverageVal: 0.50,
        clusterVal: 0.85,
        value: 0.74,
      },
      context: {
        batchName: "Alpha",
        scenario: "hybrid",
        mutationRate: 0.08,
        balanceA: 0.5,
        balanceAAdjustment: 0,
        slot: 1,
      },
      good: true,
    });

    const state = arbiterMemory.getState();
    expect(state.decisions.length).toBe(1);
    expect(state.decisions[0].id).toBe(recordId);
    expect(state.decisions[0].chosen.brain).toBe("A");
    expect(state.decisions[0].good).toBe(true);
  });

  it("computa taxa de sucesso por cenário e brain", () => {
    for (let i = 0; i < 5; i += 1) {
      arbiterMemory.registerDecision({
        chosen: {
          brain: "A",
          lineage: "conservative",
          scoreTotal: 0.70,
          diversity: 0.72,
          coverageVal: 0.60,
          clusterVal: 0.90,
          value: 0.80,
        },
        rejected: {
          brain: "B",
          lineage: "chaotic",
          scoreTotal: 0.68,
          diversity: 0.65,
          coverageVal: 0.50,
          clusterVal: 0.85,
          value: 0.74,
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

    for (let i = 0; i < 2; i += 1) {
      arbiterMemory.registerDecision({
        chosen: {
          brain: "B",
          lineage: "chaotic",
          scoreTotal: 0.68,
          diversity: 0.65,
          coverageVal: 0.50,
          clusterVal: 0.85,
          value: 0.74,
        },
        rejected: {
          brain: "A",
          lineage: "conservative",
          scoreTotal: 0.70,
          diversity: 0.72,
          coverageVal: 0.60,
          clusterVal: 0.90,
          value: 0.80,
        },
        context: {
          batchName: "Alpha",
          scenario: "hybrid",
          mutationRate: 0.08,
          balanceA: 0.5,
          balanceAAdjustment: 0,
          slot: i + 6,
        },
        good: false,
      });
    }

    const summary = arbiterMemory.getSummary();
    expect(summary.decisionCount).toBe(7);
    expect(summary.successRates.hybrid.A).toBeGreaterThan(0.7);
    expect(summary.successRates.hybrid.B).toBeLessThan(0.4);
  });

  it("getBrainBias retorna viés adaptativo baseado em histórico", () => {
    for (let i = 0; i < 10; i += 1) {
      arbiterMemory.registerDecision({
        chosen: { brain: "A", lineage: "conservative", scoreTotal: 0.75, diversity: 0.70, coverageVal: 0.65, clusterVal: 0.92, value: 0.85 },
        rejected: { brain: "B", lineage: "chaotic", scoreTotal: 0.70, diversity: 0.65, coverageVal: 0.55, clusterVal: 0.88, value: 0.78 },
        context: { batchName: "Alpha", scenario: "conservative", mutationRate: 0.06, balanceA: 0.7, balanceAAdjustment: 0, slot: i + 1 },
        good: true,
      });
    }

    const biasA = arbiterMemory.getBrainBias("A", "conservative", 0.7, 0.70, 0.65);
    const biasB = arbiterMemory.getBrainBias("B", "conservative", 0.7, 0.70, 0.65);

    expect(biasA).toBeGreaterThan(biasB);
  });

  it("adjustBalanceA ajusta dinamicamente baseado em sucesso passado", () => {
    for (let i = 0; i < 8; i += 1) {
      arbiterMemory.registerDecision({
        chosen: { brain: "A", lineage: "conservative", scoreTotal: 0.75, diversity: 0.70, coverageVal: 0.65, clusterVal: 0.92, value: 0.85 },
        rejected: { brain: "B", lineage: "chaotic", scoreTotal: 0.70, diversity: 0.65, coverageVal: 0.55, clusterVal: 0.88, value: 0.78 },
        context: { batchName: "Alpha", scenario: "hybrid", mutationRate: 0.08, balanceA: 0.5, balanceAAdjustment: 0, slot: i + 1 },
        good: true,
      });
    }

    const adjusted = arbiterMemory.adjustBalanceA(0.5, "hybrid", 3, 2);
    expect(adjusted).toBeGreaterThan(0.5);
  });

  it("markDecisionOutcome atualiza feedback real após resultado", () => {
    const id = arbiterMemory.registerDecision({
      chosen: { brain: "A", lineage: "conservative", scoreTotal: 0.75, diversity: 0.70, coverageVal: 0.65, clusterVal: 0.92, value: 0.85 },
      rejected: { brain: "B", lineage: "chaotic", scoreTotal: 0.70, diversity: 0.65, coverageVal: 0.55, clusterVal: 0.88, value: 0.78 },
      context: { batchName: "Alpha", scenario: "hybrid", mutationRate: 0.08, balanceA: 0.5, balanceAAdjustment: 0, slot: 1 },
      good: true,
    });

    const beforeSummary = arbiterMemory.getSummary();
    expect(beforeSummary.successRates.hybrid.A).toBeGreaterThan(0.5);

    arbiterMemory.markDecisionOutcome(id, false);

    const afterSummary = arbiterMemory.getSummary();
    expect(afterSummary.successRates.hybrid.A).toBeLessThan(beforeSummary.successRates.hybrid.A);
  });

  it("memória penaliza padrões de erro detectados", () => {
    for (let i = 0; i < 5; i += 1) {
      arbiterMemory.registerDecision({
        chosen: { brain: "B", lineage: "chaotic", scoreTotal: 0.65, diversity: 0.60, coverageVal: 0.45, clusterVal: 0.80, value: 0.70 },
        rejected: { brain: "A", lineage: "conservative", scoreTotal: 0.75, diversity: 0.70, coverageVal: 0.65, clusterVal: 0.92, value: 0.85 },
        context: { batchName: "Omega", scenario: "aggressive", mutationRate: 0.12, balanceA: 0.3, balanceAAdjustment: 0, slot: i + 1 },
        good: false,
      });
    }

    const state = arbiterMemory.getState();
    const errorKeys = Object.keys(state.errors);
    expect(errorKeys.length).toBeGreaterThan(0);
    expect(errorKeys.some((k) => k.includes("chosen:B") && k.includes("rejected:A"))).toBe(true);
  });
});
