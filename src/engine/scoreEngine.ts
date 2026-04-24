import { Dezena, ScoreBreakdown, GameMetrics, LineageId, StructuralBias } from "./lotteryTypes";
import { coverageScore, gridCoverageScore, distributionScore, clusterPenalty, territoryScore, computeMetrics } from "./coverageEngine";
import { antiBiasScore, recencyPenalty } from "./antiBiasEngine";
import { diversityVsSet } from "./diversityEngine";

export interface ScoreContext {
  usage: number[];           // territoryUsage snapshot
  reference: Dezena[][];     // outros jogos do lote (para diversidade)
  recentDraws: Dezena[][];   // últimas N draws para anti-recency
  lineage: LineageId;
  structuralBias?: StructuralBias; // pressões contextuais mapeadas pela experiência do Arbiter
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

  let structuralAffinity = 0;
  if (ctx.structuralBias) {
    // 1. Modificador Numérico (Number Pressure) & Geográfico (Zonas)
    let numMod = 0;
    let terrMod = 0;
    const zoneCounts: Record<string, number> = {};

    for (const num of numbers) {
      // Track numbers
      if (ctx.structuralBias.numberPressure[num]) {
        numMod += ctx.structuralBias.numberPressure[num];
      }

      // Track Zones (Z0 a Z9)
      const z = num === 0 ? "Z0" : "Z" + Math.floor(Math.min(99, Math.max(0, num)) / 10);
      zoneCounts[z] = (zoneCounts[z] || 0) + 1;
      if (ctx.structuralBias.territoryPressure[z]) {
        terrMod += ctx.structuralBias.territoryPressure[z];
      }
    }

    // Limitador rígido duplo (clampar variação total evitando domination absoluto)
    structuralAffinity += Math.max(-0.15, Math.min(0.15, numMod / 20));
    structuralAffinity += Math.max(-0.10, Math.min(0.10, terrMod / 35));

    // 2. Modificador de Estruturas Físicas
    if (ctx.structuralBias.diversityPush > 0) {
      // amplifica levemente o score da diversidade
      div = Math.min(1.0, div * (1 + ctx.structuralBias.diversityPush * 0.4));
    }
    if (ctx.structuralBias.antiClusterPush > 0) {
      // cl (quanto mais alto, menos clusters ruins). Punir concentrações por excesso na mesma ZONA e por proximidade.
      let maxConcentration = 0;
      for (const k in zoneCounts) maxConcentration = Math.max(maxConcentration, zoneCounts[k]);

      if (maxConcentration > 8) {
        cl = Math.max(0, cl - ctx.structuralBias.antiClusterPush * 0.6); // forte penalty pro candidate superlotado
      } else {
        cl = Math.max(0, cl - ctx.structuralBias.antiClusterPush * 0.3); // penalty leve se nao ta superlotado mas tem clusters adjacentes
      }
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
    structuralAffinity;

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
