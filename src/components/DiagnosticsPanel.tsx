import { GenerationDiagnostics } from "@/engine/generatorCore";
import { Cpu, Scale, Shuffle } from "lucide-react";

export function DiagnosticsPanel({ diag }: { diag: GenerationDiagnostics }) {
  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <h4 className="text-sm font-semibold tracking-tight flex items-center gap-2">
        <Cpu className="h-4 w-4 text-primary" /> Diagnóstico da geração
      </h4>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-surface-2/60 border border-border/50 p-2">
          <div className="text-muted-foreground text-[10px] uppercase">
            Contradições
          </div>
          <div className="font-mono num-mono text-base">
            {diag.contradictionsRejected}
          </div>
        </div>
        <div className="rounded-md bg-surface-2/60 border border-border/50 p-2">
          <div className="text-muted-foreground text-[10px] uppercase">
            Ajustes adaptativos
          </div>
          <div className="font-mono num-mono text-base">
            {diag.adjustments.reasons.length}
          </div>
        </div>
      </div>
      {diag.adjustments.reasons.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Shuffle className="h-3 w-3" /> Pressão adaptativa
          </div>
          {diag.adjustments.reasons.map((r, i) => (
            <div
              key={i}
              className="text-[11px] text-foreground/85 rounded-md bg-surface-2/60 border border-border/50 p-2"
            >
              {r}
            </div>
          ))}
        </div>
      )}
      {diag.preGenContext && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Cpu className="h-3 w-3" /> Ajustes Pré-Geração
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <Stat
              label="Zonas saturadas"
              value={diag.preGenContext.pressureZonesCount.toString()}
            />
            <Stat
              label="Blind zones"
              value={diag.preGenContext.blindZonesCount.toString()}
            />
            <Stat
              label="Falsa diversidade"
              value={diag.preGenContext.falseDiversityDetected ? "Sim" : "Não"}
            />
            <Stat
              label="Mutação"
              value={`${diag.preGenContext.mutationRateModifier >= 0 ? "+" : ""}${diag.preGenContext.mutationRateModifier.toFixed(2)}`}
            />
            <Stat
              label="Balance A/B"
              value={`${diag.preGenContext.targetBalanceAdjustment >= 0 ? "+" : ""}${diag.preGenContext.targetBalanceAdjustment.toFixed(2)}`}
            />
            <Stat
              label="Scenario override"
              value={diag.preGenContext.scenarioOverride ?? "nenhum"}
            />
            {diag.preGenContext.territoryDrift && (
              <div className="col-span-2 rounded-md bg-surface-2/60 border border-border/50 p-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Territory drift
                </div>
                <div className="text-[11px] text-foreground/85">
                  {diag.preGenContext.territoryDrift.direction} (
                  {diag.preGenContext.territoryDrift.magnitude.toFixed(2)})
                </div>
              </div>
            )}
          </div>
          {diag.preGenContext.reasons.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Razões
              </div>
              {diag.preGenContext.reasons.slice(0, 4).map((r, i) => (
                <div
                  key={i}
                  className="text-[11px] text-foreground/85 rounded-md bg-surface-2/60 border border-border/50 p-2"
                >
                  {r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <details className="text-[11px]">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <Scale className="h-3 w-3" /> Decisões do árbitro (
          {diag.arbiterReasoning.length})
        </summary>
        <div className="mt-2 space-y-1 max-h-48 overflow-auto pr-1">
          {diag.arbiterReasoning.map((r, i) => (
            <div
              key={i}
              className="font-mono text-[10px] text-muted-foreground border-l-2 border-primary/30 pl-2"
            >
              {r}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2/60 border border-border/50 p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-mono num-mono text-base">{value}</div>
    </div>
  );
}
