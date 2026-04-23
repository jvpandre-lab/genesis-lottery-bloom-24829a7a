import { createClient } from "@supabase/supabase-js";

(async () => {
  const url = "https://kvlgqjvvzewbxivqceza.supabase.co";
  const key =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU";

  const supabase = createClient(url, key);

  console.log("[APPLY] Aplicando migração SQL para arbiter_decisions...\n");

  const sql = `
-- Create table for arbiter decisions persistence
CREATE TABLE IF NOT EXISTS public.arbiter_decisions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  batch_name TEXT,
  scenario TEXT,
  slot INTEGER,
  mutation_rate FLOAT,
  balance_a FLOAT,
  chosen_brain TEXT,
  rejected_brain TEXT,
  chosen_lineage TEXT,
  rejected_lineage TEXT,
  chosen_score FLOAT,
  rejected_score FLOAT,
  marginal_diversity FLOAT,
  coverage FLOAT,
  cluster FLOAT,
  memory_bias FLOAT,
  decision TEXT NOT NULL,
  outcome_good BOOLEAN,
  scores JSONB,
  metadata JSONB,
  source TEXT
);

-- Index for performance on queries by timestamp
CREATE INDEX IF NOT EXISTS idx_arbiter_decisions_created_at ON public.arbiter_decisions(created_at);

-- Index for scenario filtering
CREATE INDEX IF NOT EXISTS idx_arbiter_decisions_scenario ON public.arbiter_decisions(scenario);

CREATE INDEX IF NOT EXISTS idx_arbiter_decisions_batch_name ON public.arbiter_decisions(batch_name);
CREATE INDEX IF NOT EXISTS idx_arbiter_decisions_chosen_brain ON public.arbiter_decisions(chosen_brain);
  `;

  const { error } = await supabase.rpc("exec", { sql });

  if (error) {
    console.log("❌ RPC method not available. Trying via raw SQL...");
    // Tenta via supabase-js query
    const { error: queryError } = await supabase
      .from("arbiter_decisions")
      .select("*")
      .limit(1);

    if (queryError && queryError.code !== "PGRST205") {
      console.log("✅ Tabela pode já existir ou erro diferente:", queryError);
    } else {
      console.log("❌ Tabela ainda não existe");
      console.log("\nEXECUTE MANUALMENTE NO SUPABASE SQL EDITOR:");
      console.log(sql);
    }
  } else {
    console.log("✅ Tabela criada com sucesso!");
  }
})();
