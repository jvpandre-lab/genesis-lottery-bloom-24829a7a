import { Dezena, DrawRecord, GenerationResult } from "@/engine/lotteryTypes";
import { supabase } from "@/integrations/supabase/client";

/**
 * Busca N draws mais recentes (qualquer fonte)
 * @param limit Quantidade desejada (default 10)
 * @returns Array de DrawRecord ordenado por contest_number DESC
 */
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

/**
 * Busca N draws mais recentes APENAS se forem dados REAIS (não seed bootstrap antigo)
 * Filtra concursos com source='seed' quando contest_number <= 200
 * (seed local é contests 1-200 de 1999-2003)
 *
 * Estratégia:
 * - Se houver dados reais (source != 'seed' OU contest_number > 200): retorna os N mais recentes
 * - Se houver APENAS seed antigo (contests 1-200): retorna vazio (força lógica de reload/sincronização)
 */
export async function fetchRecentRealDraws(limit = 10): Promise<DrawRecord[]> {
  // Primeiro, tenta buscar draws que NÃO sejam seed bootstrap puro
  // Prioriza dados com source != 'seed' ou contest_number > 200
  const { data: realDraws, error: realError } = await supabase
    .from("lotomania_draws")
    .select("contest_number, draw_date, numbers, created_at")
    .or("contest_number.gt.200,created_at.gt.2024-01-01")
    .order("contest_number", { ascending: false })
    .limit(limit);

  if (!realError && realDraws && realDraws.length > 0) {
    return realDraws.map((r) => ({
      contestNumber: r.contest_number,
      drawDate: r.draw_date ?? undefined,
      numbers: r.numbers as Dezena[],
      source: "database" as const,
    }));
  }

  // Se nenhum draw real foi encontrado (apenas seed antigo),
  // retorna vazio para sinalizar que precisa de dados reais
  return [];
}

/**
 * Verifica se o sistema está em modo BOOTSTRAP PURO
 * (apenas seed antigo, sem dados reais posteriores)
 */
export async function isBootstrapOnly(): Promise<boolean> {
  const { data, error } = await supabase
    .from("lotomania_draws")
    .select("contest_number", { count: "exact", head: true })
    .or("contest_number.gt.200,draw_date.gt.2024-01-01");

  if (error) return false;
  return !data || data.length === 0;
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

/**
 * Retorna o maior contest_number presente na base.
 * Garante ordenação DESC e tolera base vazia (retorna null).
 */
export async function getLatestContestNumber(): Promise<number | null> {
  const { data, error } = await supabase
    .from("lotomania_draws")
    .select("contest_number")
    .order("contest_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[getLatestContestNumber] erro:", error);
    return null;
  }
  return data?.contest_number ?? null;
}

/**
 * Busca um concurso específico pelo número.
 * Retorna null (sem throw) se o concurso ainda não existe na base.
 * Usado pelo auto-aprendizado para verificar se o concurso-alvo já foi sorteado.
 */
export async function fetchDrawByContest(
  contestNumber: number,
): Promise<DrawRecord | null> {
  const { data, error } = await supabase
    .from("lotomania_draws")
    .select("contest_number, draw_date, numbers")
    .eq("contest_number", contestNumber)
    .maybeSingle();
  if (error) {
    console.warn("[fetchDrawByContest] erro:", error);
    return null;
  }
  if (!data) return null;
  return {
    contestNumber: data.contest_number,
    drawDate: data.draw_date ?? undefined,
    numbers: data.numbers as Dezena[],
    source: "database" as const,
  };
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
  const { error, count } = await supabase.from("lotomania_draws").upsert(rows, {
    onConflict: "contest_number",
    count: "exact",
    ignoreDuplicates: true,
  });
  if (error) throw error;
  return count ?? rows.length;
}

export async function persistGeneration(
  result: GenerationResult,
): Promise<string> {
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
      metrics: JSON.parse(
        JSON.stringify({ score: g.score, gameMetrics: g.metrics, decisionId: g.decisionId }),
      ),
      position: i,
    }));
    const { error: e3 } = await supabase.from("generation_games").insert(rows);
    if (e3) throw e3;
  }
  // Mutar id do resultado em memória (para integração de ecossistema)
  (result as any).id = generationId;
  return generationId;
}

