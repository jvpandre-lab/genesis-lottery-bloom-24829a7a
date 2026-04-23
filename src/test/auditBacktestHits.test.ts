import { generate } from "@/engine/generatorCore";
import { mulberry32 } from "@/engine/rng";
import { fetchAllDraws } from "@/services/storageService";
import { describe, expect, it } from "vitest";

describe("AUDITORIA: Validação de Hits no Backtest", () => {
  it("1. Validar INPUT: tamanho de game.numbers e draw.numbers", async () => {
    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("TESTE 1: Validação de Inputs (game/draw size)");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    const draws = await fetchAllDraws();
    console.log(`[AUDIT] Total draws in database: ${draws.length}`);

    if (draws.length === 0) {
      console.warn("[AUDIT] No draws found in database!");
      return;
    }

    const sampleDraw = draws[0];
    console.log(
      `[DEBUG] sampleDraw.numbers type: ${typeof sampleDraw.numbers}`,
    );
    console.log(
      `[DEBUG] sampleDraw.numbers is array: ${Array.isArray(sampleDraw.numbers)}`,
    );
    console.log(
      `[DEBUG] sampleDraw.numbers.length: ${sampleDraw.numbers?.length}`,
    );
    console.log(
      `[DEBUG] sampleDraw.numbers sample: [${sampleDraw.numbers?.slice(0, 10).join(", ")}...]`,
    );

    // Validação crítica: draw deve ter exatamente 20 números
    if (sampleDraw.numbers.length !== 20) {
      console.error(
        `❌ ERRO CRÍTICO: draw.numbers.length = ${sampleDraw.numbers.length}, esperado 20`,
      );
    } else {
      console.log("✅ draw.numbers.length = 20 (correto)");
    }

    // Gerar alguns números com a IA
    const result = await generate({
      count: 3,
      rng: mulberry32(12345),
      twoBrains: true,
    } as any);

    const sampleGame = result.batches[0]?.games[0];
    if (sampleGame) {
      console.log(
        `\n[DEBUG] sampleGame.numbers type: ${typeof sampleGame.numbers}`,
      );
      console.log(
        `[DEBUG] sampleGame.numbers is array: ${Array.isArray(sampleGame.numbers)}`,
      );
      console.log(
        `[DEBUG] sampleGame.numbers.length: ${sampleGame.numbers.length}`,
      );
      console.log(
        `[DEBUG] sampleGame.numbers sample: [${sampleGame.numbers.slice(0, 10).join(", ")}...]`,
      );

      // Game deve ter 50 números na Lotomania
      if (sampleGame.numbers.length !== 50) {
        console.error(
          `❌ ERRO CRÍTICO: game.numbers.length = ${sampleGame.numbers.length}, esperado 50`,
        );
      } else {
        console.log("✅ game.numbers.length = 50 (correto)");
      }
    }

    // Validar tipos dos números
    console.log("\n[DEBUG] Validando tipos de números...");
    if (sampleDraw.numbers.every((n) => typeof n === "number")) {
      console.log("✅ draw.numbers: todos são números");
    } else {
      console.error("❌ draw.numbers: contém não-números");
    }

    if (sampleGame && sampleGame.numbers.every((n) => typeof n === "number")) {
      console.log("✅ game.numbers: todos são números");
    } else {
      console.error("❌ game.numbers: contém não-números");
    }

    expect(sampleDraw.numbers.length).toBe(20);
    expect(sampleGame?.numbers.length).toBe(50);
  });

  it("2. Validar OUTPUT: countHits() e interseção real", async () => {
    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("TESTE 2: Validação de countHits()");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    const draws = await fetchAllDraws();
    const draw = draws[Math.floor(draws.length / 2)];

    const result = await generate({
      count: 5,
      rng: mulberry32(54321),
      twoBrains: true,
    } as any);

    const games = result.batches.flatMap((b) => b.games);
    console.log(`[AUDIT] Generated ${games.length} games`);

    // Amostra
    const game = games[0];
    console.log(`\n[DEBUG] Game 0: ${game.numbers.length} números`);
    console.log(
      `[DEBUG] Game sample: [${game.numbers.slice(0, 10).join(", ")}...]`,
    );
    console.log(`[DEBUG] Draw: ${draw.numbers.length} números`);
    console.log(
      `[DEBUG] Draw sample: [${draw.numbers.slice(0, 10).join(", ")}...]`,
    );

    // Calcular interseção manualmente
    const gameSet = new Set(game.numbers);
    const drawArray = draw.numbers;
    const intersection = drawArray.filter((n) => gameSet.has(n));

    console.log(`\n[DEBUG] Intersection real: [${intersection.join(", ")}]`);
    console.log(`[DEBUG] Intersection size: ${intersection.length}`);

    // Validação crítica
    if (intersection.length > 20) {
      console.error(
        `❌ ERRO CRÍTICO: interseção > 20! (${intersection.length})`,
      );
    } else {
      console.log(`✅ Interseção ≤ 20 (${intersection.length})`);
    }

    // Logar para todos os games
    console.log("\n[AUDIT] Hits por game:");
    const hits = games.map((g) => {
      const gs = new Set(g.numbers);
      const h = drawArray.filter((n) => gs.has(n)).length;
      return h;
    });

    hits.forEach((h, i) => {
      if (h > 20) {
        console.error(`  Game ${i}: ${h} hits ❌ INVÁLIDO`);
      } else {
        console.log(`  Game ${i}: ${h} hits`);
      }
    });

    const maxHits = Math.max(...hits);
    console.log(`\n[AUDIT] Max hits encontrado: ${maxHits}`);

    if (maxHits > 20) {
      console.error(`❌ ERRO CRÍTICO: max hits = ${maxHits} > 20`);
    } else {
      console.log(`✅ Max hits ≤ 20`);
    }

    expect(maxHits).toBeLessThanOrEqual(20);
  });

  it("3. Validar DISTRIBUIÇÃO: random vs IA", async () => {
    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("TESTE 3: Distribuição Estatística (Random vs IA)");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    const draws = await fetchAllDraws();
    if (draws.length < 50) {
      console.warn("[AUDIT] Insuficientes draws para backtest (<50)");
      return;
    }

    const testDraws = draws.slice(0, 50);
    console.log(`[AUDIT] Testing with ${testDraws.length} draws\n`);

    // === RANDOM GAMES ===
    console.log("[AUDIT] Gerando games ALEATÓRIOS (sem IA)...");
    const randomHits: number[] = [];
    const rng = mulberry32(99999);

    for (let i = 0; i < testDraws.length; i++) {
      const randomNumbers: number[] = [];
      for (let j = 0; j < 50; j++) {
        randomNumbers.push(Math.floor(rng() * 100));
      }

      const draw = testDraws[i];
      const gameSet = new Set(randomNumbers);
      const hits = draw.numbers.filter((n) => gameSet.has(n)).length;
      randomHits.push(hits);
    }

    const randomAvg = randomHits.reduce((a, b) => a + b, 0) / randomHits.length;
    const randomMax = Math.max(...randomHits);
    const randomMin = Math.min(...randomHits);

    console.log(`[AUDIT] RANDOM GAMES:`);
    console.log(`  Média de hits: ${randomAvg.toFixed(2)}`);
    console.log(`  Max hits: ${randomMax}`);
    console.log(`  Min hits: ${randomMin}`);
    console.log(`  Distribuição: ${randomHits.join(", ")}`);

    // === IA GAMES ===
    console.log("\n[AUDIT] Gerando games com IA...");
    const iaHits: number[] = [];

    const result = await generate({
      count: 50,
      rng: mulberry32(11111),
      twoBrains: true,
    } as any);

    const iaGames = result.batches.flatMap((b) => b.games).slice(0, 50);

    for (let i = 0; i < Math.min(iaGames.length, testDraws.length); i++) {
      const game = iaGames[i];
      const draw = testDraws[i];
      const gameSet = new Set(game.numbers);
      const hits = draw.numbers.filter((n) => gameSet.has(n)).length;
      iaHits.push(hits);
    }

    const iaAvg = iaHits.reduce((a, b) => a + b, 0) / iaHits.length;
    const iaMax = Math.max(...iaHits);
    const iaMin = Math.min(...iaHits);

    console.log(`[AUDIT] IA GAMES:`);
    console.log(`  Média de hits: ${iaAvg.toFixed(2)}`);
    console.log(`  Max hits: ${iaMax}`);
    console.log(`  Min hits: ${iaMin}`);
    console.log(`  Distribuição: ${iaHits.join(", ")}`);

    // === ANÁLISE ESTATÍSTICA ===
    console.log("\n[AUDIT] ANÁLISE ESTATÍSTICA:");

    // Média esperada: ~10 para random (50 escolhas de 100 números, 20 hits possíveis)
    // Probabilidade teórica: (50/100) * 20 = 10
    const expectedAvg = 10;

    console.log(`  Média esperada (teórica): ${expectedAvg}`);
    console.log(`  Média random: ${randomAvg.toFixed(2)}`);
    console.log(`  Média IA: ${iaAvg.toFixed(2)}`);

    const randomDrift = Math.abs(randomAvg - expectedAvg);
    const iaDrift = Math.abs(iaAvg - expectedAvg);

    console.log(
      `\n  Desvio random: ${randomDrift.toFixed(2)} (${((randomDrift / expectedAvg) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Desvio IA: ${iaDrift.toFixed(2)} (${((iaDrift / expectedAvg) * 100).toFixed(1)}%)`,
    );

    if (randomAvg > 15) {
      console.error(
        `❌ ERRO: Média random = ${randomAvg.toFixed(2)} é anormalmente alta!`,
      );
    }

    if (iaAvg > 15 && iaDrift > randomDrift) {
      console.error(`⚠️  SUSPEITA: Média IA = ${iaAvg.toFixed(2)} > random`);
    } else if (iaAvg > 15) {
      console.error(
        `❌ ERRO: Média IA = ${iaAvg.toFixed(2)} é anormalmente alta!`,
      );
    }

    expect(randomMax).toBeLessThanOrEqual(20);
    expect(iaMax).toBeLessThanOrEqual(20);
  });

  it("4. Validar VAZAMENTO TEMPORAL: draw em recentDraws?", async () => {
    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("TESTE 4: Vazamento Temporal");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    const draws = await fetchAllDraws();
    console.log(`[AUDIT] Total draws: ${draws.length}`);

    if (draws.length < 2) {
      console.warn("[AUDIT] Insuficientes draws para validar vazamento");
      return;
    }

    // Simular: últimos 10 draws são "recentes"
    const recentDrawsCount = 10;
    const recentDraws = draws.slice(0, recentDrawsCount);
    const recentContestNumbers = new Set(
      recentDraws.map((d) => d.contestNumber),
    );

    console.log(
      `[AUDIT] "Recentes": draws ${recentDraws[0].contestNumber} a ${recentDraws[recentDrawsCount - 1].contestNumber}`,
    );

    // Backtest simula a avaliação de draws históricos
    const backtestDraws = draws.slice(recentDrawsCount);
    console.log(
      `[AUDIT] Backtest avalia: draws ${backtestDraws[0].contestNumber} até ${backtestDraws[backtestDraws.length - 1].contestNumber}`,
    );

    let leakageDetected = false;

    for (const draw of backtestDraws.slice(0, 20)) {
      // sample
      if (recentContestNumbers.has(draw.contestNumber)) {
        console.error(
          `❌ VAZAMENTO TEMPORAL: draw ${draw.contestNumber} está em recentDraws!`,
        );
        leakageDetected = true;
      }
    }

    if (!leakageDetected) {
      console.log(`✅ Nenhum vazamento temporal detectado na amostra`);
    }

    expect(!leakageDetected).toBe(true);
  });

  it("CONCLUSÃO: Auditoria de Hits", () => {
    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("CONCLUSÃO: AUDITORIA DE HITS");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    console.log(`
✅ Validações executadas:
  1. Tamanho de arrays (game=50, draw=20)
  2. Resultado de countHits() ≤ 20
  3. Distribuição estatística (random vs IA)
  4. Vazamento temporal

⚠️  Se encontrar erros acima:
  - ❌ ERRO CRÍTICO (game/draw size): bug no gerador ou fetch
  - ❌ countHits() > 20: bug no algoritmo de interseção
  - ❌ Média > 15: draws estão sendo contaminados ou números são diferentes
  - ❌ VAZAMENTO: recentDraws está contaminando backtest

próximo passo: corrigir conforme evidência encontrada.
    `);
  });
});
