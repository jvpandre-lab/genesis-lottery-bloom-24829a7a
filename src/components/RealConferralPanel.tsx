import { useState, useEffect, useCallback, useRef } from "react";
import {
    CheckCircle2, Clock, AlertTriangle, Loader2, RefreshCw,
    ChevronDown, ChevronUp, Activity, Brain, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
    fetchRecentDraws,
    fetchRecentGenerations,
    fetchRecentRealDraws,
    getLatestContestNumber,
    fetchDrawByContest,
} from "@/services/storageService";
import { countHits } from "@/engine/backtestEngine";
import { arbiterMemory } from "@/engine/arbiterMemory";
import { supabase } from "@/integrations/supabase/client";
import {
    GenerationResult, Scenario,
    AdaptiveInstinct, SystemHealth, ArbiterMemorySummary, MetaBias,
} from "@/engine/lotteryTypes";
import { cn } from "@/lib/utils";

// ─── Tipos locais ──────────────────────────────────────────────────────────────

type AutoStatus = "idle" | "checking" | "pending" | "continuous" | "learned" | "already-learned" | "partial" | "error";

interface GameResult {
    index: number;
    numbers: number[];
    lineage: string;
    decisionId?: string;
    hits: number;
    hitNumbers: number[];
    quality: "good" | "neutral" | "bad" | null;
    outcome: "learned" | "duplicate" | "blocked" | "no-decision";
}

interface LearningReport {
    contestNumber: number;
    targetContestNumber: number;
    scenario: Scenario;
    mode: "exact-target" | "target-minus-one";
    totalGames: number;
    learned: number;
    duplicate: number;
    blocked: number;
    noDecision: number;
    avgHits: number;
    bestHits: number;
    worstHits: number;
    goodCount: number;
    neutralCount: number;
    badCount: number;
    games: GameResult[];
}

