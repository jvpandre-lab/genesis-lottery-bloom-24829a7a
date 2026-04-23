import { createClient } from "@supabase/supabase-js";

(async () => {
  const url = "https://kvlgqjvvzewbxivqceza.supabase.co";
  const key =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU";

  const supabase = createClient(url, key);

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log(
    "║  AUDITORIA: Origem dos 33 Concursos em lotomania_draws      ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  // Query todos os draws
  const { data, error } = await supabase
    .from("lotomania_draws")
    .select("*")
    .order("contest_number", { ascending: false });

  if (error) {
    console.error("❌ Erro ao buscar draws:", error);
    return;
  }

  console.log(`[1] Total de registros na tabela: ${data.length}\n`);

  // Listar os 33 últimos (ou todos se menos)
  const toList = data.slice(0, 33);

  console.log(`[2] Listando ${toList.length} concursos:\n`);
  console.log("Contest#  | Date       | Numbers (20)              | ID Prefix");
  console.log(
    "-----------|------------|---------------------------|----------",
  );

  toList.forEach((draw) => {
    const date = draw.draw_date || "null";
    const nums = Array.isArray(draw.numbers)
      ? draw.numbers.join(",").substring(0, 25)
      : "null";
    const id = draw.id ? draw.id.substring(0, 8) : "null";
    console.log(
      `${String(draw.contest_number).padEnd(10)}| ${date} | ${nums.padEnd(25)} | ${id}`,
    );
  });

  // Análise de origem
  console.log(`\n[3] Análise de Origem:\n`);

  const countBySource = {};
  data.forEach((draw) => {
    const source = draw.source || "seed (default)";
    countBySource[source] = (countBySource[source] || 0) + 1;
  });

  Object.entries(countBySource).forEach(([source, count]) => {
    console.log(`  ${source}: ${count} registros`);
  });

  // Verificar se todos os 33 têm 20 números
  console.log(`\n[4] Validação de Integridade (33 últimos):\n`);

  const validCount = toList.filter(
    (d) => Array.isArray(d.numbers) && d.numbers.length === 20,
  ).length;
  console.log(`  Concursos com 20 números: ${validCount}/${toList.length}`);

  const invalidNumbers = toList.filter(
    (d) => !Array.isArray(d.numbers) || d.numbers.length !== 20,
  );
  if (invalidNumbers.length > 0) {
    console.log(`  ⚠️  Problemas encontrados:`);
    invalidNumbers.forEach((d) => {
      console.log(
        `     Contest #${d.contest_number}: ${d.numbers ? d.numbers.length : 0} números`,
      );
    });
  }

  // Data range
  const dates = toList
    .map((d) => d.draw_date)
    .filter(Boolean)
    .sort();
  if (dates.length > 0) {
    console.log(`\n[5] Período dos 33 concursos:\n`);
    console.log(`  Mais antigo: ${dates[0]}`);
    console.log(`  Mais recente: ${dates[dates.length - 1]}`);
  }
})();
