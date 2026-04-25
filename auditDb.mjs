import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kvlgqjvvzewbxivqceza.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU";
const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
    "lotomania_draws",
    "generations",
    "generation_batches",
    "generation_games",
    "arbiter_decisions",
    "adaptive_adjustments",
    "adaptive_pressure_signals",
    "lineage_history",
    "scenario_transitions",
    "territory_snapshots",
];

async function scan() {
    const result = {};
    for (const table of tables) {
        console.log(`Scanning ${table}...`);
        const { data, error, count } = await supabase
            .from(table)
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .limit(20);

        if (error) {
            console.error(`Erro ao ler ${table}:`, error.message);
            result[table] = { error: error.message };
            continue;
        }

        if (!data || data.length === 0) {
            result[table] = { count: count || 0, cols: {}, empty: true };
            continue;
        }

        const columns = Object.keys(data[0]);
        const nulls = {};
        for (const col of columns) {
            let nullCount = 0;
            for (const row of data) {
                if (row[col] === null || row[col] === undefined) nullCount++;
            }
            nulls[col] = { count: nullCount, percentage: Math.round((nullCount / data.length) * 100) };
        }

        result[table] = {
            totalRows: count,
            analyzedLimit: data.length,
            nullStats: nulls
        };
    }

    console.log("\n====== DB SCAN RESULTS ======\n");
    console.log(JSON.stringify(result, null, 2));
}

scan().catch(console.error);
