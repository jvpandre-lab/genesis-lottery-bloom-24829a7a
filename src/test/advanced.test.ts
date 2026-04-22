import { describe, it, expect } from "vitest";
import { backtest, countHits, fromGenerationResult } from "@/engine/backtestEngine";
import { generate } from "@/engine/generatorCore";
import { mulberry32 } from "@/engine/rng";
import { PressureEngine } from "@/engine/adaptivePressureEngine";
import { proposeFromBrain, arbitrateBatch } from "@/engine/twoBrainsEngine";
import { arbiterMemory } from "@/engine/arbiterMemory";

describe("Backtest", () => {
  it("countHits correto", () => {
    expect(countHits([1, 2, 3, 4, 5], [3, 4, 6])).toBe(2);
  });

  it("backtest produz buckets coerentes", async () => {
    const gen = await generate({ count: 3, scenario: "hybrid", rng: mulberry32(11), twoBrains: true });
    const draws = Array.from({ length: 60 }, (_, i) => ({
      contestNumber: 1000 + i,
      numbers: Array.from({ length: 20 }, (_, k) => (i + k * 5) % 100),
    }));
    const rep = backtest([fromGenerationResult(gen)], draws, [50]);
    expect(rep.windows.length).toBe(1);
    expect(rep.windows[0].draws).toBe(50);
    expect(rep.windows[0].totalGames).toBe(3 * 50);
    expect(rep.windows[0].avgHits).toBeGreaterThan(0);
    expect(rep.perLineage.length).toBeGreaterThan(0);
    expect(rep.perBatch.length).toBeGreaterThan(0);
  }, 10000);
});

describe("Two Brains + Arbiter", () => {
  it("árbitro respeita balanceA aproximado", () => {
    const ctxBase = { usage: new Array(100).fill(0), reference: [], recentDraws: [] };
    const A = proposeFromBrain("A", "Alpha", 0, ctxBase, 4, mulberry32(21));
    const B = proposeFromBrain("B", "Alpha", 0, ctxBase, 4, mulberry32(22));
    const { selected } = arbitrateBatch([...A, ...B], 4, 0.75, ctxBase, "hybrid", 0.08, "Alpha");
    const aShare = selected.filter((c) => c.brain === "A").length / selected.length;
    expect(aShare).toBeGreaterThanOrEqual(0.5);
  });

  it("árbitro aprende com memória e penaliza Brain B ruim", () => {
    arbiterMemory.reset();
    const ctxBase = { usage: new Array(100).fill(0), reference: [], recentDraws: [] };
    const chosenA = {
      brain: "A" as const,
      lineage: "conservative" as const,
      scoreTotal: 0.68,
      diversity: 0.70,
      coverageVal: 0.55,
      clusterVal: 0.92,
      value: 0.88,
    };
    const rejectedB = {
      brain: "B" as const,
      lineage: "chaotic" as const,
      scoreTotal: 0.72,
      diversity: 0.65,
      coverageVal: 0.50,
      clusterVal: 0.88,
      value: 0.82,
    };
    for (let i = 0; i < 8; i += 1) {
      arbiterMemory.registerDecision({
        chosen: chosenA,
        rejected: rejectedB,
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

    const candidateA = {
      brain: "A" as const,
      lineage: "conservative" as const,
      numbers: Array.from({ length: 50 }, (_, i) => i),
      scoreTotal: 0.68,
      diversity: 0.7,
      coverageVal: 0.55,
      clusterVal: 0.92,
    };
    const candidateB = {
      brain: "B" as const,
      lineage: "chaotic" as const,
      numbers: Array.from({ length: 50 }, (_, i) => 50 + i),
      scoreTotal: 0.72,
      diversity: 0.65,
      coverageVal: 0.5,
      clusterVal: 0.88,
    };
    const { selected } = arbitrateBatch([
      candidateA,
      { ...candidateA, numbers: Array.from({ length: 50 }, (_, i) => (i + 2) % 100) },
      candidateB,
      { ...candidateB, numbers: Array.from({ length: 50 }, (_, i) => (50 + i + 2) % 100) },
    ], 2, 0.5, ctxBase, "hybrid", 0.08, "Alpha");

    expect(selected.filter((c) => c.brain === "A").length).toBeGreaterThan(0);
  });

  it("árbitro produz exatamente targetSize jogos", () => {
    const ctxBase = { usage: new Array(100).fill(0), reference: [], recentDraws: [] };
    const A = proposeFromBrain("A", "Sigma", 0, ctxBase, 5, mulberry32(31));
    const B = proposeFromBrain("B", "Sigma", 0, ctxBase, 5, mulberry32(32));
    const { selected } = arbitrateBatch([...A, ...B], 6, 0.4, ctxBase, "hybrid", 0.08, "Sigma");
    expect(selected.length).toBe(6);
  });
});

describe("Adaptive pressure", () => {
  it("não dispara ajustes sem histórico suficiente", () => {
    const p = new PressureEngine();
    const adj = p.computeAdjustments("hybrid");
    expect(adj.reasons.length).toBe(0);
  });
});
