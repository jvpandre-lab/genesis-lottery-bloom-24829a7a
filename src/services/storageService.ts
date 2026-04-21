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

export async function fetchAllDraws(): Promise<DrawRecord[]> {
  // Pagina em blocos de 1000 (limite default do Supabase) para garantir
  // backtest completo mesmo com histórico grande.
  const all: DrawRecord[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("lotomania_draws")
      .select("contest_number, draw_date, numbers")
      .order("contest_number", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      all.push({
        contestNumber: r.contest_number,
        drawDate: r.draw_date ?? undefined,
        numbers: r.numbers as Dezena[],
        source: "database" as const,
      });
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
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
  // Mutar id do resultado em memória (para integração de ecossistema)
  (result as any).id = generationId;
  return generationId;
}

export interface PressureSignal {
  signalType: string;
  value: number;
  threshold?: number;
  triggered: boolean;
  details?: any;
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
  driftMagnitude?: number;
  driftStatus?: string;
}

export interface TerritorySnapshot {
  snapshot: any;
  saturationLevel?: number;
  pressureZones?: any[];
  blindZones?: any[];
  driftMagnitude?: number;
  driftDirection?: string;
}

// ============= Persistência real do ecossistema =============

export async function persistPressureSignals(generationId: string, signals: PressureSignal[]): Promise<void> {
  if (!signals.length) return;
  const rows = signals.map((s) => ({
    generation_id: generationId,
    signal_type: s.signalType,
    value: s.value,
    threshold: s.threshold ?? null,
    triggered: s.triggered,
    details: s.details ?? {},
  }));
  const { error } = await supabase.from("adaptive_pressure_signals").insert(rows);
  if (error) throw error;
}

export async function persistAdjustments(generationId: string, adjustments: AdjustmentRecord[]): Promise<void> {
  if (!adjustments.length) return;
  const rows = adjustments.map((a) => ({
    generation_id: generationId,
    adjustment_type: a.adjustmentType,
    details: a.details,
    applied: a.applied,
  }));
  const { error } = await supabase.from("adaptive_adjustments").insert(rows);
  if (error) throw error;
}

export async function persistLineageHistory(generationId: string, lineages: LineageRecord[]): Promise<void> {
  if (!lineages.length) return;
  const rows = lineages.map((l) => ({
    generation_id: generationId,
    lineage: l.lineage,
    dominance_score: l.dominanceScore,
    exploration_rate: l.explorationRate ?? null,
    stability_score: l.stabilityScore ?? null,
    drift_magnitude: l.driftMagnitude ?? null,
    drift_status: l.driftStatus ?? null,
  }));
  const { error } = await supabase.from("lineage_history").insert(rows);
  if (error) throw error;
}

export async function persistTerritorySnapshot(generationId: string, snap: TerritorySnapshot): Promise<void> {
  const { error } = await supabase.from("territory_snapshots").insert({
    generation_id: generationId,
    snapshot: snap.snapshot,
    saturation_level: snap.saturationLevel ?? null,
    pressure_zones: snap.pressureZones ?? [],
    blind_zones: snap.blindZones ?? [],
    drift_magnitude: snap.driftMagnitude ?? null,
    drift_direction: snap.driftDirection ?? null,
  });
  if (error) throw error;
}

export async function persistScenarioTransition(
  fromScenario: string | null,
  toScenario: string,
  reason: string,
  triggeredBy: any
): Promise<void> {
  const { error } = await supabase.from("scenario_transitions").insert({
    from_scenario: fromScenario,
    to_scenario: toScenario,
    reason,
    triggered_by: triggeredBy ?? {},
  });
  if (error) throw error;
}

// ============= Leitura do ecossistema (reidratação) =============

export async function fetchRecentScenarioTransitions(limit = 20) {
  const { data, error } = await supabase
    .from("scenario_transitions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchRecentLineageHistory(lineage: string, limit = 30) {
  const { data, error } = await supabase
    .from("lineage_history")
    .select("*")
    .eq("lineage", lineage)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchRecentPressureSignals(limit = 100) {
  const { data, error } = await supabase
    .from("adaptive_pressure_signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
