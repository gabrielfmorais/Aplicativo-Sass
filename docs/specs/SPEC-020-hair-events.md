# SPEC-020 — "Meu cabelo mudou": o app fica sabendo

| Campo | Valor |
|---|---|
| ID | SPEC-020 |
| Status | **IMPLEMENTADA — validação real pendente** (agente, §0.2/§0.4). O código está pronto e verde; a migration **ainda não foi aplicada no DEV**, então a jornada feliz não foi observada e a capability **não é DONE** (D-90). |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Hair Profile** (DOMAIN-MAP §3.2) |
| Related ADRs | ADR-001 (UI não contém regra), ADR-007 (gate de domínio), ADR-008 (datas) |
| Related SPECs | SPEC-002 (perfil capilar), SPEC-014 (reavaliação — o caminho oferecido), SPEC-005 (histórico), SPEC-016/SPEC-018 (design) |
| Fase | MASTER PRODUCT BACKLOG — **F23** |
| Criado | 2026-09-01 |

## 1. Context

O MASTER PRODUCT BLUEPRINT §6 nomeia o **maior risco do produto** com todas as letras: *"Ela descolore o cabelo numa sexta. O cronograma de segunda continua o mesmo, montado para um cabelo que não existe mais."* O app trata como atual um contexto capilar que mudou — e nem sabe.

A reavaliação (SPEC-014) já existe e resolve o cronograma. O que não existe é **o momento em que ela conta**: hoje a única porta é "Reavaliar" na conta, que pede oito perguntas sem nunca perguntar o que aconteceu. E o que aconteceu não fica registrado em lugar nenhum.

## 2. Problem

| Momento | Hoje | Deveria |
|---|---|---|
| Ela descolore o cabelo | nada acontece; o cronograma segue igual | ela conta em dois toques, e o app oferece reavaliar |
| Ela olha para trás | o histórico mostra cuidados, nunca o que mudou | os eventos fazem parte da linha do tempo dela |
| Uma virada no histórico | inexplicável | explicada pelo evento que a causou (base de `P2`) |

## 3. Goals

- G1 — Ela registra **o que aconteceu e quando**, de uma lista reconhecível, em dois toques.
- G2 — Depois de registrar, o app **oferece** reavaliar — e nunca decide por ela.
- G3 — O evento **fica**: entra no histórico dela e não some.
- G4 — Um registro errado é corrigível, sem apagar nada de verdade.

## 4. Non-Goals

- **NG1 — Não aconselha.** Nenhum texto sobre o que fazer depois de uma química, de um corte ou de uma praia. Isso é conteúdo capilar substantivo e exige sign-off (D-26/D-70).
- **NG2 — Não diagnostica.** Nunca dizer que o cabelo dela "está danificado", "está fragilizado" ou equivalente.
- **NG3 — Não reavalia sozinho.** Oferecer é o limite; substituir cronograma é decisão dela (mesma regra de D-28).
- **NG4 — Não é o SOS (`F24`).** A face urgente — "aconteceu agora e eu não sei o que fazer" — depende de conteúdo validado e continua bloqueada por D-26.
- **NG5 — Sem texto livre.** Nenhum campo de descrição: seria a primeira PII de forma livre do produto, sem consumidor, e mudaria a postura de privacidade (DATA-MODEL §4).
- **NG6 — Não interpreta o evento.** Nada de "isso costuma pedir mais X". O Free **registra**; interpretar é `P4`/`P2`, é Premium, e depende de inteligência que não existe.
- **NG7 — Nenhuma dependência nova.**

## 5. User Stories

- Como usuária que acabou de descolorir, quero contar isso ao app para que o cronograma pare de ser o de antes.
- Como usuária que registrou o evento errado, quero corrigir sem perder o resto.
- Como usuária olhando para trás, quero ver o que mudou, e não só o que eu fiz.

## 6. Functional Requirements

