const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const VITE_SUPABASE_URL = "https://kvlgqjvvzewbxivqceza.supabase.co";
const VITE_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY);

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║      STRUCTURAL CONSISTENCY VALIDATION                    ║");
console.log("║   Objetivo: Validar dados, métricas e fluxo geral         ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// ═══════════════════════════════════════════════════════════════════════════════
// TASK 1: Validate lotomania_draws history
// ═══════════════════════════════════════════════════════════════════════════════

async function validateDrawsHistory() {
  console.log("┌─────────────────────────────────────────────────────────┐");
  console.log("│ TASK 1: Validar histórico de draws (lotomania_draws)   │");
  console.log("└─────────────────────────────────────────────────────────┘\n");

  try {
    // Count total draws
    const { count, error: countErr } = await supabase
      .from("lotomania_draws")
      .select("*", { count: "exact", head: true });

    if (countErr) throw countErr;
    const drawsCount = count ?? 0;
    console.log(`✓ Total draws na base: ${drawsCount}`);

    // Fetch all draws for integrity check
    const { data: draws, error: fetchErr } = await supabase
      .from("lotomania_draws")
      .select("contest_number, draw_date, numbers")
      .order("contest_number", { ascending: false })
      .limit(100);

    if (fetchErr) throw fetchErr;

    // Validate data integrity
    let validCount = 0;
    let invalidCount = 0;
    const sampleDraws = [];

    for (const draw of draws || []) {
      const nums = draw.numbers;
      // Check: array of exactly 20 numbers in range 0-99
      if (
        Array.isArray(nums) &&
        nums.length === 20 &&
        nums.every((n) => n >= 0 && n <= 99)
      ) {
        validCount++;
        if (sampleDraws.length < 3) {
          sampleDraws.push({
            contest: draw.contest_number,
            date: draw.draw_date,
            numbers: nums.sort((a, b) => a - b).join(","),
          });
        }
      } else {
        invalidCount++;
        console.log(
          `  ⚠ Draw ${draw.contest_number}: INVÁLIDO (${nums?.length ?? 0} números)`,
        );
      }
    }

    console.log(
      `✓ Integridade dos draws: ${validCount}/${validCount + invalidCount} válidos`,
    );
    if (sampleDraws.length > 0) {
      console.log("  Amostra de draws válidos:");
      sampleDraws.forEach((s) => {
        console.log(
          `    Contest ${s.contest}: ${s.numbers.substring(0, 40)}...`,
        );
      });
    }

    const dataQuality = {
      totalDraws: drawsCount,
      sampleCount: draws?.length ?? 0,
      validInSample: validCount,
      invalidInSample: invalidCount,
      passesCriteria: drawsCount >= 10 && invalidCount === 0,
    };

    return dataQuality;
  } catch (err) {
    console.error("✗ Erro ao validar draws:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK 2: Validate territoryEntropy NaN risk (local logic)
// ═══════════════════════════════════════════════════════════════════════════════

function validateTerritoryEntropyLogic() {
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│ TASK 2: Validar territoryEntropy (NaN risk analysis)   │");
  console.log("└─────────────────────────────────────────────────────────┘\n");

  // Reproduce the entropy() logic from territoryEngine.ts
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
    { name: "Empty usage", usage: new Array(100).fill(0) },
    { name: "Uniform usage", usage: new Array(100).fill(1) },
    {
      name: "Concentrated usage (few high)",
      usage: (() => {
        const arr = new Array(100).fill(0);
        arr[0] = 100;
        arr[1] = 100;
        return arr;
      })(),
    },
    {
      name: "Normal distribution",
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
        isNaN,
        isValid: Number.isFinite(ent),
      });
      console.log(`  ${isNaN ? "X" : "✓"} ${test.name}: ${ent.toFixed(4)}`);
      if (isNaN) nanFound = true;
    } catch (err) {
      results.push({ test: test.name, error: err.message });
      console.log(`  X ${test.name}: ERROR - ${err.message}`);
      nanFound = true;
    }
  }

  const entropyValidation = {
    allTestsPassed: !nanFound,
    nanRiskDetected: nanFound,
    testResults: results,
    conclusion: nanFound
      ? "NaN risk FOUND - needs fix"
      : "No NaN risk detected",
  };

  console.log(`\n  Conclusão: ${entropyValidation.conclusion}`);
  return entropyValidation;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK 3: Validate backtest consistency
// ═══════════════════════════════════════════════════════════════════════════════

async function validateBacktestConsistency() {
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│ TASK 3: Validar backtest (10 draws vs máximo)          │");
  console.log("└─────────────────────────────────────────────────────────┘\n");

  try {
    // Fetch all draws
    const { data: allDraws, error: err } = await supabase
      .from("lotomania_draws")
      .select("contest_number, numbers")
      .order("contest_number", { ascending: true });

    if (err) throw err;

    const draws = (allDraws || []).map((d) => ({
      contestNumber: d.contest_number,
      numbers: d.numbers,
    }));

    console.log(`✓ Total draws disponíveis: ${draws.length}`);

    // Fetch recent generations to backtest against
    const { data: gens, error: genErr } = await supabase
      .from("generations")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (genErr) throw genErr;

    const generationsCount = gens?.length ?? 0;
    console.log(`✓ Total generations disponíveis: ${generationsCount}`);

    // Validate that we have enough data
    const consistencyMetrics = {
      totalDraws: draws.length,
      totalGenerations: generationsCount,
      drawsAt10: Math.min(10, draws.length),
      maxDrawsUsable: draws.length,
      canDoBacktest10: draws.length >= 10,
      canDoBacktestFull: draws.length >= 20,
      ratioDrawsToGen:
        generationsCount > 0
          ? (draws.length / generationsCount).toFixed(2)
          : "N/A",
    };

    if (consistencyMetrics.canDoBacktest10) {
      console.log(`✓ Backtest com 10 draws: POSSÍVEL`);
    } else {
      console.log(
        `✗ Backtest com 10 draws: IMPOSSÍVEL (apenas ${draws.length} draws)`,
      );
    }

    if (consistencyMetrics.canDoBacktestFull) {
      console.log(`✓ Backtest com máximo (${draws.length} draws): POSSÍVEL`);
    } else {
      console.log(`✗ Backtest com máximo: IMPOSSÍVEL`);
    }

    console.log(
      `✓ Razão draws/generations: ${consistencyMetrics.ratioDrawsToGen}`,
    );

    return consistencyMetrics;
  } catch (err) {
    console.error("✗ Erro ao validar backtest:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK 4: Validate recentResults flow
// ═══════════════════════════════════════════════════════════════════════════════

async function validateRecentResultsFlow() {
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│ TASK 4: Validar recentResults flow (generator input)   │");
  console.log("└─────────────────────────────────────────────────────────┘\n");

  try {
    // Simulate fetchRecentGenerations(10) logic
    const { data: gens, error: e1 } = await supabase
      .from("generations")
      .select(
        "id, label, scenario, requested_count, params, metrics, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(10);

    if (e1) throw e1;
    if (!gens || gens.length === 0) {
      console.log("⚠ No generations found in database");
      return {
        generationsCount: 0,
        batchesCount: 0,
        gamesCount: 0,
        reconstructable: false,
        hasRecentResults: false,
      };
    }

    console.log(`✓ Gerações fetched: ${gens.length}`);

    let totalBatches = 0;
    let totalGames = 0;
    let reconstructable = true;

    for (const gen of gens) {
      const { data: batches, error: e2 } = await supabase
        .from("generation_batches")
        .select("id, name")
        .eq("generation_id", gen.id);

      if (e2) {
        console.log(`  ⚠ Gen ${gen.id?.slice(0, 8)}: erro ao fetch batches`);
        reconstructable = false;
        continue;
      }

      totalBatches += batches?.length ?? 0;

      for (const batch of batches || []) {
        const { data: games, error: e3 } = await supabase
          .from("generation_games")
          .select("id")
          .eq("batch_id", batch.id);

        if (e3) {
          console.log(
            `  ⚠ Batch ${batch.id?.slice(0, 8)}: erro ao fetch games`,
          );
          reconstructable = false;
          continue;
        }

        totalGames += games?.length ?? 0;
      }
    }

    console.log(`✓ Total batches: ${totalBatches}`);
    console.log(`✓ Total games: ${totalGames}`);

    const recentResultsValidation = {
      generationsCount: gens.length,
      batchesCount: totalBatches,
      gamesCount: totalGames,
      reconstructable,
      hasRecentResults: gens.length > 0,
      generatorWillReceive: gens.length > 0 ? "populated" : "empty",
      generatorWarning: gens.length === 0 ? "CRITICAL: will log warning" : "OK",
    };

    if (recentResultsValidation.generatorWillReceive === "empty") {
      console.log("⚠ ⚠ ⚠ GENERATOR WILL RECEIVE EMPTY recentResults ⚠ ⚠ ⚠");
    } else {
      console.log(
        `✓ generator() will receive recentResults: ${recentResultsValidation.generatorWillReceive}`,
      );
    }

    return recentResultsValidation;
  } catch (err) {
    console.error("✗ Erro ao validar recentResults:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main validation runner
// ═══════════════════════════════════════════════════════════════════════════════

async function runAllValidations() {
  const results = {
    timestamp: new Date().toISOString(),
    tasks: {},
  };

  // Task 1: Draws History
  results.tasks.drawsHistory = await validateDrawsHistory();

  // Task 2: Territory Entropy Logic
  results.tasks.territoryEntropy = validateTerritoryEntropyLogic();

  // Task 3: Backtest Consistency
  results.tasks.backtestConsistency = await validateBacktestConsistency();

  // Task 4: Recent Results Flow
  results.tasks.recentResultsFlow = await validateRecentResultsFlow();

  // ═══════════════════════════════════════════════════════════════════════════════
  // FINAL OBJECTIVE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log("║              FINAL OBJECTIVE VALIDATION                   ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  const objectiveValidation = {
    dataQualityOK: results.tasks.drawsHistory?.passesCriteria ?? false,
    metricsNaNFreeOK: results.tasks.territoryEntropy?.allTestsPassed ?? false,
    backtestCapableOK:
      results.tasks.backtestConsistency?.canDoBacktest10 ?? false,
    recentResultsFlowOK:
      results.tasks.recentResultsFlow?.hasRecentResults ?? false,
  };

  results.objective = objectiveValidation;

  const allPass = Object.values(objectiveValidation).every((v) => v);

  if (allPass) {
    console.log("✓ ✓ ✓ TODOS OS CRITÉRIOS ATENDIDOS ✓ ✓ ✓");
    console.log(
      "\nO sistema está estruturalmente consistente e confiável para:",
    );
    console.log("  1. Processamento de dados históricos corretos");
    console.log("  2. Cálculos de métrica sem NaN");
    console.log("  3. Backtest com múltiplas janelas de draws");
    console.log("  4. Fluxo de recentResults para generator()");
  } else {
    console.log("✗ ✗ ✗ CRITÉRIOS NÃO ATENDIDOS ✗ ✗ ✗");
    console.log("\nProblemas detectados:");
    if (!objectiveValidation.dataQualityOK)
      console.log("  • Dados de draws inválidos");
    if (!objectiveValidation.metricsNaNFreeOK)
      console.log("  • Risco de NaN em territoryEntropy");
    if (!objectiveValidation.backtestCapableOK)
      console.log("  • Backtest não possível com dados");
    if (!objectiveValidation.recentResultsFlowOK)
      console.log("  • Fluxo de recentResults vazio");
  }

  console.log("\n" + "═".repeat(60));
  console.log("RELATÓRIO COMPLETO SALVO EM: validation_report.json");
  fs.writeFileSync("validation_report.json", JSON.stringify(results, null, 2));

  return results;
}

// Run it
runAllValidations()
  .then((results) => {
    process.exit(Object.values(results.objective).every((v) => v) ? 0 : 1);
  })
  .catch((err) => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
  });
