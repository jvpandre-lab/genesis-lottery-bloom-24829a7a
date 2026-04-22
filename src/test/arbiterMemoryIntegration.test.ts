import { describe, it, expect, beforeEach } from "vitest";
import { generate } from "@/engine/generatorCore";
import { mulberry32 } from "@/engine/rng";
import { arbiterMemory } from "@/engine/arbiterMemory";

describe("Arbiter Memory — Fluxo de Geração Completo", () => {
  beforeEach(() => {
    arbiterMemory.reset();
  });

  it("gera games e árbitro registra decisões na memória", async () => {
    const result = await generate({
      count: 4,
      scenario: "hybrid",
      rng: mulberry32(1001),
      twoBrains: true,
    });

    const state = arbiterMemory.getState();
    expect(state.decisions.length).toBeGreaterThan(0);
    expect(result.batches.length).toBeGreaterThan(0);
  }, 30000);

  it("árbitro usa memória para ajustar balanceA ao longo de múltiplas gerações", async () => {
    const generations = [];
    let recentResults: any[] = [];

    for (let gen = 0; gen < 3; gen += 1) {
      const result = await generate({
        count: 4,
        scenario: "hybrid",
        rng: mulberry32(2000 + gen),
        twoBrains: true,
        recentResults: recentResults.slice(-2),
      });

      generations.push({
        gen,
        picksA: result.diagnostics.ecoBrainBalance.picksA,
        picksB: result.diagnostics.ecoBrainBalance.picksB,
      });

      recentResults.push(result);
    }

    expect(generations.length).toBe(3);
    expect(generations[0].picksA + generations[0].picksB).toBe(4);

    console.log("\n   Distribuição A/B ao longo de 3 gerações:");
    generations.forEach((g) => {
      console.log(
        `   Gen ${g.gen + 1}: A=${g.picksA} B=${g.picksB} (${((g.picksA / (g.picksA + g.picksB)) * 100).toFixed(1)}% A)`
      );
    });
  }, 90000);

  it("memória registra contexto completo com batch, scenario e mutationRate", async () => {
    const result = await generate({
      count: 6,
      scenario: "conservative",
      rng: mulberry32(3001),
      twoBrains: true,
    });

    const state = arbiterMemory.getState();
    const conservativeDecisions = state.decisions.filter(
      (d) => d.context.scenario === "conservative"
    );

    expect(conservativeDecisions.length).toBeGreaterThan(0);

    const hasAlphaBatch = conservativeDecisions.some((d) => d.context.batchName === "Alpha");
    expect(hasAlphaBatch).toBe(true);

    const firstDecision = conservativeDecisions[0];
    expect(firstDecision.context.mutationRate).toBeGreaterThan(0);
    expect(firstDecision.context.balanceA).toBeGreaterThan(0);
  }, 30000);

  it("diagnósticos incluem reasoning do árbitro com memBias", async () => {
    const result = await generate({
      count: 4,
      scenario: "hybrid",
      rng: mulberry32(4001),
      twoBrains: true,
    });

    const reasoning = result.diagnostics.arbiterReasoning;
    expect(reasoning.length).toBeGreaterThan(0);

    const hasMemBias = reasoning.some((r) => r.includes("memBias"));
    expect(hasMemBias).toBe(true);

    console.log("\n   Amostra de reasoning do árbitro:");
    console.log(`   ${reasoning[0].substring(0, 120)}...`);
  }, 30000);

  it("validar que memória diferencia desempenho por cenário", async () => {
    const scenarios = ["conservative", "aggressive"] as const;

    for (const scenario of scenarios) {
      arbiterMemory.reset();

      for (let i = 0; i < 2; i += 1) {
        await generate({
          count: 4,
          scenario,
          rng: mulberry32(5000 + i),
          twoBrains: true,
        });
      }

      const summary = arbiterMemory.getSummary();
      expect(summary.decisionCount).toBeGreaterThan(0);
      console.log(
        `\n   ${scenario}: ${summary.decisionCount} decisões, Taxa A: ${(
          summary.successRates[scenario].A * 100
        ).toFixed(1)}%`
      );
    }
  }, 90000);
});
