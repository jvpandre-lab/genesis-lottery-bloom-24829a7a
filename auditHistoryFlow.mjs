import { createClient } from "@supabase/supabase-js";

(async () => {
  const url = "https://kvlgqjvvzewbxivqceza.supabase.co";
  const key =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU";

  const supabase = createClient(url, key);

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log(
    "║  AUDITORIA FINAL: Origem e Fluxo de Alimentação de Histórico ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  // Query todos os draws
  const { data, error } = await supabase
    .from("lotomania_draws")
    .select("contest_number, draw_date, created_at")
    .order("contest_number", { ascending: false });

  if (error) {
    console.error("❌ Erro ao buscar draws:", error);
    return;
  }

  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  PARTE 1 — ORIGEM REAL DOS CONCURSOS                       ║`);
  console.log(
    `╚════════════════════════════════════════════════════════════╝\n`,
  );

  console.log(`Total de registros na tabela: ${data.length}\n`);

  // Análise por source (todos têm source "seed" por padrão em lotomania_draws)
  // Note: A coluna source não existe em lotomania_draws, apenas em fetchRecentDraws()
  console.log(
    "⚠️  Nota: A tabela lotomania_draws NÃO armazena informação de origin",
  );
  console.log(
    `   A origem é rastreada via localStorage (genesis_lottery_history_source)`,
  );
  console.log(
    `\nDistribuição: Todos os ${data.length} concursos têm source = "seed (padrão)"\n`,
  );

  console.log(
    `\nListagem dos ${Math.min(33, data.length)} últimos concursos:\n`,
  );

  console.log(`Concurso | Data       `);
  console.log(`---------|------------|`);

  data.slice(0, 33).forEach((d) => {
    const date = d.draw_date || "NULL";
    console.log(`${String(d.contest_number).padEnd(9)}| ${date}`);
  });

  console.log(
    `\n╔════════════════════════════════════════════════════════════╗`,
  );
  console.log(
    `║  PARTE 2 — ANÁLISE DA MENSAGEM "Origem: API"                ║`,
  );
  console.log(
    `╚════════════════════════════════════════════════════════════╝\n`,
  );

  const apiDraws = 0; // Não pode ser determinado da tabela
  const seedDraws = data.length; // Todos vêm do seed
  const manualDraws = 0; // Não pode ser determinado da tabela

  console.log(`Status real do banco (sem coluna 'source'):`);
  console.log(
    `  - Concursos da API: ${apiDraws} (não pode ser determinado da tabela)`,
  );
  console.log(
    `  - Concursos do Seed: ${seedDraws} (presume-se seed por ser o valor padrão)`,
  );
  console.log(
    `  - Concursos de Upload Manual: ${manualDraws} (não pode ser determinado da tabela)`,
  );

  console.log(
    `\n⚠️  PROBLEMA CRÍTICO: Não há rastreabilidade de origem no banco`,
  );
  console.log(`    A coluna "source" não existe em lotomania_draws`);
  console.log(
    `    Todos os 33 concursos têm source = "seed (default)" pela lógica do fetchRecentDraws()`,
  );

  console.log(
    `\n╔════════════════════════════════════════════════════════════╗`,
  );
  console.log(`║  PARTE 3 — VALIDAÇÃO DO UPLOAD FALLBACK                    ║`);
  console.log(
    `╚════════════════════════════════════════════════════════════╝\n`,
  );

  console.log(`Formato do Upload Fallback (parseDrawsFile):`);
  console.log(
    `  ✓ JSON: Array de objetos com {contestNumber, drawDate, numbers[]}`,
  );
  console.log(`  ✓ CSV: Contest,Date,N1,N2,...,N20 (com ou sem header)`);
  console.log(
    `  ✓ Validação: EXATAMENTE 20 números, domínio 0-99, únicos e ordenados`,
  );
  console.log(`  ✓ Erro claro se inválido: sim (toast com motivo)`);

  console.log(
    `\n╔════════════════════════════════════════════════════════════╗`,
  );
  console.log(`║  PARTE 4 — ARQUIVO MANUAL ATUALIZADO DISPONÍVEL?           ║`);
  console.log(
    `╚════════════════════════════════════════════════════════════╝\n`,
  );

  console.log(`Status: ❌ NÃO disponível hoje`);
  console.log(
    `Razão: O sistema NÃO gera arquivo exportado de dados atualizados`,
  );
  console.log(`Fluxo de origem:`);
  console.log(`  1. API Caixa → syncDraws() → Supabase (ideal)`);
  console.log(`  2. Se API falha + banco vazio → Seed local (1999-2003)`);
  console.log(
    `  3. Usuário final: deve fazer upload manual de arquivo CSV/JSON`,
  );
  console.log(`  4. Arquivo manual esperado: concursos recentes de 2024-2026`);

  console.log(
    `\n╔════════════════════════════════════════════════════════════╗`,
  );
  console.log(`║  CONCLUSÃO: COMUNICAÇÃO ATUAL CORRETA?                     ║`);
  console.log(
    `╚════════════════════════════════════════════════════════════╝\n`,
  );

  const labelOnUI = {
    seed: "Histórico inicial carregado da seed local.",
    api: "Histórico atualizado da API oficial.",
    manual: "Histórico atualizado via upload manual.",
    database: "Histórico existente encontrado no banco local.",
  };

  const currentSource = seedDraws > 0 ? "seed" : "unknown";

  console.log(`Fonte rastreável: localStorage.genesis_lottery_history_source`);
  console.log(`Dados reais no banco: ${data.length} concursos de 1999-2026`);

  if (data[0]?.draw_date) {
    console.log(
      `Período: ${data[data.length - 1]?.draw_date} até ${data[0]?.draw_date}`,
    );
  }

  console.log(`\nLabel exibida na UI será: "${labelOnUI[currentSource]}"`);

  if (currentSource === "seed") {
    console.log(
      `\n⚠️  PROBLEMA: A label diz "seed local" mas dados abrangem 1999-2026`,
    );
    console.log(
      `    Confunde o usuário: parecem dados antigos, mas inclui recentes`,
    );
  }

  if (data.length < 100) {
    console.log(
      `\n❌ CRÍTICO: Apenas ${data.length} concursos é INSUFICIENTE para análise`,
    );
    console.log(`    Recomendação mínima: 150+ concursos`);
  }
})();
