import {
  fetchArbiterDecisions,
  persistArbiterDecision,
  updateArbiterDecisionOutcome,
} from "@/services/storageService";
import { BatchName, LineageId, Scenario } from "./lotteryTypes";

const STORAGE_KEY = "arbiterMemory.v1";
const MAX_DECISIONS = 400;

export interface DecisionCandidateSnapshot {
  brain: "A" | "B";
  lineage: LineageId;
  scoreTotal: number;
  diversity: number;
  coverageVal: number;
  clusterVal: number;
  value: number;
  numbers?: number[];
}

export interface DecisionContext {
  batchName: BatchName;
  scenario: Scenario;
  mutationRate: number;
  balanceA: number;
  balanceAAdjustment: number;
  slot: number;
  targetContestNumber?: number | null;
}

export interface ArbiterDecisionRecord {
  id: string;
  createdAt: string;
  chosen: DecisionCandidateSnapshot;
  rejected: DecisionCandidateSnapshot;
  context: DecisionContext;
  good: boolean;
  /** Real hits count from the draw result — populated by applyLearning() */
  outcomeHits?: number;
  /** Quality classification derived from outcomeHits */
  outcomeQuality?: "good" | "neutral" | "bad";
}

interface BrainStats {
  wins: number;
  losses: number;
  total: number;
  scoreDelta: number;
}

type ScenarioBrainStats = Record<"A" | "B", BrainStats>;

interface ArbiterMemoryState {
  decisions: ArbiterDecisionRecord[];
  stats: Record<Scenario, ScenarioBrainStats>;
  errors: Record<string, number>;
  /** Per-scenario memory bias accumulated from real outcome learning */
  memoryBias: Record<Scenario, number>;
  updatedAt: string;
}

function createStats(): BrainStats {
  return { wins: 0, losses: 0, total: 0, scoreDelta: 0 };
}

function createScenarioStats(): ScenarioBrainStats {
  return { A: createStats(), B: createStats() };
}

function createDefaultMemoryBias(): Record<Scenario, number> {
  return { conservative: 0, hybrid: 0, aggressive: 0, exploratory: 0 };
}

const DEFAULT_STATE: ArbiterMemoryState = {
  decisions: [],
  stats: {
    conservative: createScenarioStats(),
    hybrid: createScenarioStats(),
    aggressive: createScenarioStats(),
    exploratory: createScenarioStats(),
  },
  errors: {},
  memoryBias: createDefaultMemoryBias(),
  updatedAt: new Date().toISOString(),
};

function hasLocalStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

