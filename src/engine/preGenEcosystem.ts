// Pre-Generation Ecosystem — P5 FIX
// Lê o estado de todos os engines do ecossistema ANTES da geração
// e produz um PreGenContext que influencia geração, seleção e arbitragem.

import { globalPressure } from "./adaptivePressureEngine";
import { brainTensionEngine } from "./brainTensionEngine";
import { CycleHealth, cycleMemoryEngine } from "./cycleMemoryEngine";
import { lineageDriftEngine } from "./lineageDriftEngine";
import {
  BatchName,
  DrawRecord,
  GenerationResult,
  LineageId,
  Scenario,
} from "./lotteryTypes";
import { metaTerritoryEngine } from "./metaTerritoryEngine";
import { scenarioEvolutionEngine } from "./scenarioEvolutionEngine";
import { TacticalRole } from "./tacticalRoleEngine";

/**
 * Contexto pré-geração produzido pelo ecossistema.
 * Influencia: pesos territoriais, cenário, targetBalance, mutationRate,
 * linhagens penalizadas, papéis táticos necessários por lote.
 */
export interface PreGenContext {
  /** Dezenas saturadas: peso reduzido nos geradores [0..99]. */
  weightModifiers: number[];
  /** Cenário escolhido pelo ScenarioEvolutionEngine (ou null para usar o do usuário). */
  scenarioOverride: Scenario | null;
  /** Ajuste no targetBalanceA do árbitro. -0.2..+0.2 */
  targetBalanceAdjustment: number;
  /** Ajuste na taxa de mutação base. -0.05..+0.15 */
  mutationRateModifier: number;
  /** Linhagens em drift — recebem penalidade de score. */
  lineagePenalties: Partial<Record<LineageId, number>>;
  /** Papéis táticos que ainda faltam no lote (por batch). */
  tacticalNeeds: Partial<Record<BatchName, TacticalRole[]>>;
  /** Quantidade de zonas saturadas detectadas. */
  pressureZonesCount: number;
  /** Quantidade de blind zones detectadas. */
  blindZonesCount: number;
  /** False diversity detectada. */
  falseDiversityDetected: boolean;
  /** Direção do drift territorial, se aplicado. */
  territoryDrift?: { direction: string; magnitude: number };
  /** Razões do contexto pré-gen (para diagnóstico). */
  reasons: string[];
  /** Saúde do ciclo obtida do CycleMemoryEngine. */
  cycleHealth: CycleHealth | null;
  /** True se o ecossistema tem dados suficientes para influenciar. */
  hasData: boolean;
}

/**
 * Constrói o PreGenContext lendo o estado atual de todos os engines
 * antes de iniciar a geração.
 */
