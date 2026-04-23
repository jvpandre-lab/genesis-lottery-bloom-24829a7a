import {
  Dezena,
  DOMAIN_MAX,
  DOMAIN_MIN,
  DrawRecord,
} from "@/engine/lotteryTypes";
import { fetchRecentDraws, upsertDraws } from "./storageService";

export type HistorySource = "api" | "seed" | "manual" | "database" | "unknown";

export interface ImportReport {
  totalRead: number;
  totalValid: number;
  totalDiscarded: number;
  discardReasons: Record<string, number>;
}

export interface SyncReport {
  status: "success" | "fallback_banco" | "erro_total";
  source?: Exclude<HistorySource, "unknown">;
  seedFallback?: boolean;
  newRecordsAdded: number;
  recordsIgnoredDuplicate: number;
  apiTotalFetched?: number;
  error?: string;
  lastSuccessfulSyncAt?: string;
}

const HISTORY_SOURCE_STORAGE_KEY = "genesis_lottery_history_source";

export function getHistorySource(): HistorySource {
  if (typeof window === "undefined") return "unknown";
  const source = window.localStorage.getItem(HISTORY_SOURCE_STORAGE_KEY);
  if (
    source === "api" ||
    source === "seed" ||
    source === "manual" ||
    source === "database"
  ) {
    return source;
  }
  return "unknown";
}

export function setHistorySource(source: Exclude<HistorySource, "unknown">) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_SOURCE_STORAGE_KEY, source);
}

// Global in-memory cache for status (could be persisted to LocalStorage if needed)
let globalLastSuccessfulSync: string | null = null;

