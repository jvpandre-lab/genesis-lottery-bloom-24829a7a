/**
 * Integration Impact Test
 * Validates the new integrations with short comparisons.
 */
import { describe, it, expect } from "vitest";
import { generate } from "@/engine/generatorCore";
import { mulberry32 } from "@/engine/rng";

describe("Integration Impact Validation", () => {
    it("TacticalRole: ativo vs desligado", async () => {
        const [withTactical, withoutTactical] = await Promise.all([
            generate({ count: 6, rng: mulberry32(100), twoBrains: true, scenario: "hybrid", disableEngines: {} }),
            generate({ count: 6, rng: mulberry32(100), twoBrains: true, scenario: "hybrid", disableEngines: { tacticalRole: true } }),
        ]);
        const compWith = withTactical.diagnostics.tacticalComposition;
        const compWithout = withoutTactical.diagnostics.tacticalComposition;
        console.log("TacticalRole With:", compWith);
        console.log("TacticalRole Without:", compWithout);
        expect(Object.keys(compWith).length).toBeGreaterThan(Object.keys(compWithout).length);
    });

    it("ScenarioEvolution: ativo vs desligado", async () => {
        const gen1 = await generate({ count: 4, rng: mulberry32(200), twoBrains: true, scenario: "hybrid" });
        const [withEvolution, withoutEvolution] = await Promise.all([
            generate({ count: 4, rng: mulberry32(201), twoBrains: true, scenario: "hybrid", recentResults: [gen1], disableEngines: {} }),
            generate({ count: 4, rng: mulberry32(201), twoBrains: true, scenario: "hybrid", recentResults: [gen1], disableEngines: { preGenEcosystem: true } }),
        ]);
        console.log("ScenarioEvolution With:", withEvolution.scenario, withEvolution.diagnostics.preGenContext?.scenarioOverride);
        console.log("ScenarioEvolution Without:", withoutEvolution.scenario, withoutEvolution.diagnostics.preGenContext);
        // Check if scenario was overridden
        expect(withEvolution.diagnostics.preGenContext?.scenarioOverride).toBeDefined();
    });

    it("BrainTension: ativo vs desligado", async () => {
        const gen1 = await generate({ count: 4, rng: mulberry32(300), twoBrains: true, scenario: "hybrid" });
        const [withTension, withoutTension] = await Promise.all([
            generate({ count: 4, rng: mulberry32(301), twoBrains: true, scenario: "hybrid", recentResults: [gen1], disableEngines: {} }),
            generate({ count: 4, rng: mulberry32(301), twoBrains: true, scenario: "hybrid", recentResults: [gen1], disableEngines: { brainTension: true } }),
        ]);
        console.log("BrainTension With:", withTension.diagnostics.brainTensionHealth);
        console.log("BrainTension Without:", withoutTension.diagnostics.brainTensionHealth);
        expect(withTension.diagnostics.brainTensionHealth).not.toBeNull();
        expect(withoutTension.diagnostics.brainTensionHealth).toBeNull();
    });
});