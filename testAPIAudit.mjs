(async () => {
  const API_URL = "https://loteriascaixa-api.herokuapp.com/api/lotomania";

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log(
    "║  AUDITORIA DA API ATUAL - Lotomania Caixa                   ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  console.log(`[1] Testando: ${API_URL}\n`);

  try {
    const start = Date.now();
    const response = await fetch(API_URL, { timeout: 10000 });
    const elapsed = Date.now() - start;

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ Resposta recebida em ${elapsed}ms`);
    console.log(`   Content-Type: ${response.headers.get("content-type")}`);

    // Análise da estrutura
    console.log(`\n[2] Estrutura da resposta:\n`);

    if (Array.isArray(data)) {
      console.log(`   - É um array: SIM`);
      console.log(`   - Total de elementos: ${data.length}`);

      if (data.length > 0) {
        const first = data[0];
        const last = data[data.length - 1];

        console.log(`\n   Primeiro elemento (amostra):`);
        console.log(`   `, JSON.stringify(first).substring(0, 100) + "...");

        console.log(`\n   Último elemento (amostra):`);
        console.log(`   `, JSON.stringify(last).substring(0, 100) + "...");

        // Campos
        const keys = Object.keys(first);
        console.log(`\n   Campos disponíveis: ${keys.join(", ")}`);

        // Validação de concursos
        const concursos = data.map((d) => {
          const num =
            d.concurso ??
            d.numero ??
            d.contestNumber ??
            d.contest_number ??
            null;
          const dezenas =
            d.dezenas ??
            d.numbers ??
            d.dezenas_sorteadas ??
            d.sorteadas ??
            null;
          const data = d.data ?? d.date ?? null;
          return { num, dezenas, data };
        });

        const withValidNumbers = concursos.filter(
          (c) => Array.isArray(c.dezenas) && c.dezenas.length === 20,
        ).length;

        console.log(`\n[3] Análise de integridade:\n`);
        console.log(
          `   - Concursos com 20 números: ${withValidNumbers}/${data.length}`,
        );
        console.log(
          `   - Taxa de cobertura: ${((withValidNumbers / data.length) * 100).toFixed(1)}%`,
        );

        // Range de concursos
        const numeros = concursos
          .map((c) => c.num)
          .filter((n) => n)
          .map(Number)
          .sort((a, b) => a - b);

        if (numeros.length > 0) {
          console.log(`   - Menor concurso: ${numeros[0]}`);
          console.log(`   - Maior concurso: ${numeros[numeros.length - 1]}`);
          console.log(
            `   - Abrangência: ${numeros.length} concursos identificados`,
          );
        }

        // Gaps
        if (numeros.length > 1) {
          let gaps = 0;
          for (let i = 1; i < numeros.length; i++) {
            if (numeros[i] - numeros[i - 1] > 1) {
              gaps++;
            }
          }
          console.log(`   - Lacunas detectadas: ${gaps}`);
        }

        // Datas
        const datas = concursos
          .map((c) => c.data)
          .filter((d) => d)
          .sort();
        if (datas.length > 0) {
          console.log(`\n[4] Período de cobertura:\n`);
          console.log(`   - Mais antigo: ${datas[0]}`);
          console.log(`   - Mais recente: ${datas[datas.length - 1]}`);
        }
      }
    } else if (typeof data === "object" && data !== null) {
      console.log(`   - É um objeto (não array)`);
      const keys = Object.keys(data);
      console.log(`   - Chaves: ${keys.slice(0, 10).join(", ")}`);
      console.log(
        `   - Pode ter paginação: ${keys.some((k) => ["page", "limit", "results", "data"].includes(k)) ? "SIM" : "NÃO"}`,
      );
    }

    console.log(`\n[5] Confiabilidade:\n`);

    if (data.length < 100) {
      console.log(
        `   ❌ LIMITADA: Apenas ${data.length} registros (esperado mínimo 100+)`,
      );
    } else {
      console.log(`   ✅ RAZOÁVEL: ${data.length} registros`);
    }

    if (data.length >= 2000) {
      console.log(
        `   ✅ ABRANGENTE: ${data.length} registros cobrem bom período`,
      );
    }

    console.log(`\n[6] Conclusão:\n`);

    if (data.length < 50) {
      console.log(
        `   🔴 API NÃO CONFIÁVEL: Dados insuficientes (${data.length} concursos)`,
      );
    } else if (data.length < 500) {
      console.log(
        `   🟡 API PARCIAL: Dados limitados (${data.length} concursos)`,
      );
    } else {
      console.log(
        `   🟢 API ADEQUADA: Cobertura razoável (${data.length} concursos)`,
      );
    }
  } catch (error) {
    console.error(`❌ ERRO: ${error.message}`);
    console.log(`\n   A API está INDISPONÍVEL ou NÃO RESPONDE\n`);
    console.log(`   Recomendação: Buscar fonte alternativa confiável`);
  }
})();