async function loadState(): Promise<ArbiterMemoryState> {
  try {
    // Try to load from database first
    const dbState = await loadStateFromDB();
    if (dbState) {
      console.log(
        `[ARBITER] loaded ${dbState.decisions.length} decisions from DB`,
      );
      return dbState;
    }
  } catch (error) {
    console.warn(
      "Failed to load arbiter memory from database, falling back to localStorage",
      error,
    );
  }

  // Fallback to localStorage
  if (!hasLocalStorage()) {
    console.log(
      "[ARBITER] no localStorage available, using default memory state",
    );
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      console.log(
        "[ARBITER] no localStorage entry, using default memory state",
      );
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    const parsed = JSON.parse(serialized) as ArbiterMemoryState;
    const mergedState: ArbiterMemoryState = {
      ...DEFAULT_STATE,
      ...parsed,
      stats: {
        conservative: {
          ...DEFAULT_STATE.stats.conservative,
          ...parsed.stats?.conservative,
        },
        hybrid: { ...DEFAULT_STATE.stats.hybrid, ...parsed.stats?.hybrid },
        aggressive: {
          ...DEFAULT_STATE.stats.aggressive,
          ...parsed.stats?.aggressive,
        },
        exploratory: {
          ...DEFAULT_STATE.stats.exploratory,
          ...parsed.stats?.exploratory,
        },
      },
      memoryBias: {
        ...createDefaultMemoryBias(),
        ...(parsed.memoryBias ?? {}),
      },
      decisions: Array.isArray(parsed.decisions)
        ? parsed.decisions.slice(-MAX_DECISIONS)
        : [],
      errors: parsed.errors ?? {},
      updatedAt: parsed.updatedAt ?? DEFAULT_STATE.updatedAt,
    };
    console.log(
      `[ARBITER] loaded ${mergedState.decisions.length} decisions from localStorage`,
    );
    return mergedState;
  } catch (e) {
    console.warn("[ARBITER] failed to parse localStorage state", e);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

async function loadStateFromDB(): Promise<ArbiterMemoryState | null> {
  try {
    const data = await fetchArbiterDecisions(MAX_DECISIONS);

    if (!data || data.length === 0) return null;

    const decisions: ArbiterDecisionRecord[] = data.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      chosen: row.scores?.chosen || {
        brain: row.chosen_brain || "A",
        lineage: row.chosen_lineage || "A1",
        scoreTotal: row.chosen_score || 0,
        diversity: row.marginal_diversity || 0,
        coverageVal: row.coverage || 0,
        clusterVal: row.cluster || 0,
        value: row.chosen_score || 0,
      },
      rejected: row.scores?.rejected || {
        brain: row.rejected_brain || "B",
        lineage: row.rejected_lineage || "B1",
        scoreTotal: row.rejected_score || 0,
        diversity: 0,
        coverageVal: 0,
        clusterVal: 0,
        value: row.rejected_score || 0,
      },
      context: {
        batchName: (row.batch_name || "Alpha") as BatchName,
        scenario: (row.scenario || "conservative") as Scenario,
        mutationRate: row.mutation_rate || 0,
        balanceA: row.balance_a || 0.5,
        balanceAAdjustment: row.metadata?.balanceAAdjustment || 0,
        slot: row.slot || 0,
        targetContestNumber: row.metadata?.targetContestNumber ?? null,
      },
      good:
        typeof row.outcome_good === "boolean"
          ? row.outcome_good
          : row.decision === "chosen",
      // Rehydrate learning outcomes from DB (enables persistent idempotency guard)
      outcomeHits: row.outcome_hits ?? undefined,
      outcomeQuality: (row.outcome_quality as ArbiterDecisionRecord["outcomeQuality"]) ?? undefined,
    }));

    // Rebuild stats from decisions
    const stats = { ...DEFAULT_STATE.stats };
    const errors: Record<string, number> = {};
    // Rebuild memoryBias from evaluated decisions
    const memoryBias = createDefaultMemoryBias();

    for (const decision of decisions) {
      const scenario = decision.context.scenario;
      const chosenBrain = decision.chosen.brain;
      const rejectedBrain = decision.rejected.brain;
      const brainStats = stats[scenario][chosenBrain];
      brainStats.total += 1;
      if (decision.good) brainStats.wins += 1;
      else brainStats.losses += 1;
      brainStats.scoreDelta += decision.chosen.value - decision.rejected.value;

      if (!decision.good) {
        const errorKey = buildErrorKey(scenario, chosenBrain, rejectedBrain);
        errors[errorKey] = (errors[errorKey] ?? 0) + 1;
      }

      // Rebuild memoryBias from persisted quality outcomes
      if (decision.outcomeQuality) {
        const totalDecisions = Math.max(1, decisions.length / 20);
        const rawDelta = computeRawDelta(decision.outcomeQuality, decision.outcomeHits ?? 0);
        memoryBias[scenario] = clamp(
          memoryBias[scenario] + rawDelta / totalDecisions,
          -0.5,
          0.5,
        );
      }
    }

    console.log(
      `[ARBITER] loaded ${decisions.length} decisions from Supabase (real persistence)`,
    );

    return {
      decisions,
      stats,
      errors,
      memoryBias,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("[ARBITER] failed to load from Supabase:", error);
    return null;
  }
}

