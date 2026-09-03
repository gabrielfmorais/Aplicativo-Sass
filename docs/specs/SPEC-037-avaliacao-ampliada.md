# SPEC-037 — A avaliação que o motor vai usar (F35 + F36)

| Campo | Valor |
|---|---|
| ID | SPEC-037 |
| Status | **Fatia 1 (F35) implementada** — fatia 2 (F36) pendente |
| Owner | dono do produto |
| Bounded Context | Hair profile (`packages/core/src/hair-profile`, `apps/mobile/src/features/onboarding`) |
| Related ADRs | ADR-001 (fronteiras), ADR-007 (regras capilares), D-26, D-62, D-102 |
| Related SPECs | SPEC-002 (o perfil), SPEC-004 (o motor de cronograma), SPEC-014 (reavaliação), SPEC-017 (por que este cronograma) |
| Capabilities | `F35` avaliação capilar ampliada · `F36` motor de cronograma por necessidade |
| Criado / Atualizado | 2026-09-03 / 2026-09-03 |

## 1. Context

A D-102 registrou a avaliação ampliada pedida pelo dono. **Medir antes de assumir encurtou o
trabalho:** a lista dele foi comparada com `hair_profiles` (8 inputs, D-62) e quase tudo já era
coletado — curvatura, espessura, oleosidade, química, calor, ressecamento/quebra/frizz, frequência de
lavagem e objetivo; "mudanças ao longo do tempo" já são `F17` + `F23`. **Faltavam duas coisas, e só
duas: porosidade percebida e disponibilidade real de rotina.**

## 2. Problem, e o acoplamento que esta SPEC assume

⚠️ **Uma pergunta que o motor não usa é uma pergunta que só custa o tempo dela** (D-47/D-48). O
onboarding é o funil mais sensível do produto; acrescentar duas perguntas sem que nada as leia é
friccão pura. É por isso que `F35` e `F36` estão **na mesma SPEC**: a fatia 1 coleta, a fatia 2 lê, e
a fatia 1 não é um destino.

**A fatia 1 é entregue mesmo assim, e por uma razão de sequência, não de valor:** `F36` é uma versão
nova de motor que precisa dos inputs existindo no banco antes de poder ler qualquer coisa. Coletar
primeiro é a ordem, não a preferência.

## 3. Goals

- G1 — As duas entradas que faltavam são coletadas, validadas e guardadas.
- G2 — O vocabulário descreve **o que ela observa**, nunca uma classificação capilar.
- G3 — Avaliações anteriores continuam válidas e distinguíveis das novas.
- G4 — (fatia 2) A frequência de cada tipo de cuidado depende do perfil, não de uma sequência fixa.

## 4. Non-Goals

- NG1 — **Não** se classifica porosidade. `slow_to_wet` não é `low_porosity`, e a tradução entre os
  dois é regra capilar que mora no motor, versionada e `candidate` (D-26/ADR-007 A1).
- NG2 — **Não** se mostra estas respostas em "Por que este cronograma?" na fatia 1. O motor v1 não as
  lê; exibi-las ali alegaria uma influência que não existe, que é a "explicação plausível e errada"
  que a SPEC-017 FR4 recusa.
- NG3 — **Não** se preenche retroativamente uma avaliação antiga. A tabela é imutável (D-62).
- NG4 — **Não** entra sintoma clínico. Coceira, descamação, dor e queda continuam atrás de base legal
  (D-32) e sign-off de domínio (D-26), como registrado na SPEC-025 OQ2.
- NG5 — **Não** se muda o motor na fatia 1. Nenhum comportamento de cronograma é afetado.

## 5. Functional Requirements — fatia 1 (F35)

- FR1 — `hair_profiles` ganha `perceived_porosity` e `routine_availability`, **nullable**, com CHECK
  espelhando os enums do core.
- FR2 — `HairProfileInput` exige as duas: **uma avaliação nova sempre responde**.
- FR3 — `HairProfileSnapshot` as tipa como `| null`: quem pode faltar é a **linha antiga**.
- FR4 — A pergunta de porosidade **não usa a palavra "porosidade"** e não classifica: pergunta o que
  acontece quando ela molha o cabelo. "Não sei dizer" é uma resposta oferecida.
- FR5 — A pergunta de rotina fala em **minutos**, porque "pouco tempo" é elástico e minuto não é.
- FR6 — O onboarding passa de 8 para 10 perguntas, em dois blocos: a porosidade fecha o bloco do
  cabelo, a disponibilidade fecha o bloco da rotina.
