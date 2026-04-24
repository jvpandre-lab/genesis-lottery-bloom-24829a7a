import { generate } from "./src/engine/generatorCore";
import { arbiterMemory } from "./src/engine/arbiterMemory";
import { fetchRecentDraws } from "./src/services/storageService";

function getZoneFor(num: number): string {
    if (num === 0) return "Z0";
    return "Z" + Math.floor(Math.min(99, Math.max(0, num)) / 10);
}

function extractZoneDistribution(games: { numbers: number[] }[]) {
    const dist: Record<string, number> = {};
    for (const g of games) {
        for (const n of g.numbers) {
            const z = getZoneFor(n);
            dist[z] = (dist[z] ?? 0) + 1;
        }
    }
    return dist;
}

async function runDominanceTest() {
    await arbiterMemory.init();
    const recent = await fetchRecentDraws(8);
    const scenario = "exploratory";

    console.log("==========================================");
    console.log("   TESTE DE CONTROLE DE DOMINÂNCIA       ");
    console.log("==========================================");

    // 1. Gerar JOGOS ANTES
    console.log("\n[FASE 1] Baseline (15 jogos)...");
    const res1 = await generate({ count: 15, scenario, recentDraws: recent, twoBrains: true, targetContestNumber: 999200 });

    // Escolheremos a Z4 como alvo pra saturação.
    const DOMINANT_ZONE = "Z4";

    console.log(`\n[FASE 2] Treinando ArbiterMemory FORÇANDO DOMINÂNCIA ABSOLUTA DA ${DOMINANT_ZONE}...`);
    // Inject mass 40 decisões EXCLUSIVAS na mesma zona para tentar empurrar overload genético.
    const toxicNumbers = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49]; // All from Z4
    for (let i = 0; i < 40; i++) {
        const id = arbiterMemory.registerDecision({
            chosen: {
                brain: "A", lineage: "exploratory", scoreTotal: 1.0, diversity: 1.0,
                coverageVal: 0.8, clusterVal: 1.0, value: 1.0,
                numbers: [...toxicNumbers, 1, 2, 3, 4, 5]
            },
            rejected: { brain: "B", lineage: "conservative", scoreTotal: 0.5, diversity: 0.5, coverageVal: 0.5, clusterVal: 0.5, value: 0.5, numbers: [] },
            context: { batchName: "Alpha", scenario, mutationRate: 0.1, balanceA: 0.5, balanceAAdjustment: 0, slot: 1, targetContestNumber: 999200 },
            good: true,
        });
        arbiterMemory.applyLearning(id, 13, 999200);
    }

    // Comprova se O LIMITADOR atuou (Logará Automatico no Console o [TERRITORY CONTROL] clampledZones info)
    console.log("\n>>> MATRIX ESTRUTURAL PÓS OVERLOAD:");
    const sb = arbiterMemory.getStructuralBias(scenario);

    console.log("\n[FASE 3] Segunda Geração (Teste de Resistência)...");
    const res2 = await generate({ count: 15, scenario, recentDraws: recent, twoBrains: true, targetContestNumber: 999201 });

    const allGames2 = res2.batches.flatMap(b => b.games);
    const dist2 = extractZoneDistribution(allGames2);
    const totalNumbers = allGames2.length * 50;
    const shareZ4 = (dist2[DOMINANT_ZONE] ?? 0) / totalNumbers;

    console.log("\n==========================================");
    console.log("          RESULTADOS E EQUILÍBRIO         ");
    console.log("==========================================");
    console.log(`Pressão registrada da zona alvo [${DOMINANT_ZONE}]: ${sb.territoryPressure[DOMINANT_ZONE]?.toFixed(4)} (DEVE ESTAR CLAMPED em max 0.035!)`);
    console.log(`Share final da ${DOMINANT_ZONE} nos genes: ${(shareZ4 * 100).toFixed(2)}%`);

    if (sb.territoryPressure[DOMINANT_ZONE] > 0.04) {
        console.error("FALHA: O Limite foi furado. Saturação falhou.");
        process.exit(1);
    } else if (shareZ4 > 0.35) {
        console.error("FALHA: A dominância invadiu a ecologia e não reduziu.");
        process.exit(1);
    } else if (sb.territoryPressure[DOMINANT_ZONE] > 0) {
        console.log("SUCESSO: A zona blindada influenciou OTIMIZADAMENTE a seleção genotípica sem destruir a distribuição por excesso (Dominance Detection atuou bloqueando).");
        process.exit(0);
    }
}

runDominanceTest().catch(e => { console.error(e); process.exit(1); });
