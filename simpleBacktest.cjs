const fs = require('fs');

// Script simples para testar backtest
console.log('=== TESTE SIMPLES DE BACKTEST ===');

try {
  // Teste básico - apenas verificar se conseguimos importar
  console.log('Tentando importar módulos...');

  // Como estamos em CommonJS, vamos tentar require
  const path = require('path');

  // Simular dados de teste
  const mockDraws = [
    { concurso: 1, dezenas: ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20'] },
    { concurso: 2, dezenas: ['05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24'] },
    { concurso: 3, dezenas: ['10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29'] }
  ];

  console.log(`Dados simulados: ${mockDraws.length} concursos`);

  // Função simples de contagem de hits
  function countHits(game, real) {
    const gameSet = new Set(game.map(n => parseInt(n, 10)));
    const realNums = real.map(n => parseInt(n, 10));
    let hits = 0;
    for (const n of realNums) {
      if (gameSet.has(n)) hits++;
    }
    return hits;
  }

  // Simular jogos gerados
  const mockGames = [
    { numbers: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50] },
    { numbers: [5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50] },
    { numbers: [10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50] }
  ];

  console.log('\n=== RESULTADOS DO BACKTEST SIMPLES ===');

  let totalHits = 0;
  let totalGames = 0;

  for (let i = 0; i < mockDraws.length; i++) {
    const draw = mockDraws[i];
    console.log(`\nConcurso ${draw.concurso}:`);
    console.log(`Dezenas sorteadas: ${draw.dezenas.join(', ')}`);

    for (let j = 0; j < mockGames.length; j++) {
      const game = mockGames[j];
      const hits = countHits(game.numbers, draw.dezenas);
      totalHits += hits;
      totalGames++;

      console.log(`Jogo ${j+1}: ${hits} acertos`);
    }
  }

  const avgHits = (totalHits / totalGames).toFixed(3);
  console.log(`\n=== RESULTADO FINAL ===`);
  console.log(`Total de jogos: ${totalGames}`);
  console.log(`Total de acertos: ${totalHits}`);
  console.log(`Média de acertos: ${avgHits}`);

  // Salvar resultado
  const result = {
    totalGames,
    totalHits,
    avgHits: parseFloat(avgHits),
    testType: 'simulated'
  };

  fs.writeFileSync('simple_backtest_result.json', JSON.stringify(result, null, 2));
  console.log('\nResultado salvo em simple_backtest_result.json');

} catch (error) {
  console.error('Erro:', error.message);
  fs.writeFileSync('simple_backtest_error.txt', error.message + '\n' + error.stack);
}