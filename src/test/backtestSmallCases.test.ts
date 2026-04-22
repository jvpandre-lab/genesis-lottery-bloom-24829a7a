import { describe, it, expect } from "vitest";
import { backtest } from "@/engine/backtestEngine";

describe("Backtest histórico - casos pequenos", () => {
  it("calcula corretamente métricas para 1, 3 e 5 concursos", () => {
    const draws = [
      { contestNumber: 1, numbers: Array.from({ length: 20 }, (_, k) => k) },
      { contestNumber: 2, numbers: Array.from({ length: 20 }, (_, k) => k + 20) },
      { contestNumber: 3, numbers: Array.from({ length: 20 }, (_, k) => k + 40) },
      { contestNumber: 4, numbers: Array.from({ length: 20 }, (_, k) => k + 60) },
      { contestNumber: 5, numbers: Array.from({ length: 20 }, (_, k) => k + 80) },
    ];

    const generation = [
      {
        scenario: "hybrid",
        batches: [
          {
            name: "Alpha",
            games: [
              { numbers: Array.from({ length: 50 }, (_, k) => k), lineage: "hybrid" },
              { numbers: Array.from({ length: 50 }, (_, k) => k + 25), lineage: "hybrid" },
            ],
          },
        ],
      },
    ];

    const report = backtest(generation, draws, [1, 3, 5]);

    expect(report.windows).toHaveLength(3);

    const window1 = report.windows.find((w) => w.windowSize === 1);
    const window3 = report.windows.find((w) => w.windowSize === 3);
    const window5 = report.windows.find((w) => w.windowSize === 5);

    expect(window1).toBeDefined();
    expect(window3).toBeDefined();
    expect(window5).toBeDefined();

    expect(window1?.draws).toBe(1);
    expect(window1?.totalGames).toBe(2);
    expect(window1?.avgHits).toBe(10); // 20 + 0 / 2

    expect(window3?.draws).toBe(3);
    expect(window3?.totalGames).toBe(6);
    expect(window3?.avgHits).toBeCloseTo((20 + 0 + 10 + 0 + 20 + 20) / 6, 6);

    expect(window5?.draws).toBe(5);
    expect(window5?.totalGames).toBe(10);
    expect(window5?.avgHits).toBeGreaterThan(0);
    expect(window5?.freq20).toBeGreaterThanOrEqual(0);
  });
});
