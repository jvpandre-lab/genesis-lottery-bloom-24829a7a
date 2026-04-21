import { describe, it, expect } from "vitest";
import {
  PressureSignal,
  AdjustmentRecord,
  LineageRecord,
  TerritorySnapshot,
} from "@/services/storageService";

// Estes testes validam a SHAPE dos contratos de persistência do ecossistema.
// Não chamam o Supabase real (sem rede em CI), mas garantem que o módulo
// exporta os tipos esperados e que objetos válidos passam por type-check.

describe("storageService - ecosystem persistence contracts", () => {
  it("PressureSignal aceita sinal triggered com threshold", () => {
    const s: PressureSignal = {
      signalType: "low_diversity",
      value: 0.18,
      threshold: 0.25,
      triggered: true,
      details: { source: "global" },
    };
    expect(s.triggered).toBe(true);
    expect(s.value).toBeLessThan(s.threshold!);
  });

  it("AdjustmentRecord registra causa e payload aplicado", () => {
    const a: AdjustmentRecord = {
      adjustmentType: "pressure_adjustment",
      details: { reason: "saturação territorial", boost: 0.15 },
      applied: true,
    };
    expect(a.applied).toBe(true);
    expect(a.details.boost).toBeGreaterThan(0);
  });

  it("LineageRecord captura drift e dominância", () => {
    const l: LineageRecord = {
      lineage: "chaotic",
      dominanceScore: 0.42,
      explorationRate: 0.71,
      stabilityScore: 0.33,
      driftMagnitude: 0.55,
      driftStatus: "drifting",
    };
    expect(l.dominanceScore).toBeGreaterThan(0);
    expect(l.driftStatus).toBe("drifting");
  });

  it("TerritorySnapshot suporta zonas e drift", () => {
    const t: TerritorySnapshot = {
      snapshot: { 17: 4, 23: 2, 88: 5 },
      saturationLevel: 0.62,
      pressureZones: [{ range: [80, 99], heat: 0.81 }],
      blindZones: [{ range: [0, 9], heat: 0.04 }],
      driftMagnitude: 0.31,
      driftDirection: "converging",
    };
    expect(Array.isArray(t.pressureZones)).toBe(true);
    expect(t.driftDirection).toMatch(/converging|diverging|stable/);
  });
});
