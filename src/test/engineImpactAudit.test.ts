/**
 * Engine Impact Audit
 * Validação direta dos novos mecanismos em geração e backtest real.
 */
import fs from "fs";
import { describe, it } from "vitest";
import { generate, GenerateInput } from "@/engine/generatorCore";
import { mulberry32 } from "@/engine/rng";
import { DrawRecord, Dezena } from "@/engine/lotteryTypes";

async function fetchDraws(): Promise<any[]> {
    const response = await fetch("https://loteriascaixa-api.herokuapp.com/api/lotomania");
    if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
    return await response.json();
}

function parseDezenas(rawDezenas: string[]): Dezena[] {
    return rawDezenas.map(d => parseInt(d, 10) as Dezena).sort((a, b) => a - b);
}

function countHits(game: Dezena[], real: Dezena[]): number {
    const set = new Set(real);
    let hits = 0;
    for (const n of game) if (set.has(n)) hits++;
    return hits;
}

interface Stats {
    totalGames: number;
    totalHits: number;
    poorGames: number;
    hits15plus: number;
    hits16plus: number;
    hits17plus: number;
    hits18plus: number;
    hits19plus: number;
    hits20: number;
    hitValues: number[];
    scenarioCounts: Record<string, number>;
}

function makeStats(): Stats {
    return {
        totalGames: 0,
        totalHits: 0,
        poorGames: 0,
        hits15plus: 0,
        hits16plus: 0,
        hits17plus: 0,
        hits18plus: 0,
        hits19plus: 0,
        hits20: 0,
        hitValues: [],
        scenarioCounts: {},
    };
}

function updateStats(stats: Stats, game: any, real: Dezena[]) {
    const hits = countHits(game.numbers, real);
    stats.totalGames += 1;
    stats.totalHits += hits;
    stats.hitValues.push(hits);
    if (hits === 15) stats.hits15plus++;
    if (hits === 16) stats.hits16plus++;
    if (hits === 17) stats.hits17plus++;
    if (hits === 18) stats.hits18plus++;
    if (hits === 19) stats.hits19plus++;
    if (hits === 20) stats.hits20++;
    if (hits < 10) stats.poorGames++;
    const scenario = game.scenario ?? "hybrid";
    stats.scenarioCounts[scenario] = (stats.scenarioCounts[scenario] || 0) + 1;
}

function stddev(arr: number[]) {
    const n = arr.length;
    if (n === 0) return 0;
    const mean = arr.reduce((s, v) => s + v, 0) / n;
    return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
}

async function runComparison(draws: any[], maxDraws: number, gamesPerDraw: number) {
    const nDraws = draws.length;
    const startIdx = Math.max(0, nDraws - maxDraws);
    let historyDraws: DrawRecord[] = draws.slice(0, startIdx).map(d => ({
        contestNumber: d.concurso,
        drawDate: d.data,
        numbers: parseDezenas(d.dezenas),
    }));
    let recentResults: any[] = [];
    const statsA = makeStats();
    const statsB = makeStats();
    const diversityA: number[] = [];
    const diversityB: number[] = [];
    const territoryEntropyA: number[] = [];
    const territoryEntropyB: number[] = [];

    for (let i = startIdx; i < nDraws; i++) {
        const real = parseDezenas(draws[i].dezenas);
        const contest = draws[i].concurso;
        const seed = contest * 10;

        const inputA: GenerateInput = {
            count: gamesPerDraw,
            scenario: "hybrid",
            recentDraws: historyDraws.slice(-10),
            recentResults: [],
            rng: mulberry32(seed),
            twoBrains: false,
            disableEngines: {
                preGenEcosystem: true,
                diversity: true,
                coverage: true,
                batchObjective: true,
            },
        };
        const inputB: GenerateInput = {
            count: gamesPerDraw,
            scenario: "hybrid",
            recentDraws: historyDraws.slice(-15),
            recentResults,
            rng: mulberry32(seed),
            twoBrains: true,
            disableEngines: {},
        };

        const [resA, resB] = await Promise.all([generate(inputA), generate(inputB)]);
        recentResults = [...recentResults, resB].slice(-5);

        resA.batches.flatMap(b => b.games).forEach(game => updateStats(statsA, game, real));
        resB.batches.flatMap(b => b.games).forEach(game => updateStats(statsB, { ...game, scenario: resB.scenario }, real));
        diversityA.push(resA.metrics.avgDiversity ?? 0);
        diversityB.push(resB.metrics.avgDiversity ?? 0);
        territoryEntropyA.push(resA.metrics.territoryEntropy ?? 0);
        territoryEntropyB.push(resB.metrics.territoryEntropy ?? 0);

        historyDraws.push({ contestNumber: contest, drawDate: draws[i].data, numbers: real });
    }

    return {
        statsA,
        statsB,
        diversityA: diversityA.reduce((s, v) => s + v, 0) / Math.max(1, diversityA.length),
        diversityB: diversityB.reduce((s, v) => s + v, 0) / Math.max(1, diversityB.length),
        saturationA: territoryEntropyA.reduce((s, v) => s + v, 0) / Math.max(1, territoryEntropyA.length),
        saturationB: territoryEntropyB.reduce((s, v) => s + v, 0) / Math.max(1, territoryEntropyB.length),
        stabilityA: stddev(statsA.hitValues),
        stabilityB: stddev(statsB.hitValues),
    };
}

async function auditCase() {
    const draws = await fetchDraws();
    const report: any = {};
    report["50"] = await runComparison(draws, 50, 6);
    report["100"] = await runComparison(draws, 100, 6);
    fs.writeFileSync("engine_impact_audit.json", JSON.stringify(report, null, 2));
    return report;
}

async function samplePreGenImpact(draws: any[]) {
    const historyDraws: DrawRecord[] = draws.slice(0, 20).map(d => ({ contestNumber: d.concurso, drawDate: d.data, numbers: parseDezenas(d.dezenas) }));
    const recentResults: any[] = [];
    const baseInput: GenerateInput = {
        count: 6,
        scenario: "hybrid",
        recentDraws: historyDraws.slice(-15),
        recentResults,
        rng: mulberry32(1234),
        twoBrains: true,
    };
    const enabled = await generate({ ...baseInput, disableEngines: {} });
    const disabled = await generate({ ...baseInput, disableEngines: { preGenEcosystem: true } });
    return {
        enabled: {
            scenario: enabled.scenario,
            avgDiversity: enabled.metrics.avgDiversity,
            territoryEntropy: enabled.metrics.territoryEntropy,
            preGenContext: enabled.diagnostics.preGenContext?.reasons ?? [],
            overallObjectiveScore: enabled.diagnostics.overallObjectiveScore,
        },
        disabled: {
            scenario: disabled.scenario,
            avgDiversity: disabled.metrics.avgDiversity,
            territoryEntropy: disabled.metrics.territoryEntropy,
            overallObjectiveScore: disabled.diagnostics.overallObjectiveScore,
            preGenContext: disabled.diagnostics.preGenContext,
        },
    };
}

async function runAudit() {
    const draws = await fetchDraws();
    const report = await auditCase();
    report.sample = await samplePreGenImpact(draws);
    fs.writeFileSync("engine_impact_audit.json", JSON.stringify(report, null, 2));
    return report;
}

describe("Engine Impact Audit", () => {
    it("runs the audit and writes engine_impact_audit.json", async () => {
        const report = await runAudit();
        console.log(JSON.stringify(report, null, 2));
    }, 900000);
});