interface OrganismSnapshot {
    instinct: AdaptiveInstinct;
    health: SystemHealth;
    summary: ArbiterMemorySummary;
    metaBias: MetaBias;
    learnedCount: number;
    boostedZones: string[];
    penalizedZones: string[];
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function GameNumbers({ numbers, hitNumbers }: { numbers: number[]; hitNumbers: number[] }) {
    const hitSet = new Set(hitNumbers);
    return (
        <div className="flex flex-wrap gap-[2px] mt-1">
            {numbers.map((n) => (
                <span
                    key={n}
                    className={cn(
                        "inline-flex items-center justify-center w-[22px] h-[18px] rounded text-[8px] font-mono font-bold select-none",
                        hitSet.has(n)
                            ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                            : "bg-surface-2/20 text-foreground/25 border border-border/15",
                    )}
                >
                    {n.toString().padStart(2, "0")}
                </span>
            ))}
        </div>
    );
}

function QualityBadge({ quality }: { quality: "good" | "neutral" | "bad" | null }) {
    if (!quality) return null;
    const cfg = {
        good: { label: "Bom", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
        neutral: { label: "Neutro", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
        bad: { label: "Ruim", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    }[quality];
    return (
        <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-semibold", cfg.cls)}>
            {cfg.label}
        </span>
    );
}

function OrganismPanel({ snap }: { snap: OrganismSnapshot }) {
    const modeColor: Record<string, string> = {
        balanced: "text-blue-400", recovery: "text-red-400",
        exploration: "text-purple-400", conservative: "text-emerald-400",
    };
    const healthColor: Record<string, string> = {
        healthy: "text-emerald-400", warning: "text-amber-400", critical: "text-red-400",
    };
    const Row = ({ label, value, cls }: { label: string; value: string; cls?: string }) => (
        <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn("font-mono font-medium", cls)}>{value}</span>
        </div>
    );
    return (
        <div className="space-y-3 pt-2">
            {/* Instinto */}
            <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1 mb-1.5">
                    <Zap className="h-3 w-3" /> Instinto Adaptativo
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-[3px]">
                    <Row label="Modo" value={snap.instinct.mode} cls={modeColor[snap.instinct.mode]} />
                    <Row label="Mutação" value={`${snap.instinct.mutationMultiplier.toFixed(2)}×`} />
                    <Row label="Diversidade" value={`${(snap.instinct.diversityBoost * 100).toFixed(0)}%`} />
                    <Row label="AntiCluster" value={`${(snap.instinct.antiClusterBoost * 100).toFixed(0)}%`} />
                </div>
            </div>
            {/* Saúde */}
            <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1 mb-1.5">
                    <Activity className="h-3 w-3" /> Saúde do Sistema
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-[3px]">
                    <Row label="Estado" value={snap.health.state} cls={healthColor[snap.health.state]} />
                    <Row label="Média hits" value={snap.health.avgHits.toFixed(1)} />
                    <Row label="Taxa baixa" value={`${(snap.health.lowHitsRate * 100).toFixed(0)}%`} />
                    <Row label="Score saúde" value={`${(snap.health.healthScore * 100).toFixed(0)}%`} />
                </div>
            </div>
            {/* Memória */}
            <div>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1 mb-1.5">
                    <Brain className="h-3 w-3" /> Memória Ativa
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-[3px]">
                    <Row label="Decisões" value={`${snap.summary.decisionCount}`} />
                    <Row label="Aprendidas" value={`${snap.learnedCount}`} />
                    <Row label="Padrões bons" value={`${snap.metaBias.preferredPatterns.length}`} cls="text-emerald-400" />
                    <Row label="Padrões ruins" value={`${snap.metaBias.avoidedPatterns.length}`} cls="text-red-400" />
                    <Row label="Pref. diversidade" value={snap.metaBias.diversityPreference.toFixed(2)} />
                    <Row label="Penalidade cluster" value={`${(snap.metaBias.clusterPenaltyLevel * 100).toFixed(0)}%`} />
                </div>
            </div>
            {/* Território */}
            {(snap.boostedZones.length > 0 || snap.penalizedZones.length > 0) && (
                <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Território</p>
                    <div className="flex flex-wrap gap-1">
                        {snap.boostedZones.map((z) => (
                            <span key={z} className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">{z}↑</span>
                        ))}
                        {snap.penalizedZones.map((z) => (
                            <span key={z} className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/15 text-red-400 border border-red-500/20">{z}↓</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RealConferralPanelProps {
    /** Geração atual em memória (state). Tem prioridade sobre o banco. */
    currentResult?: GenerationResult | null;
    /** Número inteiro de concursos no histórico. Muda após sincronização e dispara re-check. */
    drawsSyncCount?: number;
    /** Callback opcional: notifica o parent sempre que o autoStatus muda. */
    onAutoStatusChange?: (status: string) => void;
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function RealConferralPanel({ currentResult, drawsSyncCount, onAutoStatusChange }: RealConferralPanelProps) {
    // Estado do auto-aprendizado
    const [autoStatus, setAutoStatus] = useState<AutoStatus>("idle");
    const [report, setReport] = useState<LearningReport | null>(null);
    const [organism, setOrganism] = useState<OrganismSnapshot | null>(null);
    const [showGames, setShowGames] = useState(false);
    const [showOrganism, setShowOrganism] = useState(false);
    const [softInfo, setSoftInfo] = useState<{ contestCount: number; softApplied: number } | null>(null);

    // Estado do fluxo manual (preservado)
    const [busy, setBusy] = useState(false);
    const [manualStatus, setManualStatus] = useState<string | null>(null);

    // Anti-loop refs
    const isCheckingRef = useRef(false);
    const lastCheckedKeyRef = useRef<string | null>(null);

    // Elevar autoStatus ao parent quando mudar
    useEffect(() => {
        onAutoStatusChange?.(autoStatus);
    }, [autoStatus, onAutoStatusChange]);

    // ── Utilitário: capturar estado vivo do organismo ──────────────────────────
    const captureOrganism = useCallback((scenario: Scenario) => {
        try {
            const instinct = arbiterMemory.getAdaptiveInstinct();
            const health = arbiterMemory.evaluateSystemHealth();
            const summary = arbiterMemory.getSummary();
            const metaBias = arbiterMemory.getMetaBias(scenario);
            const structuralBias = arbiterMemory.getStructuralBias(scenario);
            const learnedCount = arbiterMemory
                .getState()
                .decisions.filter((d) => d.outcomeHits !== undefined).length;

            const boostedZones = Object.entries(structuralBias.territoryPressure)
                .filter(([, v]) => v > 0.002)
                .sort((a, b) => b[1] - a[1])
                .map(([z]) => z)
                .slice(0, 5);
            const penalizedZones = Object.entries(structuralBias.territoryPressure)
                .filter(([, v]) => v < -0.002)
                .sort((a, b) => a[1] - b[1])
                .map(([z]) => z)
                .slice(0, 5);

            setOrganism({ instinct, health, summary, metaBias, learnedCount, boostedZones, penalizedZones });
        } catch (e) {
            console.warn("[ORGANISM PANEL] falha ao capturar estado:", e);
        }
    }, []);

    // ── Auto-aprendizado ───────────────────────────────────────────────────────
    const runAutoCheck = useCallback(async (isManual = false) => {
        // Chave única para evitar re-checagem do mesmo estado (anti-loop)
        const checkKey = `${currentResult?.targetContestNumber ?? "none"}-${drawsSyncCount ?? 0}`;

        if (isCheckingRef.current) return;
        if (!isManual && lastCheckedKeyRef.current === checkKey) return;

        isCheckingRef.current = true;
        if (!isManual) lastCheckedKeyRef.current = checkKey;
        setAutoStatus("checking");

        try {
            await arbiterMemory.init();

            // Resolver geração-alvo (memória tem prioridade)
            type SlimGame = { numbers: number[]; lineage: string; decisionId?: string };
            let targetContest: number | null = null;
            let games: SlimGame[] = [];
            let scenario: Scenario = "hybrid";

            if (currentResult?.targetContestNumber && currentResult.batches?.length) {
                targetContest = currentResult.targetContestNumber;
                scenario = currentResult.scenario;
                games = currentResult.batches.flatMap((b) =>
                    b.games.map((g) => ({
                        numbers: g.numbers,
                        lineage: g.lineage,
                        decisionId: g.decisionId,
                    })),
                );
            } else {
                // Fallback: scan últimas gerações persistidas
                const gens = await fetchRecentGenerations(3);
                for (const gen of gens) {
                    if (gen.targetContestNumber) {
                        targetContest = gen.targetContestNumber;
                        scenario = gen.scenario;
                        games = gen.batches.flatMap((b) =>
                            b.games.map((g) => ({
                                numbers: g.numbers,
                                lineage: g.lineage,
                                decisionId: g.decisionId,
                            })),
                        );
                        break;
                    }
                }
            }

            if (!targetContest || games.length === 0) {
                setAutoStatus("idle");
                captureOrganism(scenario);
                return;
            }

            // ── PARTE 1: Resolver draw real (exact-target ou target-minus-one) ───────────────
            let resolvedDraw = await fetchDrawByContest(targetContest);
            let drawMode: "exact-target" | "target-minus-one" | null = null;

            if (resolvedDraw) {
                drawMode = "exact-target";
            } else {
                // Fallback: target - 1 é aceito por applyLearning (guard já implementado)
                const fallbackDraw = await fetchDrawByContest(targetContest - 1);
                if (fallbackDraw) {
                    resolvedDraw = fallbackDraw;
                    drawMode = "target-minus-one";
                }
            }

            console.log(
                `[AUTO CONFERRAL CHECK]\n` +
                `  targetContestNumber: ${targetContest}\n` +
                `  exactDrawFound:      ${drawMode === "exact-target"}\n` +
                `  fallbackDrawFound:   ${drawMode === "target-minus-one"}\n` +
                `  selectedDraw:        ${resolvedDraw?.contestNumber ?? "none"}\n` +
                `  mode:                ${drawMode ?? "none — modo contínuo"}`,
            );

            if (!resolvedDraw || !drawMode) {
                // ── MODO CONTÍNUO: nenhum draw válido (nem target nem target-1) ──
                setSoftInfo(null);
                try {
                    const recentDraws = await fetchRecentRealDraws(10);
                    let softApplied = 0;
                    for (const recentDraw of recentDraws) {
                        for (const game of games) {
                            if (!game.decisionId) continue;
                            const hits = countHits(game.numbers, recentDraw.numbers);
                            const r = arbiterMemory.applySoftLearning(game.decisionId, hits, recentDraw.contestNumber);
                            if (r.applied) softApplied++;
                        }
                    }
                    setSoftInfo({ contestCount: recentDraws.length, softApplied });
                    console.log(`[CONTINUOUS LEARNING] ${softApplied} soft-learnings em ${recentDraws.length} concursos recentes (NÃO persistido)`);
                } catch (e) {
                    console.warn("[CONTINUOUS LEARNING] falha:", e);
                }
                setAutoStatus("continuous");
                captureOrganism(scenario);
                return;
            }

            // ── Draw real encontrado — aprendizado real (limpar bias temporário) ──
            arbiterMemory.clearTemporaryBias();
            setSoftInfo(null);

            // Aplicar aprendizado
            const gameResults: GameResult[] = [];
            let learned = 0, duplicate = 0, blocked = 0, noDecision = 0;
            let totalHitsForAvg = 0, hitsCount = 0;
            let bestHits = 0, worstHits = Infinity;
            let goodCount = 0, neutralCount = 0, badCount = 0;

            let gameErrors = 0;

            for (let i = 0; i < games.length; i++) {
                const game = games[i];

                if (!game.decisionId) {
                    noDecision++;
                    gameResults.push({
                        index: i, numbers: game.numbers, lineage: game.lineage,
                        decisionId: undefined, hits: 0, hitNumbers: [], quality: null, outcome: "no-decision",
                    });
                    continue;
                }

                // try/catch individual: erro em 1 jogo não interrompe os outros
                try {
                    const hits = countHits(game.numbers, resolvedDraw.numbers);
                    const hitNumbers = game.numbers.filter((n) => (resolvedDraw.numbers as number[]).includes(n));
                    const quality: "good" | "neutral" | "bad" = hits >= 11 ? "good" : hits >= 9 ? "neutral" : "bad";

                    const result = arbiterMemory.applyLearning(game.decisionId, hits, resolvedDraw.contestNumber);

                    console.log(
                        `[ARBITER LEARNING RESULT]\n` +
                        `  decisionId: ${game.decisionId}\n` +
                        `  hits:       ${hits}\n` +
                        `  quality:    ${quality}\n` +
                        `  applied:    ${result.applied}\n` +
                        `  reason:     ${result.reason}`,
                    );

                    let outcome: GameResult["outcome"];
                    if (result.applied) {
                        outcome = "learned";
                        learned++;
                        if (quality === "good") goodCount++;
                        else if (quality === "neutral") neutralCount++;
                        else badCount++;
                    } else if (result.reason === "duplicate") {
                        outcome = "duplicate";
                        duplicate++;
                        if (quality === "good") goodCount++;
                        else if (quality === "neutral") neutralCount++;
                        else badCount++;
                    } else {
                        outcome = "blocked";
                        blocked++;
                    }

                    if (outcome !== "blocked") {
                        totalHitsForAvg += hits;
                        hitsCount++;
                        if (hits > bestHits) bestHits = hits;
                        if (hits < worstHits) worstHits = hits;
                    }

                    gameResults.push({
                        index: i, numbers: game.numbers, lineage: game.lineage,
                        decisionId: game.decisionId, hits, hitNumbers, quality, outcome,
                    });
                } catch (gameErr: unknown) {
                    gameErrors++;
                    console.error(`[ARBITER LEARNING] erro no jogo ${i} (decisionId=${game.decisionId}):`, gameErr);
                    gameResults.push({
                        index: i, numbers: game.numbers, lineage: game.lineage,
                        decisionId: game.decisionId, hits: 0, hitNumbers: [], quality: null, outcome: "blocked",
                    });
                }
            }

            const avgHits = hitsCount > 0 ? totalHitsForAvg / hitsCount : 0;
            const newReport: LearningReport = {
                contestNumber: resolvedDraw.contestNumber,
                targetContestNumber: targetContest,
                scenario,
                mode: drawMode,
                totalGames: games.length, learned, duplicate, blocked, noDecision,
                avgHits, bestHits, worstHits: worstHits === Infinity ? 0 : worstHits,
                goodCount, neutralCount, badCount, games: gameResults,
            };
            setReport(newReport);

            console.log(
                `[AUTO CONFERRAL APPLY]\n` +
                `  drawContestNumber: ${resolvedDraw.contestNumber}\n` +
                `  mode:              ${drawMode}\n` +
                `  learned:           ${learned}\n` +
                `  duplicates:        ${duplicate}\n` +
                `  noDecision:        ${noDecision}\n` +
                `  blocked:           ${blocked}`,
            );

            // Status final: learned > 0 nunca é sobrescrito por erro posterior
            const allAlreadyDone = duplicate + noDecision + blocked === games.length;
            if (learned > 0) {
                setAutoStatus("learned");
            } else if (allAlreadyDone && duplicate > 0) {
                setAutoStatus("already-learned");
            } else {
                setAutoStatus("partial");
            }

            captureOrganism(scenario);

            if (isManual && learned > 0) {
                toast({
                    title: "Aprendizado aplicado",
                    description: `${learned} jogo(s) aprendidos — concurso ${resolvedDraw.contestNumber} (${drawMode}).`,
                });
            }

            console.log(
                `[AUTO CONFERRAL SAFE]\n` +
                `  resolvedDraw:  ${resolvedDraw.contestNumber}\n` +
                `  mode:          ${drawMode}\n` +
                `  totalGames:    ${games.length}\n` +
                `  learned:       ${learned}\n` +
                `  duplicates:    ${duplicate}\n` +
                `  noDecision:    ${noDecision}\n` +
                `  blocked:       ${blocked}\n` +
                `  gameErrors:    ${gameErrors}`,
            );

            // Reacão imediata do organismo (apenas após aprendizado real)
            // Não é chamado em backtest nem em modo contínuo
            arbiterMemory.triggerOrganismReaction(avgHits, learned, scenario);

        } catch (e: any) {
            console.error("[AUTO LEARNING] erro:", e);
            setAutoStatus("error");
            if (isManual) {
                toast({ title: "Erro na conferência", description: e.message, variant: "destructive" });
            }
        } finally {
            isCheckingRef.current = false;
        }
    }, [currentResult, drawsSyncCount, captureOrganism]);

    // Auto-trigger: roda quando targetContestNumber ou drawsSyncCount muda
    useEffect(() => {
        runAutoCheck(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentResult?.targetContestNumber, drawsSyncCount]);

    // ── Fluxo manual preservado (fluxo validado na auditoria) ─────────────────
    const handleManualCheck = async () => {
        setBusy(true);
        setManualStatus(null);
        try {
            // Primeira tentativa: auto-check com target
            if (currentResult?.targetContestNumber) {
                await runAutoCheck(true);
                setBusy(false);
                return;
            }

            // Fallback: conferência pelo último concurso disponível (fluxo original)
            await arbiterMemory.init();
            let allGames: { numbers: number[]; lineage: string; decisionId?: string }[] = [];
            let sourceLabel = "memória";

            if (currentResult?.batches?.length) {
                allGames = currentResult.batches.flatMap((b) =>
                    b.games.map((g) => ({ numbers: g.numbers, lineage: g.lineage, decisionId: g.decisionId })),
                );
            } else {
                sourceLabel = "banco (fallback)";
                const gens = await fetchRecentGenerations(1);
                if (!gens || gens.length === 0) { setManualStatus("⚠️ Nenhuma geração encontrada"); return; }
                const lastGen = gens[0];
                const { data: bs } = await supabase.from("generation_batches").select("id").eq("generation_id", lastGen.id);
                if (!bs?.length) { setManualStatus("⚠️ Nenhuma geração encontrada"); return; }
                for (const b of bs) {
                    const { data: gms } = await supabase.from("generation_games").select("numbers, lineage, metrics").eq("batch_id", b.id);
                    if (gms) allGames.push(...gms.map((g: any) => ({ numbers: g.numbers, lineage: g.lineage, decisionId: g.metrics?.decisionId })));
                }
            }
            if (!allGames.length) { setManualStatus("⚠️ Nenhuma geração encontrada"); return; }

            const latestContest = await getLatestContestNumber();
            if (!latestContest) { setManualStatus("⚠️ Nenhum sorteio disponível"); return; }
            const draws = await fetchRecentDraws(1);
            const latestDraw = draws[0];
            if (!latestDraw) { setManualStatus("⚠️ Sorteio inconsistente"); return; }

            let learnedCount = 0, ignoredCount = 0, withoutDecisionId = 0, duplicateCount = 0, blockedCount = 0;
            for (const game of allGames) {
                if (!game.decisionId) { withoutDecisionId++; ignoredCount++; continue; }
                const hits = countHits(game.numbers, latestDraw.numbers);
                const result = arbiterMemory.applyLearning(game.decisionId, hits, latestDraw.contestNumber);
                if (result.applied) learnedCount++;
                else { ignoredCount++; if (result.reason === "duplicate") duplicateCount++; else if (result.reason === "blocked") blockedCount++; }
            }

            const allNoDecision = withoutDecisionId > 0 && learnedCount === 0;
            const allNoDecisionMsg = withoutDecisionId === allGames.length;

            const allNoDecisionMsg2 = withoutDecisionId > 0 && learnedCount === 0;
            if (allNoDecisionMsg2) {
                setManualStatus(
                    allNoDecisionMsg
                        ? `⚠️ Geração sem decisionId rastreável. Aprendizado não aplicado. Concurso ${latestDraw.contestNumber}. Jogos: ${allGames.length}.`
                        : `⚠️ Conferência parcial. Concurso ${latestDraw.contestNumber}. Sem decisionId: ${withoutDecisionId}. Aprendidos: ${learnedCount}.`,
                );
            } else {
                const extras = [
                    withoutDecisionId > 0 && `sem decisionId: ${withoutDecisionId}`,
                    duplicateCount > 0 && `duplicados: ${duplicateCount}`,
                    blockedCount > 0 && `bloqueados: ${blockedCount}`,
                ].filter(Boolean).join(", ");
                setManualStatus(`✅ Conferência concluída (${sourceLabel}). Concurso ${latestDraw.contestNumber}. Jogos: ${allGames.length}. Aprendidos: ${learnedCount}. Ignorados: ${ignoredCount}.${extras ? ` (${extras})` : ""}`);
            }
            captureOrganism((currentResult?.scenario ?? "hybrid") as Scenario);
        } catch (e: any) {
            setManualStatus(`❌ Erro: ${e.message}`);
        } finally {
            setBusy(false);
        }
    };

    // ── Status do auto-aprendizado ─────────────────────────────────────────────
    const targetContest = currentResult?.targetContestNumber;

    const statusConfig: Record<AutoStatus, { icon: React.ReactNode; label: string; cls: string }> = {
        idle: { icon: <Activity className="h-4 w-4" />, label: "Aguardando geração...", cls: "text-muted-foreground" },
        checking: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: "Verificando concurso alvo...", cls: "text-blue-400" },
        pending: { icon: <Clock className="h-4 w-4" />, label: `Aguardando concurso #${targetContest ?? "—"}`, cls: "text-amber-400" },
        continuous: { icon: <Brain className="h-4 w-4 animate-pulse" />, label: `Evolução ativa (modo contínuo) — aguardando #${targetContest ?? "—"}`, cls: "text-purple-400" },
        learned: { icon: <CheckCircle2 className="h-4 w-4" />, label: `Aprendizado automático — Concurso #${report?.contestNumber ?? "—"}`, cls: "text-emerald-400" },
        "already-learned": { icon: <CheckCircle2 className="h-4 w-4" />, label: `Aprendizado já aplicado — Concurso #${report?.contestNumber ?? "—"}`, cls: "text-emerald-300/70" },
        partial: { icon: <AlertTriangle className="h-4 w-4" />, label: `Aprendizado parcial — ${report?.learned ?? 0} aprendidos`, cls: "text-amber-400" },
        error: { icon: <AlertTriangle className="h-4 w-4" />, label: "Erro na conferência automática", cls: "text-red-400" },
    };

    const sc = statusConfig[autoStatus];

    return (
        <div className="glass rounded-xl p-5 space-y-4">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" /> Conferência &amp; Aprendizado Automático
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Detecta automaticamente quando o concurso alvo está disponível.
                    </p>
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleManualCheck}
                    disabled={busy || autoStatus === "checking"}
                    className="text-muted-foreground hover:text-foreground"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Verificar agora
                </Button>
            </div>

            {/* Banner de status automático */}
            <div className={cn("flex items-center gap-2 text-[12px] font-medium", sc.cls)}>
                {sc.icon}
                <span>{sc.label}</span>
            </div>

            {/* Detalhes do modo contínuo */}
            {autoStatus === "continuous" && softInfo && (
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 text-purple-400 font-medium">
                        <Brain className="h-3.5 w-3.5 animate-pulse" />
                        Evolução ativa — aprendizado contínuo em execução
                    </div>
                    <div className="text-muted-foreground space-y-0.5">
                        <div>Aprendizado real: <span className="text-amber-400">aguardando concurso #{targetContest}</span></div>
                        <div>Simulações ativas: <span className="text-purple-300 font-mono">{softInfo.contestCount} concursos recentes</span></div>
                        <div>Soft-learnings aplicados: <span className="text-purple-300 font-mono">{softInfo.softApplied}</span></div>
                        <div className="text-muted-foreground/50 text-[9px] pt-0.5">Não persistido · Some ao confirmar concurso real</div>
                    </div>
                </div>
            )}

            {report && (autoStatus === "learned" || autoStatus === "already-learned" || autoStatus === "partial") && (
                <div className="space-y-2">
                    <div className="text-[10px] text-muted-foreground/60 font-mono">
                        {report.mode === "target-minus-one"
                            ? `⚡ modo: último concurso disponível (#${report.contestNumber}) — alvo #${report.targetContestNumber} ainda não sorteado`
                            : `✓ modo: concurso alvo exato (#${report.contestNumber})`}
                        {" — "}Aprendidos: <span className="text-emerald-400">{report.learned}</span>
                        {" | "}Duplicados: {report.duplicate}
                        {" | "}Sem decisionId: {report.noDecision}
                        {" | "}Bloqueados: {report.blocked}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="glass rounded-lg px-3 py-2 text-center">
                            <div className="text-muted-foreground">Média hits</div>
                            <div className="text-base font-mono font-semibold text-foreground">{report.avgHits.toFixed(1)}</div>
                        </div>
                        <div className="glass rounded-lg px-3 py-2 text-center">
                            <div className="text-muted-foreground">Melhor</div>
                            <div className="text-base font-mono font-semibold text-emerald-400">{report.bestHits}</div>
                        </div>
                        <div className="glass rounded-lg px-3 py-2 text-center">
                            <div className="text-muted-foreground">Pior</div>
                            <div className="text-base font-mono font-semibold text-red-400">{report.worstHits}</div>
                        </div>
                        <div className="glass rounded-lg px-3 py-2 text-center">
                            <div className="text-emerald-400">Bom</div>
                            <div className="font-mono font-semibold">{report.goodCount}</div>
                        </div>
                        <div className="glass rounded-lg px-3 py-2 text-center">
                            <div className="text-amber-400">Neutro</div>
                            <div className="font-mono font-semibold">{report.neutralCount}</div>
                        </div>
                        <div className="glass rounded-lg px-3 py-2 text-center">
                            <div className="text-red-400">Ruim</div>
                            <div className="font-mono font-semibold">{report.badCount}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Acertos por jogo (colapsável) */}
            {report && report.games.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowGames((v) => !v)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showGames ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        Acertos por jogo ({report.games.length})
                    </button>
                    {showGames && (
                        <div className="mt-2 space-y-3 max-h-96 overflow-y-auto pr-1">
                            {report.games.map((g) => (
                                <div key={g.index} className="glass rounded-lg p-3 space-y-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-mono text-muted-foreground capitalize">{g.lineage}</span>
                                        {g.outcome !== "no-decision" && g.outcome !== "blocked" && (
                                            <span className="text-[10px] font-mono font-bold">{g.hits} acertos</span>
                                        )}
                                        <QualityBadge quality={g.quality} />
                                        {g.outcome === "duplicate" && (
                                            <span className="px-1.5 py-0.5 rounded border text-[9px] bg-surface-2/30 text-muted-foreground border-border/30">já aprendido</span>
                                        )}
                                        {g.outcome === "no-decision" && (
                                            <span className="px-1.5 py-0.5 rounded border text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20">sem rastreio</span>
                                        )}
                                        {g.outcome === "blocked" && (
                                            <span className="px-1.5 py-0.5 rounded border text-[9px] bg-red-500/10 text-red-400 border-red-500/20">bloqueado</span>
                                        )}
                                    </div>
                                    {g.outcome !== "no-decision" && g.numbers.length > 0 && (
                                        <GameNumbers numbers={g.numbers} hitNumbers={g.hitNumbers} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Estado do Organismo (colapsável) */}
            {organism && (
                <div>
                    <button
                        onClick={() => setShowOrganism((v) => !v)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showOrganism ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <Brain className="h-3.5 w-3.5" /> Estado do Organismo
                    </button>
                    {showOrganism && <OrganismPanel snap={organism} />}
                </div>
            )}

            {/* Status do fluxo manual (quando usado) */}
            {manualStatus && (
                <div className="text-[11px] p-2 rounded bg-surface-2/50 border border-border/50 text-muted-foreground">
                    {manualStatus}
                </div>
            )}
        </div>
    );
}