- FR1 — De uma tela alcançável a partir da conta, ela registra um evento escolhendo **um tipo** de uma lista fechada e **quando aconteceu**.
- FR2 — A lista é: química · coloração · descoloração/luzes · corte · calor intenso · praia ou piscina · tranças ou penteados de proteção · pausa nos cuidados · "meu cabelo mudou e eu percebi".
- FR3 — A data é **hoje**. Data futura é recusada pelo servidor — um evento é algo que aconteceu. *(Escolher um dia passado é valor real e ficou como OQ6: sem desenho de seletor de data, improvisar um seria pior do que a ausência honesta.)*
- FR4 — Registrado o evento, o app **oferece** reavaliar, com uma saída igualmente clara para não reavaliar agora.
- FR5 — Ela vê os eventos que registrou, do mais recente para o mais antigo.
- FR6 — Ela pode **anular** um evento registrado por engano. A linha continua no banco, anulada, e some da lista.
- FR7 — Registrar é **idempotente**: dois toques no mesmo botão registram um evento, não dois.
- FR8 — Tudo compõe dos tokens e primitivas de `apps/mobile/src/design/`.

## 7. Business Rules

- BR1 — A UI não decide nada (ADR-001).
- BR2 — **Nenhum texto desta SPEC dá orientação capilar.** Os rótulos nomeiam o que aconteceu; nenhum diz o que fazer, o que esperar ou como o cabelo ficou. É o que mantém esta capability fora do gate D-26 — e é uma linha fácil de cruzar sem perceber, então tem barreira de teste.
- BR3 — O tipo de evento é enum fechado, validado no banco (`CHECK`) **e** em zod (P07).
- BR4 — `occurred_on` é o dia civil dela, enviado pelo cliente e validado como não-futuro no servidor (ADR-008).
- BR5 — Nada aqui altera plano, cuidado ou perfil capilar. O evento é um fato registrado; a reavaliação continua sendo o único caminho que muda cronograma.
- BR6 — Anular preserva a linha (`voided_at`), como `care_executions` (D-12/D-69). Não existe DELETE.

## 8. Data Model Impact

**Uma tabela nova: `public.hair_events`.**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `user_id` | uuid not null, FK `auth.users` on delete cascade | ownership direto (D-63) |
| `event_type` | text not null, `CHECK` na lista fechada de FR2 | |
| `occurred_on` | date not null | dia civil dela; `CHECK` de não-futuro é do servidor, ver §9 |
| `client_event_id` | uuid not null | idempotência por intenção; único por usuária (FR7) |
| `voided_at` | timestamptz null | anulado por engano; a linha fica (BR6) |
| `created_at` | timestamptz not null default `now()` | |

Índice único parcial `(user_id, client_event_id)`. Índice `(user_id, occurred_on desc)` para a listagem.

**Sem coluna de texto livre** (NG5). **Sem FK para plano ou cuidado:** o evento é sobre o cabelo dela, não sobre uma linha do cronograma — amarrá-lo a um plano faria o evento desaparecer na próxima substituição, que é o oposto de G3.

`DATA-MODEL.md` §3 e §4.1 são reconciliados na mesma PR.

## 9. API / Contracts

**Um port novo, nenhuma Edge Function.**

```ts
type HairEvent = {
  readonly id: string;
  readonly eventType: HairEventType;
  readonly occurredOn: string;
  readonly createdAt: string;
};
interface HairEventPort {
  list(): Promise<readonly HairEvent[]>;   // não anulados, mais recente primeiro
  record(input: {
    eventType: HairEventType;
    occurredOn: string;
    clientEventId: string;
    /** O fuso IANA dela: é o servidor que decide o dia civil (ADR-008). */
    timeZone: string;
  }): Promise<void>;
  void(eventId: string): Promise<void>;
}
```

Mais `HairEventTypeSchema` em `packages/core`, espelhando o `CHECK` do banco.

**RPC, resolvido.** A validação de "não-futuro" precisa do servidor, e o servidor não conhece o fuso dela (ADR-008: o fuso viaja na chamada). `public.care_local_today(timezone)` já existia (SPEC-005) e já valida e limita o fuso recebido (T22), então a checagem saiu de graça — e a idempotência por `(user_id, client_event_id)` precisava do servidor de qualquer forma. `record_hair_event(p_event_type, p_occurred_on, p_client_event_id, p_timezone)` e `void_hair_event(p_event_id)`, ambas `SECURITY DEFINER` com `search_path` fixo e allowlistadas.