function saveState(state: ArbiterMemoryState): void {
  state.updatedAt = new Date().toISOString();
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // fallback silently in environments without storage
  }
}

async function persistDecisionToDB(
  record: ArbiterDecisionRecord,
): Promise<void> {
  try {
    await persistArbiterDecision(record);
  } catch (error) {
    console.error(
      "[ARBITER] CRITICAL: Failed to persist decision to Supabase:",
      error,
    );
    throw error;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreRate(stats: BrainStats): number {
  return stats.total === 0 ? 0.5 : stats.wins / stats.total;
}

function buildErrorKey(
  scenario: Scenario,
  chosen: string,
  rejected: string,
): string {
  return `${scenario}|chosen:${chosen}|rejected:${rejected}`;
}

/** Classify outcome quality based on hit count */
function classifyQuality(hits: number): "good" | "neutral" | "bad" {
  if (hits >= 11) return "good";
  if (hits >= 9) return "neutral";
  return "bad";
}

/**
 * Compute the raw bias delta for a given quality and hit count.
 * good  → +0.1 to +0.3 (linear scale based on hits above 10)
 * bad   → -0.1 to -0.3 (linear scale based on hits below 10)
 * neutral → 0
 */
function computeRawDelta(
  quality: "good" | "neutral" | "bad",
  hits: number,
): number {
  if (quality === "good") {
    return 0.1 + 0.02 * clamp(hits - 10, 0, 10);
  }
  if (quality === "bad") {
    return -(0.1 + 0.02 * clamp(10 - hits, 0, 10));
  }
  return 0; // neutral
}

let state: ArbiterMemoryState = JSON.parse(JSON.stringify(DEFAULT_STATE));
let stateLoaded = false;

export const arbiterMemory = {
  async init(): Promise<void> {
    if (stateLoaded) return;
    state = await loadState();
    stateLoaded = true;
    console.log(
      `[ARBITER] init completed, ${state.decisions.length} decisions loaded`,
    );
  },

  getState(): ArbiterMemoryState {
    return state;
  },

  reset(): void {
    stateLoaded = false;
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState(state);
  },

  getSummary(): {
    decisionCount: number;
    successRates: Record<Scenario, { A: number; B: number }>;
    memoryBias: Record<Scenario, number>;
    updatedAt: string;
  } {
    return {
      decisionCount: state.decisions.length,
      updatedAt: state.updatedAt,
      memoryBias: { ...state.memoryBias },
      successRates: {
        conservative: {
          A: scoreRate(state.stats.conservative.A),
          B: scoreRate(state.stats.conservative.B),
        },
        hybrid: {
          A: scoreRate(state.stats.hybrid.A),
          B: scoreRate(state.stats.hybrid.B),
        },
        aggressive: {
          A: scoreRate(state.stats.aggressive.A),
          B: scoreRate(state.stats.aggressive.B),
        },
        exploratory: {
          A: scoreRate(state.stats.exploratory.A),
          B: scoreRate(state.stats.exploratory.B),
        },
      },
    };
  },

  registerDecision(
    record: Omit<ArbiterDecisionRecord, "id" | "createdAt">,
  ): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const good = record.good;
    const chosenBrain = record.chosen.brain;
    const stats = state.stats[record.context.scenario][chosenBrain];
    stats.total += 1;
    if (good) stats.wins += 1;
    else stats.losses += 1;
    stats.scoreDelta += record.chosen.value - record.rejected.value;

    if (!good) {
      const errorKey = buildErrorKey(
        record.context.scenario,
        record.chosen.brain,
        record.rejected.brain,
      );
      state.errors[errorKey] = (state.errors[errorKey] ?? 0) + 1;
    }

    const fullRecord: ArbiterDecisionRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    state.decisions.push(fullRecord);
    if (state.decisions.length > MAX_DECISIONS) {
      state.decisions = state.decisions.slice(
        state.decisions.length - MAX_DECISIONS,
      );
    }

    // Persist to database (async, non-blocking)
    persistDecisionToDB(fullRecord).catch((err) => {
      console.warn(
        "[ARBITER] decision registered locally, but DB persist failed:",
        err,
      );
    });

    saveState(state);
    return id;
  },

  markDecisionOutcome(id: string, actualGood: boolean): void {
    const decision = state.decisions.find((d) => d.id === id);
    if (!decision) return;
    if (decision.good === actualGood) return;
    const stats = state.stats[decision.context.scenario][decision.chosen.brain];
    if (decision.good) {
      stats.wins = Math.max(0, stats.wins - 1);
    } else {
      stats.losses = Math.max(0, stats.losses - 1);
    }
    if (actualGood) stats.wins += 1;
    else stats.losses += 1;
    decision.good = actualGood;

    // Update in database (async, non-blocking)
    updateArbiterDecisionOutcome(id, actualGood).catch((err) => {
      console.warn(
        "[ARBITER] decision updated locally, but DB update failed:",
        err,
      );
    });

    saveState(state);
  },

  /**
   * Apply real learning from an actual draw result.
   *
   * Protection Rule:
   * - If `decision.context.targetContestNumber` does not match `contestNumber`,
   *   skip learning. This prevents simulated conferences from polluting the DB.
   *
   * Guards:
   * - If the decision doesn't exist → no-op
   * - If `decision.outcomeHits` is already set → skip (idempotent, works across
   *   sessions because outcomeHits is rehydrated from DB on load)
   *
   * Effect:
   * - Adjusts `memoryBias[scenario]` based on hit quality
   * - Persists outcome_hits + outcome_quality to DB
   *
   * @param decisionId  ID of the ArbiterDecisionRecord to update
   * @param hits        Real number of matched numbers in the draw
   * @param contestNumber  Contest number (logged for traceability and validated against target)
   */
  applyLearning(
    decisionId: string,
    hits: number,
    contestNumber: number,
  ): { applied: boolean; reason: "learned" | "duplicate" | "no-decision" | "blocked" } {
    const decision = state.decisions.find((d) => d.id === decisionId);

    if (!decision) {
      console.warn(
        `[ARBITER LEARNING] decisionId ${decisionId} not found in memory`,
      );
      return { applied: false, reason: "no-decision" };
    }

    // --- Protection Rule: Simulated Conference Guard ---
    // Accept when conferring against the exact target OR the immediately
    // previous contest (target - 1). Generation targets "next contest", but
    // real conferral typically uses the latest available draw.
    const target = decision.context.targetContestNumber;
    const accepted =
      target != null &&
      (contestNumber === target || contestNumber === target - 1);

    console.log(
      `[ARBITER LEARNING CHECK]\n` +
      `  decisionId:           ${decisionId}\n` +
      `  targetContestNumber:  ${target}\n` +
      `  testedContestNumber:  ${contestNumber}\n` +
      `  accepted:             ${accepted}\n` +
      `  reason:               ${accepted
        ? "match (target or target-1)"
        : target == null
          ? "no target set"
          : "contest mismatch (out of accepted window)"
      }`,
    );

    if (!accepted) return { applied: false, reason: "blocked" };

    // --- Idempotency guard (persistent-safe) ---
    if (decision.outcomeHits !== undefined) {
      console.log(
        `[ARBITER LEARNING] skipped duplicate outcome` +
        ` | decisionId: ${decisionId}` +
        ` | contestNumber: ${contestNumber}` +
        ` | already evaluated with hits=${decision.outcomeHits} quality=${decision.outcomeQuality}`,
      );
      return { applied: false, reason: "duplicate" };
    }

    const quality = classifyQuality(hits);
    const scenario = decision.context.scenario;
    const biasBefore = state.memoryBias[scenario];

    // Raw delta based on quality and magnitude of hits
    const rawDelta = computeRawDelta(quality, hits);

    // Normalize by decisions count to prevent weight explosion
    const normFactor = Math.max(1, state.decisions.length / 20);
    const normalizedDelta = rawDelta / normFactor;

    const biasAfter = clamp(biasBefore + normalizedDelta, -0.5, 0.5);
    state.memoryBias[scenario] = biasAfter;

    // Stamp the decision record with real outcome data
    decision.outcomeHits = hits;
    decision.outcomeQuality = quality;
    decision.good = quality !== "bad";

    // Persist to DB (non-blocking)
    updateArbiterDecisionOutcome(decisionId, decision.good, hits, quality).catch(
      (err) => {
        console.warn(
          "[ARBITER LEARNING] DB update failed (local state was applied):",
          err,
        );
      },
    );

    saveState(state);

    // --- Structured learning log ---
    console.log(
      `[ARBITER LEARNING]\n` +
      `  decisionId:    ${decisionId}\n` +
      `  contestNumber: ${contestNumber}\n` +
      `  hits:          ${hits}\n` +
      `  quality:       ${quality}\n` +
      `  scenario:      ${scenario}\n` +
      `  biasBefore:    ${biasBefore.toFixed(6)}\n` +
      `  normalizedDelta: ${normalizedDelta.toFixed(6)}\n` +
      `  biasAfter:     ${biasAfter.toFixed(6)}`,
    );
    return { applied: true, reason: "learned" };
  },

  getBrainBias(
    brain: "A" | "B",
    scenario: Scenario,
    balanceA: number,
    marginalDiv: number,
    coverageVal: number,
  ): number {
    const current = state.stats[scenario][brain];
    const other = state.stats[scenario][brain === "A" ? "B" : "A"];
    const selfRate = scoreRate(current);
    const otherRate = scoreRate(other);
    let bias = (selfRate - otherRate) * 0.22;
    if (marginalDiv < 0.55 && brain === "A") bias += 0.03;
    if (marginalDiv < 0.55 && brain === "B") bias -= 0.03;
    if (coverageVal < 0.38 && brain === "A") bias += 0.02;
    if (balanceA < 0.35 && brain === "A") bias += 0.02;
    if (selfRate < 0.4 && otherRate > 0.6) bias -= 0.04;

    // Incorporate real outcome learning bias (halved to be additive, not dominant)
    const learnedBias = state.memoryBias[scenario] * 0.5;
    // Brain A benefits from positive bias, B benefits from negative
    bias += brain === "A" ? learnedBias : -learnedBias;

    return clamp(bias, -0.35, 0.35);
  },

  adjustBalanceA(
    balanceA: number,
    scenario: Scenario,
    picksA: number,
    picksB: number,
  ): number {
    const statsA = state.stats[scenario].A;
    const statsB = state.stats[scenario].B;
    const rateA = scoreRate(statsA);
    const rateB = scoreRate(statsB);
    let adjustment = 0;
    if (rateA > rateB + 0.16) adjustment += 0.06;
    if (rateB > rateA + 0.16) adjustment -= 0.06;
    if (picksA + picksB > 0) {
      const actual = picksA / (picksA + picksB);
      const drift = actual - balanceA;
      if (drift < -0.12) adjustment += 0.03;
      if (drift > 0.12) adjustment -= 0.03;
    }
    return clamp(balanceA + adjustment, 0.1, 0.92);
  },

  /**
   * Identifica a zona geográfica (00-09, 10-19... 90-99) da dezena.
   */
  getZoneFor(num: number): string {
    if (num === 0) return "Z0"; // 00 da Lotomania
    return "Z" + Math.floor(Math.min(99, Math.max(0, num)) / 10);
  },

  /**
   * Extrai a memória contextual estrutural baseada no resultado fenotípico das dezenas e linhagens
   * que sobreviveram aos embates do Árbitro na janela temporal recente.
   * Regras Anti-Overfitting aplicadas:
   * - Ocorrência mínima (n > 1) antes de conferir poder.
   * - Clamp de score estrito e Decay Temporal na janela de amostragem.
   */
  getStructuralBias(scenario: Scenario) {
    const MAX_WINDOW = 60;
    // Captura apenas decisões já aprendidas (com qualidade declarada) do respectivo cenário
    const windowDecisions = state.decisions
      .filter((d) => d.context.scenario === scenario && d.outcomeQuality && d.outcomeQuality !== "neutral")
      .slice(-MAX_WINDOW)
      .reverse();

    const output = {
      numberPressure: {} as Record<number, number>,
      territoryPressure: {} as Record<string, number>,
      lineagePreference: {} as Record<string, number>,
      diversityPush: 0,
      antiClusterPush: 0,
      explorationPush: 0,
      conservativePush: 0,
    };

    if (windowDecisions.length === 0) return output;

    // Trackers
    const numTracker: Record<number, { goodScale: number; badScale: number; count: number }> = {};
    const linTracker: Record<string, { goodScale: number; badScale: number; count: number }> = {};
    const zoneTracker: Record<string, { goodScale: number; badScale: number; count: number }> = {};
    let aggDiversityModifier = 0;
    let aggClusterModifier = 0;

    windowDecisions.forEach((d, i) => {
      // Peso do decay: de 1.0 (recente) a 0.2 (longínquo)
      const temporalDecay = 1.0 - (i / MAX_WINDOW) * 0.8;
      const isGood = d.outcomeQuality === "good";

      // Track lineage
      const lin = d.chosen.lineage;
      if (!linTracker[lin]) linTracker[lin] = { goodScale: 0, badScale: 0, count: 0 };
      linTracker[lin].count += 1;
      if (isGood) linTracker[lin].goodScale += temporalDecay;
      else linTracker[lin].badScale += temporalDecay;

      // Track indicators for push mechanisms
      if (!isGood) {
        // Se deu ruim e o escolhido tinha cluster altíssimo, empurrar o motor global de antiClusterPush
        if (d.chosen.clusterVal > 0.6) aggClusterModifier += temporalDecay * 1.5;
        // Se deu ruim e diversidade era baixa, subir o exploration.
        if (d.chosen.diversity < 0.4) aggDiversityModifier += temporalDecay;
      }

      // Track numbers se salvos
      if (d.chosen.numbers && Array.isArray(d.chosen.numbers)) {
        const gameZoneCounts: Record<string, number> = {};

        d.chosen.numbers.forEach((n) => {
          if (!numTracker[n]) numTracker[n] = { goodScale: 0, badScale: 0, count: 0 };
          numTracker[n].count += 1;
          if (isGood) numTracker[n].goodScale += temporalDecay;
          else numTracker[n].badScale += temporalDecay;

          const z = this.getZoneFor(n);
          gameZoneCounts[z] = (gameZoneCounts[z] || 0) + 1;
        });

        // Registrar o impacto do território na decisão global
        Object.keys(gameZoneCounts).forEach((z) => {
          if (!zoneTracker[z]) zoneTracker[z] = { goodScale: 0, badScale: 0, count: 0 };
          zoneTracker[z].count += 1;
          // Peso da zona perante a relevância nos números do jogo
          const scopeWeight = gameZoneCounts[z] / 50;
          if (isGood) {
            zoneTracker[z].goodScale += temporalDecay * scopeWeight;
          } else {
            zoneTracker[z].badScale += temporalDecay * scopeWeight;
            // Penalidade adicional: concentração nociva (> 8 dezenas na mesma zona e o jogo foi ruim)
            if (gameZoneCounts[z] > 8) {
              aggClusterModifier += temporalDecay * 1.2;
            }
          }
        });
      }
    });

    // Compilation - Numbers
    let boostedCount = 0;
    let penalizedCount = 0;
    Object.keys(numTracker).forEach((key) => {
      const n = Number(key);
      const meta = numTracker[n];
      // Anti-overfitting rule 1: Ignorar se ocorreu pouco na janela
      if (meta.count < 2) return;

      const balance = (meta.goodScale * 0.02) - (meta.badScale * 0.015);
      if (balance > 0.005) {
        output.numberPressure[n] = clamp(balance, 0, 0.12);
        boostedCount++;
      } else if (balance < -0.005) {
        output.numberPressure[n] = clamp(balance, -0.12, 0);
        penalizedCount++;
      }
    });

    // Compilation - Lineages
    Object.keys(linTracker).forEach((lin) => {
      const meta = linTracker[lin];
      if (meta.count < 2) return;
      const balance = (meta.goodScale * 0.02) - (meta.badScale * 0.01);
      output.lineagePreference[lin] = clamp(balance, -0.2, 0.2);
    });

    // Compilation - Territory (Diminishing Returns & Dominance Control)
    let boostedZones = 0;
    let penalizedZones = 0;
    let totalPositivePressure = 0;
    let dominanceDetected = false;
    const rawTerritory: Record<string, number> = {};

    Object.keys(zoneTracker).forEach((z) => {
      const meta = zoneTracker[z];
      if (meta.count < 2) return; // Anti-overfitting

      // Diminuindo retornos para impedir saturação linear
      const saturatedGood = Math.log10(1 + meta.goodScale) * 0.15;
      const saturatedBad = Math.log10(1 + meta.badScale) * 0.1;
      const balance = saturatedGood - saturatedBad;

      rawTerritory[z] = balance;
      if (balance > 0) totalPositivePressure += balance;
    });

    // Detecção de Dominância
    const sortedZones = Object.entries(rawTerritory).sort((a, b) => b[1] - a[1]);
    if (sortedZones.length > 0 && totalPositivePressure > 0) {
      const topZoneWeight = sortedZones[0][1] / totalPositivePressure;
      if (topZoneWeight > 0.45) {
        dominanceDetected = true;
        // Equilíbrio Forçado
        aggDiversityModifier += 0.5 * MAX_WINDOW;
      }
    }

    // Normalização Global (Limite total = 25% * 0.10 base da engine = 0.025 global distribuido? Não, usaremos 0.25 como teto da soma e INDIVIDUAL_LIMIT)
    const LIMIT_TOTAL = 0.25;
    const normFactorPos = totalPositivePressure > LIMIT_TOTAL ? LIMIT_TOTAL / totalPositivePressure : 1.0;
    const INDIVIDUAL_LIMIT = 0.035;

    const clampedZonesInfo: string[] = [];
    Object.keys(rawTerritory).forEach((z) => {
      const b = rawTerritory[z];
      if (b > 0.002) {
        const finalP = clamp(b * normFactorPos, 0, INDIVIDUAL_LIMIT);
        output.territoryPressure[z] = finalP;
        boostedZones++;
        if (finalP >= INDIVIDUAL_LIMIT) clampedZonesInfo.push(`${z}: capped`);
      } else if (b < -0.002) {
        output.territoryPressure[z] = clamp(b, -0.06, 0);
        penalizedZones++;
      }
    });

    // Pushes globais
    const normAgg = (val: number) => clamp(val / MAX_WINDOW, 0, 1.0);
    output.diversityPush = normAgg(aggDiversityModifier);
    output.antiClusterPush = normAgg(aggClusterModifier);
    output.explorationPush = normAgg(aggDiversityModifier * 0.8);

    console.log(
      `[TERRITORY CONTROL]\n` +
      `  scenario:           ${scenario}\n` +
      `  dominanceDetected:  ${dominanceDetected}\n` +
      `  totalPositive:      ${totalPositivePressure.toFixed(4)}\n` +
      `  normFactor:         ${normFactorPos.toFixed(4)}\n` +
      `  clampedZones:       ${clampedZonesInfo.length > 0 ? clampedZonesInfo.join(', ') : 'none'}\n` +
      `  boostedZonesCount:  ${boostedZones}\n` +
      `  penalizedZonesCount:${penalizedZones}\n` +
      `  antiClusterPush:    ${output.antiClusterPush.toFixed(3)}\n`
    );

    return output;
  }
};