/**
 * Busca gerações recentes persistidas no banco para alimentar o ecossistema (recentResults).
 * Reconstrói o objeto GenerationResult a partir dos dados persistidos.
 */
export async function fetchRecentGenerations(
  limit = 10,
): Promise<GenerationResult[]> {
  const { data: gens, error: e1 } = await supabase
    .from("generations")
    .select("id, label, scenario, requested_count, params, metrics, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (e1) throw e1;
  if (!gens || gens.length === 0) return [];

  const results: GenerationResult[] = [];

  for (const gen of gens) {
    const { data: batches, error: e2 } = await supabase
      .from("generation_batches")
      .select("id, name, purpose, dominant_lineage, score, metrics")
      .eq("generation_id", gen.id);

    if (e2) throw e2;

    const reconstructedBatches = [];
    for (const batch of batches ?? []) {
      const { data: games, error: e3 } = await supabase
        .from("generation_games")
        .select("numbers, lineage, score, metrics")
        .eq("batch_id", batch.id);

      if (e3) throw e3;

      const batchMetrics = (batch.metrics ?? {}) as any;
      reconstructedBatches.push({
        name: batch.name as any,
        purpose: batch.purpose,
        dominant: batch.dominant_lineage as any,
        avgScore: batch.score,
        diversity: batchMetrics?.diversity ?? 0.5,
        games: (games ?? []).map((g: any) => ({
          numbers: g.numbers,
          lineage: g.lineage,
          score: g.metrics?.score ?? {
            total: g.score,
            diversity: 0.5,
            balance: 0.5,
            coverage: 0.5,
          },
          metrics: g.metrics?.gameMetrics ?? {},
          decisionId: g.metrics?.decisionId,
        })),
      });
    }

    const genMetrics = (gen.metrics ?? {}) as any;
    results.push({
      label: gen.label,
      scenario: gen.scenario as any,
      requestedCount: gen.requested_count,
      batches: reconstructedBatches as any,
      metrics: {
        avgScore: genMetrics?.avgScore ?? 0,
        avgDiversity: genMetrics?.avgDiversity ?? 0,
        avgCoverage: genMetrics?.avgCoverage ?? 0,
        territoryEntropy: genMetrics?.territoryEntropy ?? 0,
      },
    } as any);
  }

  return results.reverse(); // Retorna em ordem crescente de criação
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

export async function persistPressureSignals(
  generationId: string,
  signals: PressureSignal[],
): Promise<void> {
  if (!signals.length) return;
  const rows = signals.map((s) => ({
    generation_id: generationId,
    signal_type: s.signalType,
    value: s.value,
    threshold: s.threshold ?? null,
    triggered: s.triggered,
    details: s.details ?? {},
  }));
  const { error } = await supabase
    .from("adaptive_pressure_signals")
    .insert(rows);
  if (error) throw error;
}

export async function persistAdjustments(
  generationId: string,
  adjustments: AdjustmentRecord[],
): Promise<void> {
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

export async function persistLineageHistory(
  generationId: string,
  lineages: LineageRecord[],
): Promise<void> {
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

export async function persistTerritorySnapshot(
  generationId: string,
  snap: TerritorySnapshot,
): Promise<void> {
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
  triggeredBy: any,
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

// Alias para compatibilidade
export const getContestHistory = fetchAllDraws;

// ============= Persistência do Arbiter (decisões, aprendizado) =============

export async function persistArbiterDecision(decision: {
  id: string;
  createdAt: string;
  chosen: {
    brain: "A" | "B";
    lineage: string;
    scoreTotal: number;
    diversity: number;
    coverageVal: number;
    clusterVal: number;
    value: number;
  };
  rejected: {
    brain: "A" | "B";
    lineage: string;
    scoreTotal: number;
    diversity: number;
    coverageVal: number;
    clusterVal: number;
    value: number;
  };
  context: {
    batchName: string;
    scenario: string;
    mutationRate: number;
    balanceA: number;
    balanceAAdjustment: number;
    slot: number;
    targetContestNumber?: number | null;
  };
  good: boolean;
  memoryBiasApplied?: number;
}): Promise<void> {
  const { error } = await supabase.from("arbiter_decisions").insert({
    id: decision.id,
    created_at: decision.createdAt,
    batch_name: decision.context.batchName,
    scenario: decision.context.scenario,
    slot: decision.context.slot,
    mutation_rate: decision.context.mutationRate,
    balance_a: decision.context.balanceA,
    chosen_brain: decision.chosen.brain,
    rejected_brain: decision.rejected.brain,
    chosen_lineage: decision.chosen.lineage,
    rejected_lineage: decision.rejected.lineage,
    chosen_score: decision.chosen.scoreTotal,
    rejected_score: decision.rejected.scoreTotal,
    marginal_diversity: decision.chosen.diversity,
    coverage: decision.chosen.coverageVal,
    cluster: decision.chosen.clusterVal,
    memory_bias: decision.memoryBiasApplied ?? null,
    decision: decision.good ? "chosen" : "rejected",
    outcome_good: decision.good,
    // outcome_hits and outcome_quality are null on insert — filled later by applyLearning()
    outcome_hits: null,
    outcome_quality: null,
    scores: {
      chosen: decision.chosen,
      rejected: decision.rejected,
    },
    metadata: {
      balanceAAdjustment: decision.context.balanceAAdjustment,
      targetContestNumber: decision.context.targetContestNumber ?? null,
      source: "arbiterMemory",
    },
    source: "arbiterMemory",
  });
  if (error) {
    console.error(
      `[ARBITER PERSIST ERROR] decisionId=${decision.id}` +
      ` batch=${decision.context.batchName}` +
      ` slot=${decision.context.slot}` +
      ` code=${error.code} message=${error.message}`,
    );
    throw new Error(
      `arbiter_decisions insert failed [${error.code}]: ${error.message}`,
    );
  }
  console.log(
    `[ARBITER PERSIST OK] decisionId=${decision.id}` +
    ` batch=${decision.context.batchName}` +
    ` slot=${decision.context.slot}`,
  );
}

export async function fetchArbiterDecisions(limit = 400): Promise<
  Array<{
    id: string;
    created_at: string;
    decision: "chosen" | "rejected";
    chosen_brain: "A" | "B";
    rejected_brain: "A" | "B";
    scores: any;
    scenario: string;
    batch_name: string;
    slot: number;
    mutation_rate: number;
    balance_a: number;
    chosen_lineage: string;
    rejected_lineage: string;
    chosen_score: number;
    rejected_score: number;
    marginal_diversity: number;
    coverage: number;
    cluster: number;
    memory_bias: number | null;
    outcome_good: boolean | null;
    outcome_hits: number | null;
    outcome_quality: "good" | "neutral" | "bad" | null;
    metadata: any;
    source: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("arbiter_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(
      "[ARBITER] TABLE arbiter_decisions NOT FOUND - persistence DISABLED",
    );
    console.error("Error code:", error.code, "|", error.message);
    throw new Error(
      "arbiter_decisions table does not exist. Migration not applied?",
    );
  }
  return (data ?? []) as any;
}

export async function updateArbiterDecisionOutcome(
  id: string,
  good: boolean,
  hits?: number,
  quality?: "good" | "neutral" | "bad",
): Promise<void> {
  const payload: Record<string, unknown> = {
    decision: good ? "chosen" : "rejected",
    outcome_good: good,
  };
  if (hits !== undefined) payload.outcome_hits = hits;
  if (quality !== undefined) payload.outcome_quality = quality;

  const { error } = await supabase
    .from("arbiter_decisions")
    .update(payload as any)
    .eq("id", id);

  if (error) {
    console.error(
      "[ARBITER] TABLE arbiter_decisions NOT FOUND - persistence DISABLED",
    );
    console.error("Error code:", error.code, "|", error.message);
    throw new Error(
      "arbiter_decisions table does not exist. Migration not applied?",
    );
  }
}
