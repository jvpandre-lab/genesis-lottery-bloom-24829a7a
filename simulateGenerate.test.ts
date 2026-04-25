import { describe, test, expect } from "vitest";
import { generate } from "./src/engine/generatorCore";
import { persistGeneration } from "./src/services/storageService";
import { integrateEcosystemFlow } from "./src/engine/ecoIntegration";
import { arbiterMemory } from "./src/engine/arbiterMemory";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config(); // carregar env manual se vitest nao puxou
import fs from "fs";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://kvlgqjvvzewbxivqceza.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU";
const supabase = createClient(supabaseUrl, supabaseKey);

describe("Surgical Audit - Supabase Tables", () => {
    test("Gerar 5 jogos, persistir e Conferir", async () => {
        // 1. Contar antes
        const tables = [
            "generations", "generation_batches", "generation_games",
            "arbiter_decisions", "adaptive_adjustments", "adaptive_pressure_signals",
            "lineage_history", "scenario_transitions", "territory_snapshots"
        ];

        const countsBefore: Record<string, number> = {};
        for (const t of tables) {
            const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
            countsBefore[t] = count || 0;
        }

        // 2. Gerar
        await arbiterMemory.init();
        const res = await generate({
            count: 5,
            scenario: "hybrid",
            twoBrains: true,
            targetContestNumber: 2917,
        });

        expect(res.batches.length).toBeGreaterThan(0);

        // 3. Persistir
        const savedGen = await persistGeneration(res);
        const genId = savedGen.id;

        // Integrar ecossistema
        await integrateEcosystemFlow(res, [], genId, 0.5, 0.4);

        // Delay para supabase assimilar
        await new Promise(r => setTimeout(r, 2000));

        // 4. Contar depois
        const countsAfter: Record<string, number> = {};
        for (const t of tables) {
            const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
            countsAfter[t] = count || 0;
        }

        const report = { countsBefore, countsAfter };
        fs.writeFileSync("audit_simulation_report.json", JSON.stringify(report, null, 2));

        // 5. Testar Aprendizado Automático (Conferência)
        // Pegar todas as decisões geradas
        const { data: decisions } = await supabase.from("arbiter_decisions").select("*").eq("batch_name", "Alpha").order("created_at", { ascending: false }).limit(2);

        expect(decisions).toBeDefined();

        if (decisions && decisions.length > 0) {
            // Falsificar um hit para uma decisão e forçar applyLearning
            const decisionId = decisions[0].id;
            const learnRes = arbiterMemory.applyLearning(decisionId, 12, 2916);
            expect(learnRes.applied).toBe(true);

            // Delay supabase sync das métricas (updateAssync)
            await new Promise(r => setTimeout(r, 2000));

            // Validar update
            const { data: updatedDec } = await supabase.from("arbiter_decisions").select("*").eq("id", decisionId).single();
            expect(updatedDec.outcome_hits).toBe(12);
            expect(updatedDec.outcome_quality).toBe("good");
        }
    }, 30000); // 30s timeout
});
