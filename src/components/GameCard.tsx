import { useState } from "react";
import { Game, LINEAGES, formatDezena } from "@/engine/lotteryTypes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  game: Game;
  index: number;
}

export function GameCard({ game, index }: Props) {
  const meta = LINEAGES[game.lineage];
  const score = Math.round(game.score.total * 100);
  const [showDetails, setShowDetails] = useState(false);

  // Badge de qualidade simples
  const quality = score >= 70 ? "Bom" : score >= 50 ? "Médio" : "Básico";
  const qualityColor = score >= 70 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-muted-foreground";

  return (
    <div className="glass rounded-xl p-4 hover:border-primary/50 transition-colors animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono">JOGO {String(index + 1).padStart(2, "0")}</span>
          <span className={cn("text-[10px] font-semibold", qualityColor)}>{quality}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="text-[10px] text-muted-foreground">SCORE</div>
          <div className="text-sm font-mono num-mono font-semibold text-gradient">{score}</div>
        </div>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {game.numbers.map((n) => (
          <div
            key={n}
            className="h-7 flex items-center justify-center rounded bg-surface-2 text-foreground text-[11px] font-mono num-mono border border-border/60"
          >
            {formatDezena(n)}
          </div>
        ))}
      </div>
      {/* Métricas principais */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <Stat label="Qualidade" value={pct(game.score.total)} />
        <Stat label="Cobertura" value={pct(game.score.coverage)} />
        <Stat label="Diversidade" value={pct(game.score.diversity)} />
      </div>
      {/* Detalhes opcionais */}
      <button
        onClick={() => setShowDetails((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {showDetails ? "Fechar detalhes" : "Ver detalhes"}
      </button>
      {showDetails && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] border-t border-border/30 pt-2">
          <Stat label="Distribuição" value={pct(game.score.distribution)} />
          <Stat label="Território" value={pct(game.score.territory)} />
          <Stat label="Anti-viés" value={pct(game.score.antiBias)} />
          <Stat label="Anti-cluster" value={pct(game.score.clusterPenalty)} />
          <Stat label="Linhagem" value={meta.short} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-1/70 px-2 py-1.5 border border-border/50">
      <div className="text-muted-foreground/80 text-[9px] uppercase tracking-wider">{label}</div>
      <div className="font-mono num-mono text-foreground/90">{value}</div>
    </div>
  );
}

function pct(n: number) { return `${Math.round(n * 100)}%`; }
