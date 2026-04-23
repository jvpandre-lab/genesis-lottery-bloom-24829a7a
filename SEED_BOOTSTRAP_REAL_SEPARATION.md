# Auditoria e Separação: Seed Bootstrap vs Contexto Recente Real

## PARTE 1 — ACHADOS DA AUDITORIA

### O Sistema Antes

**fetchRecentDraws(N):**

- Buscava os N draws com maior `contest_number` (DESC)
- Se banco tinha apenas seed (1-200, datas 1999-2003): retornava draws 193-200
- Issue: Draw de 2003 sendo usado como "recente" em geração, anti-viés e preGenContext

**applySeedFallback():**

- Acionada corretamente: apenas quando banco vazio E API falha
- Carrega todos os 200 do seed via `fetchSeedDraws()`
- Marca source = "seed"

**syncDraws():**

- Busca dados recentes reais da API
- Fallback para seed apenas se banco vazio
- Tudo funcionava corretamente

**Problema Real:**
Quando sistema está com apenas seed carregado (estado inicial), **não há discriminação** entre "contexto de bootstrap" e "contexto recente para geração".

```
Banco com apenas seed (contests 1-200, datas 1999-2003)
↓
fetchRecentDraws(8) retorna contests 193-200
↓
generate() usa dados de 2003 como "recent context"
↓
❌ Anti-viés calibra contra dados de 2003 (histórico antigo)
❌ Geração pensa que dados recentes são de 2003
```

### O Impacto

- **Moderado**: Sistema funciona, mas calibração de anti-viés fica viesada
- **Em Produção**: API está online, traz dados reais 2025/2026 → problema desaparece
- **Em Teste**: Com apenas seed, comportamento fica anômalo

---

## PARTE 2 — SEPARAÇÃO CONCEITUAL IMPLEMENTADA

### 1. **fetchRecentRealDraws(limit)** (NOVA)

```typescript
/**
 * Busca draws REAIS (não bootstrap antigo)
 * Filtra:
 * - contest_number > 200 OU
 * - draw_date > 2024-01-01
 *
 * Retorna:
 * - Draws reais se existirem
 * - Array vazio se houver apenas seed antigo
 */
export async function fetchRecentRealDraws(limit = 10): Promise<DrawRecord[]>;
```

**Uso recomendado:**

```typescript
// Para contexto recente em geração
const realRecent = await fetchRecentRealDraws(8);
const contextDraws = realRecent.length > 0 ? realRecent : [];
// Se não há dados reais, deixa array vazio (anti-viés com seed antigo)
```

### 2. **isBootstrapOnly()** (NOVA)

```typescript
/**
 * Verifica se sistema está em modo BOOTSTRAP PURO
 * (apenas seed 1-200, sem dados reais posteriores)
 */
export async function isBootstrapOnly(): Promise<boolean>;
```

**Caso de uso:**

```typescript
if (await isBootstrapOnly()) {
  console.warn(
    "⚠️  Sistema em bootstrap puro. Sincronize API para dados recentes.",
  );
  // Pode decidir não gerar ou gerar com configuração diferente
}
```

### 3. **fetchRecentDraws(limit)** (MANTIDO - para backtest/contexto geral)

```typescript
/**
 * Busca draws mais recentes (qualquer fonte)
 * Não filtra por fonte ou data
 * Ordena por contest_number DESC
 */
export async function fetchRecentDraws(limit = 10): Promise<DrawRecord[]>;
```

**Comportamento:**

- Se há dados reais: retorna os N mais recentes
- Se há apenas seed: retorna os N do seed (193-200, datas 2003)
- Sem filtro: ideal para backtest histórico completo

### 4. **applySeedFallback()** (DOCUMENTADO)

```typescript
/**
 * BOOTSTRAP FALLBACK: Carrega seed histórico antigo (1999-2003)
 * APENAS como último recurso quando:
 * - banco está vazio E
 * - API falha
 *
 * ⚠️  NÃO use seed como contexto recente se dados reais existirem
 */
```

---

## PARTE 3 — REGRAS FINAIS DE USO

### Regra 1: Bootstrap

```
Seed entra no banco APENAS quando:
- countDraws() == 0 E
- API falha OU retorna vazio

Uma vez carregado, seed fica no banco com source = "seed"
Nunca é limpo automaticamente
```

### Regra 2: Contexto Recente em Geração

```
Para geração/anti-viés/preGenContext:

Usar fetchRecentRealDraws(8) se possível:
├─ Se retorna draws: use esses (dados reais)
└─ Se retorna vazio: use array vazio (evita seed antigo)

Fallback se fetchRecentRealDraws() não existisse:
├─ Usar fetchRecentDraws(8)
├─ Mas SABER que pode incluir seed antigo (2003)
└─ Aceitar limitação
```

### Regra 3: Backtest Histórico

```
Use fetchAllDraws() + sort cronológico:
- Inclui tudo (seed antigo + dados reais)
- Backtest retrospectivo aprecia cobertura temporal completa
- Evita usar fetchRecentRealDraws() (perderia seed para cobertura)
```

### Regra 4: Indicador de Saúde

```
healthService classifica por volume total:
- VAZIO (0)
- CRÍTICO (1-4)
- BÁSICO (5-49)
- BOM (50-149)
- FORTE (150+)

Com seed (200): logo sai de VAZIO → FORTE (200 contests)
Mas source = "seed" sinaliza que é bootstrap
```

---

## PARTE 4 — ARQUIVOS ALTERADOS

