import { getHistorySource } from "./contestService";
import { countDraws } from "./storageService";

export interface HistoryHealth {
  totalCount: number;
  classification: "VAZIO" | "CRÍTICO" | "BÁSICO" | "BOM" | "FORTE";
  lastSource: string;
  lastUpdated: string;
  description: string;
  healthPercentage: number;
}

export const healthService = {
  async getHistoryHealth(): Promise<HistoryHealth> {
    try {
      const totalCount = await countDraws();
      const lastSource = getHistorySource();
      const lastUpdated = new Date().toISOString();

      let classification: "VAZIO" | "CRÍTICO" | "BÁSICO" | "BOM" | "FORTE";
      let description: string;
      let healthPercentage: number;

      if (totalCount === 0) {
        classification = "VAZIO";
        description =
          'Nenhum histórico carregado. Use "Sincronizar API" ou "Upload Fallback".';
        healthPercentage = 0;
      } else if (totalCount < 5) {
        classification = "CRÍTICO";
        description = `Apenas ${totalCount} concurso(s). Histórico muito limitado.`;
        healthPercentage = 10;
      } else if (totalCount < 50) {
        classification = "BÁSICO";
        description = `${totalCount} concursos disponíveis. Histórico inicial adequado.`;
        healthPercentage = 40;
      } else if (totalCount < 150) {
        classification = "BOM";
        description = `${totalCount} concursos disponíveis. Histórico robusto.`;
        healthPercentage = 70;
      } else {
        classification = "FORTE";
        description = `${totalCount} concursos disponíveis. Histórico muito robusto.`;
        healthPercentage = 100;
      }

      return {
        totalCount,
        classification,
        lastSource: lastSource || "desconhecido",
        lastUpdated,
        description,
        healthPercentage,
      };
    } catch (error) {
      console.error("Erro ao calcular saúde do histórico:", error);
      return {
        totalCount: 0,
        classification: "VAZIO",
        lastSource: "erro",
        lastUpdated: new Date().toISOString(),
        description: "Erro ao calcular saúde do histórico.",
        healthPercentage: 0,
      };
    }
  },

  getClassificationColor(classification: string): string {
    switch (classification) {
      case "VAZIO":
        return "#ef4444"; // red
      case "CRÍTICO":
        return "#f97316"; // orange
      case "BÁSICO":
        return "#eab308"; // yellow
      case "BOM":
        return "#84cc16"; // lime
      case "FORTE":
        return "#22c55e"; // green
      default:
        return "#6b7280"; // gray
    }
  },

  getClassificationIcon(classification: string): string {
    switch (classification) {
      case "VAZIO":
        return "⚠️";
      case "CRÍTICO":
        return "⛔";
      case "BÁSICO":
        return "📊";
      case "BOM":
        return "✅";
      case "FORTE":
        return "🎯";
      default:
        return "❓";
    }
  },
};
