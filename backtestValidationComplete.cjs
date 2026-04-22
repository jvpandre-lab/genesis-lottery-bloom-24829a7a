const { execSync } = require('child_process');
const fs = require('fs');

console.log('=== VALIDAÇÃO COMPLETA DO BACKTEST LOTOMANIA ===\n');

const tests = [
  'src/test/realDataBacktest.test.ts',
  'src/test/evolutionaryBacktest.test.ts',
  'src/test/auditBacktestComplete.test.ts'
];

let fullOutput = '';

for (const test of tests) {
  console.log(`Executando ${test}...`);
  try {
    const output = execSync(`npx vitest run ${test} --reporter=verbose`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000 // 2 minutos timeout
    });
    fullOutput += `\n=== ${test} ===\n${output}`;
    console.log(`✓ ${test} concluído`);
  } catch (error) {
    const errorOutput = error.stdout || error.stderr || error.message;
    fullOutput += `\n=== ${test} (ERRO) ===\n${errorOutput}`;
    console.log(`✗ ${test} falhou`);
  }
}

fs.writeFileSync('backtestValidationComplete.log', fullOutput);
console.log('\n=== RELATÓRIO SALVO ===');
console.log('Arquivo: backtestValidationComplete.log');
console.log('Contém resultados completos de todos os testes de backtest.');