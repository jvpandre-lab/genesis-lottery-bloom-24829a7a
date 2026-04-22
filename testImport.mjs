import fs from 'fs';

console.log('Teste de importação...');

try {
  const { getContestHistory } = await import('./src/services/storageService.js');
  console.log('Import storageService OK');

  const draws = await getContestHistory();
  console.log(`Encontrados ${draws.length} concursos`);

  fs.writeFileSync('import_test.txt', `OK: ${draws.length} concursos`);
} catch (error) {
  console.error('Erro:', error);
  fs.writeFileSync('import_error.txt', error.message);
}