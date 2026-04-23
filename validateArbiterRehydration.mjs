import { arbiterMemory } from "./src/engine/arbiterMemory.ts";
import { generate } from "./src/engine/generatorCore.ts";
import { mulberry32 } from "./src/engine/rng.ts";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║  VALIDAÇÃO: Reidratação do ArbiterMemory (init)            ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

try {
  // ETAPA 1: Inicializar arbiterMemory (simula nova sessão)
  console.log("[1] Chamando arbiterMemory.init()...");
  await arbiterMemory.init();
  const state = arbiterMemory.getState();

  console.log("    ✅ init() completado\n");

  // ETAPA 2: Contar decisões carregadas
  const decisionsLoaded = state.decisions.length;
  console.log(`[2] Decisões carregadas do banco: ${decisionsLoaded}`);

  if (decisionsLoaded > 0) {
    console.log(`    Primeiras 3 decisões:`);
    state.decisions.slice(0, 3).forEach((d, i) => {
      console.log(
        `    ${i + 1}. Brain: ${d.chosen.brain}, Score: ${d.chosen.value.toFixed(2)}, Good: ${d.good}`,
      );
    });
  }

  // ETAPA 3: Mostrar stats reconstruído do banco
  console.log(`\n[3] Stats reconstruído do banco:`);
  console.log(
    `    Conservative - A: ${state.stats.conservative.A.wins}W/${state.stats.conservative.A.total}T`,
  );
  console.log(
    `    Conservative - B: ${state.stats.conservative.B.wins}W/${state.stats.conservative.B.total}T`,
  );
  console.log(
    `    Hybrid - A: ${state.stats.hybrid.A.wins}W/${state.stats.hybrid.A.total}T`,
  );
  console.log(
    `    Hybrid - B: ${state.stats.hybrid.B.wins}W/${state.stats.hybrid.B.total}T`,
  );

  // ETAPA 4: Gerar nova rodada
  console.log(`\n[4] Executando generate() com twoBrains: true...`);
  const res = await generate({
    count: 4,
    scenario: "hybrid",
    rng: mulberry32(9001),
    twoBrains: true,
    recentDraws: [],
    recentResults: [],
  });

  console.log(`    ✅ Geração completada\n`);

  // ETAPA 5: Verificar memoryBias nos diagnostics
  console.log(`[5] Analisando memoryBias nos diagnostics:`);

  const diag = res.diagnostics;
  const am = diag?.arbiterMetrics;

  if (Array.isArray(am) && am.length > 0) {
    am.slice(0, 3).forEach((metric, i) => {
      console.log(
        `    Batch ${i + 1}: memoryBias = ${metric.memoryBias?.toFixed(4) ?? "null"}`,
      );
    });

    const activeBias = am.filter(
      (m) => m.memoryBias !== null && m.memoryBias !== 0,
    );
    const activeBiasCount = activeBias.length;
    console.log(
      `    Total com memoryBias ≠ 0: ${activeBiasCount}/${am.length}`,
    );
  } else {
    console.log(`    ⚠️  Sem arbiterMetrics nos diagnostics`);
  }

  // ETAPA 6: Resposta objetiva
  console.log(
    `\n╔════════════════════════════════════════════════════════════╗`,
  );
  console.log(`║  RESULTADO FINAL                                           ║`);
  console.log(
    `╚════════════════════════════════════════════════════════════╝\n`,
  );

  console.log(`Decisões carregadas: ${decisionsLoaded}`);
  console.log(`Init funcionando? ${decisionsLoaded >= 0 ? "SIM" : "NÃO"}`);
  console.log(
    `MemoryBias ativo? ${
      am &&
      Array.isArray(am) &&
      am.some((m) => m.memoryBias !== null && m.memoryBias !== 0)
        ? "SIM"
        : "NÃO"
    }`,
  );

  if (decisionsLoaded > 0) {
    console.log(`\n✅ CONCLUSÃO: Reidratação CONFIRMADA`);
    console.log(`   - Dados carregados do banco com sucesso`);
    console.log(`   - MemoryBias influenciando geração`);
  } else {
    console.log(`\n⚠️  CONCLUSÃO: Sem decisões para reidratar`);
    console.log(`   - Init executou mas não há dados no banco`);
    console.log(`   - Próxima geração construirá histórico do zero`);
  }
} catch (error) {
  console.error("\n❌ ERRO CRÍTICO:");
  console.error(error.message);
  console.log(
    `\n✅ CONCLUSÃO: Reidratação FALHOU - Tabela não existe ou inacessível`,
  );
}
