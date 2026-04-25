import { Button } from "@/components/ui/button";
import {
  backtestEvolutionaryRetrospective,
  EvolutionaryBacktestReport,
} from "@/engine/backtestEngine";
import { generate } from "@/engine/generatorCore";
import { Scenario } from "@/engine/lotteryTypes";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { countDraws, fetchAllDraws } from "@/services/storageService";
import { Loader2, Rewind, TrendingDown, TrendingUp, BarChart2 } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  scenario: Scenario;
}

export function EvolutionaryBacktestPanel({ scenario }: Props) {
  const [busy, setBusy] = useState(false);
  const [drawsTotal, setDrawsTotal] = useState(0);
  const [numGens, setNumGens] = useState(8);
  const [report, setReport] = useState<EvolutionaryBacktestReport | null>(null);
  const [progress, setProgress] = useState<string>("");

  useEffect(() => {
    countDraws()
      .then(setDrawsTotal)
      .catch(() => setDrawsTotal(0));
  }, []);

  async function run() {
    if (drawsTotal < numGens * 2) {
      toast({
        title: "Histórico insuficiente",
        description: `Precisa de pelo menos ${numGens * 2} concursos para ${numGens} gerações retroativas.`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    setReport(null);
    setProgress("Carregando histórico...");
    try {
      const allDraws = await fetchAllDraws();
      setProgress(`Simulando ${numGens} gerações no passado...`);

      const rep = await backtestEvolutionaryRetrospective(
        numGens,
        Date.now() & 0xffffffff,
        allDraws,
        scenario,
        async (input) => {
          const res = await generate({
            count: 5,
            scenario: input.scenario,
            recentDraws: input.recentDraws,
            twoBrains: true,
          });
          const { diagnostics, ...gen } = res;
          return gen as any;
        },
      );

      setReport(rep);
      toast({
        title: "Backtest evolutivo concluído",
        description: `${rep.generations.length} gerações simuladas contra o histórico real.`,
      });
    } catch (e: any) {
      toast({
        title: "Falha no backtest evolutivo",
        description: e?.message ?? "Erro",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  // Encontrar max para normalizar a curva
  const maxHits = report
    ? Math.max(...report.generations.map((g) => g.avgHits), 1)
    : 1;

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <Rewind className="h-4 w-4 text-primary" /> Backtest Evolutivo
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Simula como o organismo teria evoluído se tivesse gerado jogos no passado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={numGens}
            onChange={(e) => setNumGens(Number(e.target.value))}
            disabled={busy}
            className="text-[11px] bg-surface-2/60 border border-border/50 rounded px-2 py-1"
          >
            <option value={4}>4 gerações</option>
            <option value={8}>8 gerações</option>
            <option value={12}>12 gerações</option>
            <option value={20}>20 gerações</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={run}
            disabled={busy || drawsTotal === 0}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Executar"}
          </Button>
        </div>
      </div>

      {/* Progresso */}
      {progress && (
        <div className="text-[11px] text-muted-foreground italic animate-pulse">
          {progress}
        </div>
      )}

      {/* Sem histórico */}
      {drawsTotal === 0 && (
        <div className="text-[11px] text-muted-foreground/70 border border-border/40 rounded-lg px-4 py-3">
          Sincronize o histórico oficial para habilitar o backtest evolutivo.
        </div>
      )}

      {/* Sem dados ainda */}
      {!report && !busy && drawsTotal > 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground/50">
          <BarChart2 className="h-8 w-8" />
          <p className="text-[11px]">Execute o backtest para visualizar a evolução.</p>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <KpiCard label="Acertos médios" value={report.overall.avgHits.toFixed(1)} />
            <KpiCard label="Taxa 15+" value={`${(report.overall.freq15plus * 100).toFixed(1)}%`} />
            <KpiCard label="Taxa 16+" value={`${(report.overall.freq16plus * 100).toFixed(1)}%`} />
            <KpiCard label="Taxa 17+" value={`${(report.overall.freq17plus * 100).toFixed(1)}%`} />
          </div>

          {/* Tendência: apenas estabilidade */}
          <div className="grid grid-cols-1 gap-2">
            <TrendCard
              label="Tendência de estabilidade"
              value={report.overall.stabilityTrend}
              invert
            />
          </div>

          {/* Curva evolutiva animada */}
          <div className="rounded-lg bg-surface-2/60 border border-border/50 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              Evolução dos acertos por geração
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {report.generations.map((g, i) => {
                const pct = Math.max(6, (g.avgHits / maxHits) * 100);
                const isRising = i > 0 && g.avgHits >= report.generations[i - 1].avgHits;
                return (
                  <div
                    key={g.generationIndex}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    {/* valor */}
                    <span className="text-[8px] text-muted-foreground/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      {g.avgHits.toFixed(1)}
                    </span>
                    {/* barra */}
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all duration-700",
                        isRising || i === 0 ? "bg-primary/70" : "bg-destructive/50",
                      )}
                      style={{ height: `${pct}%` }}
                      title={`Geração ${g.generationIndex}: ${g.avgHits.toFixed(2)} acertos`}
                    />
                    {/* label */}
                    <span className="text-[8px] text-muted-foreground/50 font-mono">
                      {g.generationIndex}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-3 text-[9px] text-muted-foreground/60">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary/70 rounded-sm inline-block" />Subiu</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-destructive/50 rounded-sm inline-block" />Caiu</span>
            </div>
          </div>

          {/* Por cenário simplificado */}
          <div className="rounded-lg bg-surface-2/60 border border-border/50 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Resultados por cenário
            </div>
            <div className="space-y-1.5">
              {report.perScenario.map((s) => (
                <div key={s.scenario} className="flex justify-between text-[11px]">
                  <span className="capitalize text-foreground/80">{s.scenario}</span>
                  <span className="font-mono num-mono text-muted-foreground">
                    {s.avgHits.toFixed(1)} acertos · {(s.freq15plus * 100).toFixed(1)}% ganham 15+
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2/60 border border-border/50 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-base font-mono num-mono mt-1 text-foreground">{value}</div>
    </div>
  );
}

function TrendCard({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const positiveIsBad = !!invert;
  const isUp = value > 0;
  const isHealthy = positiveIsBad ? !isUp : isUp;
  return (
    <div className="rounded-lg bg-surface-2/60 border border-border/50 p-3 flex items-center justify-between">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("flex items-center gap-1 text-[11px] font-medium", isHealthy ? "text-emerald-400" : "text-amber-400")}>
        {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {isHealthy ? "Estável" : "Variando"}
      </div>
    </div>
  );
}
