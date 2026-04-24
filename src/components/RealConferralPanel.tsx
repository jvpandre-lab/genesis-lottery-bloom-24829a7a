import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Target, CheckCircle2 } from "lucide-react";
import {
    fetchRecentDraws,
    fetchRecentGenerations,
    getLatestContestNumber,
} from "@/services/storageService";
import { countHits } from "@/engine/backtestEngine";
import { arbiterMemory } from "@/engine/arbiterMemory";
import { supabase } from "@/integrations/supabase/client";
import { GenerationResult } from "@/engine/lotteryTypes";

interface RealConferralPanelProps {
    /** Geração atual em memória (state). Tem prioridade sobre o banco. */
    currentResult?: GenerationResult | null;
}

interface ConferralGame {
    numbers: number[];
    lineage: string;
    decisionId?: string;
}

export function RealConferralPanel({ currentResult }: RealConferralPanelProps) {
    const [busy, setBusy] = useState(false);
    const [conferralStatus, setConferralStatus] = useState<string | null>(null);

    const handleConferral = async () => {
        setBusy(true);
        setConferralStatus(null);
        try {
            await arbiterMemory.init();

            // 1. PRIORIDADE: usar geração em memória
            let allGames: ConferralGame[] = [];
            let sourceLabel = "memória";

            if (currentResult && currentResult.batches?.length > 0) {
                allGames = currentResult.batches.flatMap((b) =>
                    b.games.map((g) => ({
                        numbers: g.numbers,
                        lineage: g.lineage,
                        decisionId: g.decisionId,
                    })),
                );
            } else {
                // 2. FALLBACK: buscar última geração no banco
                sourceLabel = "banco (fallback)";
                const gens = await fetchRecentGenerations(1);
                if (!gens || gens.length === 0) {
                    setConferralStatus("⚠️ Nenhuma geração ativa encontrada");
                    return;
                }
                const lastGen = gens[0];
                const { data: bs } = await supabase
                    .from("generation_batches")
                    .select("id")
                    .eq("generation_id", lastGen.id);
                if (!bs || bs.length === 0) {
                    setConferralStatus("⚠️ Nenhuma geração ativa encontrada");
                    return;
                }
                for (const b of bs) {
                    const { data: games } = await supabase
                        .from("generation_games")
                        .select("numbers, lineage, metrics")
                        .eq("batch_id", b.id);
                    if (games) {
                        allGames.push(
                            ...games.map((g: any) => ({
                                numbers: g.numbers as number[],
                                lineage: g.lineage as string,
                                decisionId: (g.metrics as any)?.decisionId,
                            })),
                        );
                    }
                }
            }

            if (allGames.length === 0) {
                setConferralStatus("⚠️ Nenhuma geração ativa encontrada");
                return;
            }

            // 3. Determinar concurso de referência (último real da base)
            const latestContest = await getLatestContestNumber();
            if (!latestContest) {
                toast({
                    title: "Erro",
                    description: "Nenhum sorteio histórico disponível",
                    variant: "destructive",
                });
                return;
            }

            const draws = await fetchRecentDraws(1);
            const latestDraw = draws[0];
            if (!latestDraw || latestDraw.contestNumber !== latestContest) {
                toast({
                    title: "Erro",
                    description: "Sorteio mais recente inconsistente",
                    variant: "destructive",
                });
                return;
            }

            // 4. Aplicar aprendizado
            let learnedCount = 0;
            let ignoredCount = 0;
            let withoutDecisionId = 0;

            for (const game of allGames) {
                if (!game.decisionId) {
                    withoutDecisionId++;
                    continue;
                }
                const hits = countHits(game.numbers, latestDraw.numbers);
                const prev = arbiterMemory
                    .getState()
                    .decisions.find((d) => d.id === game.decisionId);
                const target = prev?.context.targetContestNumber;

                arbiterMemory.applyLearning(
                    game.decisionId,
                    hits,
                    latestDraw.contestNumber,
                );

                const after = arbiterMemory
                    .getState()
                    .decisions.find((d) => d.id === game.decisionId);
                if (
                    target === latestDraw.contestNumber &&
                    after?.outcomeHits !== undefined
                ) {
                    learnedCount++;
                } else {
                    ignoredCount++;
                }
            }

            setConferralStatus(
                `✅ Conferência concluída (fonte: ${sourceLabel}). Concurso ${latestDraw.contestNumber}. ` +
                    `Jogos: ${allGames.length}. Aprendidos: ${learnedCount}. Ignorados: ${ignoredCount}.` +
                    (withoutDecisionId > 0
                        ? ` Sem decisionId: ${withoutDecisionId}.`
                        : ""),
            );
            toast({
                title: "Conferência Executada",
                description: `Hits calculados sobre o concurso ${latestDraw.contestNumber}.`,
            });
        } catch (e: any) {
            toast({
                title: "Falha",
                description: e.message,
                variant: "destructive",
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="glass rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" /> Conferência Real & Aprendizado
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Confere a geração atual contra o último sorteio do sistema.
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={handleConferral}
                    disabled={busy}
                    className="bg-gradient-primary text-primary-foreground shadow-glow"
                >
                    {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Conferir e Aprender
                </Button>
            </div>
            {conferralStatus && (
                <div className="text-[11px] p-2 rounded bg-surface-2/50 border border-border/50 text-muted-foreground">
                    {conferralStatus}
                </div>
            )}
        </div>
    );
}
