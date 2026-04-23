import { createClient } from "@supabase/supabase-js";

(async () => {
  const url = "https://kvlgqjvvzewbxivqceza.supabase.co";
  const key =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU";

  const supabase = createClient(url, key);

  console.log(
    "[CHECK] Verificando existência da tabela arbiter_decisions...\n",
  );

  const { data, error } = await supabase
    .from("arbiter_decisions")
    .select("count")
    .limit(1);

  if (error) {
    console.log("❌ ERRO:", error.code, error.message);
    if (error.code === "PGRST205") {
      console.log("→ CONFIRMADO: Tabela arbiter_decisions NÃO EXISTE no banco");
    }
  } else {
    console.log("✅ TABELA EXISTE");
    console.log("Registros na tabela:", data);
  }
})();
