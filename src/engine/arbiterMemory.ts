import { supabase } from "@/integrations/supabase/client";
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
}

export interface DecisionContext {
  batchName: BatchName;
  scenario: Scenario;
  mutationRate: number;
  balanceA: number;
  balanceAAdjustment: number;
  slot: number;
}

export interface ArbiterDecisionRecord {
  id: string;
  createdAt: string;
  chosen: DecisionCandidateSnapshot;
  rejected: DecisionCandidateSnapshot;
  context: DecisionContext;
  good: boolean;
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
  updatedAt: string;
}

function createStats(): BrainStats {
  return { wins: 0, losses: 0, total: 0, scoreDelta: 0 };
}

function createScenarioStats(): ScenarioBrainStats {
  return { A: createStats(), B: createStats() };
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
  updatedAt: new Date().toISOString(),
};

function hasLocalStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function loadState(): ArbiterMemoryState {
  try {
    // Try to load from database first
    const dbState = loadStateFromDB();
    if (dbState) return dbState;
  } catch (error) {
    console.warn(
      "Failed to load arbiter memory from database, falling back to localStorage",
      error,
    );
  }

  // Fallback to localStorage
  if (!hasLocalStorage()) return JSON.parse(JSON.stringify(DEFAULT_STATE));
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) return JSON.parse(JSON.stringify(DEFAULT_STATE));
    const parsed = JSON.parse(serialized) as ArbiterMemoryState;
    return {
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
      decisions: Array.isArray(parsed.decisions)
        ? parsed.decisions.slice(-MAX_DECISIONS)
        : [],
      errors: parsed.errors ?? {},
      updatedAt: parsed.updatedAt ?? DEFAULT_STATE.updatedAt,
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

async function loadStateFromDB(): Promise<ArbiterMemoryState | null> {
  const { data, error } = await supabase
    .from("arbiter_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_DECISIONS);

  if (error || !data) return null;

  const decisions: ArbiterDecisionRecord[] = data.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    chosen: row.scores?.chosen || {
      brain: "A",
      lineage: "A1",
      scoreTotal: 0,
      diversity: 0,
      coverageVal: 0,
      clusterVal: 0,
      value: 0,
    },
    rejected: row.scores?.rejected || {
      brain: "B",
      lineage: "B1",
      scoreTotal: 0,
      diversity: 0,
      coverageVal: 0,
      clusterVal: 0,
      value: 0,
    },
    context: {
      batchName: row.batch || "unknown",
      scenario: row.scenario || "conservative",
      mutationRate: row.mutation_rate || 0,
      balanceA: row.balance_a || 0.5,
      balanceAAdjustment: 0,
      slot: 0,
    },
    good: row.decision === "chosen",
  }));

  // Rebuild stats from decisions
  const stats = { ...DEFAULT_STATE.stats };
  const errors: Record<string, number> = {};

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
  }

  return {
    decisions,
    stats,
    errors,
    updatedAt: new Date().toISOString(),
  };
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

function persistDecisionToDB(record: ArbiterDecisionRecord): void {
  supabase
    .from("arbiter_decisions")
    .insert({
      decision: record.good ? "chosen" : "rejected",
      chosen_brain: record.chosen.brain,
      rejected_brain: record.rejected.brain,
      scores: {
        chosen: record.chosen,
        rejected: record.rejected,
      },
      scenario: record.context.scenario,
      batch: record.context.batchName,
      mutation_rate: record.context.mutationRate,
      balance_a: record.context.balanceA,
    })
    .then(({ error }) => {
      if (error)
        console.warn("Failed to persist arbiter decision to database", error);
    });
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

let state: ArbiterMemoryState = loadState();

export const arbiterMemory = {
  getState(): ArbiterMemoryState {
    return state;
  },

  reset(): void {
    state = loadState();
    state.decisions = [];
    state.stats = {
      conservative: createScenarioStats(),
      hybrid: createScenarioStats(),
      aggressive: createScenarioStats(),
      exploratory: createScenarioStats(),
    };
    state.errors = {};
    saveState(state);
  },

  getSummary(): {
    decisionCount: number;
    successRates: Record<Scenario, { A: number; B: number }>;
    updatedAt: string;
  } {
    return {
      decisionCount: state.decisions.length,
      updatedAt: state.updatedAt,
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

    // Persist to database
    persistDecisionToDB(fullRecord);

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

    // Update in database
    supabase
      .from("arbiter_decisions")
      .update({ decision: actualGood ? "chosen" : "rejected" })
      .eq("id", id)
      .then(({ error }) => {
        if (error)
          console.warn("Failed to update arbiter decision in database", error);
      });

    saveState(state);
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
};
