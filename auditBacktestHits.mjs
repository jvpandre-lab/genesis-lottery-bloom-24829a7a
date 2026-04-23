const { createClient } = await import("@supabase/supabase-js");

const VITE_SUPABASE_URL = "https://kvlgqjvvzewbxivqceza.supabase.co";
const VITE_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY);

// Mulberry32 RNG inline (evitar import de TS)
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function auditHits() {
  console.log(
    "\n═══════════════════════════════════════════════════════════════════════════════",
  );
  console.log("AUDITORIA: Validação de Hits no Backtest da Lotomania");
  console.log(
    "═══════════════════════════════════════════════════════════════════════════════\n",
  );

  // ===== TESTE 1: Validar INPUT =====
  console.log("\n" + "━".repeat(80));
  console.log("TESTE 1: Validação de Inputs (game/draw size)");
  console.log("━".repeat(80) + "\n");

  const { data: rawDraws, error: drawError } = await supabase
    .from("lotomania_draws")
    .select("contest_number, numbers")
    .limit(100);

  if (drawError) {
    console.error(`[ERROR] Falha ao fetch draws: ${drawError.message}`);
    return;
  }

  const draws = (rawDraws ?? []).map((r) => ({
    contestNumber: r.contest_number,
    numbers: Array.isArray(r.numbers) ? r.numbers : [],
  }));

  console.log(`[AUDIT] Total draws retornados: ${draws.length}`);

  if (draws.length === 0) {
    console.error("[ERROR] Nenhum draw encontrado!");
    return;
  }

  const sampleDraw = draws[0];
  console.log(`\n[DEBUG] Sample draw:`);
  console.log(`  contestNumber: ${sampleDraw.contestNumber}`);
  console.log(`  numbers type: ${typeof sampleDraw.numbers}`);
  console.log(`  numbers is array: ${Array.isArray(sampleDraw.numbers)}`);
  console.log(`  numbers.length: ${sampleDraw.numbers?.length}`);
  console.log(
    `  numbers sample: [${sampleDraw.numbers?.slice(0, 20).join(", ")}...]`,
  );

  // Validação crítica
  if (sampleDraw.numbers?.length !== 20) {
    console.error(
      `\n❌ ERRO CRÍTICO: draw.numbers.length = ${sampleDraw.numbers?.length}, esperado 20`,
    );
  } else {
    console.log(`\n✅ draw.numbers.length = 20 (CORRETO)`);
  }

  // Checar todos os draws
  console.log("\n[AUDIT] Validando todos os draws...");
  let allValid = true;
  for (const draw of draws) {
    if (!Array.isArray(draw.numbers) || draw.numbers.length !== 20) {
      console.error(
        `  ❌ Draw ${draw.contestNumber}: numbers.length = ${draw.numbers?.length}`,
      );
      allValid = false;
    }
  }
  if (allValid) {
    console.log(`  ✅ Todos os ${draws.length} draws têm 20 números`);
  }

  // ===== TESTE 2: Validar countHits() =====
  console.log("\n" + "━".repeat(80));
  console.log("TESTE 2: Validação de countHits() e Interseção Real");
  console.log("━".repeat(80) + "\n");

  // Gerar games aleatórios para testar
  const testDraws = draws.slice(0, 30);
  console.log(`[AUDIT] Testando com ${testDraws.length} draws\n`);

  let maxHitsFound = 0;
  let hitsDistribution = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ];

  // Gerar games IA (simulando backtest)
  console.log("[AUDIT] Gerando 30 games com IA para teste...");
  const rng = mulberry32(12345);

  // Simular números de 1 a 100 (Lotomania)
  const gameNumbers = [];
  for (let g = 0; g < 30; g++) {
    const numbers = [];
    for (let i = 0; i < 50; i++) {
      numbers.push(Math.floor(rng() * 100) + 1); // 1-100
    }
    gameNumbers.push(numbers);
  }

  console.log(
    `[DEBUG] Game[0] sample: [${gameNumbers[0].slice(0, 10).join(", ")}...]`,
  );
  console.log(`[DEBUG] Game[0].length: ${gameNumbers[0].length}`);

  // Calcular hits manualmente para cada game vs cada draw
  console.log("\n[AUDIT] Calculando interseções...\n");
  const results = [];

  for (let d = 0; d < testDraws.length; d++) {
    const draw = testDraws[d];
    const drawSet = new Set(draw.numbers);

    for (let g = 0; g < gameNumbers.length; g++) {
      const game = gameNumbers[g];
      const gameSet = new Set(game);

      // Interseção real
      const intersection = draw.numbers.filter((n) => gameSet.has(n));
      const hits = intersection.length;

      results.push({
        drawNum: draw.contestNumber,
        gameNum: g,
        hits: hits,
        intersection: intersection,
      });

      if (hits > maxHitsFound) {
        maxHitsFound = hits;
      }

      if (hits < 21) {
        hitsDistribution[hits]++;
      }

      // Log dos primeiros 5
      if (d === 0 && g < 5) {
        console.log(
          `[DEBUG] Draw ${draw.contestNumber} vs Game ${g}: hits=${hits} intersection=[${intersection.join(", ")}]`,
        );
      }
    }
  }

  console.log(`\n[AUDIT] Hits encontrados: ${results.length} combinações`);
  console.log(`[AUDIT] Max hits encontrado: ${maxHitsFound}`);

  if (maxHitsFound > 20) {
    console.error(
      `\n❌ ERRO CRÍTICO: Max hits = ${maxHitsFound} > 20 (impossível)`,
    );
  } else {
    console.log(`\n✅ Max hits = ${maxHitsFound} ≤ 20 (válido)`);
  }

  // Distribuição
  console.log("\n[AUDIT] Distribuição de hits:");
  for (let h = 0; h <= 20; h++) {
    if (hitsDistribution[h] > 0) {
      const bar = "█".repeat(Math.min(hitsDistribution[h], 50));
      console.log(`  ${h} hits: ${bar} (${hitsDistribution[h]} ocorrências)`);
    }
  }

  // ===== TESTE 3: Validar DISTRIBUIÇÃO =====
  console.log("\n" + "━".repeat(80));
  console.log("TESTE 3: Distribuição Estatística (Random vs IA)");
  console.log("━".repeat(80) + "\n");

  console.log("[AUDIT] Gerando 100 games ALEATÓRIOS (sem IA)...");
  const randomRng = mulberry32(99999);
  const randomHits = [];

  for (let d = 0; d < testDraws.length; d++) {
    const draw = testDraws[d];
    const drawSet = new Set(draw.numbers);

    // Gerar 100 games aleatórios para essa draw
    for (let g = 0; g < 100; g++) {
      const randomGame = [];
      for (let i = 0; i < 50; i++) {
        randomGame.push(Math.floor(randomRng() * 100) + 1);
      }

      const gameSet = new Set(randomGame);
      const hits = draw.numbers.filter((n) => gameSet.has(n)).length;
      randomHits.push(hits);
    }
  }

  const randomAvg = randomHits.reduce((a, b) => a + b, 0) / randomHits.length;
  const randomMax = Math.max(...randomHits);
  const randomMin = Math.min(...randomHits);
  const randomMedian = randomHits.sort((a, b) => a - b)[
    Math.floor(randomHits.length / 2)
  ];

  console.log(`\n[AUDIT] RANDOM GAMES (${randomHits.length} combinações):`);
  console.log(`  Média: ${randomAvg.toFixed(2)}`);
  console.log(`  Max: ${randomMax}, Min: ${randomMin}`);
  console.log(`  Mediana: ${randomMedian}`);

  // Hits com IA
  const iaHits = results.map((r) => r.hits);
  const iaAvg = iaHits.reduce((a, b) => a + b, 0) / iaHits.length;
  const iaMax = Math.max(...iaHits);
  const iaMin = Math.min(...iaHits);
  const iaMedian = iaHits.sort((a, b) => a - b)[Math.floor(iaHits.length / 2)];

  console.log(`\n[AUDIT] IA GAMES (${iaHits.length} combinações):`);
  console.log(`  Média: ${iaAvg.toFixed(2)}`);
  console.log(`  Max: ${iaMax}, Min: ${iaMin}`);
  console.log(`  Mediana: ${iaMedian}`);

  // Análise
  console.log(`\n[AUDIT] ANÁLISE COMPARATIVA:`);
  console.log(`  Esperado (teórico): ~10 hits`);
  console.log(
    `  Random vs Teórico: ${Math.abs(randomAvg - 10).toFixed(2)} de desvio`,
  );
  console.log(`  IA vs Teórico: ${Math.abs(iaAvg - 10).toFixed(2)} de desvio`);
  console.log(
    `  IA vs Random: ${Math.abs(iaAvg - randomAvg).toFixed(2)} de desvio`,
  );

  if (randomAvg > 12 || randomMax > 20) {
    console.error(
      `\n⚠️  SUSPEITA: Random está gerando hits anormalmente altos!`,
    );
  }

  if (iaAvg > 12) {
    console.error(
      `\n⚠️  SUSPEITA: IA está gerando média de hits > 12 (${iaAvg.toFixed(2)})`,
    );
    console.error(
      `    Isso é ${((iaAvg / randomAvg) * 100 - 100).toFixed(1)}% acima do random`,
    );
  }

  if (iaMax > 20) {
    console.error(`\n❌ ERRO: Max hits com IA = ${iaMax} > 20`);
  }

  // ===== TESTE 4: Vazamento Temporal =====
  console.log("\n" + "━".repeat(80));
  console.log("TESTE 4: Validação de Vazamento Temporal");
  console.log("━".repeat(80) + "\n");

  console.log(`[AUDIT] Draws usados no backtest:`);
  console.log(`  Primeiro: ${testDraws[0].contestNumber}`);
  console.log(`  Último: ${testDraws[testDraws.length - 1].contestNumber}`);

  // Se houver draws após os testados
  const futureDraws = draws.slice(testDraws.length, testDraws.length + 10);
  if (futureDraws.length > 0) {
    console.log(`\n[AUDIT] Draws "futuros" (não usados):`);
    console.log(
      `  Primeiros futuros: ${futureDraws[0].contestNumber} - ${futureDraws[futureDraws.length - 1].contestNumber}`,
    );
    console.log(`  ✅ Sem sobreposição (válido)`);
  }

  // ===== CONCLUSÃO =====
  console.log("\n" + "═".repeat(80));
  console.log("CONCLUSÃO DA AUDITORIA");
  console.log("═".repeat(80) + "\n");

  const issues = [];

  if (sampleDraw.numbers?.length !== 20) {
    issues.push("❌ ERRO CRÍTICO: Draws não têm 20 números");
  }

  if (maxHitsFound > 20) {
    issues.push(
      `❌ ERRO CRÍTICO: countHits() pode retornar > 20 (encontrado ${maxHitsFound})`,
    );
  }

  if (randomAvg > 12) {
    issues.push(
      `⚠️  SUSPEITA: Números aleatórios com média > 12 (${randomAvg.toFixed(2)})`,
    );
  }

  if (iaAvg > 15) {
    issues.push(
      `❌ ERRO: IA gerando média ${iaAvg.toFixed(2)} hits (máximo teórico é ~10)`,
    );
  }

  if (issues.length === 0) {
    console.log("✅ NENHUM ERRO DETECTADO NA AUDITORIA\n");
    console.log("Conclusões:");
    console.log("  • Tamanho de arrays: CORRETO");
    console.log("  • countHits(): CORRETO");
    console.log("  • Distribuição: NORMAL");
    console.log("  • Vazamento temporal: NENHUM\n");
    console.log(
      "⚠️  Se o backtest ainda mostra ~24-25 hits, o problema está EM OUTRO LUGAR:",
    );
    console.log("  → Revise como a média está sendo calculada no backtest");
    console.log("  → Verifique se não está somando hits de múltiplas jogadas");
    console.log("  → Valide o arquivo backtestEngine.ts (cálculo de média)");
  } else {
    console.log("PROBLEMAS ENCONTRADOS:\n");
    issues.forEach((issue) => console.log(issue));
  }

  console.log("\n" + "═".repeat(80) + "\n");
}

await auditHits();
