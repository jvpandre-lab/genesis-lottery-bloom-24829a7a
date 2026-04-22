// Mock data for testing - simulating real contest draws
const mockDraws = Array.from({ length: 300 }, (_, i) => ({
  contestNumber: 2000 + i,
  numbers: Array.from({ length: 20 }, (_, k) => (i * 3 + k * 7) % 100),
  drawDate: new Date(2024, 0, 1 + i).toISOString(),
  source: "mock"
}));

import { backtest } from './src/engine/backtestEngine.js';
import { generate } from './src/engine/generatorCore.js';

async function runSimpleBacktest() {
  try {
    console.log('=== BACKTEST SIMPLES LOTOMANIA ===\n');

    // Usar dados mock simulando concursos reais
    const allDraws = mockDraws;
    console.log(`Usando ${allDraws.length} concursos simulados (dados mock).\n`);

    // Gerar uma geração simples para teste
    console.log('Gerando jogos para backtest...');
    const generationResult = await generate({
      count: 50, // 50 jogos
      scenario: 'hybrid',
      recentDraws: allDraws.slice(-10), // últimos 10 concursos
      twoBrains: true,
      label: 'Simple Backtest'
    });

    console.log(`Gerados ${generationResult.batches.reduce((sum, b) => sum + b.games.length, 0)} jogos.\n`);

    // Executar backtest para 50, 100 e 200 concursos
    const windows = [50, 100, 200];
    const report = backtest([generationResult], allDraws, windows);

    console.log('=== RESULTADOS DO BACKTEST ===\n');

    for (const bucket of report.windows) {
      console.log(`Janela de ${bucket.windowSize} concursos:`);
      console.log(`- Concursos avaliados: ${bucket.draws}`);
      console.log(`- Total de jogos testados: ${bucket.totalGames}`);
      console.log(`- Média de acertos: ${bucket.avgHits.toFixed(3)}`);
      console.log(`- Frequência 15+: ${(bucket.freq15plus * 100).toFixed(2)}%`);
      console.log(`- Frequência 16+: ${(bucket.freq16plus * 100).toFixed(2)}%`);
      console.log(`- Frequência 17+: ${(bucket.freq17plus * 100).toFixed(2)}%`);
      console.log(`- Frequência 18+: ${(bucket.freq18plus * 100).toFixed(2)}%`);
      console.log(`- Frequência 19+: ${(bucket.freq19plus * 100).toFixed(2)}%`);
      console.log(`- Frequência 20: ${(bucket.freq20 * 100).toFixed(2)}%`);

      console.log('Histograma de acertos:');
      for (let hits = 0; hits <= 20; hits++) {
        const count = bucket.hitsHistogram[hits] || 0;
        if (count > 0) {
          console.log(`  ${hits} acertos: ${count} ocorrências`);
        }
      }
      console.log('');
    }

    console.log('=== DESEMPENHO POR LINHAGEM ===');
    for (const lineage of report.perLineage) {
      console.log(`${lineage.lineage}: ${lineage.avgHits.toFixed(3)} avg hits, ${(lineage.freq15plus * 100).toFixed(2)}% freq 15+`);
    }

    console.log('\n=== DESEMPENHO POR BATCH ===');
    for (const batch of report.perBatch) {
      console.log(`${batch.batch}: ${batch.avgHits.toFixed(3)} avg hits, ${(batch.freq15plus * 100).toFixed(2)}% freq 15+`);
    }

    console.log('\n=== DESEMPENHO POR CENÁRIO ===');
    for (const scenario of report.perScenario) {
      console.log(`${scenario.scenario}: ${scenario.avgHits.toFixed(3)} avg hits, ${(scenario.freq15plus * 100).toFixed(2)}% freq 15+`);
    }

    console.log(`\nGerações analisadas: ${report.generationsAnalyzed}`);
    console.log(`Concursos disponíveis: ${report.drawsAvailable}`);

    console.log('\n=== BACKTEST CONCLUÍDO ===');

  } catch (error) {
    console.error('Erro no backtest:', error.message);
    console.error(error.stack);
  }
}

runSimpleBacktest();