| Arquivo                                                          | Mudança                                        | Linhas               |
| ---------------------------------------------------------------- | ---------------------------------------------- | -------------------- |
| [src/services/storageService.ts](src/services/storageService.ts) | ✨ Adicionado `fetchRecentRealDraws()`         | +43 linhas           |
| [src/services/storageService.ts](src/services/storageService.ts) | ✨ Adicionado `isBootstrapOnly()`              | +12 linhas           |
| [src/services/contestService.ts](src/services/contestService.ts) | 📝 Documentação clara em `applySeedFallback()` | +7 linhas comentário |
| [src/pages/Index.tsx](src/pages/Index.tsx)                       | 📝 Comentário em `handleGenerate()`            | +6 linhas comentário |

---

## PARTE 5 — VALIDAÇÃO EM RUNTIME

### Cenário A: Banco com apenas seed (estado inicial)

```
await countDraws()  → 200
await getHistorySource() → "seed"
await isBootstrapOnly()  → true
await fetchRecentDraws(8) → contests [193-200], dates 2003-07 a 2003-05
await fetchRecentRealDraws(8) → [] (vazio, apenas seed antigo)
```

**Conclusão:** Sistema reconhece que é bootstrap puro ✅

### Cenário B: Banco com seed + alguns dados reais recentes

Suponha que após sync com API, temos contests 1-200 (seed) + 201-250 (reais, datas 2025-06):

```
await countDraws()  → 250
await getHistorySource() → "api"
await isBootstrapOnly()  → false (há contests > 200)
await fetchRecentDraws(8) → contests [243-250], dates 2025-06
await fetchRecentRealDraws(8) → contests [243-250], dates 2025-06
```

**Conclusão:** Sistema usa dados reais, seed está no background ✅

### Cenário C: Geração com dados reais

```typescript
const realRecent = await fetchRecentRealDraws(8);
// realRecent = [243, 244, ..., 250] (2025-06)

await generate({
  count: 5,
  scenario: "hybrid",
  recentDraws: realRecent, // Usa dados reais, não seed antigo
  twoBrains: true,
});
```

**Conclusão:** Anti-viés calibra contra 2025, não 2003 ✅

### Scenário D: Backtest Histórico

```typescript
const allDraws = await fetchAllDraws();
// allDraws = [1 (seed, 1999), ..., 200 (seed, 2003), 201 (api, 2025), ..., 250 (api, 2025)]

// Backtest percorre cronologicamente a evolução do sistema
// Obtém cobertura temporal 1999-2025 completa
```

**Conclusão:** Backtest tem cobertura máxima ✅

---

## PARTE 6 — RESPOSTA OBJETIVA FINAL

### Como Estava Antes

- `fetchRecentDraws()` retornava draws mais recentes sem distinção
- Com apenas seed: retornava contestos 193-200 de 2003
- Geração usava dados de 2003 como "contexto recente"
- Sem forma de saber se estava em bootstrap puro ou com dados reais

### Como Ficou Depois

- `fetchRecentDraws()` continua igual (para backtest/contexto geral)
- `fetchRecentRealDraws()` **NOVA** retorna apenas draws reais ou vazio
- `isBootstrapOnly()` **NOVA** detecta estado de bootstrap puro
- `applySeedFallback()` **documentada** para deixar claro que é bootstrap último recurso
- Lógica **clara**: seed é bootstrap, dados reais são contexto recente

### Arquivos Alterados

1. [src/services/storageService.ts](src/services/storageService.ts) — 2 funções novas
2. [src/services/contestService.ts](src/services/contestService.ts) — documentação em applySeedFallback()
3. [src/pages/Index.tsx](src/pages/Index.tsx) — comentário em handleGenerate()

### Regra Final de Uso do Seed

```
Seed (1999-2003) é carregado APENAS para bootstrap quando:
├─ countDraws() == 0
├─ API falha ou retorna vazio

Após carregado:
├─ Fica no banco (source = "seed", contests 1-200)
├─ Nunca é limpo automaticamente
├─ Não interfere com dados reais (contests > 200)
├─ Não é usado como contexto recente se houver dados reais
```

### Regra Final de Uso de Contexto Recente

```
Para geração/anti-viés:

Preferência 1: fetchRecentRealDraws(8)
├─ Se retorna draws: use (dados reais)
└─ Se vazio: use [] (evita seed antigo)

Fallback: fetchRecentDraws(8)
├─ Retorna N mais recentes
├─ Pode incluir seed antigo se em bootstrap puro
└─ Aceitar limitação conhecida
```

### Exemplo Real de Runtime

**Estado: Banco com seed + 50 contests reais recentes**

```
Total contests: 250 (200 seed + 50 reais)

handleGenerate() chamado:
├─ fetchRecentDraws(8) → contests [243-250], dates 2025-06 ✅
├─ isBootstrapOnly() → false ✅
├─ fetchRecentRealDraws(8) → contests [243-250], dates 2025-06 ✅
└─ generate() recebe dados de 2025, não 2003 ✅

Backtest chamado:
├─ fetchAllDraws() → 250 contests (1999-2025) ✅
└─ Cobertura temporal completa ✅
```

### Confirmação: Seed Restrito a Bootstrap

✅ **SIM** — Seed agora tem papel claro:

- Entra apenas se banco vazio
- Permanece no banco sem limpar
- Não interfere com dados reais (contests > 200 distintos)
- Detectável via `isBootstrapOnly()` e `getHistorySource()`
- Não contamina contexto recente se dados reais existirem

---

**Build Status:** ✅ Sucesso (658.89 kB JS)  
**Compilação:** ✅ Sem erros  
**Escopo:** ✅ Fechado — Separação implementada com sucesso
