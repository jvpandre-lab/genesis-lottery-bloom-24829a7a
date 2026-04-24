import { Dezena, ScoreBreakdown, GameMetrics, LineageId, StructuralBias, AdaptiveInstinct, MetaBias } from "./lotteryTypes";
import { coverageScore, gridCoverageScore, distributionScore, clusterPenalty, territoryScore, computeMetrics } from "./coverageEngine";
import { antiBiasScore, recencyPenalty } from "./antiBiasEngine";
import { diversityVsSet } from "./diversityEngine";

export interface ScoreContext {
  usage: number[];           // territoryUsage snapshot
  reference: Dezena[][];     // outros jogos do lote (para diversidade)
  recentDraws: Dezena[][];   // últimas N draws para anti-recency
  lineage: LineageId;
  structuralBias?: StructuralBias; // pressões contextuais mapeadas pela experiência do Arbiter
  adaptiveInstinct?: AdaptiveInstinct; // limitadores orgânicos e impulsos fisiológicos
  metaBias?: MetaBias; // refinamento por padrões estruturais aprendidos (meta-learning)
}

/** Pesos por linhagem — cada linhagem otimiza diferentes dimensões. */
export function weightsFor(lineage: LineageId) {
  switch (lineage) {
    case "conservative": return { coverage: 0.28, distribution: 0.30, diversity: 0.10, territory: 0.07, antiBias: 0.10, cluster: 0.15 };
    case "dispersive": return { coverage: 0.22, distribution: 0.18, diversity: 0.20, territory: 0.18, antiBias: 0.10, cluster: 0.12 };
    case "coverage": return { coverage: 0.34, distribution: 0.18, diversity: 0.14, territory: 0.14, antiBias: 0.08, cluster: 0.12 };
    case "anticrowd": return { coverage: 0.18, distribution: 0.14, diversity: 0.18, territory: 0.10, antiBias: 0.30, cluster: 0.10 };
    case "hybrid": return { coverage: 0.22, distribution: 0.20, diversity: 0.18, territory: 0.14, antiBias: 0.16, cluster: 0.10 };
    case "chaotic": return { coverage: 0.16, distribution: 0.14, diversity: 0.22, territory: 0.22, antiBias: 0.18, cluster: 0.08 };
  }
}

export function scoreGame(numbers: Dezena[], ctx: ScoreContext, metrics?: GameMetrics): ScoreBreakdown {
  const m = metrics ?? computeMetrics(numbers);
  let cov = (coverageScore(m) * 0.6 + gridCoverageScore(m) * 0.4);
  let dist = distributionScore(m);
  let div = diversityVsSet(numbers, ctx.reference);
  let terr = territoryScore(numbers, ctx.usage);
  let ab = antiBiasScore(numbers, m) * recencyPenalty(numbers, ctx.recentDraws);
  let cl = clusterPenalty(m);

  // Peso do Instinto sobre as pressões do bias estrutural (0.2 em RECOVERY, 1.0 em CONSERVATIVE)
  const instinctBiasWeight = ctx.adaptiveInstinct ? ctx.adaptiveInstinct.structuralBiasWeight : 1.0;

  let structuralAffinity = 0;
  if (ctx.structuralBias) {
    // 1. Modificador Numérico (Number Pressure) & Geográfico (Zonas)
    let numMod = 0;
    let terrMod = 0;
    const zoneCounts: Record<string, number> = {};

    for (const num of numbers) {
      if (ctx.structuralBias.numberPressure[num]) {
        numMod += ctx.structuralBias.numberPressure[num];
      }
      const z = num === 0 ? "Z0" : "Z" + Math.floor(Math.min(99, Math.max(0, num)) / 10);
      zoneCounts[z] = (zoneCounts[z] || 0) + 1;
      if (ctx.structuralBias.territoryPressure[z]) {
        terrMod += ctx.structuralBias.territoryPressure[z];
      }
    }

    // Peso do instinto modera as pressões aprendidas (RECOVERY suprime viés antigo)
    structuralAffinity += Math.max(-0.15, Math.min(0.15, numMod / 20)) * instinctBiasWeight;
    structuralAffinity += Math.max(-0.10, Math.min(0.10, terrMod / 35)) * instinctBiasWeight;

    // 2. Modificadores de estrutura: combinam bias + impulso instintivo
    const extraDiversity = ctx.adaptiveInstinct ? ctx.adaptiveInstinct.diversityBoost : 0;
    const combinedDiversityPush = ctx.structuralBias.diversityPush + extraDiversity;
    if (combinedDiversityPush > 0) {
      div = Math.min(1.0, div * (1 + combinedDiversityPush * 0.4));
    }

    const extraAntiCluster = ctx.adaptiveInstinct ? ctx.adaptiveInstinct.antiClusterBoost : 0;
    const combinedClusterPush = ctx.structuralBias.antiClusterPush + extraAntiCluster;
    if (combinedClusterPush > 0) {
      let maxConcentration = 0;
      for (const k in zoneCounts) maxConcentration = Math.max(maxConcentration, zoneCounts[k]);
      if (maxConcentration > 8) {
        cl = Math.max(0, cl - combinedClusterPush * 0.6);
      } else {
        cl = Math.max(0, cl - combinedClusterPush * 0.3);
      }
    }
  }

  // 3. Aplicação do META-APRENDIZADO
  let metaModifier = 0;
  if (ctx.metaBias) {
    const { preferredPatterns, avoidedPatterns, diversityPreference, clusterPenaltyLevel } = ctx.metaBias;

    // Recompilar dispersionPattern do candidate atual
    const zoneCounts: Record<string, number> = {};
    for (const num of numbers) {
      const z = num === 0 ? "Z0" : "Z" + Math.floor(Math.min(99, Math.max(0, num)) / 10);
      zoneCounts[z] = (zoneCounts[z] || 0) + 1;
    }
    let maxConc = 0;
    for (const k in zoneCounts) { if (zoneCounts[k] > maxConc) maxConc = zoneCounts[k]; }
    const dispersionPattern = maxConc > 8 ? "concentrado" : maxConc < 5 ? "espalhado" : "misto";

    // Match de assinatura com as preferências históricas
    const matchGood = preferredPatterns.some(p => p.dispersionPattern === dispersionPattern && p.lineage === ctx.lineage);
    const matchBad = avoidedPatterns.some(p => p.dispersionPattern === dispersionPattern && p.lineage === ctx.lineage);

    if (matchGood) metaModifier += 0.05;
    if (matchBad) metaModifier -= 0.05;

    // Aplicar ajustes baseados em macro-learning
    if (clusterPenaltyLevel > 0 && maxConc > 8) {
      cl = Math.max(0, cl - (clusterPenaltyLevel * 0.15));
    }
    if (diversityPreference > -1) {
      div = Math.min(1.0, div * (1 + diversityPreference * 0.15));
    }
  }

  const w = weightsFor(ctx.lineage);
  const total =
    cov * w.coverage +
    dist * w.distribution +
    div * w.diversity +
    terr * w.territory +
    ab * w.antiBias +
    cl * w.cluster +
    structuralAffinity +
    metaModifier;

  return {
    coverage: cov,
    distribution: dist,
    diversity: div,
    territory: terr,
    antiBias: ab,
    clusterPenalty: cl,
    structuralAffinity,
    total: Math.max(0, Math.min(1, total)),
  };
}
