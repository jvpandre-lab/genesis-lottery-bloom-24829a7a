import { generate, GenerateInput } from "@/engine/generatorCore";
import { mulberry32 } from "@/engine/rng";
import { describe, expect, it } from "vitest";

const testOpts = (seed: number, count: number): Partial<GenerateInput> => ({
  count,
  rng: mulberry32(seed),
  twoBrains: true,
});

describe("VALIDAÇÃO: Conexão Ecossistema (recentResults)", () => {
  it("TESTE 1: SEM recentResults (baseline → hasData=false)", async () => {
    console.log("\n┌─ TESTE 1: SEM recentResults ─────────────────┐");
    const gen1 = await generate({
      ...testOpts(1001, 4),
      scenario: "conservative",
    } as GenerateInput);

    console.log("gen1 criado, id:", gen1.id);
    console.log(
      "preGenContext.hasData:",
      gen1.diagnostics.preGenContext?.hasData,
    );

    expect(gen1.diagnostics.preGenContext).toBeDefined();
    expect(gen1.diagnostics.preGenContext?.hasData).toBe(false);
    console.log("└─ RESULTADO: hasData=false (esperado) ────────┘\n");
  });

  it("TESTE 2: COM recentResults: [gen1] → hasData=true", async () => {
    console.log("\n┌─ TESTE 2: COM recentResults: [gen1] ─────────┐");

    const gen1 = await generate({
      ...testOpts(1002, 4),
      scenario: "conservative",
    } as GenerateInput);

    const gen2 = await generate({
      ...testOpts(1003, 4),
      scenario: "conservative",
      recentResults: [gen1],
    } as GenerateInput);

    console.log("gen1 criado");
    console.log("gen2 com recentResults: [gen1]");
    console.log(
      "preGenContext.hasData:",
      gen2.diagnostics.preGenContext?.hasData,
    );
    console.log(
      "preGenContext.reasons:",
      gen2.diagnostics.preGenContext?.reasons.slice(0, 2).join(" | "),
    );

    expect(gen2.diagnostics.preGenContext?.hasData).toBe(true);
    console.log("└─ RESULTADO: hasData=true (esperado) ────────┘\n");
  });

  it("TESTE 3: IMPACTO REAL - Histórico crescente (3 gerações)", async () => {
    console.log("\n┌─ TESTE 3: IMPACTO REAL - 3 Gerações ─────────┐");

    const history: any[] = [];

    // Gen 1 (sem histórico)
    const gen1 = await generate({
      ...testOpts(2001, 5),
      scenario: "hybrid",
    } as GenerateInput);
    history.push(gen1);
    console.log("\nGen 1 (sem histórico):");
    console.log("  hasData:", gen1.diagnostics.preGenContext?.hasData);
    console.log(
      "  mutRate mod:",
      gen1.diagnostics.preGenContext?.mutationRateModifier,
    );
    console.log(
      "  balAdj:",
      gen1.diagnostics.preGenContext?.targetBalanceAdjustment,
    );

    // Gen 2 (com gen1)
    const gen2 = await generate({
      ...testOpts(2002, 5),
      scenario: "hybrid",
      recentResults: [gen1],
    } as GenerateInput);
    history.push(gen2);
    console.log("\nGen 2 (com gen1):");
    console.log("  hasData:", gen2.diagnostics.preGenContext?.hasData);
    console.log(
      "  mutRate mod:",
      gen2.diagnostics.preGenContext?.mutationRateModifier,
    );
    console.log(
      "  balAdj:",
      gen2.diagnostics.preGenContext?.targetBalanceAdjustment,
    );
    const mods2 = gen2.diagnostics.preGenContext?.weightModifiers ?? [];
    console.log("  weightMods min:", Math.min(...mods2).toFixed(3));
    console.log("  weightMods max:", Math.max(...mods2).toFixed(3));

    // Gen 3 (com gen1, gen2)
    const gen3 = await generate({
      ...testOpts(2003, 5),
      scenario: "hybrid",
      recentResults: history,
    } as GenerateInput);
    history.push(gen3);
    console.log("\nGen 3 (com gen1, gen2):");
    console.log("  hasData:", gen3.diagnostics.preGenContext?.hasData);
    console.log(
      "  mutRate mod:",
      gen3.diagnostics.preGenContext?.mutationRateModifier,
    );
    console.log(
      "  balAdj:",
      gen3.diagnostics.preGenContext?.targetBalanceAdjustment,
    );
    const mods3 = gen3.diagnostics.preGenContext?.weightModifiers ?? [];
    console.log("  weightMods min:", Math.min(...mods3).toFixed(3));
    console.log("  weightMods max:", Math.max(...mods3).toFixed(3));
    console.log(
      "  reasons:",
      gen3.diagnostics.preGenContext?.reasons.slice(0, 3).join(" | "),
    );

    expect(gen2.diagnostics.preGenContext?.hasData).toBe(true);
    expect(gen3.diagnostics.preGenContext?.hasData).toBe(true);
    console.log("└─ RESULTADO: hasData ativo com histórico ────┘\n");
  });

  it("CONCLUSÃO FINAL", () => {
    console.log(
      "\n╔════════════════════════════════════════════════════════════╗",
    );
    console.log("║  RESUMO FINAL DA VALIDAÇÃO                               ║");
    console.log(
      "╚════════════════════════════════════════════════════════════╝",
    );
    console.log("\nA. recentResults está chegando? SIM");
    console.log(
      "B. preGenContext ativo? SIM (com hasData=true quando histórico presente)",
    );
    console.log("C. preGen alterando decisão? PARCIAL (depende de histórico)");
    console.log(
      "D. ecossistema ativo na UI real? (será validado ao conectar localStorage)\n",
    );
  });
});
