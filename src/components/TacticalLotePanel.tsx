import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Batch, TacticalRole } from "@/engine/lotteryTypes";
import { Layers } from "lucide-react";
import React from "react";

const roleColors: Record<TacticalRole, string> = {
  Anchor: "bg-blue-500/20 text-blue-300",
  Explorer: "bg-purple-500/20 text-purple-300",
  Breaker: "bg-red-500/20 text-red-300",
  Shield: "bg-cyan-500/20 text-cyan-300",
  Spreader: "bg-yellow-500/20 text-yellow-300",
  AntiCrowd: "bg-green-500/20 text-green-300",
};

const roleDescriptions: Record<TacticalRole, string> = {
  Anchor: "Estabilidade estrutural",
  Explorer: "Exploração territorial",
  Breaker: "Ruptura de padrão",
  Shield: "Proteção contra falhas",
  Spreader: "Dispersão extrema",
  AntiCrowd: "Anti-padrão humano",
};

type TacticalGame = Batch["games"][number];

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

export const TacticalLotePanel = React.forwardRef<
  HTMLDivElement,
  { batches?: Batch[] }
>(({ batches = [] }, _ref) => {
  const games = batches.flatMap((batch) => batch.games) as TacticalGame[];
  const composition: Record<TacticalRole, number> = {
    Anchor: 0,
    Explorer: 0,
    Breaker: 0,
    Shield: 0,
    Spreader: 0,
    AntiCrowd: 0,
  };

  for (const game of games) {
    if (game.tacticalRole) composition[game.tacticalRole]++;
  }

  const totalGames = games.length;
  const ideal = totalGames > 0 ? totalGames / 6 : 0;
  const imbalance =
    totalGames > 0
      ? Object.values(composition).reduce(
          (sum, count) => sum + Math.abs(count - ideal),
          0,
        ) /
        (totalGames * 2)
      : 0;
  const balanceScore = Math.round((1 - imbalance) * 100);
  const rolesWithGames = (Object.keys(composition) as TacticalRole[]).filter(
    (role) => composition[role] > 0,
  );

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <div>
            <div className="text-sm font-medium">Composição Tática</div>
            <div className="text-[11px] text-muted-foreground">
              Resumo por lote e papel tático.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Stat label="Jogos totais" value={totalGames} />
          <Stat label="Equilíbrio tático" value={`${balanceScore}%`} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {(Object.entries(composition) as [TacticalRole, number][]).map(
            ([role, count]) => (
              <div
                key={role}
                className="flex items-center gap-2 rounded-md bg-surface-2/60 border border-border/50 p-2"
              >
                <Badge className={`text-xs ${roleColors[role]}`}>{role}</Badge>
                <span className="text-xs text-muted-foreground">{count}</span>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {batches.map((batch) => {
          const batchComposition: Record<TacticalRole, number> = {
            Anchor: 0,
            Explorer: 0,
            Breaker: 0,
            Shield: 0,
            Spreader: 0,
            AntiCrowd: 0,
          };
          for (const game of batch.games as TacticalGame[]) {
            if (game.tacticalRole) batchComposition[game.tacticalRole]++;
          }
          return (
            <Card key={batch.name} className="glass p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{batch.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {batch.purpose}
                  </div>
                </div>
                <Badge className="font-mono">{batch.games.length} jogos</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {(
                  Object.entries(batchComposition) as [TacticalRole, number][]
                ).map(([role, count]) => (
                  <div
                    key={role}
                    className="rounded-md bg-surface-2/60 border border-border/50 p-2"
                  >
                    <div className="text-muted-foreground text-[10px] uppercase tracking-widest">
                      {role}
                    </div>
                    <div className="font-mono num-mono text-base">{count}</div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {totalGames > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Jogos por papel tático
          </div>
          <Tabs defaultValue={rolesWithGames[0] ?? "Anchor"} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              {rolesWithGames.map((role) => (
                <TabsTrigger key={role} value={role} className="text-xs py-1">
                  {role} ({composition[role]})
                </TabsTrigger>
              ))}
            </TabsList>
            {rolesWithGames.map((role) => (
              <TabsContent key={role} value={role} className="space-y-3">
                <div className="text-[11px] text-muted-foreground">
                  {roleDescriptions[role]}
                </div>
                {(
                  games.filter(
                    (game) => game.tacticalRole === role,
                  ) as TacticalGame[]
                ).map((game, index) => (
                  <Card key={`${role}-${index}`} className="glass p-3">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-foreground/90">
                          {game.numbers.join(", ")}
                        </span>
                        <Badge className={`text-xs ${roleColors[role]}`}>
                          {role}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                        <div>
                          Score total: {(game.score.total * 100).toFixed(0)}%
                        </div>
                        <div>
                          Papel:{" "}
                          {typeof game.roleScore === "number"
                            ? `${(game.roleScore * 100).toFixed(0)}%`
                            : "n/a"}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      ) : (
        <Card className="glass p-4 text-[11px] text-muted-foreground">
          Nenhum jogo disponível para exibir papéis táticos.
        </Card>
      )}
    </div>
  );
});
TacticalLotePanel.displayName = "TacticalLotePanel";
