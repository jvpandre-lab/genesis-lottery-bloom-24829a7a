import {
  Dezena,
  DOMAIN_MAX,
  DOMAIN_MIN,
  DrawRecord,
} from "@/engine/lotteryTypes";
import {
  countDraws,
  fetchAllDraws,
  fetchRecentDraws,
  upsertDraws,
} from "./storageService";

const CAIXA_API_URL = "https://loteriascaixa-api.herokuapp.com/api/lotomania";

/**
 * Ingestão Aprimorada: Sincroniza TODOS os concursos da API oficial
 * com estratégia incremental (apenas novos são inseridos)
 */
export async function syncAllDrawsFromAPI(): Promise<{
  totalFromAPI: number;
  newRecordsAdded: number;
  duplicatesIgnored: number;
  lastContestNumber: number;
  error?: string;
}> {
  try {
    console.log("[SYNC] Iniciando sincronização completa com API Caixa...");

    // 1. Fetch TODOS os concursos da API
    const response = await fetch(CAIXA_API_URL, { timeout: 15000 });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const apiData = await response.json();
    if (!Array.isArray(apiData)) {
      throw new Error("API não retornou um array");
    }

    console.log(`[SYNC] API retornou ${apiData.length} concursos`);

    // 2. Contar o que já temos
    const currentCount = await countDraws();
    console.log(`[SYNC] Banco tem ${currentCount} concursos atualmente`);

    // 3. Normalizar dados da API
    const toInsert: DrawRecord[] = [];
    const timestamp = new Date().toISOString();

    for (const item of apiData) {
      const contest = Number(item.concurso);
      if (!contest || contest < 1) continue;

      const dezenas = item.dezenas ?? item.números ?? [];
      if (!Array.isArray(dezenas) || dezenas.length !== 20) continue;

      const nums: Dezena[] = dezenas
        .map((n) => {
          const parsed = Number(n);
          if (parsed >= DOMAIN_MIN && parsed <= DOMAIN_MAX) {
            return parsed as Dezena;
          }
          return null;
        })
        .filter((n): n is Dezena => n !== null);

      if (nums.length !== 20) continue;

      // Normalizar data (DD/MM/YYYY → YYYY-MM-DD)
      let drawDate: string | undefined;
      if (typeof item.data === "string") {
        const [day, month, year] = item.data.split("/");
        if (day && month && year) {
          drawDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
      }

      toInsert.push({
        contestNumber: contest,
        drawDate,
        numbers: nums.sort((a, b) => a - b),
        source: "api",
        syncedAt: timestamp,
        lastCheckedAt: timestamp,
      });
    }

    console.log(`[SYNC] ${toInsert.length} concursos válidos normalizados`);

    // 4. Upsert (duplicatas serão ignoradas)
    if (toInsert.length === 0) {
      return {
        totalFromAPI: apiData.length,
        newRecordsAdded: 0,
        duplicatesIgnored: 0,
        lastContestNumber: currentCount > 0 ? 2915 : 0,
        error: "Nenhum concurso válido encontrado na API",
      };
    }

    const inserted = await upsertDraws(toInsert);
    const duplicates = toInsert.length - inserted;

    console.log(
      `[SYNC] Inserção completa: +${inserted} novos, ${duplicates} duplicados`,
    );

    return {
      totalFromAPI: apiData.length,
      newRecordsAdded: inserted,
      duplicatesIgnored: duplicates,
      lastContestNumber: Math.max(...toInsert.map((d) => d.contestNumber)),
    };
  } catch (error: any) {
    console.error("[SYNC] Erro na sincronização:", error.message);
    return {
      totalFromAPI: 0,
      newRecordsAdded: 0,
      duplicatesIgnored: 0,
      lastContestNumber: 0,
      error: error.message,
    };
  }
}

/**
 * Exportar todos os concursos como JSON para download
 */
export async function exportDrawsAsJSON(): Promise<string> {
  const allDraws = await fetchAllDraws();

  const exported = allDraws.map((d) => ({
    contestNumber: d.contestNumber,
    drawDate: d.drawDate || null,
    numbers: d.numbers,
  }));

  return JSON.stringify(exported, null, 2);
}

/**
 * Exportar todos os concursos como CSV
 */
export async function exportDrawsAsCSV(): Promise<string> {
  const allDraws = await fetchAllDraws();

  const lines: string[] = ["contestNumber,drawDate,numbers"];

  for (const draw of allDraws) {
    const date = draw.drawDate || "";
    const nums = draw.numbers.join(",");
    lines.push(`${draw.contestNumber},${date},${nums}`);
  }

  return lines.join("\n");
}

/**
 * Retornar informações de status do histórico
 */
export async function getHistoryStats(): Promise<{
  totalCount: number;
  lastContestNumber: number;
  lastDrawDate?: string;
  isComplete: boolean;
  updatedAt: string;
}> {
  try {
    const allDraws = await fetchAllDraws();
    const recentDraws = await fetchRecentDraws(1);

    const lastContestNumber = Math.max(
      ...allDraws.map((d) => d.contestNumber),
      0,
    );
    const lastDraw = recentDraws[0];

    return {
      totalCount: allDraws.length,
      lastContestNumber,
      lastDrawDate: lastDraw?.drawDate,
      isComplete: allDraws.length >= 2900,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      totalCount: 0,
      lastContestNumber: 0,
      isComplete: false,
      updatedAt: new Date().toISOString(),
    };
  }
}
