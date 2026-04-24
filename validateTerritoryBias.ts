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

async function runTerritoryTest() {
    await arbiterMemory.init();
    const recent = await fetchRecentDraws(8);
    const scenario = "aggressive";

    console.log("==========================================");
    console.log("   TESTE DE BIAS TERRITORIAL (ZONAS)     ");
    console.log("==========================================");

    // 1. Gerar JOGOS ANTES
    console.log("\n[FASE 1] Geração de Baseline (15 jogos)...");
    const res1 = await generate({ count: 15, scenario, recentDraws: recent, twoBrains: true, targetContestNumber: 999120 });
    const allGames1 = res1.batches.flatMap(b => b.games);
    const dist1 = extractZoneDistribution(allGames1);

    // Escolhendo 2 zonas fracas nativamente
    const sorted1 = Object.entries(dist1).sort((a, b) => b[1] - a[1]);
    const weakZones = sorted1.slice(-2).map(x => x[0]); // Pior zonas

    console.log("\n[DISTRIBUIÇÃO INICIAL Z0-Z9]");
    sorted1.forEach(([z, count]) => console.log(`${z}: ${count} dezenas preenchidas`));
    console.log(`Zonas com MENOS preenchimento (Cobaias para reforço evolutivo): ${weakZones.join(', ')}`);

    console.log("\n[FASE 2] Treinando ArbiterMemory (Injetando Vitória Histórica nas Cobaias)...");

    // Fabricando números que recaem nas weakZones para criar o array do Arbiter.
    // Se Z = Z4 (40-49), entao numeros 40,41.. 
    const buildNumbersFor = (zones: string[]) => {
        let nums: number[] = [];
        for (const z of zones) {
            const base = Number(z.replace("Z", "")) * 10;
            nums.push(base, base + 1, base + 2, base + 3, base + 4, base + 5, base + 6, base + 7, base + 8, base + 9);
        }
        return nums;
    };
    const syntheticWinningNumbers = buildNumbersFor(weakZones);

    // Registra decisões e confere pra disparar o TerritoryBias
    for (let i = 0; i < 25; i++) {
        const id = arbiterMemory.registerDecision({
            chosen: {
                brain: "A", lineage: "aggressive", scoreTotal: 1.0, diversity: 1.0,
                coverageVal: 0.8, clusterVal: 1.0, value: 1.0,
                numbers: [...syntheticWinningNumbers.slice(0, 15), 1, 2, 3]
            },
            rejected: { brain: "B", lineage: "conservative", scoreTotal: 0.5, diversity: 0.5, coverageVal: 0.5, clusterVal: 0.5, value: 0.5, numbers: [] },
            context: { batchName: "Alpha", scenario, mutationRate: 0.1, balanceA: 0.5, balanceAAdjustment: 0, slot: 1, targetContestNumber: 999120 },
            good: true,
        });
        arbiterMemory.applyLearning(id, 14, 999120); // quality 'good'
    }

    // Comprova se StructuralBias puxou a zona
    console.log("\n>>> MATRIX DE ZONAS (GERADA DENTRO DO MOTOR)");
    const sb = arbiterMemory.getStructuralBias(scenario);
    console.log("Pressões registradas pelo Bias:", sb.territoryPressure);

    console.log("\n[FASE 3] Segunda Geração Pós-Cognitiva...");
    const res2 = await generate({ count: 15, scenario, recentDraws: recent, twoBrains: true, targetContestNumber: 999121 });
    const allGames2 = res2.batches.flatMap(b => b.games);
    const dist2 = extractZoneDistribution(allGames2);

    console.log("\n==========================================");
    console.log("          IMPACTO GEOGRÁFICO            ");
    console.log("==========================================");

    console.log("ZONAS TESTADAS:");
    weakZones.forEach(z => {
        const bef = dist1[z] ?? 0;
        const aft = dist2[z] ?? 0;
        console.log(`${z}: participações pulou de ${bef} -> para ${aft}`);
    });

    const sumBefore = weakZones.reduce((s, z) => s + (dist1[z] ?? 0), 0);
    const sumAfter = weakZones.reduce((s, z) => s + (dist2[z] ?? 0), 0);

    console.log(`\nVolume Geográfico na Região Penalizada: Antes=${sumBefore} Depois=${sumAfter}`);

    if (sumAfter > sumBefore) {
        console.log(">> SUCESSO: A geração territorial MUDOU fisicamente. A IA povoou densamente as faixas do tabuleiro requisitadas via pontuação do TerritoryModifier.");
        process.exit(0);
    } else {
        console.warn(">> AVISO: O desvio territorial foi engolido e não cresceu. Reveja os clamps da engenharia.");
        process.exit(1);
    }
}

runTerritoryTest().catch(e => { console.error(e); process.exit(1); });
