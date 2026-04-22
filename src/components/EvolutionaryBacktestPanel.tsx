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
import { Loader2, Rewind, TrendingDown, TrendingUp } from "lucide-react";
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
    setProgress("Carregando histórico completo...");
    try {
      const allDraws = await fetchAllDraws();
      setProgress(`Rodando ${numGens} gerações retroativas...`);

      const rep = await backtestEvolutionaryRetrospective(
        numGens,
        Date.now() & 0xffffffff,
        allDraws,
        scenario,
        async (input) => {
          // gera com two-brains ATIVO para medir o sistema real de produção
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

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <Rewind className="h-4 w-4 text-primary" /> Backtest evolutivo
            retroativo
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Roda o sistema como se estivesse no passado, usando só draws
            disponíveis até cada ponto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={numGens}
            onChange={(e) => setNumGens(Number(e.target.value))}
            disabled={busy}
            className="text-[11px] bg-surface-2/60 border border-border/50 rounded px-2 py-1"
          >
            <option value={4}>4 gens</option>
            <option value={8}>8 gens</option>
            <option value={12}>12 gens</option>
            <option value={20}>20 gens</option>
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

      {progress && (
        <div className="text-[11px] text-muted-foreground italic">
          {progress}
        </div>
      )}

      {drawsTotal === 0 && (
        <div className="text-[11px] text-warning/90">
          Importe um histórico para habilitar.
        </div>
      )}

      {report && (
        <div className="space-y-4">
          {/* Overall trends */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Metric
              label="Acertos médios"
              value={report.overall.avgHits.toFixed(2)}
            />
            <Metric
              label="15+"
              value={`${(report.overall.freq15plus * 100).toFixed(2)}%`}
            />
            <Metric
              label="16+"
              value={`${(report.overall.freq16plus * 100).toFixed(2)}%`}
            />
            <Metric
              label="17+"
              value={`${(report.overall.freq17plus * 100).toFixed(2)}%`}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Trend
              label="Estabilidade"
              value={report.overall.stabilityTrend}
              invert
            />
            <Trend
              label="Saturação territorial"
              value={report.overall.saturationTrend}
            />
            <Trend
              label="Convergência"
              value={report.overall.convergenceTrend}
              invert
            />
          </div>

          {/* Per-generation curve */}
          <div className="rounded-lg bg-surface-2/60 border border-border/50 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Curva evolutiva (geração × acertos médios)
            </div>
            <div className="flex items-end gap-1 h-20">
              {report.generations.map((g) => {
                const h = Math.max(4, Math.min(80, g.avgHits * 8));
                return (
                  <div
                    key={g.generationIndex}
                    className="flex-1 bg-primary/60 rounded-sm relative group"
                    style={{ height: `${h}px` }}
                    title={`Gen ${g.generationIndex}: ${g.avgHits.toFixed(2)} acertos · ${g.drawsUsed} draws`}
                  />
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Section title="Por linhagem">
              {report.perLineage.slice(0, 6).map((l) => (
                <Row
                  key={l.lineage}
                  label={l.lineage}
                  value={`${l.avgHits.toFixed(2)} (${(l.freq15plus * 100).toFixed(2)}% 15+)`}
                />
              ))}
            </Section>
            <Section title="Por cenário">
              {report.perScenario.map((s) => (
                <Row
                  key={s.scenario}
                  label={s.scenario}
                  value={`${s.avgHits.toFixed(2)} (${(s.freq15plus * 100).toFixed(2)}% 15+)`}
                />
              ))}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2/60 border border-border/50 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-base font-mono num-mono mt-1">{value}</div>
    </div>
  );
}

function Trend({
  label,
  value,
  invert,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  // invert=true => slope positivo é ruim (estabilidade=variância subindo, convergência subindo)
  const positiveIsBad = !!invert;
  const isUp = value > 0;
  const isHealthy = positiveIsBad ? !isUp : isUp;
  return (
    <div className="rounded-lg bg-surface-2/60 border border-border/50 p-3 flex items-center justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div className="text-xs font-mono num-mono mt-1">
          {value.toFixed(4)}
        </div>
      </div>
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center",
          isHealthy
            ? "bg-success/20 text-success"
            : "bg-destructive/20 text-destructive",
        )}
      >
        {isUp ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <TrendingDown className="h-4 w-4" />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-surface-2/60 border border-border/50 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="capitalize text-foreground/85">{label}</span>
      <span className="font-mono num-mono text-muted-foreground">{value}</span>
    </div>
  );
}
