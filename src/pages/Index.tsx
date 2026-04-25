import { BacktestPanel } from "@/components/BacktestPanel";
import { BatchSection } from "@/components/BatchSection";
import { BrainTensionDiagnostics } from "@/components/BrainTensionDiagnostics";
import { DiagnosticsPanel } from "@/components/DiagnosticsPanel";
import { EcosystemDashboard } from "@/components/EcosystemDashboard";
import { EvolutionaryBacktestPanel } from "@/components/EvolutionaryBacktestPanel";
import { EvolutionTimeline } from "@/components/EvolutionTimeline";
import { HistoryHealthIndicator } from "@/components/HistoryHealthIndicator";
import { HistoryUploader } from "@/components/HistoryUploader";
import { RealConferralPanel } from "@/components/RealConferralPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { TacticalLotePanel } from "@/components/TacticalLotePanel";
import { TerritoryHeatmap } from "@/components/TerritoryHeatmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { globalPressure } from "@/engine/adaptivePressureEngine";
import { integrateEcosystemFlow } from "@/engine/ecoIntegration";
import { generate, GenerationDiagnostics } from "@/engine/generatorCore";
import { GenerationResult, Scenario } from "@/engine/lotteryTypes";
import { recommend } from "@/engine/recommendationEngine";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  fetchRecentDraws,
  fetchRecentGenerations,
  fetchRecentRealDraws,
  getLatestContestNumber,
  isBootstrapOnly,
  persistGeneration,
} from "@/services/storageService";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Loader2,
  Settings2,
  Shuffle,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";

const COUNTS = [1, 3, 5, 10, 15] as const;

const SCENARIOS: { id: Scenario; label: string; hint: string }[] = [
  { id: "conservative", label: "Conservador", hint: "Mais estabilidade" },
  { id: "hybrid", label: "Híbrido", hint: "Equilíbrio" },
  { id: "aggressive", label: "Agressivo", hint: "Mais risco" },
  { id: "exploratory", label: "Exploratório", hint: "Máxima variação" },
];

