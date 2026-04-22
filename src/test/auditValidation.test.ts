import { describe, it, expect, beforeEach } from "vitest";
import { validateDraw } from "../services/contestService";

describe("Auditoria de Validação (20 Dezenas Oficiais)", () => {
  
  it("FALHA: Rejeita 50 dezenas (era o comportamento antigo)", () => {
    const fiftyNumbers = Array.from({ length: 50 }, (_, i) => String(i).padStart(2, "0"));
    const result = validateDraw(fiftyNumbers);
    expect("error" in result).toBe(true);
  });

  it("SUCESSO: Aceita exatamente 20 dezenas (novo comportamento)", () => {
    const twentyNumbers = ["02", "04", "05", "22", "23", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39"];
    const result = validateDraw(twentyNumbers);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result).toHaveLength(20);
      expect(result).toEqual(["02", "04", "05", "22", "23", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39"]);
    }
  });

  it("SUCESSO: Aceita 20 dezenas como array numérico", () => {
    const twentyNumbers = [2, 4, 5, 22, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39];
    const result = validateDraw(twentyNumbers);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result).toHaveLength(20);
    }
  });

  it("FALHA: Rejeita menos de 20 dezenas", () => {
    const tenNumbers = ["02", "04", "05", "22", "23", "25", "26", "27", "28", "29"];
    const result = validateDraw(tenNumbers);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("invalid_length");
    }
  });

  it("FALHA: Rejeita mais de 20 dezenas (mas menos de 50)", () => {
    const thirtyNumbers = Array.from({ length: 30 }, (_, i) => String(i).padStart(2, "0"));
    const result = validateDraw(thirtyNumbers);
    expect("error" in result).toBe(true);
  });

  it("FALHA: Rejeita 20 dezenas com duplicatas", () => {
    const numbersWithDuplicates = ["02", "04", "05", "22", "23", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "02"];
    const result = validateDraw(numbersWithDuplicates);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("duplicate");
    }
  });

  it("SUCESSO: API data típica (20 dezenas de concurso oficial)", () => {
    // Simulando resposta real da API
    const apiData = ["02", "04", "05", "22", "23", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39"];
    const result = validateDraw(apiData);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result).toHaveLength(20);
    }
  });

  it("SUCESSO: Ordena resultado corretamente", () => {
    const unordered = ["39", "02", "38", "05", "04", "22", "37", "23", "36", "35", "25", "34", "26", "33", "27", "32", "28", "31", "29", "30"];
    const result = validateDraw(unordered);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result).toEqual(["02", "04", "05", "22", "23", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39"]);
    }
  });

  it("SUCESSO: Aceita string com separadores", () => {
    const stringInput = "02,04,05,22,23,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39";
    const result = validateDraw(stringInput);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result).toHaveLength(20);
    }
  });
});
