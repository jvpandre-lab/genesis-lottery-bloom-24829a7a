import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ArrowRight, Compass, Gauge, Zap } from "lucide-react";
import {
  fetchRecentScenarioTransitions,
  fetchRecentPressureSignals,
} from "@/services/storageService";
import { supabase } from "@/integrations/supabase/client";

type TimelineEvent = {
  id: string;
  kind: "scenario" | "pressure" | "territory" | "lineage";
  ts: string;
  title: string;
  detail: string;
  tone: "primary" | "accent" | "warn" | "muted";
};

function fmt(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function EvolutionTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [transitions, signals, territoryRes, lineageRes] = await Promise.all([
          fetchRecentScenarioTransitions(15),
          fetchRecentPressureSignals(40),
          supabase
            .from("territory_snapshots")
            .select("id, created_at, drift_direction, drift_magnitude, saturation_level")
            .order("created_at", { ascending: false })
            .limit(15),
          supabase
            .from("lineage_history")
            .select("id, created_at, lineage, drift_status, drift_magnitude")
            .not("drift_status", "is", null)
            .order("created_at", { ascending: false })
            .limit(15),
        ]);

        const list: TimelineEvent[] = [];

        for (const t of transitions) {
          list.push({
            id: `s-${t.id}`,
            kind: "scenario",
            ts: t.created_at,
            title: `Cenário ${t.from_scenario ?? "—"} → ${t.to_scenario}`,
            detail: t.reason || "Transição automática",
            tone: "primary",
          });
        }

        for (const s of signals.filter((x: any) => x.triggered)) {
          list.push({
            id: `p-${s.id}`,
            kind: "pressure",
            ts: s.created_at,
            title: `Pressão: ${s.signal_type.replace(/_/g, " ")}`,
            detail: `valor ${Number(s.value).toFixed(2)}${s.threshold ? ` / limite ${Number(s.threshold).toFixed(2)}` : ""}`,
            tone: "warn",
          });
        }

        const territory = (territoryRes.data ?? []) as any[];
        for (const t of territory) {
          if (!t.drift_direction && t.saturation_level == null) continue;
          list.push({
            id: `t-${t.id}`,
            kind: "territory",
            ts: t.created_at,
            title: `Território ${t.drift_direction ?? "estável"}`,
            detail: [
              t.drift_magnitude != null ? `drift ${(t.drift_magnitude * 100).toFixed(0)}%` : null,
              t.saturation_level != null ? `saturação ${(t.saturation_level * 100).toFixed(0)}%` : null,
            ]
              .filter(Boolean)
              .join(" · "),
            tone: "accent",
          });
        }

        const lineage = (lineageRes.data ?? []) as any[];
        for (const l of lineage) {
          list.push({
            id: `l-${l.id}`,
            kind: "lineage",
            ts: l.created_at,
            title: `Linhagem ${l.lineage}: ${l.drift_status}`,
            detail: l.drift_magnitude != null ? `drift ${(l.drift_magnitude * 100).toFixed(0)}%` : "",
            tone: "muted",
          });
        }

        list.sort((a, b) => (a.ts < b.ts ? 1 : -1));
        if (!cancelled) {
          setEvents(list.slice(0, 30));
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Falha ao carregar timeline");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="glass p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-accent" />
        <span className="text-sm font-medium">Linha do tempo evolutiva</span>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          {events.length}
        </Badge>
      </div>

      {loading && (
        <div className="text-[11px] text-muted-foreground">Carregando eventos do ecossistema…</div>
      )}
      {error && <div className="text-[11px] text-destructive">{error}</div>}
      {!loading && !error && events.length === 0 && (
        <div className="text-[11px] text-muted-foreground">
          Nenhum evento registrado ainda. Gere alguns lotes para ativar a timeline.
        </div>
      )}

      {events.length > 0 && (
        <ol className="relative space-y-3 pl-4 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border/60">
          {events.map((ev) => (
            <li key={ev.id} className="relative">
              <span
                className={
                  "absolute -left-[10px] top-1 h-2 w-2 rounded-full " +
                  (ev.tone === "primary"
                    ? "bg-primary shadow-glow"
                    : ev.tone === "accent"
                    ? "bg-accent"
                    : ev.tone === "warn"
                    ? "bg-yellow-500"
                    : "bg-muted-foreground/60")
                }
              />
              <div className="flex items-start gap-2">
                <EventIcon kind={ev.kind} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[12px] font-medium truncate">
                    <span className="truncate">{ev.title}</span>
                  </div>
                  {ev.detail && (
                    <div className="text-[11px] text-muted-foreground truncate">{ev.detail}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                    {fmt(ev.ts)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function EventIcon({ kind }: { kind: TimelineEvent["kind"] }) {
  const cls = "h-3.5 w-3.5 shrink-0 mt-0.5";
  if (kind === "scenario") return <ArrowRight className={cls + " text-primary"} />;
  if (kind === "pressure") return <Gauge className={cls + " text-yellow-500"} />;
  if (kind === "territory") return <Compass className={cls + " text-accent"} />;
  return <Zap className={cls + " text-muted-foreground"} />;
}