## 10. Authorization

- `SELECT` da própria linha (RLS `using user_id = auth.uid()`).
- **Escrita só pela RPC** (§9): o cliente não recebe `INSERT` nem `UPDATE`, e o `user_id` **nunca** é parâmetro — vem de `auth.uid()`.
- Sem `DELETE`, para ninguém e nunca.
- Anular é chamada de RPC própria, que recusa evento alheio e evento já anulado.

## 11. Security Considerations

Checklist de `SECURITY-BASELINE` §13:

- Tabela nova: RLS `enable` + `force`, policy de linha própria, grants na allowlist. **Só `SELECT` para `authenticated`.**
- `SECURITY DEFINER`: **sim**, com allowlist, `search_path` fixo e `auth.uid()` validado dentro — justificado aqui: dia civil e idempotência são invariantes de servidor.
- Cliente adulterado: não escreve para outra usuária (o `user_id` não é parâmetro), não registra data futura (validado no servidor), não duplica (índice único), não apaga (sem `DELETE`).
- Entrada validada em zod **e** no banco.
- PII: o tipo de evento é dado pessoal sobre o cabelo dela — mesma categoria de `hair_profiles`, não sensível. Nunca em log nem analytics.
- Segredo: nenhum.

## 12. Privacy Considerations

Um dado novo, de escolha fechada, sobre o cabelo dela — a mesma categoria que `hair_profiles` já coleta. Sai com a conta por cascade. Sem texto livre (NG5), então a postura de privacidade do produto **não muda** (DATA-MODEL §4). `DATA-MODEL` §4.1 passa a listá-lo.

## 13. Analytics Events

**Nenhum** (D-31).

## 14. UX Notes (sem design visual)

- **Uma ideia por tela**: "o que mudou?".
- Depois de registrar, a oferta de reavaliar é uma **escolha de duas saídas claras**, nunca um caminho único.
- A lista de eventos é uma linha do tempo curta e factual: o que, quando. Sem adjetivo, sem ícone de alerta, sem "atenção".
- Nada aqui pode parecer repreensão. Descolorir não é erro; é informação.

## 15. Edge Cases

- EC1 — Nenhum evento ainda: a tela explica o que ela pode registrar, sem parecer vazia por falha.
- EC2 — Data futura: recusada, com a razão em palavra.
- EC3 — Dois toques no botão: um evento (FR7).
- EC4 — Sem rede: erro explícito e nova tentativa; a mesma `clientEventId` é reusada.
- EC5 — Ela anula o único evento: a lista volta ao estado vazio, sem drama.
- EC6 — Ela registra e recusa reavaliar: o evento fica; o cronograma segue como está. Nada de insistir.
- EC7 — Tela pequena e fonte grande: rola, não trunca.

## 16. Failure Modes

- Falha ao registrar ⇒ nada foi gravado, erro explícito, nova tentativa com a mesma chave.
- Falha ao listar ⇒ erro com nova tentativa; nunca uma lista vazia que finge que ela não registrou nada.
- Falha ao anular ⇒ o evento continua lá, e a tela diz isso.

## 17. Acceptance Criteria

- AC1 — Ela registra um evento da lista fechada, com data, em dois toques.
- AC2 — Data futura é recusada **pelo servidor**, não só pela tela.
- AC3 — Dois toques registram um evento (idempotência por `clientEventId`, verificada com a chamada repetida).
- AC4 — Depois de registrar, reavaliar é **oferecido**, e recusar é igualmente fácil.
- AC5 — Os eventos aparecem, do mais recente para o mais antigo, sem os anulados.
- AC6 — Anular preserva a linha no banco e some da lista.
- AC7 — Um cliente adulterado não registra, não lê, não anula evento de outra usuária (pgTAP, positivo e negativo).
- AC8 — **Nenhum texto orienta cuidado, prevê resultado ou qualifica o cabelo dela** — barreira de teste com amostras que precisam casar.
- AC9 — Nenhum literal de cor/espaçamento fora de `design/`; `package.json` inalterado.
- AC10 — `pnpm verify` verde e pgTAP verde no CI.
- AC11 — **Validação visual real a 390px.**

