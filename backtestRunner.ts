import { backtestEvolutionaryRetrospective } from './src/engine/backtestEngine';
import { getContestHistory } from './src/services/storageService';
import { generate } from './src/engine/generatorCore';
import * as fs from 'fs';
import * as path from 'path';

async function runBacktestValidation() {
  console.log('=== VALIDAÇÃO REAL DO BACKTEST LOTOMANIA ===\n');

  const results = {
    timestamp: new Date().toISOString(),
    scenarios: [] as any[]
  };

  try {
    // Obter dados reais dos concursos
    console.log('Obtendo histórico de concursos...');
    const allDraws = await getContestHistory();
    console.log(`Encontrados ${allDraws.length} concursos no histórico.\n`);

    if (allDraws.length < 200) {
      console.log('ATENÇÃO: Histórico insuficiente para teste completo de 200 concursos.');
      console.log('Usando dados disponíveis para validação.\n');
    }

    // Configurar cenários de teste
    const testScenarios = [
      { name: '50 Concursos', contests: 50 },
      { name: '100 Concursos', contests: 100 },
      { name: '200 Concursos', contests: 200 }
    ];

    for (const scenario of testScenarios) {
      const maxContests = Math.min(scenario.contests, allDraws.length);
      if (maxContests < scenario.contests) {
        console.log(`\n=== ${scenario.name} (Limitado a ${maxContests} disponíveis) ===`);
      } else {
        console.log(`\n=== ${scenario.name} ===`);
      }

      try {
        // Usar apenas os últimos maxContests concursos
        const draws = allDraws.slice(-maxContests);

        console.log(`Executando backtest evolutivo com ${draws.length} concursos...`);

        const report = await backtestEvolutionaryRetrospective(
          4, // 4 gerações
          6, // 6 jogos por geração
          draws,
          "hybrid",
          generate // usar o generator real
        );

        // Coletar resultados para salvar
        const scenarioResult = {
          name: scenario.name,
          contests: draws.length,
          report: report
        };
        results.scenarios.push(scenarioResult);

        console.log('Resultados:');
        console.log(`- Média de acertos: ${report.overall.avgHits.toFixed(3)}`);
        console.log(`- Frequência 15+: ${(report.overall.freq15plus * 100).toFixed(2)}%`);
        console.log(`- Distribuição de hits:`);
        for (let hits = 15; hits <= 20; hits++) {
          const freq = report.overall.hitDistribution[hits] || 0;
          console.log(`  ${hits} acertos: ${(freq * 100).toFixed(2)}%`);
        }
        console.log(`- Gerações processadas: ${report.generations.length}`);

        // Estatísticas por linhagem
        console.log('\nDesempenho por linhagem:');
        report.perLineage.forEach(lineage => {
          console.log(`- ${lineage.lineage}: ${lineage.avgHits.toFixed(3)} avg hits`);
        });

        // Estatísticas das gerações
        console.log('\nEvolução por geração:');
        report.generations.forEach((gen, idx) => {
          console.log(`Geração ${idx + 1}: ${gen.avgHits.toFixed(3)} hits, saturação: ${(gen.territorySaturation * 100).toFixed(1)}%`);
        });

        console.log(`✓ ${scenario.name} concluído com sucesso\n`);

      } catch (error) {
        console.error(`✗ Erro em ${scenario.name}:`, error.message);
        console.log('Continuando com próximos cenários...\n');
      }
    }

    // Salvar resultados
    const jsonPath = path.join(process.cwd(), 'backtest_results_complete.json');
    const textPath = path.join(process.cwd(), 'backtest_results_complete.txt');

    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`✓ Resultados salvos em: ${jsonPath}`);

    // Gerar relatório textual
    let textReport = '=== RELATÓRIO COMPLETO DO BACKTEST LOTOMANIA ===\n\n';
    textReport += `Data/Hora: ${results.timestamp}\n\n`;

    results.scenarios.forEach(scenario => {
      textReport += `=== ${scenario.name} ===\n`;
      textReport += `Concursos analisados: ${scenario.contests}\n\n`;

      const r = scenario.report;
      textReport += `MÉTRICAS GERAIS:\n`;
      textReport += `- Média de acertos: ${r.overall.avgHits.toFixed(3)}\n`;
      textReport += `- Frequência 15+: ${(r.overall.freq15plus * 100).toFixed(2)}%\n`;
      textReport += `- Distribuição de hits:\n`;
      for (let hits = 15; hits <= 20; hits++) {
        const freq = r.overall.hitDistribution[hits] || 0;
        textReport += `  ${hits} acertos: ${(freq * 100).toFixed(2)}%\n`;
      }
      textReport += `\nDESEMPENHO POR LINHAGEM:\n`;
      r.perLineage.forEach(lineage => {
        textReport += `- ${lineage.lineage}: ${lineage.avgHits.toFixed(3)} avg hits\n`;
      });

      textReport += `\nEVOLUÇÃO POR GERAÇÃO:\n`;
      r.generations.forEach((gen, idx) => {
        textReport += `Geração ${idx + 1}: ${gen.avgHits.toFixed(3)} hits, saturação: ${(gen.territorySaturation * 100).toFixed(1)}%\n`;
      });

      textReport += '\n\n';
    });

    fs.writeFileSync(textPath, textReport);
    console.log(`✓ Relatório textual salvo em: ${textPath}`);

    console.log('=== VALIDAÇÃO CONCLUÍDA ===');
    console.log('Backtest executado com dados reais do sistema.');

  } catch (error) {
    console.error('Erro fatal na validação:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runBacktestValidation();
}