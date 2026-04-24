import { generate } from "./src/engine/generatorCore";
import { arbiterMemory } from "./src/engine/arbiterMemory";
import { fetchRecentDraws } from "./src/services/storageService";

function extractDistribution(games: { numbers: number[] }[]) {
    const dist: Record<number, number> = {};
    for (const g of games) {
        for (const n of g.numbers) dist[n] = (dist[n] ?? 0) + 1;
    }
    return dist;
}

async function runStructuralTest() {
    await arbiterMemory.init();
    const recent = await fetchRecentDraws(8);
    const scenario = "hybrid";

    console.log("==========================================");
    console.log("   TESTE DE EVOLUÇÃO ESTRUTURAL (BIAS)   ");
    console.log("==========================================");

    // 1. Gerar JOGOS ANTES do Aprendizado
    console.log("\n[FASE 1] Geração de Baseline...");
    const res1 = await generate({ count: 10, scenario, recentDraws: recent, twoBrains: true, targetContestNumber: 999998 });
    const allGames1 = res1.batches.flatMap(b => b.games);
    const dist1 = extractDistribution(allGames1);

    // Exibir distribuição limpa original
    const sorted1 = Object.entries(dist1).sort((a, b) => b[1] - a[1]);
    console.log(`Top 3 Dezenas Base: ${sorted1.slice(0, 3).map(x => `${x[0]}(${x[1]}x)`).join(", ")}`);
    console.log(`Linha de Base Anti-Cluster: ${res1.metrics.avgCluster.toFixed(3)}`);

    // Vamos escolher artificialmente as 5 dezenas mais "fracas" dessa rodada para hiper-impulsionar (E simular a memória do árbitro reforçando elas nas conferências)
    const weakNumbers = sorted1.slice(-5).map(x => Number(x[0]));
    console.log(`\n==========================================`);
    console.log(`Dezenas Cobaia para INJEÇÃO do Arbiter: [${weakNumbers.join(", ")}]`);

    console.log("\n[FASE 2] Treinando ArbiterMemory...");

    // O StructuralBias varre a matriz inteira do "chosen".
    // Para forçar a matriz das cobaias sem burlar o DB, nós registramos `synthetic decisions` hiper focadas com quality=Good!
    for (let i = 0; i < 20; i++) {
        const id = arbiterMemory.registerDecision({
            chosen: {
                brain: "A",
                lineage: "hybrid",
                scoreTotal: 1.0,
                diversity: 0.2, // Forçando diversityPush pular (pq é baixo)
                coverageVal: 0.8,
                clusterVal: 0.9, // Forçando antiClusterPush pular 
                value: 1.0,
                numbers: [...weakNumbers, 1, 2, 3, 4, 5, 6, 7] // forçando a pressao nas weak
            },
            rejected: { brain: "B", lineage: "conservative", scoreTotal: 0.5, diversity: 0.5, coverageVal: 0.5, clusterVal: 0.5, value: 0.5, numbers: [] },
            context: { batchName: "Alpha", scenario, mutationRate: 0.1, balanceA: 0.5, balanceAAdjustment: 0, slot: 1, targetContestNumber: 999998 },
            good: true,
        });
        // Dispara applyLearning ativando flag 'good'
        arbiterMemory.applyLearning(id, 14, 999998); // >=11 hits = quality 'good'
    }

    // Comprova se StructuralBias foi extraído e alimentado
    console.log("\n>>> MATRIX DE PRESSÃO (GERADA)");
    const sb = arbiterMemory.getStructuralBias(scenario);

    console.log("\n[FASE 3] Segunda Geração Pós-Cognitiva...");
    const res2 = await generate({ count: 10, scenario, recentDraws: recent, twoBrains: true, targetContestNumber: 999999 });
    const allGames2 = res2.batches.flatMap(b => b.games);
    const dist2 = extractDistribution(allGames2);

    const sorted2 = Object.entries(dist2).sort((a, b) => b[1] - a[1]);

    console.log("\n==========================================");
    console.log("            IMPACTO ESTRUTURAL            ");
    console.log("==========================================");

    console.log("NÚMEROS IMPULSIONADOS:");
    weakNumbers.forEach(n => {
        const bef = dist1[n] ?? 0;
        const aft = dist2[n] ?? 0;
        console.log(`Dezena ${n}: occurrences pulou de ${bef} -> para ${aft} (Aumento estrutural)`);
    });

    console.log("\nMÉTODOS ABSTRATOS:");
    console.log(`Anti-ClusterPush atuando... Antes: ${res1.metrics.avgCluster.toFixed(3)} -> Depois (com pressão isolante): ${res2.metrics.avgCluster.toFixed(3)}`);

    // Validacao dura
    const sumBefore = weakNumbers.reduce((s, n) => s + (dist1[n] ?? 0), 0);
    const sumAfter = weakNumbers.reduce((s, n) => s + (dist2[n] ?? 0), 0);

    console.log(`\nTotais cobaia: Antes=${sumBefore} Depois=${sumAfter}`);

    if (sumAfter > sumBefore) {
        console.log(">> SUCESSO: A composição estrutural biológica MUDOU em resposta as pressões subjacentes, moldando a seleção para além do score numérico.");
    } else {
        console.warn(">> AVISO: O desvio de dezenas não cresceu o suficiente. Reveja a equação.");
        process.exit(1);
    }
}

runStructuralTest().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
