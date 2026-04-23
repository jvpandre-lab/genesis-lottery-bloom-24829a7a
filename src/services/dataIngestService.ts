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
 * Contrato padronizado de retorno da importação histórica.
 * Toda chamada DEVE retornar este formato — nunca undefined em campos numéricos.
 */
export interface ImportHistoricalResult {
  ok: boolean;
  totalFetched: number;
  inserted: number;
  duplicates: number;
  lastContestNumber: number | null;
  error?: string;
}

/**
 * IMPORTAÇÃO HISTÓRICA — fluxo único, real e auditável.
 *
 * Etapas:
 *  1. GET https://loteriascaixa-api.herokuapp.com/api/lotomania (com AbortController/timeout)
 *  2. Valida payload: array, cada item com 20 dezenas no domínio 0..99
 *  3. Normaliza (data DD/MM/YYYY → YYYY-MM-DD, números ordenados)
 *  4. Upsert no Supabase com ignoreDuplicates
 *  5. Retorna SEMPRE o contrato ImportHistoricalResult (sem undefined)
 */
export async function importHistoricalDraws(
  timeoutMs = 20000,
): Promise<ImportHistoricalResult> {
  const before = await safeCountDraws();

  // 1. Fetch com timeout via AbortController
  let apiData: any[];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(CAIXA_API_URL, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      return failure(
        before,
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }
    const json = await response.json();
    if (!Array.isArray(json)) {
      return failure(before, "Resposta da API não é um array.");
    }
    apiData = json;
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? `Timeout (${timeoutMs}ms) ao chamar API da Caixa.`
        : err?.message || "Falha de rede ao acessar API.";
    return failure(before, msg);
  }

  const totalFetched = apiData.length;

  // 2 + 3. Validar e normalizar
  const toInsert: DrawRecord[] = [];
  const seen = new Set<number>();
  const timestamp = new Date().toISOString();

  for (const item of apiData) {
    const contest = Number(item?.concurso ?? item?.contestNumber);
    if (!Number.isFinite(contest) || contest < 1 || seen.has(contest)) continue;

    const rawNums = item?.dezenas ?? item?.numbers ?? [];
    if (!Array.isArray(rawNums) || rawNums.length !== 20) continue;

    const nums: Dezena[] = [];
    let valid = true;
    for (const raw of rawNums) {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < DOMAIN_MIN || n > DOMAIN_MAX) {
        valid = false;
        break;
      }
      nums.push(n as Dezena);
    }
    if (!valid) continue;

    const unique = Array.from(new Set(nums));
    if (unique.length !== 20) continue;

    let drawDate: string | undefined;
    if (typeof item?.data === "string") {
      const parts = item.data.split("/");
      if (parts.length === 3) {
        const [d, m, y] = parts;
        drawDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    } else if (typeof item?.drawDate === "string") {
      drawDate = item.drawDate.slice(0, 10);
    }

    seen.add(contest);
    toInsert.push({
      contestNumber: contest,
      drawDate,
      numbers: unique.sort((a, b) => a - b) as Dezena[],
      source: "api",
      syncedAt: timestamp,
      lastCheckedAt: timestamp,
    });
  }

  if (toInsert.length === 0) {
    return failure(before, "Nenhum concurso válido na resposta da API.");
  }

  // 4. Upsert
  let inserted = 0;
  try {
    inserted = await upsertDraws(toInsert);
  } catch (err: any) {
    return failure(before, err?.message || "Falha ao gravar no banco.");
  }

  const duplicates = Math.max(0, totalFetched - inserted);
  const lastContestNumber = toInsert.reduce(
    (max, d) => (d.contestNumber > max ? d.contestNumber : max),
    0,
  );

  return {
    ok: true,
    totalFetched,
    inserted,
    duplicates,
    lastContestNumber,
  };
}

function failure(
  beforeCount: number,
  error: string,
): ImportHistoricalResult {
  return {
    ok: false,
    totalFetched: 0,
    inserted: 0,
    duplicates: 0,
    lastContestNumber: null,
    error,
  };
}

async function safeCountDraws(): Promise<number> {
  try {
    return await countDraws();
  } catch {
    return 0;
  }
}

/* ============================================================
 * Funções auxiliares preservadas (export JSON/CSV, stats).
 * Mantidas porque são consumidas em outros pontos da UI.
 * ============================================================ */

export async function exportDrawsAsJSON(): Promise<string> {
  const allDraws = await fetchAllDraws();
  const exported = allDraws.map((d) => ({
    contestNumber: d.contestNumber,
    drawDate: d.drawDate || null,
    numbers: d.numbers,
  }));
  return JSON.stringify(exported, null, 2);
}

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
    const lastContestNumber = allDraws.reduce(
      (max, d) => (d.contestNumber > max ? d.contestNumber : max),
      0,
    );
    return {
      totalCount: allDraws.length,
      lastContestNumber,
      lastDrawDate: recentDraws[0]?.drawDate,
      isComplete: allDraws.length >= 2900,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      totalCount: 0,
      lastContestNumber: 0,
      isComplete: false,
      updatedAt: new Date().toISOString(),
    };
  }
}
