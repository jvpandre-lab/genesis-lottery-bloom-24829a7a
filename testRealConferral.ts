import { generate } from "./src/engine/generatorCore";
import { arbiterMemory } from "./src/engine/arbiterMemory";
import { fetchRecentDraws } from "./src/services/storageService";
import { supabase } from "./src/integrations/supabase/client";

async function runTest() {
    console.log("=== INICIANDO TESTE DO FLUXO DE CONFERÊNCIA REAL ===");

    await arbiterMemory.init();

    // 1. Fetch histórico para simular "último concurso"
    const recent = await fetchRecentDraws(8);
    if (recent.length === 0) {
        console.error("Nenhum sorteio encontrado, abortando.");
        return;
    }

    const lastContest = recent[0].contestNumber;
    const targetContestNumber = lastContest + 1;

    console.log(`\nÚltimo concurso do histórico: ${lastContest}. Alvo injetado: ${targetContestNumber}.`);

    // 2. Gerar jogos
    console.log("\nGerando 3 jogos para testar...");
    const result = await generate({
        count: 3,
        scenario: "hybrid",
        recentDraws: recent,
        twoBrains: true,
        targetContestNumber // O auto-target agindo
    });

    await new Promise((r) => setTimeout(r, 2000)); // Esperar gravação no banco (persistArbiterDecision is async without await)

    // 3. Obter um decisionId do lote recém-criado
    const games = result.batches.flatMap(b => b.games);
    const game = games.find(g => g.decisionId);
    if (!game || !game.decisionId) {
        console.error("ERRO: O jogo não recebeu decisionId.");
        return;
    }

    const decisionId = game.decisionId;

    // 4. Verificar banco se o targetContestNumber foi parar lá
    const { data: record, error } = await supabase
        .from("arbiter_decisions")
        .select("id, metadata, outcome_hits")
        .eq("id", decisionId)
        .single();

    if (error || !record) {
        console.error("ERRO ao buscar no Supabase:", error);
        return;
    }

    const targetNoBanco = record.metadata?.targetContestNumber;
    console.log(`\nBuscando registro no banco -> ID: ${decisionId}`);
    console.log(`  - targetContestNumber salvo: ${targetNoBanco}`);
    console.log(`  - outcome_hits inicial: ${record.outcome_hits}`);

    if (targetNoBanco !== targetContestNumber) {
        console.error("FALHA: O db não gravou o alvo corretamente!");
        return;
    }

    // 5. Teste A: Tentar conferir com concurso errado (SIMULAÇÃO FAKE)
    const falseContest = targetContestNumber + 50;
    console.log(`\n>> TESTE A: Tentando aplicar aprendizado de simulação com concurso ${falseContest} (Alvo era ${targetContestNumber})...`);
    arbiterMemory.applyLearning(decisionId, 11, falseContest);

    await new Promise((r) => setTimeout(r, 1000)); // Aguardar DB

    const { data: recA } = await supabase.from("arbiter_decisions").select("outcome_hits").eq("id", decisionId).single();
    console.log(`  Resultado do Teste A (hits no banco após o bloqueio): ${recA?.outcome_hits === null ? 'null (BLOQUEADO COM SUCESSO)' : recA?.outcome_hits}`);

    // 6. Teste B: Conferência Real e Correta
    console.log(`\n>> TESTE B: Ocorreu o sorteio real ${targetContestNumber}. Submetendo 14 acertos (quality good)...`);
    arbiterMemory.applyLearning(decisionId, 14, targetContestNumber);

    await new Promise((r) => setTimeout(r, 1500)); // Aguardar DB atualização real

    const { data: recB } = await supabase.from("arbiter_decisions").select("outcome_hits, outcome_quality").eq("id", decisionId).single();
    console.log(`  Resultado do Teste B (hits: ${recB?.outcome_hits}, quality: ${recB?.outcome_quality}) - APRENIZADO REALIZADO!`);

    console.log("\n=== FIM DA COMPROVAÇÃO ===");
    process.exit(0);
}

runTest().catch((e) => {
    console.error(e);
    process.exit(1);
});