- FR7 — As pausas **derivam** a contagem de perguntas do roteiro. Número digitado à mão deixou de ser
  possível.

## 6. Business Rules

- BR1 — ⚠️ **`null` não é `'unknown'`.** `'unknown'` é uma resposta ("não sei dizer"); `null` é a
  ausência da pergunta. Tratar os dois como iguais inventaria uma resposta que ela nunca deu, e é
  disso que o motor da fatia 2 leria "fato dela". Barreira de teste no core e no pgTAP.
- BR2 — O vocabulário é fechado nas duas pontas: zod recusa antes da chamada, CHECK recusa um cliente
  adulterado. É o segundo que importa.
- BR3 — Toda regra que **ler** estes inputs nasce `candidate` com `rule_id`, `version` e
  `rationale_source`, e não vai a PUBLIC RELEASE sem sign-off (D-26).

## 7. Dados

Duas colunas `text` nullable em `public.hair_profiles`. Nenhuma tabela, RPC, policy ou grant novo:
as colunas herdam a autorização da tabela, que continua `select, insert` do próprio dono, **sem
UPDATE e sem DELETE**.

## 8–13. Autorização, segurança, privacidade, analytics

Sem mudança. Nenhum dado novo sai do dispositivo além do que já saía, nenhum evento novo é emitido,
e nada aqui é dado de saúde: são preferências e observações de rotina.

## 14. UX Notes

Cada pergunta nova tem uma dica curta que diz **por que a pergunta existe** — "o tempo real, não o
ideal" — porque a resposta útil depende de ela entender o que está sendo perguntado.

## 15. Edge Cases

- EC1 — **Avaliação anterior à SPEC-037.** Chega com `null` nas duas e o app funciona igual.
- EC2 — **"Não sei dizer".** É resposta e é gravada como tal.
- EC3 — **Cliente adulterado manda `low_porosity`.** O CHECK recusa (23514).
- EC4 — **Migration não aplicada no ambiente.** O app **quebra inteiro**, não degrada: a lista de
  colunas do `select` é uma só. Por isso a ordem é migration → código, e `pnpm check:remote-schema`
  passou a verificar coluna, não só tabela.

## 16. Failure Modes

- FM1 — Escrita falha no onboarding: a tela já diz e deixa tentar de novo (SPEC-002).
- FM2 — Linha com valor fora do vocabulário: `hairProfileFromRow` **lança**. Drift de schema falha
  alto, nunca em silêncio.

## 17. Acceptance Criteria

- AC1 — As duas perguntas aparecem no onboarding e na reavaliação, na ordem dos blocos. **Teste.**
- AC2 — O que a tela coleta é exatamente o que o port recebe. **Teste** (asserção do objeto inteiro).
- AC3 — O adapter grava as duas colunas. **Teste** (asserção do payload inteiro).
- AC4 — `null` sobrevive à leitura e não vira `'unknown'`. **Teste** no core.
- AC5 — O CHECK recusa classificação de porosidade e disponibilidade fora da lista. **pgTAP.**
- AC6 — A contagem prometida nas pausas confere com o roteiro. **Teste.**
- AC7 — Jornada real a 390px no DEV: onboarding completo → cronograma → reload. **Pendente da
  migration no DEV.**

## 18. Testing Strategy

Core: vocabulário, obrigatoriedade no input, `null` no snapshot, recusa de classificação. Mobile:
walker do onboarding, payload do adapter, contagem das pausas. pgTAP: CHECKs, `null` aceito, e a
ausência de UPDATE — ninguém "completa" uma avaliação antiga depois.

## 19–22. Dependências, plano, migração, rollback

`supabase/migrations/20260910000000_hair_profiles_assessment_v2.sql`, aditiva. Rollback no rodapé do
arquivo. ⚠️ **Ordem de deploy: a migration vem antes do código.**

## 23. Open Questions

- OQ1 — **Objetivo único.** A D-102 levantou se `primary_goal` deveria virar múltiplo. Não foi
  mudado: mexer no vocabulário de um input que o motor v1 lê é mudança de comportamento de
  cronograma, e pertence à fatia 2.
- OQ2 — **`F36` carrega regra capilar** — "de quanto em quanto tempo este cabelo precisa de
  reconstrução" é exatamente o que exige sign-off (D-26/OQ-REL). Construível como `candidate`;
  bloqueado para PUBLIC RELEASE.

## 24. Change Log

| Data | Mudança |
|---|---|
| 2026-09-03 | v1.0 — fatia 1 (F35) implementada: as duas entradas que a medição do D-102 encontrou. |
