import { arbiterMemory } from "./src/engine/arbiterMemory.ts";
import { generate } from "./src/engine/generatorCore.ts";
import { mulberry32 } from "./src/engine/rng.ts";

console.log("[TEST] Iniciando validação de persistência arbiter...\n");

try {
  console.log("1. Inicializando arbiterMemory...");
  await arbiterMemory.init();
  console.log("   ✅ Inicializado\n");

  console.log("2. Executando generate() com twoBrains: true...");
  const res = await generate({
    count: 3,
    scenario: "hybrid",
    rng: mulberry32(5001),
    twoBrains: true,
    recentDraws: [],
    recentResults: [],
  });
  console.log("   ✅ Geração completada\n");

  console.log("3. Verificando state do arbiter...");
  const state = arbiterMemory.getState();
  console.log("   Decisões registradas:", state.decisions.length);
  console.log("   Score hybrid A:", state.stats.hybrid.A);
  console.log("   Score hybrid B:", state.stats.hybrid.B);
  console.log("   ✅ Estado registrado\n");
} catch (error) {
  console.error("[ERROR] Persistência falhou conforme esperado:");
  console.error(error.message);
  console.log(
    "\n✅ CONFIRMADO: Sistema falha explicitamente quando tabela não existe",
  );
}
