import { describe, it, expect } from "vitest";
import { backtestEvolutionaryRetrospective } from "@/engine/backtestEngine";

describe("Backtest evolutivo - auditoria temporal", () => {
  it("não utiliza concursos futuros para geração", async () => {
    const draws = Array.from({ length: 10 }, (_, i) => ({
      contestNumber: i + 1,
      numbers: Array.from({ length: 20 }, (_, k) => (i * 10 + k) % 100),
    }));

    const seenRecentDraws: number[][] = [];

    await backtestEvolutionaryRetrospective(3, 1, draws, "hybrid", async (input: any) => {
      seenRecentDraws.push(input.recentDraws.map((d: any) => d.contestNumber));
      return {
        id: `stub-${input.recentDraws.length}`,
        scenario: "hybrid",
        batches: [
          {
            name: "Alpha",
            purpose: "stub",
            dominant: "hybrid",
            avgScore: 0.5,
            diversity: 0.5,
            games: [
              {
                numbers: Array.from({ length: 50 }, (_, k) => k),
                lineage: "hybrid",
              },
            ],
          },
        ],
        metrics: { avgScore: 0.5, avgDiversity: 0.5, avgCoverage: 0.5, territoryEntropy: 0.5 },
        createdAt: new Date().toISOString(),
      } as any;
    });

    expect(seenRecentDraws).toHaveLength(3);
    expect(seenRecentDraws[0]).toEqual([1, 2, 3]);
    expect(seenRecentDraws[1]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(seenRecentDraws[2]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
