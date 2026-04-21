import { generate } from "../engine/generatorCore";
import { mulberry32 } from "../engine/rng";

async function testIntegrations() {
  console.log("Testing integrations...");

  // Test with engines enabled
  const withEngines = await generate({
    count: 6,
    rng: mulberry32(100),
    twoBrains: true,
    scenario: "hybrid",
    disableEngines: {}
  });

  console.log("With engines:");
  console.log("Scenario:", withEngines.scenario);
  console.log("Tactical Composition:", withEngines.diagnostics.tacticalComposition);
  console.log("Brain Tension Health:", withEngines.diagnostics.brainTensionHealth);
  console.log("PreGen Context:", withEngines.diagnostics.preGenContext?.scenarioOverride);

  // Test with engines disabled
  const withoutEngines = await generate({
    count: 6,
    rng: mulberry32(100),
    twoBrains: true,
    scenario: "hybrid",
    disableEngines: { tacticalRole: true, brainTension: true, preGenEcosystem: true }
  });

  console.log("\nWithout engines:");
  console.log("Scenario:", withoutEngines.scenario);
  console.log("Tactical Composition:", withoutEngines.diagnostics.tacticalComposition);
  console.log("Brain Tension Health:", withoutEngines.diagnostics.brainTensionHealth);
  console.log("PreGen Context:", withoutEngines.diagnostics.preGenContext?.scenarioOverride);

  console.log("\nTest completed.");
}

testIntegrations().catch(console.error);