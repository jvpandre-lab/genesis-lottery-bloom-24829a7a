import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  getHistorySource,
  HistorySource,
  parseDrawsFile,
  setHistorySource,
  syncDraws,
} from "@/services/contestService";
import {
  countDraws,
  fetchRecentDraws,
  upsertDraws,
} from "@/services/storageService";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Database, FileWarning, Loader2, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export const HistoryUploader = React.forwardRef<
  HTMLDivElement,
  { onChanged?: (total: number) => void }
>(({ onChanged }, _ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState<number | null>(null);
  const [historySource, setHistorySourceState] =
    useState<HistorySource>("unknown");
  const [latestSync, setLatestSync] = useState<{
    source?: string;
    syncedAt?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const c = await countDraws();
      setCount(c);
      if (c > 0) {
        const recent = await fetchRecentDraws(1);
        if (recent.length > 0) {
          setLatestSync({
            source: recent[0].source,
            syncedAt: recent[0].syncedAt,
          });
        }
        setHistorySourceState(getHistorySource());
      } else {
        setLatestSync(null);
        setHistorySourceState("unknown");
      }
      onChanged?.(c);
      return c;
    } catch {
      setCount(null);
      setLatestSync(null);
      setHistorySourceState("unknown");
      return 0;
    }
  }

  useEffect(() => {
    (async () => {
      const currentCount = await refresh();
      if (currentCount === 0) {
        setBusy(true);
        try {
          const report = await syncDraws();
          if (report.status === "success") {
            const source = report.source ?? "database";
            if (source !== "database") {
              setHistorySource(source);
            }
            setHistorySourceState(source as HistorySource);
            toast({
              title: "Histórico inicial carregado",
              description:
                source === "seed"
                  ? "Seed local carregada porque a API não estava disponível."
                  : "Histórico inicial recuperado da API oficial.",
            });
          } else {
            toast({
              title: "Falha ao inicializar histórico",
              description:
                report.error ||
                "Não foi possível carregar o histórico inicial.",
              variant: "destructive",
            });
          }
        } catch (e: any) {
          toast({
            title: "Falha ao inicializar histórico",
            description: e?.message || "Erro desconhecido",
            variant: "destructive",
          });
        } finally {
          setBusy(false);
          await refresh();
        }
      }
    })();
  }, []);

  async function handleSyncApi() {
    setBusy(true);
    try {
      const report = await syncDraws();
      if (report.status === "success") {
        toast({
          title: "Sincronização OK",
          description: `${report.newRecordsAdded} concursos novos adicionados. ${report.recordsIgnoredDuplicate} já registrados.`,
        });
      } else if (report.status === "fallback_banco") {
        toast({
          title: "Fallback Automático",
          description:
            "API da Caixa demorou a responder ou falhou. Operando 100% com dados do banco atual.",
        });
      } else {
        toast({
          title: "Erro Crítico",
          description:
            report.error || "A API e o Banco falharam simultaneamente.",
          variant: "destructive",
        });
      }
      if (report.source) {
        setHistorySource(report.source);
        setHistorySourceState(report.source as HistorySource);
      }
      await refresh();
    } catch (e: any) {
      toast({
        title: "Falha de Sincronização",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const result = parseDrawsFile(text, file.name) as any;
      const { draws, report } = result;

      if (draws.length === 0) {
        toast({
          title: "Nenhum concurso reconhecido",
          description: "Verifique o formato do arquivo.",
          variant: "destructive",
        });
        return;
      }
      const inserted = await upsertDraws(draws);
      setHistorySource("manual");
      setHistorySourceState("manual");
      const discardSummary = report?.discardReasons
        ? Object.entries(report.discardReasons)
            .map(([reason, count]) => `${reason}: ${count}`)
            .join(", ")
        : "";
      toast({
        title: "Histórico atualizado",
        description: `${inserted} concursos importados. Lidos: ${report?.totalRead || 0}, Válidos: ${report?.totalValid || 0}, Descartados: ${report?.totalDiscarded || 0}${discardSummary ? ` (${discardSummary})` : ""}.`,
      });
      await refresh();
    } catch (e: any) {
      toast({
        title: "Falha ao importar",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleExportJSON() {
    setBusy(true);
    try {
      const data = await exportDrawsAsJSON();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lotomania-draws-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Exportado",
        description: "Histórico exportado como JSON com sucesso.",
      });
    } catch (e: any) {
      toast({
        title: "Falha na exportação",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleExportCSV() {
    setBusy(true);
    try {
      const data = await exportDrawsAsCSV();
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lotomania-draws-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Exportado",
        description: "Histórico exportado como CSV com sucesso.",
      });
    } catch (e: any) {
      toast({
        title: "Falha na exportação",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncFullAPI() {
    setBusy(true);
    try {
      const result = await syncAllDrawsFromAPI();
      if (result.error) {
        toast({
          title: "Erro na sincronização",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sincronização Completa",
          description: `API retornou ${result.totalFromAPI} concursos. Novos: ${result.newRecordsAdded}, Duplicados: ${result.duplicatesIgnored}. Último concurso: #${result.lastContestNumber}.`,
        });
        setHistorySource("api");
        setHistorySourceState("api");
        await refresh();
      }
    } catch (e: any) {
      toast({
        title: "Falha",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-surface-2 border border-border/60 flex items-center justify-center">
          <Database className="h-5 w-5 text-accent" />
        </div>
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            Histórico Oficial
            {historySource !== "unknown" && (
              <Badge
                variant="outline"
                className={`text-[10px] uppercase h-5 font-bold ${historySource === "api" ? "text-green-400 border-green-500/30" : historySource === "manual" ? "text-yellow-400 border-yellow-500/30" : historySource === "seed" ? "text-indigo-400 border-indigo-500/30" : "text-blue-400 border-blue-500/30"}`}
              >
                Origem: {historySource}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex flex-col mt-0.5">
            {count === null ? (
              "Indisponível"
            ) : count === 0 ? (
              <span className="inline-flex items-center gap-1 text-yellow-500/80">
                <FileWarning className="h-3 w-3" /> Nenhum concurso. Anti-viés
                operará no escuro.
              </span>
            ) : (
              <span>{count} concursos armazenados na base local.</span>
            )}

            {count > 0 && historySource === "unknown" && (
              <span className="text-[10px] opacity-75 text-yellow-400">
                Histórico disponível, mas a origem não pôde ser rastreada.
              </span>
            )}
            {historySource === "seed" && count > 0 && (
              <span className="text-[10px] opacity-75 text-indigo-400">
                ⚠️ Histórico do seed local (1999-2026, {count} concursos).
                Recomenda-se sincronizar com API ou upload de dados atualizados.
              </span>
            )}
            {historySource === "manual" && count > 0 && (
              <span className="text-[10px] opacity-75 text-yellow-400">
                Histórico atualizado via upload manual.
              </span>
            )}
            {historySource === "api" && count > 0 && (
              <span className="text-[10px] opacity-75 text-green-400">
                ✓ Histórico sincronizado da API oficial ({count} concursos).
                Dados atualizados.
              </span>
            )}
            {historySource === "database" && count > 0 && (
              <span className="text-[10px] opacity-75 text-blue-400">
                Histórico existente encontrado no banco local.
              </span>
            )}

            {latestSync?.syncedAt && (
              <span className="text-[10px] opacity-75">
                Última sincronia:{" "}
                {formatDistanceToNow(new Date(latestSync.syncedAt), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={handleSyncApi}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          <span className="ml-2">Sincronizar API</span>
        </Button>
        <Input
          ref={inputRef}
          type="file"
          accept=".csv,.json,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="border-border/60 text-xs w-full sm:w-auto"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span className="ml-2">Upload Fallback</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportJSON}
          disabled={busy || count === 0}
          className="border-border/60 text-xs w-full sm:w-auto"
          title="Exportar todos os concursos como JSON"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="ml-2">JSON</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={busy || count === 0}
          className="border-border/60 text-xs w-full sm:w-auto"
          title="Exportar todos os concursos como CSV"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="ml-2">CSV</span>
        </Button>
      </div>
    </div>
  );
});
HistoryUploader.displayName = "HistoryUploader";
