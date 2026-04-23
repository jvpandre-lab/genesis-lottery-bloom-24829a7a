import { healthService, HistoryHealth } from "@/services/healthService";
import { AlertCircle, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

export function HistoryHealthIndicator() {
  const [health, setHealth] = useState<HistoryHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const health = await healthService.getHistoryHealth();
        setHealth(health);
      } catch (error) {
        console.error("Erro ao carregar saúde do histórico:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading || !health) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-pulse text-sm text-gray-500">Carregando...</div>
      </div>
    );
  }

  const bgColor = healthService.getClassificationColor(health.classification);
  const icon = healthService.getClassificationIcon(health.classification);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{icon}</span>
            <h3 className="text-sm font-semibold text-gray-900">
              Status do Histórico
            </h3>
          </div>

          {/* Classification Badge */}
          <div className="mb-3">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-white text-sm font-medium"
              style={{ backgroundColor: bgColor }}
            >
              <div className="w-2 h-2 rounded-full bg-white opacity-50"></div>
              {health.classification}
            </div>
          </div>

          {/* Health Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">
                Cobertura do Histórico
              </span>
              <span className="text-xs font-semibold text-gray-900">
                {health.totalCount} concursos
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(health.healthPercentage, 100)}%`,
                  backgroundColor: bgColor,
                }}
              ></div>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-gray-600 leading-relaxed mb-2">
            {health.description}
          </p>

          {/* Source and Update */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Fonte:{" "}
              <span className="font-medium text-gray-700 capitalize">
                {health.lastSource}
              </span>
            </span>
            <span>
              {new Date(health.lastUpdated).toLocaleTimeString("pt-BR")}
            </span>
          </div>
        </div>

        {/* Info Icon */}
        {health.classification === "VAZIO" && (
          <div className="ml-3 flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
        )}
        {health.classification === "FORTE" && (
          <div className="ml-3 flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
        )}
      </div>

      {/* Status Messages */}
      {health.classification === "VAZIO" && (
        <div className="mt-3 rounded bg-red-50 border border-red-200 p-2">
          <p className="text-xs text-red-700">
            ⚠️ Sistema sem dados históricos. Pressione "Sincronizar API" ou
            envie um arquivo.
          </p>
        </div>
      )}

      {health.classification === "CRÍTICO" && (
        <div className="mt-3 rounded bg-orange-50 border border-orange-200 p-2">
          <p className="text-xs text-orange-700">
            ⛔ Histórico muito limitado ({health.totalCount} concursos).
            Recomenda-se sincronizar com API ou fazer upload adicional.
          </p>
        </div>
      )}

      {health.classification === "BÁSICO" && (
        <div className="mt-3 rounded bg-yellow-50 border border-yellow-200 p-2">
          <p className="text-xs text-yellow-700">
            📊 Histórico adequado ({health.totalCount} concursos) mas pode ser
            expandido.
          </p>
        </div>
      )}

      {health.classification === "FORTE" && (
        <div className="mt-3 rounded bg-green-50 border border-green-200 p-2">
          <p className="text-xs text-green-700">
            🎯 Sistema com histórico robusto ({health.totalCount} concursos).
            Pronto para backtesting avançado.
          </p>
        </div>
      )}
    </div>
  );
}
