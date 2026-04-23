const { execSync } = require("child_process");

console.log("🔧 EXECUTANDO CORREÇÃO DOS DADOS...\n");

// Executar correção
try {
  const fixResult = execSync("node fixDrawsData.mjs", {
    encoding: "utf8",
    cwd: "c:\\Users\\User\\Desktop\\Lotomania\\genesis-lottery-bloom-24829a7a",
  });
  console.log("✅ CORREÇÃO EXECUTADA:");
  console.log(fixResult);
} catch (error) {
  console.error("❌ ERRO NA CORREÇÃO:", error.message);
  process.exit(1);
}

console.log("\n🔍 EXECUTANDO VALIDAÇÃO...\n");

// Executar validação
try {
  const auditResult = execSync("node auditBacktestHits.mjs", {
    encoding: "utf8",
    cwd: "c:\\Users\\User\\Desktop\\Lotomania\\genesis-lottery-bloom-24829a7a",
  });
  console.log("✅ VALIDAÇÃO EXECUTADA:");
  console.log(auditResult);
} catch (error) {
  console.error("❌ ERRO NA VALIDAÇÃO:", error.message);
  process.exit(1);
}
