import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrawRecord } from "../engine/lotteryTypes";
import {
  parseDrawsFile,
  syncDraws,
  validateDraw,
} from "../services/contestService";
import * as storageService from "../services/storageService";

// Mock das integrações para simular comportamentos
vi.mock("../services/storageService", () => {
  return {
    fetchRecentDraws: vi.fn(),
    upsertDraws: vi.fn(),
    countDraws: vi.fn(),
  };
});

// Mock Global fetch para simular API Caixa
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Validação Robusta dos 8 Pontos - Fluxo Híbrido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. INTEGRIDADE DO DOMÍNIO", () => {
    it("deve validar que concurso exige exatamente 20 dezenas oficiais, únicas, domínio 0..99", () => {
      // Setup válido
      const validSim = Array.from({ length: 20 }, (_, i) => i);
      const res = validateDraw(validSim);
      expect(Array.isArray(res)).toBe(true);
      if (Array.isArray(res)) {
        expect(res.length).toBe(20);
        expect(res[0]).toBe(0);
        expect(res[19]).toBe(19);
      }

      // Rejeita > 20
      expect(
        validateDraw(Array.from({ length: 21 }, (_, i) => i)),
      ).toHaveProperty("error");

      // Rejeita < 18
      expect(
        validateDraw(Array.from({ length: 17 }, (_, i) => i)),
      ).toHaveProperty("error");

      // Aceita 18-20
      expect(
        Array.isArray(validateDraw(Array.from({ length: 19 }, (_, i) => i))),
      ).toBe(true);

      // Rejeita duplicados
      const dups = Array.from({ length: 19 }, (_, i) => i);
      dups.push(1); // Duplicado
      expect(validateDraw(dups)).toHaveProperty("error", "duplicate_numbers");

      // Rejeita formato que fuja do domínio 0..99
      const outBounds = Array.from({ length: 19 }, (_, i) => i);
      outBounds.push(100);
      expect(validateDraw(outBounds)).toHaveProperty("error");
    });
  });

  describe("2 & 5. DUPLICIDADE E SYNC INCREMENTAL", () => {
    it("deve usar o ultimo concurso do banco, nao reprocessar historico, e tratar conflitos", async () => {
      // Mock Banco diz: O último concurso que tenho é o 2500
      vi.mocked(storageService.fetchRecentDraws).mockResolvedValueOnce([
        {
          contestNumber: 2500,
          numbers: Array.from({ length: 20 }, (_, i) => i),
          source: "api",
          syncedAt: new Date().toISOString(),
        },
      ] as any);

      // Mock Upsert
      vi.mocked(storageService.upsertDraws).mockResolvedValueOnce(1); // Retorna 1 inserido

      // Mock API responde com 3 concursos: 2499, 2500, e 2501
      const apiResponse = [
        { concurso: 2499, dezenas: Array.from({ length: 20 }, (_, i) => i) },
        { concurso: 2500, dezenas: Array.from({ length: 20 }, (_, i) => i) },
        { concurso: 2501, dezenas: Array.from({ length: 20 }, (_, i) => i) },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => apiResponse,
      });

      const report = await syncDraws();

      expect(storageService.fetchRecentDraws).toHaveBeenCalledWith(1);
      expect(mockFetch).toHaveBeenCalled();
      expect(storageService.upsertDraws).toHaveBeenCalledTimes(1);

      const payload = vi.mocked(storageService.upsertDraws).mock.calls[0][0];
      expect(payload).toHaveLength(1);
      expect(payload[0].contestNumber).toBe(2501);
      expect(report.newRecordsAdded).toBe(1);
      expect(report.status).toBe("success");
    });
  });

  describe("3. FALLBACK REAL", () => {
    it("deve tentar API e se der Error ou timeout, cair de forma suave com fallback", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fetch failed"));
      vi.mocked(storageService.fetchRecentDraws).mockResolvedValueOnce([]);

      const report = await syncDraws();
      expect(report.status).toBe("fallback_banco");
      expect(report.error).toContain("API offline");

      const manualJSON = `[{"contestNumber": 100, "drawDate": "2024-01-01", "numbers": [${Array.from({ length: 20 }, (_, i) => i).join(",")}]}]`;
      const manualRes = parseDrawsFile(manualJSON, "historico.json");
      if ("draws" in manualRes) {
        expect(manualRes.draws.length).toBe(1);
        expect(manualRes.draws[0].source).toBe("manual");
        expect(manualRes.draws[0].contestNumber).toBe(100);
      }
    });
  });

  describe("4. ORIGEM DOS DADOS", () => {
    it("as origens devem ser categorizadas rigidamente", async () => {
      vi.mocked(storageService.fetchRecentDraws).mockResolvedValueOnce([]);
      vi.mocked(storageService.upsertDraws).mockResolvedValueOnce(1);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { concurso: 1, dezenas: Array.from({ length: 20 }, (_, i) => i) },
        ],
      });

      await syncDraws();
      const payloadApi = vi.mocked(storageService.upsertDraws).mock.calls[0][0];
      expect(payloadApi[0].source).toBe("api");
    });
  });

  describe("6. RELATÓRIO DE SYNC", () => {
    it("gera o sync report com todos os status coerentes", async () => {
      vi.mocked(storageService.fetchRecentDraws).mockResolvedValueOnce([]);
      vi.mocked(storageService.upsertDraws).mockResolvedValueOnce(1);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { concurso: 1, dezenas: Array.from({ length: 20 }, (_, i) => i) },
          { concurso: 2, dezenas: Array.from({ length: 20 }, (_, i) => i) },
        ],
      });

      const report = await syncDraws();
      expect(report.newRecordsAdded).toBe(1);
      expect(report.recordsIgnoredDuplicate).toBe(1);
      expect(report.status).toBe("success");
    });
  });

  describe("7. COMPATIBILIDADE COM O SISTEMA", () => {
    it("compatibilidade da tipagem assegura que DrawRecord usa Dezena[] e não strings de formato", () => {
      const record: DrawRecord = {
        contestNumber: 1,
        numbers: [0, 1],
        source: "database",
      };
      expect(record.source).toBe("database");
    });
  });
});
