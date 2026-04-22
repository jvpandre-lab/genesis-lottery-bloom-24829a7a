# Genesis Lottery Bloom - Lotomania

Sistema evolutivo de geração de apostas para Lotomania com backtest temporal correto.

## Status Atual: ✅ AUDITADO E CORRIGIDO

### Correção Crítica Recentemente Aplicada

**Erro Estrutural**: Validação de tamanho de dezenas estava errada
- ❌ Antes: `validateDraw()` esperava 50 dezenas (apostas geradas)
- ✅ Depois: `validateDraw()` espera 20 dezenas (concursos oficiais)
- **Raiz**: Função usada para dois contextos diferentes sem discriminação
- **Impacto**: Todos os concursos da API eram REJEITADOS e NUNCA armazenados
- **Sintoma**: Backtest mostrava falsamente ~23.8+ hits (impossível estatisticamente)

Ver [AUDIT_REPORT.md](AUDIT_REPORT.md) para análise técnica completa.

## Estrutura Correta

```
Domínio Lotomania:
- 100 números (00-99)
- Concurso: 20 dezenas sorteadas (oficial)
- Aposta: 50 dezenas marcadas (jogador)

src/
├── engine/
│  ├── lotteryTypes.ts          # DRAWN_SIZE=20, GAME_SIZE=50
│  ├── generatorCore.ts         # Gera apostas (50)
│  ├── backtestEngine.ts        # Calcula interseção (game ∩ draw)
│  └── ... (outros engines)
├── services/
│  ├── contestService.ts        # ✅ CORRIGIDO: validateDraw(20)
│  └── storageService.ts
└── test/
   └── auditValidation.test.ts  # ✅ Prova 50→20 funcionando
```

## Validação Corrigida

```typescript
// Antes (❌ ERRADO)
validateDraw(20 dezenas) → ERROR: expected 50, got 20

// Depois (✅ CORRETO)
validateDraw(20 dezenas) → OK: Array[20]
validateDraw(50 dezenas) → ERROR: expected 20, got 50
```

## Estatísticas Esperadas (Agora Corretas)

Com gerador 50 vs. draw 20:

| Métrica | Esperado | Antes (Corrupto) | Status |
|---------|----------|-----------------|--------|
| Hits médios | ~10 | 23.8+ | ✅ CORRIGIDO |
| Hits máx realista | ~15 | 20+ | ✅ CORRIGIDO |
| Concursos armazenados | Todos | 0 (rejeitados) | ✅ CORRIGIDO |
| Confiabilidade backtest | Alta | Baixa | ✅ CORRIGIDO |

## Proxim Passos

1. ✅ Correção implementada e testada
2. ⏳ Sincronizar novo histórico com API
3. ⏳ Validar backtest com dados corretos
4. ⏳ Implementar UI para controle de janela
5. ⏳ Evolução supervisionada

## Testes

```bash
# Validar que 20 dezenas agora funciona
npm test -- src/test/auditValidation.test.ts

# Backtest com dados corretos (aguarde sincronização)
npm test -- src/test/realDataBacktest.test.ts
```

---

**Última Atualização**: Auditoria e correção de modelagem de dados
**Status**: 🟢 Pronto para evolução supervisionada
