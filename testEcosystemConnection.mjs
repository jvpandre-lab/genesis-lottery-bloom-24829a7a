import { generate } from "./src/engine/generatorCore.ts";
import { mulberry32 } from "./src/engine/rng.ts";

const testOpts = (seed, count) => ({
  count,
  rng: mulberry32(seed),
  twoBrains: true,
});

async function testEcosystemConnection() {
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log("║  VALIDAÇÃO: CONEXÃO ECOSSISTEMA (recentResults)           ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  // --- TESTE 1: SEM recentResults (baseline) ---
  console.log("─── TESTE 1: SEM recentResults (baseline) ─────");
  const gen1 = await generate({
    ...testOpts(1001, 4),
    scenario: "conservative",
  });
  console.log("gen1 criado, id:", gen1.id);
  console.log(
    "preGenContext.hasData:",
    gen1.diagnostics.preGenContext?.hasData,
  );
  console.log("");

  // --- TESTE 2: COM recentResults (gen1) ---
  console.log("─── TESTE 2: COM recentResults: [gen1] ─────");
  const gen2 = await generate({
    ...testOpts(1002, 4),
    scenario: "conservative",
    recentResults: [gen1],
  });
  console.log("gen2 criado, id:", gen2.id);
  console.log(
    "preGenContext.hasData:",
    gen2.diagnostics.preGenContext?.hasData,
  );
  console.log(
    "preGenContext.reasons:",
    gen2.diagnostics.preGenContext?.reasons,
  );
  console.log("");

  // --- TESTE 3: IMPACTO REAL (histórico crescente) ---
  console.log("─── TESTE 3: IMPACTO REAL COM HISTÓRICO ─────");
  const history = [gen1];

  for (let i = 0; i < 3; i++) {
    const result = await generate({
      ...testOpts(2000 + i, 5),
      scenario: "hybrid",
      recentResults: history.slice(-5),
    });

    console.log(`\nGen ${i + 3}:`);
    console.log("  recentResults count:", history.length);
    console.log(
      "  preGenContext.hasData:",
      result.diagnostics.preGenContext?.hasData,
    );
    console.log(
      "  mutationRateModifier:",
      result.diagnostics.preGenContext?.mutationRateModifier,
    );
    console.log(
      "  targetBalanceAdjustment:",
      result.diagnostics.preGenContext?.targetBalanceAdjustment,
    );
    console.log(
      "  weightModifiers min:",
      Math.min(
        ...(result.diagnostics.preGenContext?.weightModifiers ?? [1]),
      ).toFixed(3),
    );
    console.log(
      "  weightModifiers max:",
      Math.max(
        ...(result.diagnostics.preGenContext?.weightModifiers ?? [1]),
      ).toFixed(3),
    );
    console.log(
      "  reasons:",
      result.diagnostics.preGenContext?.reasons.slice(0, 2).join(" | "),
    );

    history.push(result);
  }

  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log("║  CONCLUSÃO                                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(
    "\nA. recentResults está chegando?",
    history.length > 1 ? "SIM" : "NÃO",
  );
  console.log(
    "B. preGenContext ativo?",
    gen2.diagnostics.preGenContext?.hasData ? "SIM" : "NÃO",
  );
  console.log(
    "C. preGen alterando decisão?",
    (gen2.diagnostics.preGenContext?.mutationRateModifier ?? 0) !== 0 ||
      (gen2.diagnostics.preGenContext?.targetBalanceAdjustment ?? 0) !== 0
      ? "SIM/PARCIAL"
      : "NÃO",
  );
  console.log("D. ecossistema ativo na UI real? (será testado ao conectar)");
}

testEcosystemConnection().catch(console.error);
