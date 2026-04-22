import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GenerationDiagnostics } from "@/engine/generatorCore";
import { Scenario } from "@/engine/lotteryTypes";
import { AlertTriangle, Cpu, TrendingUp, Zap } from "lucide-react";

export function EcosystemDashboard({
  diag,
  scenario,
}: {
  diag: GenerationDiagnostics;
  scenario: Scenario;
}) {
  const effectiveScenario = diag.preGenContext?.scenarioOverride ?? scenario;
  const brainHealth = diag.brainTensionHealth;
  const preGen = diag.preGenContext;
  const roleEntries = Object.entries(diag.tacticalComposition).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Cpu className="h-4 w-4 text-primary" />
            <span>Ecossistema de geração</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Visão consolidada de pressões, pré-gen e equilíbrio cerebral.
          </p>
        </div>
        <Badge variant="outline" className="font-mono">
          {effectiveScenario}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Stat label="Cenário selecionado" value={scenario} />
        <Stat label="Cenário efetivo" value={effectiveScenario} />
        <Stat
          label="Contradições rejeitadas"
          value={diag.contradictionsRejected}
        />
        <Stat
          label="Ajustes adaptativos"
          value={diag.adjustments.reasons.length}
        />
      </div>

      <Card className="glass p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4 text-accent" />
          <span>Pré-Geração</span>
        </div>
        {preGen ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <KeyValue
                label="Zonas saturadas"
                value={preGen.pressureZonesCount}
              />
              <KeyValue label="Blind zones" value={preGen.blindZonesCount} />
              <KeyValue
                label="Falsa diversidade"
                value={preGen.falseDiversityDetected ? "Sim" : "Não"}
              />
              <KeyValue
                label="Mutação"
                value={`${preGen.mutationRateModifier >= 0 ? "+" : ""}${preGen.mutationRateModifier.toFixed(2)}`}
              />
              <KeyValue
                label="Balance A/B"
                value={`${preGen.targetBalanceAdjustment >= 0 ? "+" : ""}${preGen.targetBalanceAdjustment.toFixed(2)}`}
              />
              <KeyValue
                label="Scenario override"
                value={preGen.scenarioOverride ?? "nenhum"}
              />
            </div>
            {preGen.territoryDrift && (
              <div className="rounded-md bg-surface-2/60 border border-border/50 p-3 text-[11px] text-foreground/85">
                <div className="font-medium">Territory drift</div>
                <div>
                  {preGen.territoryDrift.direction} ·{" "}
                  {preGen.territoryDrift.magnitude.toFixed(2)}
                </div>
              </div>
            )}
            {preGen.reasons.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Razões de ajuste
                </div>
                <div className="grid gap-2">
                  {preGen.reasons.slice(0, 4).map((reason, index) => (
                    <div
                      key={index}
                      className="rounded-md bg-surface-2/60 border border-border/50 p-2 text-[11px] text-foreground/85"
                    >
                      {reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">
            Pré-gen indisponível para esta geração.
          </div>
        )}
      </Card>

      <Card className="glass p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-accent" />
          <span>Saúde cerebral</span>
        </div>
        {brainHealth ? (
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <KeyValue
              label="Brain A"
              value={
                brainHealth.brainAStrength != null
                  ? `${(brainHealth.brainAStrength * 100).toFixed(0)}%`
                  : "n/a"
              }
            />
            <KeyValue
              label="Brain B"
              value={
                brainHealth.brainBStrength != null
                  ? `${(brainHealth.brainBStrength * 100).toFixed(0)}%`
                  : "n/a"
              }
            />
            <KeyValue
              label="Árbitro"
              value={
                brainHealth.arbitratorEffectiveness != null
                  ? `${(brainHealth.arbitratorEffectiveness * 100).toFixed(0)}%`
                  : "n/a"
              }
            />
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">
            Sem dados de saúde cerebral.
          </div>
        )}
      </Card>

      <Card className="glass p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span>Equilíbrio do ecossistema</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <KeyValue
            label="Picks A/B"
            value={`${diag.ecoBrainBalance.picksA}:${diag.ecoBrainBalance.picksB}`}
          />
          <KeyValue
            label="Papéis táticos"
            value={roleEntries
              .map(([role, count]) => `${role} ${count}`)
              .join(" · ")}
          />
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-surface-2/60 border border-border/50 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-mono num-mono text-base">{value}</div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-surface-2/60 border border-border/50 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-mono num-mono text-sm text-foreground/90">
        {value}
      </div>
    </div>
  );
}
