import { supabase } from "@/integrations/supabase/client";
import { Dezena, DrawRecord, GenerationResult } from "@/engine/lotteryTypes";

export async function fetchRecentDraws(limit = 10): Promise<DrawRecord[]> {
  const { data, error } = await supabase
    .from("lotomania_draws")
    .select("contest_number, draw_date, numbers")
    .order("contest_number", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    contestNumber: r.contest_number,
    drawDate: r.draw_date ?? undefined,
    numbers: r.numbers as Dezena[],
    source: "database" as const,
  }));
}

export async function countDraws(): Promise<number> {
  const { count, error } = await supabase
    .from("lotomania_draws")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function upsertDraws(draws: DrawRecord[]): Promise<number> {
  if (draws.length === 0) return 0;
  const rows = draws.map((d) => ({
    contest_number: d.contestNumber,
    draw_date: d.drawDate ?? null,
    numbers: (d.numbers as any[]).map((n) => Number(n)),
  }));
  const { error, count } = await supabase
    .from("lotomania_draws")
    .upsert(rows, { onConflict: "contest_number", count: "exact", ignoreDuplicates: true });
  if (error) throw error;
  return count ?? rows.length;
}

export async function persistGeneration(result: GenerationResult): Promise<string> {
  const { data: gen, error: e1 } = await supabase
    .from("generations")
    .insert({
      label: result.label,
      scenario: result.scenario,
      requested_count: result.requestedCount,
      params: {},
      metrics: result.metrics,
    })
    .select("id")
    .single();
  if (e1) throw e1;
  const generationId = gen!.id;

  for (const batch of result.batches) {
    const { data: b, error: e2 } = await supabase
      .from("generation_batches")
      .insert({
        generation_id: generationId,
        name: batch.name,
        purpose: batch.purpose,
        dominant_lineage: batch.dominant,
        score: batch.avgScore,
        metrics: { diversity: batch.diversity, avgScore: batch.avgScore },
      })
      .select("id")
      .single();
    if (e2) throw e2;

    const rows = batch.games.map((g, i) => ({
      batch_id: b!.id,
      numbers: g.numbers,
      lineage: g.lineage,
      score: g.score.total,
      metrics: JSON.parse(JSON.stringify({ score: g.score, gameMetrics: g.metrics })),
      position: i,
    }));
    const { error: e3 } = await supabase.from("generation_games").insert(rows);
    if (e3) throw e3;
  }
  return generationId;
}

export interface PressureSignal {
  signalType: string;
  value: number;
  threshold?: number;
  triggered: boolean;
}

export interface AdjustmentRecord {
  adjustmentType: string;
  details: any;
  applied: boolean;
}

export interface LineageRecord {
  lineage: string;
  dominanceScore: number;
  explorationRate?: number;
  stabilityScore?: number;
}

export interface TerritorySnapshot {
  snapshot: any;
  saturationLevel?: number;
}

// NOTE: Tabelas dedicadas (adaptive_pressure_signals, adaptive_adjustments,
// lineage_history, territory_snapshots, scenario_transitions) ainda não foram
// criadas no schema. Mantemos as funções como no-ops resilientes para que o
// fluxo do ecossistema funcione sem quebrar a build. Quando as tabelas forem
// adicionadas via migração, basta trocar a implementação.

export async function persistPressureSignals(_generationId: string, _signals: PressureSignal[]): Promise<void> {
  return;
}

export async function persistAdjustments(_generationId: string, _adjustments: AdjustmentRecord[]): Promise<void> {
  return;
}

export async function persistLineageHistory(_generationId: string, _lineages: LineageRecord[]): Promise<void> {
  return;
}

export async function persistTerritorySnapshot(_generationId: string, _snapshot: TerritorySnapshot): Promise<void> {
  return;
}

export async function persistScenarioTransition(_fromScenario: string | null, _toScenario: string, _reason: string, _triggeredBy: any): Promise<void> {
  return;
}
