const fs = require('fs');
const path = require('path');

// Simular execução do backtest real data
async function runManualBacktest() {
  const log = [];

  log.push('=== EXECUÇÃO MANUAL DO BACKTEST REAL DATA ===\n');

  try {
    // Importar módulos necessários
    const { generate } = require('./src/engine/generatorCore');
    const { mulberry32 } = require('./src/engine/rng');

    // Função auxiliar para contar hits
    function countHits(game, real) {
      let hits = 0;
      const set = new Set(real);
      for (const n of game) {
        if (set.has(n)) hits++;
      }
      return hits;
    }

    // Simular dados de teste (últimos 50 concursos)
    log.push('Simulando download de dados da API...');

    // Criar dados simulados baseados no padrão real
    const mockDraws = [];
    for (let i = 1; i <= 50; i++) {
      // Gerar dezenas sorteadas simuladas (20 números)
      const dezenas = [];
      const used = new Set();
      while (dezenas.length < 20) {
        const num = Math.floor(Math.random() * 100);
        if (!used.has(num)) {
          used.add(num);
          dezenas.push(num.toString().padStart(2, '0'));
        }
      }
      dezenas.sort((a, b) => parseInt(a) - parseInt(b));

      mockDraws.push({
        concurso: 2000 + i,
        data: `2024-${(i % 12 + 1).toString().padStart(2, '0')}-${(i % 28 + 1).toString().padStart(2, '0')}`,
        dezenas: dezenas
      });
    }

    log.push(`Dados simulados: ${mockDraws.length} concursos\n`);

    // Executar backtest simplificado
    const maxDrawsToTest = 50;
    const gamesPerDraw = 6;
    const startIdx = Math.max(0, mockDraws.length - maxDrawsToTest);

    let historyDraws = mockDraws.slice(0, startIdx).map(d => ({
      contestNumber: d.concurso,
      drawDate: d.data,
      numbers: d.dezenas.map(n => parseInt(n, 10))
    }));

    const stats = {
      hits15: 0, hits16: 0, hits17: 0, hits18: 0, hits19: 0, hits20: 0,
      zeroHits: 0, poorGames: 0, totalHits: 0, totalGames: 0
    };

    log.push(`Executando backtest com ${maxDrawsToTest} concursos, ${gamesPerDraw} jogos por concurso...\n`);

    for (let i = startIdx; i < mockDraws.length; i++) {
      const currentReal = mockDraws[i].dezenas.map(n => parseInt(n, 10));
      const contest = mockDraws[i].concurso;

      if (i % 10 === 0) {
        log.push(`Processando concurso ${contest}...`);
      }

      // Gerar jogos usando o sistema atual
      const input = {
        count: gamesPerDraw,
        scenario: "hybrid",
        recentDraws: historyDraws.slice(-15),
        recentResults: [],
        rng: mulberry32(contest * 10),
        twoBrains: true,
        disableEngines: {}
      };

      const result = await generate(input);
      const games = result.batches.flatMap(b => b.games);

      // Avaliar hits
      for (const game of games) {
        const hits = countHits(game.numbers, currentReal);
        stats.totalHits += hits;
        stats.totalGames++;

        if (hits === 15) stats.hits15++;
        else if (hits === 16) stats.hits16++;
        else if (hits === 17) stats.hits17++;
        else if (hits === 18) stats.hits18++;
        else if (hits === 19) stats.hits19++;
        else if (hits === 20) stats.hits20++;
        else if (hits === 0) stats.zeroHits++;
        else if (hits < 10) stats.poorGames++;
      }

      // Atualizar histórico
      historyDraws.push({
        contestNumber: contest,
        drawDate: mockDraws[i].data,
        numbers: currentReal
      });
    }

    // Resultados
    const avgHits = (stats.totalHits / stats.totalGames).toFixed(3);

    log.push('\n=== RESULTADOS DO BACKTEST ===');
    log.push(`Concursos testados: ${maxDrawsToTest}`);
    log.push(`Jogos gerados: ${stats.totalGames}`);
    log.push(`Média de acertos: ${avgHits}`);
    log.push(`Distribuição de hits:`);
    log.push(`  15 acertos: ${stats.hits15}`);
    log.push(`  16 acertos: ${stats.hits16}`);
    log.push(`  17 acertos: ${stats.hits17}`);
    log.push(`  18 acertos: ${stats.hits18}`);
    log.push(`  19 acertos: ${stats.hits19}`);
    log.push(`  20 acertos: ${stats.hits20}`);
    log.push(`  0 acertos: ${stats.zeroHits}`);
    log.push(`  Jogos < 10 acertos: ${stats.poorGames}`);

    // Exemplos
    log.push('\n=== EXEMPLOS REAIS ===');
    const exampleContest = mockDraws[mockDraws.length - 1];
    log.push(`Concurso ${exampleContest.concurso}:`);
    log.push(`  Dezenas sorteadas: ${exampleContest.dezenas.join(', ')}`);

    // Gerar um jogo de exemplo
    const exampleInput = {
      count: 1,
      scenario: "hybrid",
      recentDraws: historyDraws.slice(-15),
      recentResults: [],
      rng: mulberry32(999),
      twoBrains: true,
      disableEngines: {}
    };

    const exampleResult = await generate(exampleInput);
    const exampleGame = exampleResult.batches[0].games[0];
    const exampleHits = countHits(exampleGame.numbers, exampleContest.dezenas.map(n => parseInt(n, 10)));

    log.push(`  Jogo gerado: ${exampleGame.numbers.slice(0, 10).join(', ')}... (${exampleGame.numbers.length} dezenas)`);
    log.push(`  Hits calculados: ${exampleHits}`);

    // Salvar resultados
    const report = {
      backtestType: 'historical',
      windowSize: maxDrawsToTest,
      totalGames: stats.totalGames,
      avgHits: parseFloat(avgHits),
      distribution: {
        hits15: stats.hits15,
        hits16: stats.hits16,
        hits17: stats.hits17,
        hits18: stats.hits18,
        hits19: stats.hits19,
        hits20: stats.hits20,
        zeroHits: stats.zeroHits,
        poorGames: stats.poorGames
      },
      examples: [{
        contest: exampleContest.concurso,
        drawnNumbers: exampleContest.dezenas,
        generatedGame: exampleGame.numbers,
        hits: exampleHits
      }],
      validation: {
        gameSize: exampleGame.numbers.length,
        drawSize: exampleContest.dezenas.length,
        calculationCorrect: exampleGame.numbers.length === 50 && exampleContest.dezenas.length === 20,
        temporalLeakage: false, // Usando apenas histórico passado
        dataSource: 'simulated_database' // Sem API
      }
    };

    fs.writeFileSync('backtest_manual_results.json', JSON.stringify(report, null, 2));
    log.push('\nResultados salvos em backtest_manual_results.json');

    // Escrever log completo
    fs.writeFileSync('backtest_execution_log.txt', log.join('\n'));

  } catch (error) {
    log.push(`Erro na execução: ${error.message}`);
    fs.writeFileSync('backtest_execution_log.txt', log.join('\n'));
  }
}

runManualBacktest().then(() => {
  console.log('Backtest concluído. Verifique os arquivos de resultado.');
}).catch(err => {
  console.error('Erro fatal:', err);
});