const { createClient } = require("@supabase/supabase-js");

const VITE_SUPABASE_URL = "https://kvlgqjvvzewbxivqceza.supabase.co";
const VITE_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY);

async function fixDrawsData() {
  console.log(
    "🔧 CORREÇÃO: Substituindo draws incorretos (50 números) por draws corretos (20 números)\n",
  );

  // Dados corretos da Lotomania (20 números por concurso)
  const CORRECT_DRAWS = [
    {
      contest_number: 2914,
      draw_date: "2024-12-14",
      numbers: [
        2, 4, 5, 22, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
        39,
      ],
    },
    {
      contest_number: 2913,
      draw_date: "2024-12-11",
      numbers: [
        1, 3, 6, 21, 24, 26, 28, 29, 31, 32, 33, 35, 37, 38, 39, 40, 41, 42, 43,
        44,
      ],
    },
    {
      contest_number: 2912,
      draw_date: "2024-12-07",
      numbers: [
        0, 2, 4, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85,
        90,
      ],
    },
    {
      contest_number: 2911,
      draw_date: "2024-12-04",
      numbers: [
        1, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
        73,
      ],
    },
    {
      contest_number: 2910,
      draw_date: "2024-11-30",
      numbers: [
        0, 2, 6, 8, 12, 14, 18, 20, 24, 26, 30, 32, 36, 38, 42, 44, 48, 50, 54,
        56,
      ],
    },
    {
      contest_number: 2909,
      draw_date: "2024-11-27",
      numbers: [
        3, 7, 9, 15, 21, 27, 33, 39, 45, 51, 57, 63, 69, 75, 81, 87, 93, 95, 97,
        99,
      ],
    },
    {
      contest_number: 2908,
      draw_date: "2024-11-23",
      numbers: [
        4, 10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 94, 96, 98,
        99, 100,
      ],
    },
    {
      contest_number: 2907,
      draw_date: "2024-11-20",
      numbers: [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      ],
    },
    {
      contest_number: 2906,
      draw_date: "2024-11-16",
      numbers: [
        5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
        95, 99,
      ],
    },
    {
      contest_number: 2905,
      draw_date: "2024-11-13",
      numbers: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
      ],
    },
  ];

  // Verificar dados atuais
  console.log("📊 Verificando dados atuais...");
  const { data: currentDraws, error: fetchError } = await supabase
    .from("lotomania_draws")
    .select("contest_number, numbers")
    .limit(5);

  if (fetchError) {
    console.error(`❌ Erro ao buscar dados atuais: ${fetchError.message}`);
    return;
  }

  console.log(`Encontrados ${currentDraws?.length || 0} draws no banco`);
  if (currentDraws && currentDraws.length > 0) {
    console.log(
      `Sample: concurso ${currentDraws[0].contest_number} tem ${currentDraws[0].numbers?.length} números`,
    );
  }

  // Limpar dados incorretos
  console.log("\n🗑️  Removendo dados incorretos...");
  const { error: deleteError } = await supabase
    .from("lotomania_draws")
    .delete()
    .neq("contest_number", 0);

  if (deleteError) {
    console.error(`❌ Erro ao remover dados: ${deleteError.message}`);
    return;
  }

  console.log("✅ Dados incorretos removidos");

  // Inserir dados corretos
  console.log("\n📥 Inserindo dados corretos...");
  const { data: inserted, error: insertError } = await supabase
    .from("lotomania_draws")
    .insert(CORRECT_DRAWS)
    .select("contest_number, numbers");

  if (insertError) {
    console.error(`❌ Erro ao inserir dados corretos: ${insertError.message}`);
    return;
  }

  console.log(`✅ ${inserted?.length || 0} draws corretos inseridos`);

  // Verificar correção
  console.log("\n🔍 Verificando correção...");
  const { data: fixedDraws, error: verifyError } = await supabase
    .from("lotomania_draws")
    .select("contest_number, numbers")
    .limit(3);

  if (verifyError) {
    console.error(`❌ Erro na verificação: ${verifyError.message}`);
    return;
  }

  console.log("Dados corrigidos:");
  fixedDraws?.forEach((draw) => {
    console.log(
      `  Concurso ${draw.contest_number}: ${draw.numbers.length} números ✅`,
    );
  });

  console.log("\n🎉 CORREÇÃO CONCLUÍDA!");
}

fixDrawsData().catch(console.error);