async function fetchSeedDraws(): Promise<DrawRecord[]> {
  const response = await fetch("/lotomania-seed.json");
  if (!response.ok) {
    throw new Error(`Falha ao carregar seed local: ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Seed local inválida: formato esperado é array.");
  }

  const timestamp = new Date().toISOString();
  const seenContests = new Set<number>();
  const out: DrawRecord[] = [];

  for (const item of payload) {
    const contest = Number(item.contestNumber ?? item.concurso ?? item.numero);
    if (!Number.isFinite(contest) || contest < 1 || seenContests.has(contest)) {
      continue;
    }
    const valid = validateDraw(
      item.numbers ?? item.dezenas ?? item.numeros ?? [],
    );
    if ("error" in valid) {
      continue;
    }
    seenContests.add(contest);
    out.push({
      contestNumber: contest,
      drawDate:
        typeof item.drawDate === "string"
          ? item.drawDate.slice(0, 10)
          : undefined,
      numbers: valid,
      source: "seed",
      syncedAt: timestamp,
      lastCheckedAt: timestamp,
    });
  }

  return out.sort((a, b) => a.contestNumber - b.contestNumber);
}

/**
 * BOOTSTRAP FALLBACK: Carrega seed histórico antigo (1999-2003) apenas como último recurso
 * quando banco está vazio E API falha.
 *
 * IMPORTANTE: Seed é apenas base mínima, NÃO deve ser usado como contexto recente em geração
 * quando dados reais estiverem disponíveis. Use fetchRecentRealDraws() para evitar mistura.
 */
async function applySeedFallback(): Promise<SyncReport> {
  const report: SyncReport = {
    status: "success",
    source: "seed",
    seedFallback: true,
    newRecordsAdded: 0,
    recordsIgnoredDuplicate: 0,
    lastSuccessfulSyncAt: new Date().toISOString(),
  };

  const seedDraws = await fetchSeedDraws();
  if (seedDraws.length === 0) {
    report.status = "erro_total";
    report.error = "Seed local vazia ou inválida.";
    return report;
  }

  const inserted = await upsertDraws(seedDraws);
  report.newRecordsAdded = inserted;
  report.recordsIgnoredDuplicate = seedDraws.length - inserted;
  globalLastSuccessfulSync = report.lastSuccessfulSyncAt;
  setHistorySource("seed");
  return report;
}

const CAIXA_API_URL = "https://loteriascaixa-api.herokuapp.com/api/lotomania";

/**
 * Validação de Concurso Oficial (20 dezenas sorteadas)
 * Exige EXATAMENTE 20 números, domínio 00..99, garantindo unicidade.
 */
export function validateDraw(
  rawNums: any[] | string,
): Dezena[] | { error: string } {
  let numsArr: any[];

  if (Array.isArray(rawNums)) {
    numsArr = rawNums;
  } else {
    numsArr = String(rawNums)
      .split(/[,\s;|-]+/)
      .filter(Boolean);
  }

  const rawParsed = numsArr.map((n) => {
    const numStr = String(n).trim();
    if (!/^\d{1,2}$/.test(numStr)) return null;
    const numVal = Number(numStr);
    if (!Number.isFinite(numVal) || numVal < DOMAIN_MIN || numVal > DOMAIN_MAX)
      return null;
    return numVal as Dezena;
  });

  const parsed = rawParsed.filter((n): n is Dezena => n !== null);

  if (parsed.length !== rawParsed.length) {
    return { error: "invalid_domain" };
  }

  if (parsed.length !== 20) {
    return {
      error: parsed.length < 20 ? "insufficient_numbers" : "too_many_numbers",
    };
  }

  const unique = Array.from(new Set(parsed));

  if (unique.length !== parsed.length) {
    return { error: "duplicate_numbers" };
  }

  const isSorted = parsed.every((val, i, arr) => !i || val >= arr[i - 1]);
  if (!isSorted) {
    return { error: "unsorted_numbers" };
  }

  return unique.sort((a, b) => a - b) as Dezena[];
}

/**
 * Busca histórico automaticamente via API oficial (Defensiva)
 */
async function fetchDrawsFromAPIWithRetry(
  retries = 2,
  timeoutMs = 8000,
): Promise<any[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(CAIXA_API_URL);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("API não retornou um array.");
      return data;
    } catch (e: any) {
      console.warn(`[API] Tentativa ${attempt} falhou: ${e.message}`);
      if (attempt === retries) {
        throw new Error("Todas as tentativas de fetch falharam.");
      }
    }
  }
  return [];
}

/**
 * Sincronizador Híbrido: API → Banco Onde Faltar (Incremental)
 */
export async function syncDraws(): Promise<SyncReport> {
  const report: SyncReport = {
    status: "erro_total",
    newRecordsAdded: 0,
    recordsIgnoredDuplicate: 0,
  };

  try {
    // Passo 1: O que temos no banco? Identificar o mais recente.
    const fromDb = await fetchRecentDraws(1);
    const lastContestNumber = fromDb.length > 0 ? fromDb[0].contestNumber : 0;

    // Passo 2: Buscar da API com retry
    let apiData: any[];
    try {
      apiData = await fetchDrawsFromAPIWithRetry(2, 8000);
      report.apiTotalFetched = apiData.length;
    } catch (e: any) {
      if (lastContestNumber === 0) {
        // Primeira inicialização com banco vazio: usar seed local se a API falhar.
        const fallback = await applySeedFallback();
        return {
          ...fallback,
          error:
            fallback.status === "erro_total"
              ? `API offline e seed local falhou: ${e.message}`
              : fallback.error,
        };
      }
      // Fallback pro banco!
      report.status = "fallback_banco";
      report.error = "API offline ou falhou, usando dados locais existentes.";
      if (globalLastSuccessfulSync)
        report.lastSuccessfulSyncAt = globalLastSuccessfulSync;
      report.source = "database";
      return report;
    }

    if (apiData.length === 0 && lastContestNumber === 0) {
      return await applySeedFallback();
    }

    // Passo 3: Normalizar e extrair incrementais
    const toInsert: DrawRecord[] = [];
    const timestamp = new Date().toISOString();

    for (const item of apiData) {
      const contest = Number(item.concurso ?? item.contestNumber);
      if (!contest || contest <= lastContestNumber) {
        continue; // Ignora os que já temos ou lixos sem concurso (Incremental)
      }

      const rawNums = item.dezenas ?? item.numbers;
      const valid = validateDraw(rawNums);

      if ("error" in valid) {
        // Registro ignorado: validação falhou
        report.recordsIgnoredDuplicate++;
      } else {
        // Mantém o padrão numérico do sistema: Dezena[] ordenado para draws oficiais.
        toInsert.push({
          contestNumber: contest,
          drawDate: item.data ? normalizeDate(item.data) : undefined,
          numbers: valid,
          source: "api",
          syncedAt: timestamp,
          lastCheckedAt: timestamp,
        });
      }
    }

    if (toInsert.length === 0 && lastContestNumber === 0) {
      return await applySeedFallback();
    }

    if (toInsert.length > 0) {
      // Upsert defensivo (ignoreDuplicates ativado no Service para proteger histórico)
      const added = await upsertDraws(toInsert);
      report.newRecordsAdded = added;
      // os que n foram adicionados do lote toInsert, foram ignorados
      report.recordsIgnoredDuplicate += toInsert.length - added;
    }

    globalLastSuccessfulSync = timestamp;
    report.status = "success";
    report.source = "api";
    report.lastSuccessfulSyncAt = timestamp;
    setHistorySource("api");
    return report;
  } catch (err: any) {
    report.status = "erro_total";
    report.error = err.message;
    return report;
  }
}

/**
 * PARSERS DE FALLBACK MANUAL
 */
export function parseDrawsFile(
  content: string,
  filename: string,
): { draws: DrawRecord[]; report: ImportReport } {
  const trimmed = content.trim();
  const emptyReport: ImportReport = {
    totalRead: 0,
    totalValid: 0,
    totalDiscarded: 0,
    discardReasons: {},
  };
  if (!trimmed) return { draws: [], report: emptyReport };

  if (
    filename.toLowerCase().endsWith(".json") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("{")
  ) {
    try {
      return parseJSON(trimmed);
    } catch {
      return parseCSV(trimmed);
    }
  }
  return parseCSV(trimmed);
}

function parseJSON(content: string): {
  draws: DrawRecord[];
  report: ImportReport;
} {
  const report: ImportReport = {
    totalRead: 0,
    totalValid: 0,
    totalDiscarded: 0,
    discardReasons: {},
  };
  const data = JSON.parse(content);
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as any).results)
      ? (data as any).results
      : [];
  report.totalRead = arr.length;
  const out: DrawRecord[] = [];
  const seenContests = new Set<number>();

  const timestamp = new Date().toISOString();

  for (const item of arr) {
    const contest = Number(
      item.contestNumber ??
        item.contest_number ??
        item.concurso ??
        item.numero ??
        item.number,
    );
    const drawDate = item.drawDate ?? item.draw_date ?? item.data ?? item.date;
    const rawNums =
      item.numbers ??
      item.dezenas ??
      item.dezenasSorteadas ??
      item.dezenas_sorteadas;

    if (!contest || !rawNums || !Number.isFinite(contest) || contest < 1) {
      report.discardReasons["invalid_contest_data"] =
        (report.discardReasons["invalid_contest_data"] || 0) + 1;
      report.totalDiscarded++;
      continue;
    }

    if (seenContests.has(contest)) {
      report.discardReasons["duplicate_contest_in_file"] =
        (report.discardReasons["duplicate_contest_in_file"] || 0) + 1;
      report.totalDiscarded++;
      continue;
    }

    const valid = validateDraw(rawNums);
    if ("error" in valid) {
      report.discardReasons[valid.error] =
        (report.discardReasons[valid.error] || 0) + 1;
      report.totalDiscarded++;
      continue;
    }

    seenContests.add(contest);
    out.push({
      contestNumber: contest,
      drawDate:
        typeof drawDate === "string" ? drawDate.slice(0, 10) : undefined,
      numbers: valid,
      source: "manual",
      syncedAt: timestamp,
      lastCheckedAt: timestamp,
    });
    report.totalValid++;
  }
  return {
    draws: out.sort((a, b) => a.contestNumber - b.contestNumber),
    report,
  };
}

function parseCSV(content: string): {
  draws: DrawRecord[];
  report: ImportReport;
} {
  const report: ImportReport = {
    totalRead: 0,
    totalValid: 0,
    totalDiscarded: 0,
    discardReasons: {},
  };
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  report.totalRead = lines.length;
  const out: DrawRecord[] = [];
  const seenContests = new Set<number>();
  const timestamp = new Date().toISOString();

  let start = 0;
  if (/[a-zA-Z]/.test(lines[0])) start = 1;

  for (let i = start; i < lines.length; i++) {
    const cells = lines[i]
      .split(/[,;\t]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (cells.length < 5) {
      report.discardReasons["insufficient_columns"] =
        (report.discardReasons["insufficient_columns"] || 0) + 1;
      report.totalDiscarded++;
      continue;
    }
    const contest = Number(cells[0]);
    if (!Number.isFinite(contest) || contest < 1) {
      report.discardReasons["invalid_contest_number"] =
        (report.discardReasons["invalid_contest_number"] || 0) + 1;
      report.totalDiscarded++;
      continue;
    }

    if (seenContests.has(contest)) {
      report.discardReasons["duplicate_contest_in_file"] =
        (report.discardReasons["duplicate_contest_in_file"] || 0) + 1;
      report.totalDiscarded++;
      continue;
    }

    let drawDate: string | undefined;
    let numStart = 1;
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(cells[1]) ||
      /^\d{2}\/\d{2}\/\d{4}$/.test(cells[1])
    ) {
      drawDate = normalizeDate(cells[1]);
      numStart = 2;
    }
    const rawNums = cells.slice(numStart);
    const valid = validateDraw(rawNums);

    if ("error" in valid) {
      report.discardReasons[valid.error] =
        (report.discardReasons[valid.error] || 0) + 1;
      report.totalDiscarded++;
      continue;
    }

    seenContests.add(contest);
    out.push({
      contestNumber: contest,
      drawDate,
      numbers: valid,
      source: "manual",
      syncedAt: timestamp,
      lastCheckedAt: timestamp,
    });
    report.totalValid++;
  }
  return {
    draws: out.sort((a, b) => a.contestNumber - b.contestNumber),
    report,
  };
}

function normalizeDate(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return s;
}