## 18. Testing Strategy

- **pgTAP**: guardrails de fundação, posse e isolamento entre duas usuárias, recusa de data futura, idempotência da mesma `client_event_id`, anular preservando a linha, ausência de `DELETE`, `search_path` pinado na DEFINER.
- **Vitest**: `HairEventTypeSchema` (aceita a lista, recusa o resto).
- **RNTL**: registrar, recusar data futura, guarda de duplo toque, oferta de reavaliar com as duas saídas, listagem sem anulados, estados de erro — e a barreira de AC8.

## 19. Dependencies

**Nenhuma nova.**

## 20. Implementation Plan

1. Banco: migration, allowlist, RPCs, pgTAP.
2. Core: schema do tipo de evento + port.
3. App: adapter, tela, entrada pela conta, oferta de reavaliação.
4. Validação visual a 390px e fechamento do `F23` no backlog.

## 21. Migration Plan

Aditiva: uma tabela, duas funções, policies e grants. Nenhuma tabela existente alterada, nenhum backfill. **Aplicar no DEV é ação do dono** enquanto o histórico de migrations não for reparado (runbook `DEV-DATABASE-PROVISION` §5).

## 22. Rollback Plan

Reverter a PR e `drop table if exists public.hair_events` mais as funções. Antes do release não há dado a preservar.

## 23. Open Questions

- **OQ1 — RESOLVIDA — RPC.** `public.care_local_today(timezone)` já existia (SPEC-005) e já valida e limita o fuso recebido (T22), então a validação de não-futuro saiu de graça. A idempotência por `(user_id, client_event_id)` fecha o resto.
- **OQ2 — CAN DEFER — onde a entrada mora.** A conta é o lugar óbvio e não polui a Hoje. O Blueprint também cita a Hoje e o Wash Day (que não existe). *Assunção:* só a conta, por ora.
- **OQ3 — CAN DEFER — mais de um evento no mesmo dia.** Nada impede, e não deveria: ela pode cortar e pintar no mesmo dia. *Assunção:* permitido; a idempotência é por intenção (`clientEventId`), não por dia.
- **OQ4 — CAN DEFER — o evento na linha do tempo da Hoje.** Misturar eventos com cuidados no histórico da Hoje é valor real, e também é uma segunda tela mexida. *Assunção:* fora desta SPEC; a lista fica na própria tela de eventos.
- **OQ6 — IMPORTANT — registrar um evento passado.** A implementação envia sempre `hoje`. O caso do Blueprint é ela contar quando acontece, e é o que está coberto; contar "isso foi na semana passada" exige um seletor de data que esta SPEC não desenhou, e improvisar um é como se erra a primeira versão de uma tela. O servidor **já aceita** data passada — só falta a interface. *Gatilho:* a primeira vez que alguém disser que registrou no dia errado.
- **OQ5 — IMPORTANT — "pausa nos cuidados" é evento ou é `F22`?** `F22` (Pausa do cronograma) é uma capability própria, com estado de plano. Registrar *que houve* uma pausa é diferente de *pausar*. *Assunção:* aqui é só o registro; `F22` continua COMMITTED e intocada.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-01 | v0.2 — **implementada.** Tabela `hair_events` com `SELECT` próprio e **nenhuma escrita** para o cliente; `record_hair_event` e `void_hair_event` `SECURITY DEFINER` com `search_path` fixo, `user_id` de `auth.uid()`, não-futuro por `care_local_today` e idempotência por `client_event_id`. `HairEventPort` + enum no core, adapter, tela, entrada pela conta **antes** da reavaliação. 17 asserções pgTAP. **OQ1 resolvida.** A tela e os caminhos de erro foram validados a 390px no DEV; o caminho feliz espera a migration. | agente (§0.2/§0.4) |
| 2026-09-01 | v0.1 — Draft criada pela skill `spec-create` para o **F23** do MASTER PRODUCT BACKLOG (D-92), seguindo o Blueprint §6 (D-94). O Free **registra e oferece reavaliar**; não interpreta, não aconselha e não diagnostica — é o que mantém a capability fora do gate D-26. Cinco Open Questions, nenhuma BLOCKING. | agente |
