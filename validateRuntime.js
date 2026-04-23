import { supabase } from "./integrations/supabase/client.js";

async function validateIngestion() {
  console.log("========================================");
  console.log("PARTE 1 — VALIDAÇÃO DO BANCO");
  console.log("========================================");

  // 1. Consultar tabela lotomania_draws
  const { data: draws, error } = await supabase
    .from("lotomania_draws")
    .select("contest_number, numbers")
    .order("contest_number", { ascending: true });

  if (error) {
    console.error("Erro ao consultar banco:", error);
    return;
  }

  console.log(`Quantidade total de concursos armazenados: ${draws.length}`);

  if (draws.length === 0) {
    console.log("Nenhum concurso encontrado.");
    return;
  }

  const contestNumbers = draws.map((d) => d.contest_number);
  const minContest = Math.min(...contestNumbers);
  const maxContest = Math.max(...contestNumbers);

  console.log(`Menor concurso: ${minContest}`);
  console.log(`Maior concurso: ${maxContest}`);

  // Verificar se todos têm exatamente 20 números
  const allHave20 = draws.every((d) => d.numbers && d.numbers.length === 20);
  console.log(`Todos têm exatamente 20 números: ${allHave20 ? "SIM" : "NÃO"}`);

  // Verificar domínio 0..99
  const allInDomain = draws.every((d) =>
    d.numbers.every((n) => n >= 0 && n <= 99),
  );
  console.log(`Domínio correto (0..99): ${allInDomain ? "SIM" : "NÃO"}`);

  // Identificar duplicidades
  const uniqueContests = new Set(contestNumbers);
  const duplicates = contestNumbers.length - uniqueContests.size;
  console.log(`Duplicidades encontradas: ${duplicates}`);

  console.log("\n========================================");
  console.log("PARTE 2 — VALIDAÇÃO DA INGESTÃO");
  console.log("========================================");

  // A) Sincronização API
  console.log("A) Sincronização API:");
  const { syncDraws } = await import("./services/contestService.js");
  const syncReport = await syncDraws();
  console.log(`Novos concursos inseridos: ${syncReport.newRecordsAdded}`);
  console.log(
    `Fallback usado: ${syncReport.status === "fallback_banco" ? "SIM" : "NÃO"}`,
  );

  // B) Upload Fallback
  console.log("\nB) Upload Fallback:");
  const { parseDrawsFile, upsertDraws } =
    await import("./services/contestService.js");
  const sampleCSV = `concurso,data,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19
2700,2025-12-01,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19
2701,2025-12-04,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39`;

  const result = parseDrawsFile(sampleCSV, "sample.csv");
  console.log(`Total lido: ${result.report.totalRead}`);
  console.log(`Válidos: ${result.report.totalValid}`);
  console.log(`Descartados: ${result.report.totalDiscarded}`);

  if (result.draws.length > 0) {
    const inserted = await upsertDraws(result.draws);
    console.log(`Inseridos: ${inserted}`);
  }

  console.log("\n========================================");
  console.log("PARTE 3 — INTEGRAÇÃO COM O SISTEMA");
  console.log("========================================");

  // 1. recentDraws
  const { fetchRecentDraws } = await import("./services/storageService.js");
  const recentDraws = await fetchRecentDraws(50); // Pegar mais para ver
  console.log(`recentDraws sendo usados: ${recentDraws.length}`);

  // 2. buildPreGenContext
  const { buildPreGenContext } = await import("./engine/generatorCore.js");
  const preGenContext = await buildPreGenContext();
  console.log(`hasData: ${preGenContext.hasData}`);
  console.log(`mutationRateModifier: ${preGenContext.mutationRateModifier}`);
  console.log(
    `targetBalanceAdjustment: ${preGenContext.targetBalanceAdjustment}`,
  );
  console.log(`scenarioOverride: ${preGenContext.scenarioOverride}`);

  console.log("\n========================================");
  console.log("PARTE 4 — VALIDAÇÃO DO FIM DO MODO NEUTRO");
  console.log("========================================");

  const { generate } = await import("./engine/generatorCore.js");

  for (let i = 1; i <= 5; i++) {
    console.log(`\nExecução ${i}:`);
    const result = await generate({
      label: `Teste ${i}`,
      scenario: "hybrid",
      requestedCount: 2,
      params: {},
    });

    const preGen = result.diagnostics.preGenContext;
    console.log(`Ajuste pré-geração: ${preGen.hasData ? "SIM" : "NÃO"}`);
    console.log(`mutationRateModifier: ${preGen.mutationRateModifier}`);
    console.log(`targetBalanceAdjustment: ${preGen.targetBalanceAdjustment}`);
    console.log(`Cenário alterado: ${preGen.scenarioOverride ? "SIM" : "NÃO"}`);
  }

  console.log("\n========================================");
  console.log("PARTE 5 — CONCLUSÃO OBJETIVA");
  console.log("========================================");

  const hasHistory = draws.length > 0;
  const preGenActive = preGenContext.hasData;
  const adjustmentsHappen =
    preGenContext.mutationRateModifier !== 0 ||
    preGenContext.targetBalanceAdjustment !== 0 ||
    preGenContext.scenarioOverride !== null;

  console.log(`Ingestão funcionando: ${hasHistory ? "SIM" : "NÃO"}`);
  console.log(
    `Dados suficientes para sair do neutro: ${hasHistory ? "SIM" : "NÃO"}`,
  );
  console.log(`preGenContext está ativo: ${preGenActive ? "SIM" : "NÃO"}`);
  console.log(
    `Ajustes aparecem na prática: ${adjustmentsHappen ? "SIM" : "NÃO"}`,
  );

  if (!hasHistory) {
    console.log("Porquê: Nenhum concurso armazenado no banco.");
  } else if (!preGenActive) {
    console.log("Porquê: preGenContext.hasData é false.");
  } else if (!adjustmentsHappen) {
    console.log(
      "Porquê: Nenhum modificador ativo (mutationRateModifier=0, targetBalanceAdjustment=0, scenarioOverride=null).",
    );
  }
}

validateIngestion().catch(console.error);
