import { generate } from "./src/engine/generatorCore";
import { arbiterMemory } from "./src/engine/arbiterMemory";
import {
    fetchRecentDraws,
    fetchAllDraws,
} from "./src/services/storageService";
import { supabase } from "./src/integrations/supabase/client";

async function run() {
    console.log("=== INICIANDO VALIDAÇÃO REAL ===");

    // 1. Contar antes
    const { count: countBefore } = await supabase
        .from("arbiter_decisions")
        .select("*", { count: "exact", head: true });
    console.log(`\n1. COUNT ANTES: ${countBefore}`);

    // 2. Gerar 5 jogos
    console.log("\n2. GERANDO 5 JOGOS...");
    await arbiterMemory.init();
    const recent = await fetchRecentDraws(8);
    const result = await generate({
        count: 5,
        scenario: "hybrid",
        recentDraws: recent,
        twoBrains: true,
    });

    // Aguardar promises pendentes (persistDecisionToDB não tem await no generator)
    await new Promise((r) => setTimeout(r, 2000));

    // 3. Contar depois
    const { count: countAfter } = await supabase
        .from("arbiter_decisions")
        .select("*", { count: "exact", head: true });
    console.log(`\n3. COUNT DEPOIS: ${countAfter}`);
    console.log(`  AUMENTO: ${countAfter - countBefore}`);

    // 4. Conferência (simulando UI)
    console.log("\n4. SIMULANDO CONFERÊNCIA REAL (para o primeiro jogogerado)");
    const games = result.batches.flatMap(b => b.games);
    const gameWithDecision = games.find(g => g.decisionId);

    if (!gameWithDecision) {
        console.error("ERRO: Nenhum jogo gerado possui decisionId.");
        return;
    }

    const decisionId = gameWithDecision.decisionId!;
    console.log(`Jogo escolhido com decisionId=${decisionId} (linhagem: ${gameWithDecision.lineage})`);

    // Simulating 16 hits against contest 3333
    console.log("Aplicando learning (hits=16, contest=3333)...");
    arbiterMemory.applyLearning(decisionId, 16, 3333);

    // Aguardar DB
    await new Promise((r) => setTimeout(r, 1000));

    // Verificar DB
    console.log("\n5. VERIFICANDO BANCO DE DADOS... ");
    const { data: record, error } = await supabase
        .from("arbiter_decisions")
        .select("id, outcome_hits, outcome_quality")
        .eq("id", decisionId)
        .single();

    if (error) {
        console.error("Erro ao buscar registro:", error);
    } else {
        console.log("Registro encontrado:");
        console.log(record);
    }
}

run().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
