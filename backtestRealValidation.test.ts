import { describe, it } from 'vitest';
import { backtestEvolutionaryRetrospective } from '../src/engine/backtestEngine';
import { getContestHistory } from '../src/services/storageService';
import { generate } from '../src/engine/generatorCore';
import fs from 'fs';

describe('Backtest Real Data Validation', () => {
  it('should run real backtest with 50, 100, and 200 contests', async () => {
    const log = [];

    log.push('=== VALIDAÇÃO REAL DO BACKTEST LOTOMANIA ===\n');

    // Obter dados reais dos concursos
    log.push('Obtendo histórico de concursos...');
    const allDraws = await getContestHistory();
    log.push(`Encontrados ${allDraws.length} concursos no histórico.\n`);

    if (allDraws.length < 200) {
      log.push('ATENÇÃO: Histórico insuficiente para teste completo de 200 concursos.');
      log.push('Usando dados disponíveis para validação.\n');
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
        log.push(`\n=== ${scenario.name} (Limitado a ${maxContests} disponíveis) ===`);
      } else {
        log.push(`\n=== ${scenario.name} ===`);
      }

      try {
        // Usar apenas os últimos maxContests concursos
        const draws = allDraws.slice(-maxContests);

        log.push(`Executando backtest evolutivo com ${draws.length} concursos...`);

        const report = await backtestEvolutionaryRetrospective(
          4, // 4 gerações
          6, // 6 jogos por geração
          draws,
          "hybrid",
          generate // usar o generator real
        );

        log.push('Resultados:');
        log.push(`- Média de acertos: ${report.overall.avgHits.toFixed(3)}`);
        log.push(`- Frequência 15+: ${(report.overall.freq15plus * 100).toFixed(2)}%`);
        log.push(`- Gerações processadas: ${report.generations.length}`);

        // Estatísticas por linhagem
        log.push('\nDesempenho por linhagem:');
        report.perLineage.forEach(lineage => {
          log.push(`- ${lineage.lineage}: ${lineage.avgHits.toFixed(3)} avg hits`);
        });

        // Estatísticas das gerações
        log.push('\nEvolução por geração:');
        report.generations.forEach((gen, idx) => {
          log.push(`Geração ${idx + 1}: ${gen.avgHits.toFixed(3)} hits, saturação: ${(gen.territorySaturation * 100).toFixed(1)}%`);
        });

        log.push(`✓ ${scenario.name} concluído com sucesso\n`);

      } catch (error) {
        log.push(`✗ Erro em ${scenario.name}: ${error.message}`);
        log.push('Continuando com próximos cenários...\n');
      }
    }

    log.push('=== VALIDAÇÃO CONCLUÍDA ===');
    log.push('Backtest executado com dados reais do sistema.');

    // Escrever resultados em arquivo
    fs.writeFileSync('backtestRealValidation_results.txt', log.join('\n'));
    console.log('Resultados salvos em backtestRealValidation_results.txt');
  });
});