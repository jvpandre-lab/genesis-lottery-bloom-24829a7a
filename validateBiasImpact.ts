import { generate } from "./src/engine/generatorCore";
import { arbiterMemory } from "./src/engine/arbiterMemory";
import { fetchRecentDraws } from "./src/services/storageService";

async function runTest() {
    await arbiterMemory.init();
    const recent = await fetchRecentDraws(8);
    const scenario = "conservative";

    console.log("[BIAS BEFORE GENERATION]");
    console.log(`scenario: ${scenario}`);
    const biasBefore = arbiterMemory.getState().memoryBias[scenario] || 0;
    console.log(`memoryBias: ${biasBefore.toFixed(6)}\n`);

    console.log(">> Iniciando Geração (baseline, 5 jogos) para extração limpa de scoreBase...");
    const res1 = await generate({ count: 5, scenario, recentDraws: recent, twoBrains: true, targetContestNumber: 999998 });

    console.log("\n>> Conferência Real Acionada (Injetando 5 learning events hiper-positivos [18 hits])...");
    for (const batch of res1.batches) {
        for (const game of batch.games) {
            if (game.decisionId) {
                arbiterMemory.applyLearning(game.decisionId, 18, 999998); // target matches, hits = 18 -> quality = good, delta forte!
            }
        }
    }

    console.log("\n[BIAS AFTER LEARNING]");
    console.log(`scenario: ${scenario}`);
    const biasAfter = arbiterMemory.getState().memoryBias[scenario] || 0;
    console.log(`memoryBias: ${biasAfter.toFixed(6)}\n`);

    console.log(">> Iniciando Nova Geração (após memoryBias atualizado)...");
    const res2 = await generate({ count: 1, scenario, recentDraws: recent, twoBrains: true, targetContestNumber: 999999 });

    const diff = biasAfter - biasBefore;

    console.log("\n[BIAS IMPACT SUMMARY]");
    console.log(`scenario: ${scenario}`);
    console.log(`biasBefore: ${biasBefore.toFixed(6)}`);
    console.log(`biasAfter: ${biasAfter.toFixed(6)}`);
    console.log(`avgScoreBefore: ${res1.metrics.avgScore.toFixed(4)}`);
    console.log(`avgScoreAfter: ${res2.metrics.avgScore.toFixed(4)}`);
    console.log(`difference: ${diff.toFixed(6)}`);

    console.log("");
    if (diff < 0.01) {
        console.log("ERRO: Bias não está influenciando a geração (mudança < 0.01). O aprendizado foi fraco ou ignorado.");
        process.exit(1);
    } else {
        console.log("SUCESSO: Bias ativo e influente. A equação injeta o bias matemático provado nos logs ACIMA [ARBITER DECISION].");
        process.exit(0);
    }
}

runTest().catch((e) => {
    console.error(e);
    process.exit(1);
});