export function buildPreGenContext(
  recentResults: GenerationResult[],
  allDraws: DrawRecord[],
  scenario: Scenario,
): PreGenContext {
  const DOMAIN = 100;
  const weightModifiers = new Array(DOMAIN).fill(1.0);
  const reasons: string[] = [];
  let scenarioOverride: Scenario | null = null;
  let targetBalanceAdjustment = 0;
  let mutationRateModifier = 0;
  const lineagePenalties: Partial<Record<LineageId, number>> = {};
  let tacticalNeeds: Partial<Record<BatchName, TacticalRole[]>> = {};
  let pressureZonesCount = 0;
  let blindZonesCount = 0;
  let falseDiversityDetected = false;
  let territoryDrift: { direction: string; magnitude: number } | undefined;
  let cycleHealth: CycleHealth | null = null;

  if (recentResults.length === 0) {
    return {
      weightModifiers,
      scenarioOverride: null,
      targetBalanceAdjustment: 0,
      mutationRateModifier: 0,
      lineagePenalties: {},
      tacticalNeeds: {},
      pressureZonesCount: 0,
      blindZonesCount: 0,
      falseDiversityDetected: false,
      territoryDrift: undefined,
      cycleHealth: null,
      reasons: ["Sem histórico de gerações — contexto neutro."],
      hasData: false,
    };
  }

  // ── 1. MetaTerritoryEngine → pesos por dezena ──────────────────────────
  try {
    metaTerritoryEngine.updateHistoricalDraws(allDraws);
    for (const r of recentResults.slice(-5))
      metaTerritoryEngine.observeGeneration(r);
    const analysis = metaTerritoryEngine.analyze();

    // Zona saturada: reduzir peso
    for (const z of analysis.pressureZones.zones) {
      const idx = z.dezena as number;
      if (idx >= 0 && idx < DOMAIN) {
        weightModifiers[idx] = Math.max(0.1, 1 / Math.sqrt(z.pressure));
      }
    }
    if (analysis.pressureZones.zones.length > 0) {
      pressureZonesCount = analysis.pressureZones.zones.length;
      reasons.push(
        `MetaTerritory: ${analysis.pressureZones.zones.length} zonas saturadas bloqueadas.`,
      );
    }

    // Zona cega: reforçar peso
    for (const z of analysis.blindZones.zones) {
      const idx = z.dezena as number;
      if (idx >= 0 && idx < DOMAIN) {
        weightModifiers[idx] = Math.min(3.5, 1 / Math.max(0.05, z.coverage));
      }
    }
    if (analysis.blindZones.zones.length > 0) {
      blindZonesCount = analysis.blindZones.zones.length;
      reasons.push(
        `MetaTerritory: ${analysis.blindZones.zones.length} blind zones reforçadas.`,
      );
    }

    // False diversity: forçar exploração
    if (analysis.falseDiversitySignals.falsePositive) {
      falseDiversityDetected = true;
      mutationRateModifier += 0.05;
      reasons.push(
        "MetaTerritory: falsa diversidade detectada — aumentando mutação.",
      );
    }

    // Drift territorial convergente: forçar exploração
    if (
      analysis.territoryDrift.direction === "converging" &&
      analysis.territoryDrift.driftMagnitude > 0.15
    ) {
      territoryDrift = {
        direction: analysis.territoryDrift.direction,
        magnitude: analysis.territoryDrift.driftMagnitude,
      };
      scenarioOverride = "exploratory";
      mutationRateModifier += 0.04;
      reasons.push(
        "MetaTerritory: drift convergente → cenário forçado para exploratory.",
      );
    }
  } catch (e) {
    reasons.push("MetaTerritory: erro ao analisar (usando pesos neutros).");
  }

  // ── 2. CycleMemoryEngine → fadiga, mutação ─────────────────────────────
  try {
    for (const r of recentResults.slice(-5))
      cycleMemoryEngine.observeGeneration(r, scenario);
    const health = cycleMemoryEngine.getCycleHealth("last5");
    cycleHealth = health;

    if (health.recoveryNeed) {
      mutationRateModifier += 0.08;
      targetBalanceAdjustment += 0.15; // favorecer Brain A (estabilidade)
      reasons.push(
        `CycleMemory: saúde baixa (${health.healthScore.toFixed(2)}) — mutação+, favorecer Brain A.`,
      );
    }
    if (health.fatigueLevel > 0.7) {
      mutationRateModifier += 0.06;
      reasons.push(
        `CycleMemory: fadiga alta (${health.fatigueLevel.toFixed(2)}) — aumentando variação.`,
      );
    }
    if (health.instability > 0.4) {
      targetBalanceAdjustment += 0.1; // estabilizar
      reasons.push(
        `CycleMemory: instabilidade alta (${health.instability.toFixed(2)}) — favorecer Brain A.`,
      );
    }
  } catch (e) {
    reasons.push("CycleMemory: erro ao calcular health.");
  }

  // ── 3. BrainTensionEngine → ajuste de balance ──────────────────────────
  try {
    const tensionReport = brainTensionEngine.getHealthReport();
    if (tensionReport.brainBStrength > 0.72) {
      // Brain B capturando demais → endurecer árbitro a favor de A
      targetBalanceAdjustment += 0.12;
      reasons.push(
        `BrainTension: Brain B muito dominante (${tensionReport.brainBStrength.toFixed(2)}) — árbitro endurecido.`,
      );
    }
    if (tensionReport.brainAStrength > 0.8) {
      // Brain A rígido demais → abrir espaço para B
      targetBalanceAdjustment -= 0.1;
      reasons.push(
        `BrainTension: Brain A rígido demais (${tensionReport.brainAStrength.toFixed(2)}) — abrindo espaço para B.`,
      );
    }
    if (tensionReport.arbitratorEffectiveness < 0.6) {
      targetBalanceAdjustment += 0.08;
      reasons.push(
        `BrainTension: árbitro sob pressão (${tensionReport.arbitratorEffectiveness.toFixed(2)}) — reforçando equilíbrio.`,
      );
    }
  } catch (e) {
    reasons.push("BrainTension: sem dados suficientes.");
  }

  // ── 4. ScenarioEvolutionEngine → cenário automático ────────────────────
  try {
    // Executar transição automática baseada em sinais reais
    const cycleHealth = cycleMemoryEngine.getCycleHealth("last5");
    const territoryAnalysis = metaTerritoryEngine.analyze();
    const pressureSignals = globalPressure.signals();

    if (cycleHealth && territoryAnalysis) {
      const evolved = scenarioEvolutionEngine.evaluateTransition(
        cycleHealth,
        territoryAnalysis.territoryDrift,
        scenario,
      );
      if (evolved && evolved !== scenario) {
        scenarioOverride = evolved;
        reasons.push(
          `ScenarioEvolution: transição automática → ${evolved} (era ${scenario}).`,
        );
        // Persistir transição sem bloquear o contexto pré-gen
        void scenarioEvolutionEngine.applyTransition(evolved).catch((err) => {
          console.warn(
            "ScenarioEvolution: falha ao persistir transição automática.",
            err,
          );
          reasons.push(
            "ScenarioEvolution: falha ao persistir transição automática.",
          );
        });
      }
    }
  } catch (e) {
    reasons.push("ScenarioEvolution: erro na transição automática.");
  }

  // ── 5. LineageDriftEngine → penalidades de linhagem ────────────────────
  try {
    for (const r of recentResults.slice(-5))
      lineageDriftEngine.recordLineageBehavior(r);
    const drifts = lineageDriftEngine.getAllDrifts();
    for (const d of drifts) {
      if (d.status === "drifting") {
        lineagePenalties[d.lineage] = 0.85; // 15% de penalidade no score
        reasons.push(`LineageDrift: ${d.lineage} em drift — penalidade 15%.`);
      } else if (d.status === "lost") {
        lineagePenalties[d.lineage] = 0.65; // 35% de penalidade
        reasons.push(
          `LineageDrift: ${d.lineage} perdeu identidade — penalidade 35%.`,
        );
      }
    }
  } catch (e) {
    reasons.push("LineageDrift: erro ao detectar drifts.");
  }

  // ── 6. TacticalNeeds → papéis táticos que faltam ───────────────────────
  // Calcular necessidades táticas baseadas no histórico e cenário
  try {
    const analysis = metaTerritoryEngine.analyze();
    const hasHighPressure = analysis.pressureZones.zones.length > 8;
    const hasManyBlind = analysis.blindZones.zones.length > 10;
    const hasFalseDiversity = analysis.falseDiversitySignals.falsePositive;
    const driftDirection = analysis.territoryDrift.direction;
    const lowCycleHealth = cycleHealth ? cycleHealth.healthScore < 0.45 : false;
    const fatigue = cycleHealth ? cycleHealth.fatigueLevel > 0.6 : false;

    const buildBatchNeeds = (
      primary: TacticalRole,
      secondary: TacticalRole,
    ): TacticalRole[] => [primary, secondary];

    tacticalNeeds = {
      Alpha: buildBatchNeeds(
        lowCycleHealth ? "Shield" : "Anchor",
        hasHighPressure
          ? "Shield"
          : driftDirection === "exploring"
            ? "Explorer"
            : "Anchor",
      ),
      Sigma: buildBatchNeeds(
        hasFalseDiversity ? "Explorer" : "Breaker",
        driftDirection === "converging" ? "AntiCrowd" : "Shield",
      ),
      Delta: buildBatchNeeds(
        hasManyBlind ? "Spreader" : "Breaker",
        hasFalseDiversity || fatigue ? "AntiCrowd" : "Explorer",
      ),
      Omega: buildBatchNeeds(
        driftDirection === "converging" ? "Breaker" : "AntiCrowd",
        driftDirection === "exploring" ? "Explorer" : "Shield",
      ),
    };
    reasons.push(
      `TacticalNeeds: calculadas dinamicamente com base em pressão=${analysis.pressureZones.zones.length}, blind=${analysis.blindZones.zones.length}, drift=${driftDirection}, falseDiversity=${hasFalseDiversity}`,
    );
  } catch (e) {
    reasons.push("TacticalNeeds: erro ao calcular necessidades.");
  }

  // Clampar ajustes
  targetBalanceAdjustment = Math.max(
    -0.25,
    Math.min(0.25, targetBalanceAdjustment),
  );
  mutationRateModifier = Math.max(-0.05, Math.min(0.15, mutationRateModifier));

  return {
    weightModifiers,
    scenarioOverride,
    targetBalanceAdjustment,
    mutationRateModifier,
    lineagePenalties,
    tacticalNeeds,
    pressureZonesCount,
    blindZonesCount,
    falseDiversityDetected,
    territoryDrift,
    cycleHealth,
    reasons,
    hasData: true,
  };
}
