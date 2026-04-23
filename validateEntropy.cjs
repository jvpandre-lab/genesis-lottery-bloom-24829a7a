#!/usr/bin/env node

/**
 * Structural Consistency Validation - Node.js Script
 */

const fs = require("fs");

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║      STRUCTURAL CONSISTENCY VALIDATION                    ║");
console.log("║   Objetivo: Validar dados, métricas e fluxo geral         ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// ═══════════════════════════════════════════════════════════════════════════════
// TASK 2: Territory Entropy NaN Risk Analysis (can run without network)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("┌─────────────────────────────────────────────────────────┐");
console.log("│ TASK: Validar territoryEntropy (NaN risk analysis)     │");
console.log("└─────────────────────────────────────────────────────────┘\n");

function entropy(usage) {
  const DOMAIN_SIZE = 100;
  const total = usage.reduce((s, v) => s + v, 0);
  if (total === 0) return 1; // Safe guard
  let h = 0;
  for (const u of usage) {
    if (u === 0) continue;
    const p = u / total;
    h -= p * Math.log(p);
  }
  return h / Math.log(DOMAIN_SIZE);
}

const testCases = [
  {
    name: "Empty usage",
    usage: new Array(100).fill(0),
  },
  {
    name: "Uniform usage",
    usage: new Array(100).fill(1),
  },
  {
    name: "Concentrated (2 high)",
    usage: (() => {
      const arr = new Array(100).fill(0);
      arr[0] = 100;
      arr[1] = 100;
      return arr;
    })(),
  },
  {
    name: "Random distribution",
    usage: (() => {
      const arr = new Array(100).fill(0);
      for (let i = 0; i < 100; i++) arr[i] = Math.floor(Math.random() * 10);
      return arr;
    })(),
  },
];

let nanFound = false;
const results = [];

for (const test of testCases) {
  try {
    const ent = entropy(test.usage);
    const isNaN = !Number.isFinite(ent);
    results.push({
      test: test.name,
      entropy: ent.toFixed(4),
      isValid: Number.isFinite(ent),
    });
    console.log(`  ${isNaN ? "X" : "OK"} ${test.name}: ${ent.toFixed(4)}`);
    if (isNaN) nanFound = true;
  } catch (err) {
    results.push({ test: test.name, error: err.message });
    console.log(`  X ${test.name}: ERROR - ${err.message}`);
    nanFound = true;
  }
}

const territoryEntropy = {
  allTestsPassed: !nanFound,
  nanRiskDetected: nanFound,
  testResults: results,
  conclusion: nanFound ? "NaN risk FOUND - needs fix" : "No NaN risk detected",
};

console.log(`\nConclusion: ${territoryEntropy.conclusion}`);

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║              VALIDATION SUMMARY                           ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log("Territory Entropy NaN Risk:");
console.log(
  `  Status: ${territoryEntropy.allTestsPassed ? "PASS - No NaN risk" : "FAIL - NaN risk detected"}`,
);

const report = {
  timestamp: new Date().toISOString(),
  territoryEntropyAnalysis: territoryEntropy,
};

fs.writeFileSync(
  "validation_entropy_report.json",
  JSON.stringify(report, null, 2),
);
console.log("\nReport saved to: validation_entropy_report.json");

process.exit(territoryEntropy.allTestsPassed ? 0 : 1);
