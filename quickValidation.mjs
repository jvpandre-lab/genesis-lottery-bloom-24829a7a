// Quick validation test - run with: node --loader tsx src/test/quickValidation.mjs

import { validateDraw } from "../services/contestService.js";

console.log("\n=== TESTE RÁPIDO: validateDraw(20 dezenas) ===\n");

// Test 1: 50 dezenas (antes - deveria falhar agora)
const fiftyNumbers = Array.from({ length: 50 }, (_, i) => String(i).padStart(2, "0"));
const result50 = validateDraw(fiftyNumbers);
console.log("Teste 1 - 50 dezenas:");
console.log(`  Entrada: 50 números (00-49)`);
console.log(`  Resultado: ${typeof result50 === "object" && "error" in result50 ? "❌ REJEITADO (correto)" : "❌ ACEITO (erro!)"}`);
if (typeof result50 === "object" && "error" in result50) {
  console.log(`  Erro: ${result50.error}\n`);
} else {
  console.log(`  Aceito: ${result50?.length} dezenas\n`);
}

// Test 2: 20 dezenas (novo - deveria passar)
const twentyNumbers = ["02", "04", "05", "22", "23", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39"];
const result20 = validateDraw(twentyNumbers);
console.log("Teste 2 - 20 dezenas (típicas de concurso oficial):");
console.log(`  Entrada: ${twentyNumbers.join(",")}`);
console.log(`  Resultado: ${typeof result20 === "object" && "error" in result20 ? "❌ REJEITADO (erro!)" : "✅ ACEITO (correto)"}`);
if (typeof result20 === "object" && "error" in result20) {
  console.log(`  Erro: ${result20.error}\n`);
} else {
  console.log(`  Aceito: ${result20?.length} dezenas\n`);
  console.log(`  Output: ${result20?.join(",")}\n`);
}

// Test 3: 10 dezenas (deve falhar - muito poucas)
const tenNumbers = ["02", "04", "05", "22", "23", "25", "26", "27", "28", "29"];
const result10 = validateDraw(tenNumbers);
console.log("Teste 3 - 10 dezenas (muito poucas):");
console.log(`  Entrada: ${tenNumbers.join(",")}`);
console.log(`  Resultado: ${typeof result10 === "object" && "error" in result10 ? "❌ REJEITADO (correto)" : "❌ ACEITO (erro!)"}`);
if (typeof result10 === "object" && "error" in result10) {
  console.log(`  Erro: ${result10.error}\n`);
}

console.log("=== FIM DO TESTE ===\n");
