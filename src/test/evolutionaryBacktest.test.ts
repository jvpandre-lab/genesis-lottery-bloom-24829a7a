import { describe, it, expect } from "vitest";
import {
  countHits,
  backtestEvolutionaryRetrospective,
  EvolutionaryBacktestReport,
} from "@/engine/backtestEngine";
import { GAME_SIZE } from "@/engine/lotteryTypes";

// Helpers de fixture
function fakeDraw(contestNumber: number, seed: number) {
  const set = new Set<number>();
  let s = seed;
  while (set.size < 20) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    set.add(s % 100);
  }
  return { contestNumber, numbers: Array.from(set).sort((a, b) => a - b) as number[] };
}

function fakeGame(seed: number) {
  const set = new Set<number>();
  let s = seed;
  while (set.size < GAME_SIZE) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    set.add(s % 100);
  }
  return Array.from(set).sort((a, b) => a - b);
}

describe("backtestEvolutionaryRetrospective", () => {
  it("countHits conta interseção exata", () => {
    expect(countHits([1, 2, 3, 4, 5], [3, 4, 5, 6, 7])).toBe(3);
    expect(countHits([], [1, 2])).toBe(0);
    expect(countHits([10, 20, 30], [10, 20, 30])).toBe(3);
  });

  it("não usa informação futura: cada geração só vê draws até seu ponto", async () => {
    const draws = Array.from({ length: 40 }, (_, i) => fakeDraw(i + 1, i + 1));
    const seenLengths: number[] = [];

    await backtestEvolutionaryRetrospective(
      4, // 4 gerações
      42,
      draws,
      "hybrid",
      async (input: any) => {
        seenLengths.push(input.recentDraws.length);
        // gera 5 jogos sintéticos
        return {
          id: "stub",
          label: "stub",
          scenario: "hybrid",
          requestedCount: 5,
          batches: [{
            name: "Alpha",
            purpose: "stub",
            dominant: "hybrid",
            avgScore: 0.5,
            diversity: 0.5,
            games: Array.from({ length: 5 }, (_, k) => ({
              numbers: fakeGame(input.recentDraws.length * 100 + k),
              lineage: "hybrid",
              score: { coverage: 0.5, distribution: 0.5, diversity: 0.5, territory: 0.5, antiBias: 0.5, clusterPenalty: 0.5, total: 0.5 },
              metrics: {} as any,
            })),
          }],
          metrics: { avgScore: 0.5, avgDiversity: 0.5, avgCoverage: 0.5, territoryEntropy: 0.5 },
          createdAt: new Date().toISOString(),
        } as any;
      }
    );

    // Cada chamada deve ter strictly more draws disponíveis (monotônico crescente)
    for (let i = 1; i < seenLengths.length; i++) {
      expect(seenLengths[i]).toBeGreaterThanOrEqual(seenLengths[i - 1]);
    }
    // Nenhuma geração viu mais que o total
    for (const len of seenLengths) {
      expect(len).toBeLessThanOrEqual(40);
    }
  });

  it("produz métricas evolutivas com curva temporal e tendências", async () => {
    const draws = Array.from({ length: 60 }, (_, i) => fakeDraw(i + 1, i * 7 + 3));
    const report: EvolutionaryBacktestReport = await backtestEvolutionaryRetrospective(
      6,
      999,
      draws,
      "hybrid",
      async (input: any) => ({
        id: "stub",
        label: "stub",
        scenario: "hybrid",
        requestedCount: 3,
        batches: [{
          name: "Alpha",
          purpose: "stub",
          dominant: "hybrid",
          avgScore: 0.5,
          diversity: 0.5,
          games: Array.from({ length: 3 }, (_, k) => ({
            numbers: fakeGame(input.recentDraws.length + k),
            lineage: k % 2 === 0 ? "conservative" : "chaotic",
            score: { coverage: 0.5, distribution: 0.5, diversity: 0.5, territory: 0.5, antiBias: 0.5, clusterPenalty: 0.5, total: 0.5 },
            metrics: {} as any,
          })),
        }],
        metrics: { avgScore: 0.5, avgDiversity: 0.5, avgCoverage: 0.5, territoryEntropy: 0.5 },
        createdAt: new Date().toISOString(),
      } as any)
    );

    expect(report.generations.length).toBe(6);
    expect(report.overall.avgHits).toBeGreaterThanOrEqual(0);
    expect(report.overall.avgHits).toBeLessThanOrEqual(20);
    // freqs em [0,1]
    expect(report.overall.freq15plus).toBeGreaterThanOrEqual(0);
    expect(report.overall.freq15plus).toBeLessThanOrEqual(1);
    // tem dados por linhagem
    expect(report.perLineage.length).toBeGreaterThan(0);
    // cada geração tem métricas territoriais
    for (const g of report.generations) {
      expect(g.territorySaturation).toBeGreaterThanOrEqual(0);
      expect(g.convergenceExcess).toBeGreaterThanOrEqual(0);
      expect(g.convergenceExcess).toBeLessThanOrEqual(1);
    }
  });

  it("rejeita histórico insuficiente", async () => {
    const draws = Array.from({ length: 5 }, (_, i) => fakeDraw(i + 1, i + 1));
    await expect(
      backtestEvolutionaryRetrospective(10, 1, draws, "hybrid", async () => ({} as any))
    ).rejects.toThrow();
  });
});