const Index = () => {
  const [count, setCount] = useState<number>(5);
  const [scenario, setScenario] = useState<Scenario>("hybrid");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [diag, setDiag] = useState<GenerationDiagnostics | null>(null);
  const [draws, setDraws] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [learningStatus, setLearningStatus] = useState("idle");

  const handleLearningStatus = useCallback((s: string) => setLearningStatus(s), []);

  function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      let recent: any[] = [];
      let recentGens: any[] = [];
      try {
        // Estratégia: Usar contexto recente REAL para geração
        // Evita que seed histórico antigo (1999-2003) seja usado como "recente"
        const realRecent = await fetchRecentRealDraws(8);
        const bootstrapOnly = await isBootstrapOnly();

        if (realRecent.length > 0) {
          recent = realRecent;
          console.log(
            "[GENERATE] Usando contexto recente REAL:",
            realRecent
              .map((d: any) => `${d.contestNumber}(${d.drawDate})`)
              .join(", "),
          );
        } else if (bootstrapOnly) {
          recent = [];
          console.warn(
            "[GENERATE] Bootstrap puro detectado. Contexto recente vazio para evitar dados históricos de 2003.",
          );
        } else {
          recent = await fetchRecentDraws(8);
          console.log(
            "[GENERATE] Fallback: usando fetchRecentDraws (pode incluir dados históricos)",
          );
        }
      } catch { }
      try {
        recentGens = await fetchRecentGenerations(10);
        console.log(
          "[INDEX] fetchRecentGenerations from Supabase:",
          recentGens.length,
        );
      } catch (err) {
        console.warn(
          "[INDEX] fetchRecentGenerations failed, falling back to empty:",
          err,
        );
      }
      await new Promise((r) => setTimeout(r, 30));
      // Target = maior contest da base + 1 (fonte autoritativa, nunca recent[0])
      const latest = await getLatestContestNumber();
      const fallbackLatest = recent.length > 0 ? recent[0].contestNumber : null;
      const baseLatest = Math.max(latest ?? 0, fallbackLatest ?? 0);
      const targetContestNumber = baseLatest > 0 ? baseLatest + 1 : undefined;
      console.log("[GENERATE] latestContest=", latest, "target=", targetContestNumber);

      const res = await generate({
        count,
        scenario,
        recentDraws: recent,
        recentResults: recentGens,
        twoBrains: true,
        targetContestNumber,
      });
      const { diagnostics, ...gen } = res;
      setResult(gen as GenerationResult);
      console.log(
        "[UI] generated territoryEntropy=",
        (gen as GenerationResult).metrics?.territoryEntropy,
      );
      setDiag(diagnostics);
      try {
        await persistGeneration(gen as GenerationResult);
      } catch (e: any) {
        toast({
          title: "Geração concluída (não persistida)",
          description: e?.message ?? "",
        });
      }
      // Integrate ecosystem analysis
      try {
        const generationId = (gen as any).id ?? crypto.randomUUID();
        const am: any = (diagnostics as any)?.arbiterMetrics;
        const first = Array.isArray(am) ? am[0] : am;
        const divergence = first?.divergence ?? 0.5;
        const arbitrationDifficulty = first?.difficulty ?? 0.3;
        await integrateEcosystemFlow(
          gen as GenerationResult,
          recent,
          generationId,
          divergence,
          arbitrationDifficulty,
        );
        toast({
          title: "Ecossistema atualizado",
          description: "Análise territorial, tática e cerebral integrada.",
        });
      } catch (e: any) {
        console.warn("Ecosystem integration failed:", e);
      }
    } catch (e: any) {
      toast({
        title: "Falha ao gerar",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const recommendations = useMemo(() => {
    if (!result || !diag) return [];
    globalPressure.load();
    const all = recommend(result, globalPressure.signals(), diag.adjustments);
    // Filtrar recomendações técnicas sem ação prática para o usuário
    return all.filter((r) => {
      const text = `${r.title} ${r.detail ?? ""}`.toLowerCase();
      return (
        !text.includes("csv") &&
        !text.includes("json") &&
        !text.includes("importe") &&
        !text.includes("sem hist\u00f3rico para backtest")
      );
    });
  }, [result, diag]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/60 backdrop-blur-xl bg-surface-0/70 sticky top-0 z-30">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Lotomania IA da Sorte</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5 uppercase tracking-widest">Sistema Evolutivo</div>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-8">
        {/* Hero compacto */}
        <section className="relative overflow-hidden rounded-2xl glass-strong px-8 py-6 md:px-10 md:py-8">
          <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
              Gere jogos <span className="text-gradient">inteligentes</span> para Lotomania
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              O sistema aprende com os resultados reais e ajusta automaticamente a próxima geração.
            </p>
          </div>
        </section>

        {/* Saúde do Histórico */}
        <HistoryHealthIndicator />

        {/* Histórico */}
        <HistoryUploader onChanged={setDraws} />

        {/* Controles */}
        <section className="glass-strong rounded-2xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Quantidade de jogos
              </div>
              <div className="flex flex-wrap gap-2">
                {COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={cn(
                      "h-12 min-w-[64px] px-4 rounded-xl font-mono num-mono text-base border transition-all",
                      count === n
                        ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                        : "bg-surface-2/60 border-border/60 text-foreground/80 hover:border-primary/50",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 md:max-w-md w-full">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Cenário operacional
              </div>
              <Tabs
                value={scenario}
                onValueChange={(v) => setScenario(v as Scenario)}
              >
                <TabsList className="grid grid-cols-4 bg-surface-2/60 border border-border/60">
                  {SCENARIOS.map((s) => (
                    <TabsTrigger
                      key={s.id}
                      value={s.id}
                      className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground text-xs"
                    >
                      {s.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <p className="text-[11px] text-muted-foreground">
                {SCENARIOS.find((s) => s.id === scenario)?.hint}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
              <Shuffle className="h-3.5 w-3.5" />
              {draws > 0
                ? `${draws} concursos disponíveis para anti-viés.`
                : "Anti-viés operará apenas em modo interno."}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={busy}
              size="lg"
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Evoluindo{" "}
                  {count} jogo{count > 1 ? "s" : ""}…
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" /> Gerar {count} jogo
                  {count > 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </section>

        {/* Resultado — layout sequencial */}
        {result && (
          <section className="space-y-6 animate-fade-in">
            {/* (5) Qualidade da geração */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Qualidade" value={`${Math.round(result.metrics.avgScore * 100)}`} suffix="/100" tone="primary" />
              <Kpi label="Diversidade" value={`${Math.round(result.metrics.avgDiversity * 100)}%`} tone="accent" />
              <Kpi label="Cobertura" value={`${Math.round(result.metrics.avgCoverage * 100)}%`} />
              <SystemStatusBlock result={result} learningStatus={learningStatus} />
            </div>

            {/* (6) Recomendações do sistema */}
            {recommendations.length > 0 && (
              <RecommendationsPanel items={recommendations} />
            )}

            {/* (6) Jogos gerados */}
            <div className="space-y-8">
              {result.batches.map((b) => (
                <BatchSection key={b.name} batch={b} />
              ))}
            </div>

            {/* (7) Conferência & Aprendizado Automático */}
            <RealConferralPanel
              currentResult={result}
              drawsSyncCount={draws}
              onAutoStatusChange={handleLearningStatus}
            />

            {/* (8) Backtest histórico */}
            <BacktestPanel currentGeneration={result} />

            {/* (9) Backtest Evolutivo */}
            <EvolutionaryBacktestPanel scenario={scenario} />

            {/* (10) Modo Avançado */}
            <div className="space-y-4">
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-border/50 text-[12px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {showAdvanced ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showAdvanced && (
                <div className="space-y-6 border border-border/30 rounded-2xl p-5">
                  <p className="text-[11px] text-muted-foreground">Painel técnico — informações internas do organismo.</p>
                  <TerritoryHeatmap result={result} />
                  {diag && <DiagnosticsPanel diag={diag} />}
                  {diag && <EcosystemDashboard diag={diag} scenario={scenario} />}
                  <TacticalLotePanel batches={result.batches} />
                  <BrainTensionDiagnostics />
                  <EvolutionTimeline />
                  <div className="glass rounded-xl p-5 space-y-3">
                    <h4 className="text-sm font-semibold tracking-tight">Composição das linhagens</h4>
                    <LineageBreakdown result={result} />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {!result && !busy && (
          <section className="glass rounded-2xl p-10 text-center text-muted-foreground">
            <Sparkles className="h-6 w-6 mx-auto text-primary mb-3" />
            <p className="text-sm">
              Configure o cenário e a quantidade, depois clique em{" "}
              <span className="text-foreground">Gerar</span> para iniciar a
              primeira evolução.
            </p>
          </section>
        )}
      </main>

      <footer className="border-t border-border/40 mt-16">
        <div className="container py-6 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>Lotomania IA da Sorte</span>
          <span className="font-mono num-mono">
            domínio 00–99 · 50 dezenas/jogo
          </span>
        </div>
      </footer>
    </div>
  );
};

function Kpi({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "primary" | "accent";
}) {
  return (
    <div className="glass rounded-xl px-5 py-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-mono num-mono font-semibold",
          tone === "primary" && "text-gradient",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
        <span className="text-xs text-muted-foreground ml-1">{suffix}</span>
      </div>
    </div>
  );
}

function LineageBreakdown({ result }: { result: GenerationResult }) {
  const counts: Record<string, number> = {};
  for (const b of result.batches)
    for (const g of b.games) counts[g.lineage] = (counts[g.lineage] ?? 0) + 1;
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2">
      {entries.map(([lin, n]) => (
        <div key={lin} className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className={`text-lineage-${lin} font-medium capitalize`}>
              {lin}
            </span>
            <span className="font-mono num-mono text-muted-foreground">
              {n}/{total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className={`h-full bg-lineage-${lin}`}
              style={{ width: `${(n / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SystemStatusBlock ──────────────────────────────────────────────────────────
// Status em linguagem simples derivado das métricas de geração e do aprendizado.

function SystemStatusBlock({
  result,
  learningStatus,
}: {
  result: GenerationResult;
  learningStatus: string;
}) {
  const { avgScore, avgDiversity } = result.metrics;

  // Calcular status
  let status: "Saudável" | "Em ajuste" | "Instável";
  let statusColor: string;
  let statusIcon: string;
  let message: string;

  if (learningStatus === "error") {
    status = "Instável";
    statusColor = "text-red-400";
    statusIcon = "🔴";
    message = "Erro na conferência. Verifique o painel de aprendizado abaixo.";
  } else if (learningStatus === "continuous") {
    status = "Em ajuste";
    statusColor = "text-violet-400";
    statusIcon = "🟡";
    message = "Sistema em aprendizado contínuo enquanto aguarda o próximo concurso.";
  } else if (learningStatus === "learned") {
    status = "Saudável";
    statusColor = "text-emerald-400";
    statusIcon = "🟢";
    message = "Organismo atualizado com resultado real. Próxima geração já reflete a mudança.";
  } else if (learningStatus === "already-learned") {
    status = "Saudável";
    statusColor = "text-emerald-400";
    statusIcon = "🟢";
    message = "Aprendizado já aplicado. Sistema estável e sem alterações pendentes.";
  } else if (avgScore < 0.4) {
    status = "Instável";
    statusColor = "text-red-400";
    statusIcon = "🔴";
    message = "Qualidade baixa detectada — sistema aumentando exploração automaticamente.";
  } else if (avgDiversity < 0.25) {
    status = "Em ajuste";
    statusColor = "text-amber-400";
    statusIcon = "🟡";
    message = "Baixa diversidade detectada — sistema ajustando variação automaticamente.";
  } else if (avgScore >= 0.65 && avgDiversity >= 0.35) {
    status = "Saudável";
    statusColor = "text-emerald-400";
    statusIcon = "🟢";
    message = "Sistema estável — pode manter a configuração atual.";
  } else if (learningStatus === "pending" || learningStatus === "checking") {
    status = "Em ajuste";
    statusColor = "text-amber-400";
    statusIcon = "🟡";
    message = "Verificando disponibilidade do concurso alvo para aprendizado.";
  } else {
    status = "Em ajuste";
    statusColor = "text-amber-400";
    statusIcon = "🟡";
    message = "Sistema em ajuste — próxima geração aplicará correções automaticamente.";
  }

  return (
    <div className="glass rounded-xl px-5 py-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        Status do Sistema
      </div>
      <div className={cn("mt-1 text-sm font-semibold flex items-center gap-1.5", statusColor)}>
        <span>{statusIcon}</span> {status}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{message}</p>
    </div>
  );
}

export default Index;
