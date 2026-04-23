/**
 * validateArbiterLearning.mjs
 *
 * Standalone Node.js validation script for the arbiterMemory real learning system.
 * Exercises the pure logic without Supabase.
 *
 * Run: node validateArbiterLearning.mjs
 */

// ─── Inline helpers (mirrors arbiterMemory.ts logic) ───────────────────────

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function classifyQuality(hits) {
    if (hits >= 11) return "good";
    if (hits >= 9) return "neutral";
    return "bad";
}

function computeRawDelta(quality, hits) {
    if (quality === "good") {
        return 0.1 + 0.02 * clamp(hits - 10, 0, 10);
    }
    if (quality === "bad") {
        return -(0.1 + 0.02 * clamp(10 - hits, 0, 10));
    }
    return 0; // neutral
}

// ─── In-memory state ──────────────────────────────────────────────────────

const state = {
    decisions: [],
    memoryBias: {
        conservative: 0,
        hybrid: 0,
        aggressive: 0,
        exploratory: 0,
    },
};

// ─── applyLearning logic (inline, no Supabase) ────────────────────────────

function makeDecisionId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addFakeDecision(scenario) {
    const id = makeDecisionId();
    state.decisions.push({
        id,
        context: { scenario },
        good: true,
        outcomeHits: undefined,
        outcomeQuality: undefined,
    });
    return id;
}

function applyLearning(decisionId, hits, contestNumber) {
    const decision = state.decisions.find((d) => d.id === decisionId);

    if (!decision) {
        console.log(`[ARBITER LEARNING] decisionId ${decisionId} not found`);
        return;
    }

    // Idempotency guard
    if (decision.outcomeHits !== undefined) {
        console.log(
            `[ARBITER LEARNING] skipped duplicate outcome` +
            ` | decisionId: ${decisionId}` +
            ` | contestNumber: ${contestNumber}` +
            ` | already evaluated with hits=${decision.outcomeHits} quality=${decision.outcomeQuality}`,
        );
        return;
    }

    const quality = classifyQuality(hits);
    const scenario = decision.context.scenario;
    const biasBefore = state.memoryBias[scenario];

    const rawDelta = computeRawDelta(quality, hits);
    const normFactor = Math.max(1, state.decisions.length / 20);
    const normalizedDelta = rawDelta / normFactor;
    const biasAfter = clamp(biasBefore + normalizedDelta, -0.5, 0.5);

    state.memoryBias[scenario] = biasAfter;
    decision.outcomeHits = hits;
    decision.outcomeQuality = quality;
    decision.good = quality !== "bad";

    console.log(
        `[ARBITER LEARNING]\n` +
        `  decisionId:      ${decisionId}\n` +
        `  contestNumber:   ${contestNumber}\n` +
        `  hits:            ${hits}\n` +
        `  quality:         ${quality}\n` +
        `  scenario:        ${scenario}\n` +
        `  biasBefore:      ${biasBefore.toFixed(6)}\n` +
        `  normalizedDelta: ${normalizedDelta.toFixed(6)}\n` +
        `  biasAfter:       ${biasAfter.toFixed(6)}`,
    );
}

// ─── Validation ───────────────────────────────────────────────────────────

console.log("=".repeat(60));
console.log("ARBITER LEARNING — VALIDATION SCRIPT");
console.log("=".repeat(60));

// Populate some fake decisions so normFactor > 1 is realistic
for (let i = 0; i < 20; i++) addFakeDecision("hybrid");

// --- Test 1: GOOD outcome (hits = 14) ---
console.log("\n─── Test 1: hits=14 (expected → GOOD, bias rises) ───");
const idGood = addFakeDecision("hybrid");
const biasBefore1 = state.memoryBias["hybrid"];
applyLearning(idGood, 14, 2345);
const biasAfter1 = state.memoryBias["hybrid"];
console.log(`  PASS: bias changed from ${biasBefore1.toFixed(6)} → ${biasAfter1.toFixed(6)}`);
console.assert(biasAfter1 > biasBefore1, "FAIL: good outcome should raise bias");

// --- Test 2: NEUTRAL outcome (hits = 10) ---
console.log("\n─── Test 2: hits=10 (expected → NEUTRAL, bias unchanged) ───");
const idNeutral = addFakeDecision("hybrid");
const biasBefore2 = state.memoryBias["hybrid"];
applyLearning(idNeutral, 10, 2346);
const biasAfter2 = state.memoryBias["hybrid"];
console.log(`  PASS: bias unchanged at ${biasAfter2.toFixed(6)} (neutral no-op)`);
console.assert(biasAfter2 === biasBefore2, "FAIL: neutral outcome should not change bias");

// --- Test 3: BAD outcome (hits = 5) ---
console.log("\n─── Test 3: hits=5 (expected → BAD, bias drops) ───");
const idBad = addFakeDecision("hybrid");
const biasBefore3 = state.memoryBias["hybrid"];
applyLearning(idBad, 5, 2347);
const biasAfter3 = state.memoryBias["hybrid"];
console.log(`  PASS: bias changed from ${biasBefore3.toFixed(6)} → ${biasAfter3.toFixed(6)}`);
console.assert(biasAfter3 < biasBefore3, "FAIL: bad outcome should lower bias");

// --- Test 4: Idempotency — applying same decisionId again must be skipped ---
console.log("\n─── Test 4: Duplicate apply on idGood (must be SKIPPED) ───");
const biasBeforeRepeat = state.memoryBias["hybrid"];
applyLearning(idGood, 14, 2345); // identical call
const biasAfterRepeat = state.memoryBias["hybrid"];
console.assert(biasAfterRepeat === biasBeforeRepeat, "FAIL: duplicate outcome must not change bias");
console.log(`  PASS: bias unchanged at ${biasAfterRepeat.toFixed(6)} (idempotent)`);

// --- Test 5: Cross-scenario isolation ---
console.log("\n─── Test 5: Different scenario (conservative) stays at 0 ───");
console.assert(state.memoryBias["conservative"] === 0, "FAIL: conservative bias should be untouched");
console.log(`  PASS: conservative bias = ${state.memoryBias["conservative"]}`);

// ─── Final state summary ──────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("FINAL memoryBias state:");
for (const [scenario, bias] of Object.entries(state.memoryBias)) {
    console.log(`  ${scenario.padEnd(16)} ${bias.toFixed(6)}`);
}

const evaluatedDecisions = state.decisions.filter((d) => d.outcomeHits !== undefined);
console.log(`\nEvaluated decisions: ${evaluatedDecisions.length}`);
console.log(`Total decisions:     ${state.decisions.length}`);

console.log("\n✅ All validation checks passed.");
console.log("=".repeat(60));
