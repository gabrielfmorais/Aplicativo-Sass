# SPEC-059 — A Jornada ganha corpo: progressão de nível e coleção de conquistas

- **Capability:** `F42` (marcos) + evolução visual da Jornada (Blueprint §24)
- **Bounded context:** Journey (`packages/core/src/journey`, `apps/mobile/src/features/journey`)
- **Status:** IMPLEMENTED (2026-09-08)
- **Depende de:** SPEC-043 (Jornada Huna — pontos, níveis, marcos, celebração)
- **Decisões:** D-103 (recompensa **aderência**, nunca quantidade nem cabelo), D-26/D-70 (fora do gate por não fazer alegação capilar), ADR-001 §2 (versão de régua imutável)

## 1. Problema

A SPEC-043 entregou a Jornada **funcional**: pontos, níveis, sequência, marcos e a celebração no
lugar dela. O Blueprint §24 sempre pediu mais que a mecânica — *"evolução visual de nível, badges,
colecionáveis, progressão"* — e a tela ainda mostrava isso como **texto**: o nível era uma palavra,
e os marcos eram uma fileira de etiquetas iguais, todas do mesmo tamanho, distinguidas só por uma
borda. A capability mais emocional do produto — a que existe para ela **ver o que construiu** — era a
menos visual.

⚠️ **Isto NÃO é capability nova, e não toca a régua.** É a mesma Jornada da SPEC-043, **vista** melhor.
Nenhum ponto muda de valor, nenhum limiar de nível muda, nenhum marco novo é criado — e por isso
**não há `rules/v2`** (ADR-001 §2: mudar régua exige v2; **mostrar melhor a mesma régua, não**).

## 2. O que entra

**FR1 — O nível evolui de cor.** Um medalhão com o número do nível cuja cor **aprofunda com a faixa**:
começa quieto (creme) e desce pela família da marca — berry → ameixa → violeta → **vinho no topo**.
Subir de nível deixa de ser só uma palavra trocada: é uma cor que fica mais funda. Todos os tons vêm
dos tokens da marca; **nenhum é cor de ação nem de sucesso** — é identidade, não estado.

**FR2 — A progressão dentro do nível é vista.** Uma barra (`ProgressBar`, primitiva existente) mostra
`pointsIntoLevel / levelSpan` — os pontos que ela **já fez** dentro da faixa atual. O core passa a
expor os dois campos derivados em `JourneyView.level`. No **último nível** (`levelSpan === null`) a
barra **some**: não há próximo a perseguir.

**FR3 — Os marcos viram uma coleção.** Cada marco é uma **medalha**: conquistada (cheia, na ameixa da
marca, com o traço de confirmação) ou **por chegar** (contorno quieto). A coleção inteira aparece —
ver o que ainda vem é parte do colecionável — e um contador conta **o que ela já tem**
(*"Você já conquistou N marcos"*), nunca o que falta.

## 3. Regras de negócio

- **BR1 — Nada de cabelo (D-26/D-70).** Nível, marco e barra falam de **constância**. As barreiras de
  teste da SPEC-043 (nenhuma palavra capilar) continuam de pé e valem para a tela nova.
- **BR2 — Nada de cobrança (D-103).** Não há barra de meta, "faltam X para não perder", vermelho ou
  cadeado. A barra pinta **o que ela fez**, não o que deve; a medalha por chegar é um **convite**, o
  mesmo enquadramento que a SPEC-043 já dava ao marco não alcançado (*"um marco que ainda não chegou"*).
  O contador conta o **conquistado**, porque *"3 de 6"* leria como déficit.
- **BR3 — Sem multiplicador, sem quantidade avulsa (D-103).** A régua não muda: ponto continua saindo
  de cuidado planejado/check-in/registro, e o ad-hoc (sem ponto) não vira medalha nem barra.
- **BR4 — Régua imutável (ADR-001 §2).** Zero mudança em `POINTS_V1`/`LEVELS_V1`/`MILESTONES_V1`. Os
  campos novos (`pointsIntoLevel`, `levelSpan`) são **derivados na leitura**, não fatos gravados.

## 4. Non-goals

- **Marcos novos** (primeiro check-in, primeiro Wash Day, primeiro ciclo): exigiriam mexer na régua
  (`rules/v2`) e é decisão de outra rodada; aqui só se **mostra melhor** a régua atual.
- **Colecionáveis desbloqueáveis / cosméticos** (temas de card, avatares por marco): os avatares da
  SPEC-042 já são todos disponíveis; travá-los seria regressão, e criar novos é asset, não esta fatia.
- **Celebração mais rica / motion**: a celebração da SPEC-043 OQ1 fica como está; movimento não se
  valida a 390px por captura e é outra decisão.
- **Ranking / desafios** (`F43`/`F44`): `DEFERRED BY DEPENDENCY` (Community).

## 5. Arquitetura

- **Core:** `JourneyLevel` ganha `pointsIntoLevel: number` e `levelSpan: number | null`, computados em
  `levelOf` (`build-journey-view.ts`). Aditivo e puro; nenhuma soma é recalculada.
- **UI:** `JourneyScreen` reescreve o cartão de nível (medalhão + barra) e a seção de marcos (grade de
  medalhas). `ProgressBar` é reusada. Nenhuma primitiva nova (AC3). Cor e espaçamento **só** de tokens
  (FR2 da SPEC-016).

## 6. Acceptance Criteria

- **AC1** No DEV real a 390px: abrir a Jornada → medalhão do nível na cor da faixa, barra de progresso
  preenchida, marcos como coleção (conquistados cheios, por chegar em contorno), contador do que ela
  tem → reload → idêntico.
- **AC2** No último nível, a barra não aparece (sem meta a perseguir) — teste.
- **AC3** Nenhuma palavra capilar, nenhuma cobrança, nenhum `%` inventado — barreiras da SPEC-043
  intactas e estendidas à tela nova.
- **AC4** `pnpm typecheck && pnpm lint && pnpm test` verdes; `improve` sem BLOCKER/IMPORTANT.

## 7. Change Log

| Data | Mudança |
|---|---|
| 2026-09-08 | SPEC criada e implementada. Medalhão de nível que evolui de cor, barra de progressão dentro da faixa (`pointsIntoLevel`/`levelSpan` no core), marcos como coleção de medalhas com contador do que ela já tem. Zero mudança de régua, zero migration, zero backend, zero primitiva nova. |
