import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Target, CheckCircle2 } from "lucide-react";
import { fetchRecentDraws, fetchRecentGenerations } from "@/services/storageService";
import { countHits } from "@/engine/backtestEngine";
import { arbiterMemory } from "@/engine/arbiterMemory";
import { supabase } from "@/integrations/supabase/client";

export function RealConferralPanel() {
    const [busy, setBusy] = useState(false);
    const [conferralStatus, setConferralStatus] = useState<string | null>(null);

    const handleConferral = async () => {
        setBusy(true);
        setConferralStatus(null);
        try {
            // 1. Pega os jogos gerados mais recentes
            const gens = await fetchRecentGenerations(1);
            if (!gens || gens.length === 0) {
                toast({ title: "Erro", description: "Nenhuma geração encontrada.", variant: "destructive" });
                return;
            }
            const lastGen = gens[0];

            // Pegar os games do banco de dados para a geração encontrada (já que fetchRecentGenerations traz apenas metadados na real?)
            // Wait, let's look at what fetchRecentGenerations returns.
            // Typically it returns the full GenerationResult if the service provides it, but if it doesn't we might need to fetch games manually.
            // Let's assume recentGens returned by the service are full-ish or we can reconstruct.
            // Actually let's query the specific batches and games to be safe, just like BacktestPanel does.

            const { data: bs } = await supabase.from("generation_batches").select("id").eq("generation_id", lastGen.id);
            if (!bs) {
                toast({ title: "Erro", description: "Lotes não encontrados", variant: "destructive" });
                return;
            }

            const allGames: { numbers: number[], lineage: string, decisionId?: string }[] = [];
            for (const b of bs) {
                const { data: games } = await supabase.from("generation_games").select("numbers, lineage, metrics").eq("batch_id", b.id);
                if (games) {
                    allGames.push(...games.map((g: any) => ({
                        numbers: g.numbers,
                        lineage: g.lineage,
                        decisionId: (g.metrics as any)?.decisionId
                    })));
                }
            }

            // 2. Tentar decifrar qual concurso alvo dessa geração
            // O targetContestNumber fica gravado no banco onde? Nós acabamos de colocar na metadata do decision, ou no `lotteryTypes`.
            // Na tabela `generations` não tem coluna, mas vamos ver os últimos draws pra tentar adivinhar se não tivermos.
            const draws = await fetchRecentDraws(10);
            if (draws.length === 0) {
                toast({ title: "Erro", description: "Nenhum sorteio histórico disponível", variant: "destructive" });
                return;
            }

            // O target da geração recente (idealmente) é o próximo. Qual o concurso que o usuário quer conferir?
            // Neste MVP: vamos chumbadamente testar contra o ÚLTIMO sorteio que está na base (draws[0]).
            const latestDraw = draws[0];

            let learnedCount = 0;
            let ignoredCount = 0;

            // Ensure memory is loaded
            await arbiterMemory.init();

            // 3. Calcular hits e aplicar
            for (const game of allGames) {
                if (!game.decisionId) continue;

                const hits = countHits(game.numbers, latestDraw.numbers);

                // A checagem de targetContestNumber === contestNumber será feita internamente pelo applyLearning
                // Se bater, ele aprende. Senão o applyLearning loga e ignora.
                const prevBias = arbiterMemory.getState().decisions.find(d => d.id === game.decisionId)?.outcomeHits;
                const target = arbiterMemory.getState().decisions.find(d => d.id === game.decisionId)?.context.targetContestNumber;

                arbiterMemory.applyLearning(game.decisionId, hits, latestDraw.contestNumber);

                // Verifica se aprendeu para fins de UI
                const newD = arbiterMemory.getState().decisions.find(d => d.id === game.decisionId);
                if (target === latestDraw.contestNumber && prevBias === undefined && newD?.outcomeHits !== undefined) {
                    learnedCount++;
                } else {
                    ignoredCount++;
                }
            }

            setConferralStatus(`Conferência Finalizada! Concurso: ${latestDraw.contestNumber}. Aprendizados: ${learnedCount}. Ignorados: ${ignoredCount}.`);
            toast({ title: "Conferência Executada", description: `Hits calculados sobre o concurso ${latestDraw.contestNumber}.` });
        } catch (e: any) {
            toast({ title: "Falha", description: e.message, variant: "destructive" });
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
                        Testa a geração mais recente contra o último sorteio do sistema.
                    </p>
                </div>
                <Button size="sm" onClick={handleConferral} disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
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
