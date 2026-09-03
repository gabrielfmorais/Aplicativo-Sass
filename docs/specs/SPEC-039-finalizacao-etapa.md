# SPEC-039 — A finalização é uma etapa (F37)

| Campo | Valor |
|---|---|
| ID | SPEC-039 |
| Status | Em implementação |
| Owner | dono do produto |
| Bounded Context | Care Tracking (`packages/core/src/care-tracking`) + banco (`wash_day_finish`) + Hoje/Wash Day |
| Related ADRs | ADR-001 §2, ADR-006 (índice público entre contextos), D-26/D-70 (gate de domínio), D-47/D-48 (necessidade) |
| Related SPECs | SPEC-005 (execução), SPEC-006 (check-in), SPEC-024 (o hub do Wash Day), SPEC-025 (couro cabeludo) |
| Capability | `F37` fluxo `Lavou → Tratamento → Finalização → Resultado/Check-in` |
| Criado / Atualizado | 2026-09-03 / 2026-09-03 |

## 1. Context

O Blueprint §22 descreve o fluxo canônico:

```
LAVOU → TRATAMENTO (Hidratação/Nutrição/Reconstrução/Restauração) → FINALIZAÇÃO → RESULTADO/CHECK-IN
```

Ele existe no Blueprint e **em mais nenhum lugar**. Medido no código, duas coisas:

1. **A etapa não existe no modelo.** O `F25` (SPEC-024) registra produtos e técnicas; o `F31`
   (SPEC-025) registra o couro; o check-in (SPEC-006) registra o resultado. Entre o tratamento e o
   resultado não há nada — e o que decide boa parte de *como o cabelo dela fica* mora exatamente ali.
2. **A ordem da Hoje está invertida.** No cartão de um cuidado concluído, o `CheckInPrompt`
   (RESULTADO) é renderizado **antes** de "Contar esse cuidado". O app pergunta como ficou antes de
   ela ter dito o que fez.

E há um terceiro fato, que é a razão de esta SPEC existir com barreira e não só com tabela: **a
fusão que o dono proibiu já começou a acontecer sozinha.** Seis das catorze `WASH_DAY_TECHNIQUES`
são movimentos de secagem e finalização — `air_dried`, `blow_dried`, `diffuser`, `scrunched`,
`heat_protectant`, `protective_style`. A lista aceita um valor novo de finalização **sem nenhum
erro**, e a proibição de pendurar a finalização ali vive hoje só em prosa (Blueprint §22, D-102).

## 2. A linha entre estrutura e conteúdo

| | o quê | onde | gate |
|---|---|---|---|
| **Esta SPEC (`F37`)** | a etapa **existe**: ela finalizou ou pulou, por execução | `wash_day_finish` | nenhum |
| **`F38`** | **quais** finalizações, como fazer, "recomendadas para o seu cabelo" | conteúdo | **D-26/D-70** |

Nomear *que a etapa aconteceu* não é afirmação capilar: é o mesmo tipo de fato que "fiz o cuidado".
Nomear **técnicas de finalização** — fitagem, dedoliss, day after, técnica por curvatura — é
vocabulário de domínio com orientação embutida, e é o `F38`, atrás do gate. Esta SPEC **não cria
nenhum valor de técnica de finalização**, e a barreira do §8 existe para que criar um mais tarde
seja uma decisão consciente em vez de um `push` numa lista que já aceita qualquer coisa.

## 3. Goals

- **G1** A finalização é um **fato próprio** por execução, com registro separado do tratamento.
- **G2** A Hoje conduz na ordem canônica: tratamento → **finalização** → resultado.
- **G3** **Pular é resposta**, não ausência — e ausência continua existindo, para quem não disse nada.
- **G4** O hub continua aceitando o que o `F48` (produtos na execução) vai pendurar, **sem mexer** no
  que já existe.
- **G5** A proibição de fundir finalização com técnica deixa de ser prosa e vira **teste**.

## 4. Non-Goals

- **NG1** Nenhum vocabulário de técnica de finalização. É o `F38`, e ele depende do gate D-26/D-70.
- **NG2** Nenhuma recomendação, nenhum "para o seu cabelo", nenhuma ordem de preferência.
- **NG3** Nenhum produto atribuído à finalização ainda — é o `F48`, e o §7 deixa o lugar pronto.
- **NG4** **Não bloquear o check-in** atrás da finalização. A ordem conduz; ela não tranca.
- **NG5** Não pontuar, não comparar, não cobrar. Pular não é falha.
- **NG6** **Não mexer nas catorze técnicas existentes.** Seis delas são movimentos de finalização e
  **ficam onde estão**: reclassificá-las reescreveria o registro que já é dela (SPEC-024 BR3).

## 5. Functional Requirements

- **FR1** `public.wash_day_finish` guarda **uma** resposta por Wash Day — e portanto por execução —
  com `finish_status` em `{done, skipped}`.
- **FR2** No cartão de um cuidado concluído, a Hoje pergunta a finalização **acima** do check-in.
- **FR3** Respondida, a pergunta vira o fato ("Você finalizou" / "Você pulou a finalização"), com a
  resposta continuando tocável para trocar ou tirar.
- **FR4** O registro (`WashDayScreen`) ganha uma seção **Finalização** própria, separada de "Como
  você fez" — a separação é visível, não só estrutural.
- **FR5** A resposta persiste: depois do reload, a pergunta **não volta**.
- **FR6** Idempotência: a PK é o hub e a escrita é `upsert`. Toque repetido, retry depois de resposta
  perdida e dois aparelhos produzem **uma** linha.
- **FR7** Posse validada **nas duas pontas**: a policy olha o dono da linha, a FK composta olha o
  dono do hub.
- **FR8** Tocar na resposta marcada **tira** a resposta — voltar a "ainda não disse" é um estado
  válido, e é dela.

## 6. Business Rules

- **BR1** `skipped` é uma **resposta**; a ausência de linha é "ainda não disse". Nunca preencher por
  default — default é uma resposta que ninguém deu (a mesma lição do `F35`/SPEC-037).
- **BR2** A ordem é a única coisa que conduz. Nada aqui é obrigatório, nada bloqueia, nada cobra.
- **BR3** **Finalização não é técnica.** Uma técnica responde *como*; a etapa responde *se
  aconteceu*. São objetos diferentes — pôr `finalizei` na lista de técnicas afirmaria que finalizar
  é uma maneira de fazer, quando é uma parte do processo.
- **BR4** Nenhum rótulo desta SPEC faz alegação capilar. "Finalizei" e "Pulei dessa vez" descrevem o
  que ela fez, não o que aquilo provoca.
- **BR5** Anular a execução leva o registro junto, por cascade, como o resto do hub (SPEC-024 BR5).

## 7. Dados, autorização e o lugar do `F48`

Tabela nova, aditiva, **nenhuma linha existente muda**:

```sql
create table public.wash_day_finish (
  wash_day_id uuid primary key,
  finish_status text not null check (finish_status in ('done', 'skipped')),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint wash_day_finish_hub_owner_fk
    foreign key (wash_day_id, user_id) references public.wash_days (id, user_id) on delete cascade
);
```

**Por que uma tabela e não uma coluna no hub** — a mesma razão do `F31` (SPEC-025 §8), medida lá:
uma coluna exigiria `grant update (finish_status)`, que vive em `pg_attribute.attacl`, e **nenhum
guardrail do projeto olha para lá**; e `UPDATE` na tabela `wash_days` inteira deixaria o cliente
reapontar `care_execution_id` e mover o registro de um cuidado para outro.

**O lugar do `F48`.** Quando os produtos da finalização entrarem, eles penduram **nesta** linha —
`wash_day_finish_products (wash_day_id, product_id, user_id)`, com a mesma FK composta de posse das
outras junções. A decisão de o que fazer com produtos marcados quando ela troca para `skipped` é do
`F48`, com o consumidor na mão; inventá-la agora seria decidir sem o caso de uso (D-47/D-48).

Grants: `select, insert, update, delete` para `authenticated`. `UPDATE` porque trocar de resposta é
**uma** escrita (`on conflict do update`) e não um par apaga-e-escreve, que deixaria um instante sem
resposta se a segunda metade falhasse. `DELETE` porque tirar a resposta é FR8.

## 8. A barreira estrutural contra a fusão

Três travas, porque a proibição existia só em prosa e a lista já aceitava o valor errado:

1. **As catorze estão congeladas** (`packages/core`). Um teste compara `WASH_DAY_TECHNIQUES` com a
   lista literal da SPEC-024 e falha com a mensagem que diz onde a finalização mora. Acrescentar uma
   técnica de lavagem continua possível — mas passa a exigir tocar no teste, que é o ponto: a
   SPEC-024 já dizia que acrescentar um valor é mudança de produto, e agora isso é executável.
2. **Os vocabulários são disjuntos.** Nenhum valor de `FINISH_STATUSES` pode aparecer em
   `WASH_DAY_TECHNIQUES`, e vice-versa.
3. **O banco recusa a troca** (pgTAP): o `CHECK` de `wash_day_techniques.technique` rejeita
   `done`/`skipped`, e o `CHECK` de `wash_day_finish.finish_status` rejeita qualquer valor de
   técnica. As duas listas não se aceitam.

## 9. Edge Cases

- **EC1** Ela responde e desfaz o cuidado: a execução é anulada, o hub cai por cascade e a resposta
  vai junto — o registro de um fato que deixou de existir não sobrevive a ele.
- **EC2** Ela toca "Finalizei" duas vezes rápido: `busyId` já barra a segunda, e a PK absorveria.
- **EC3** A escrita falha: a resposta volta ao estado anterior e a tela diz que não deu, sem
  inventar que entrou.
- **EC4** Ela abre um cuidado antigo, de antes desta SPEC: não há linha, a pergunta aparece, e
  responder é permitido — o registro é dela, e não tem prazo.
- **EC5** Ela pula a finalização e responde o check-in: caminho normal, sem aviso e sem cobrança.

## 10. Acceptance Criteria

- **AC1** No DEV real a 390px: concluir um cuidado → a pergunta da finalização aparece **acima** do
  check-in → responder → reload → a resposta continua lá e a pergunta não volta.
- **AC2** Trocar `Finalizei` para `Pulei dessa vez` grava uma linha só, medida no banco.
- **AC3** Tocar na resposta marcada tira a resposta, e o estado volta a "ainda não disse".
- **AC4** O `WashDayScreen` mostra **Finalização** como seção própria, fora de "Como você fez".
- **AC5** O check-in continua acessível com a finalização não respondida (NG4).
- **AC6** Os três testes do §8 estão verdes, e cada um falha se a fusão for tentada.
- **AC7** pgTAP: posse nas duas pontas, RLS ligada e forçada, grants exatamente os do §7, hub de
  outra pessoa recusado.
- **AC8** Nenhum rótulo novo faz alegação capilar (BR4).

## 11. Open Questions

- **OQ1** Os produtos da finalização (`F48`) — a linha está preparada, a decisão é de lá.
- **OQ2** O vocabulário de técnicas de finalização (`F38`) — **atrás do gate D-26/D-70**, e é a razão
  de o §8 existir.
- **OQ3** A finalização vale para todos os quatro tipos de cuidado. Se algum dia ela deixar de valer
  para um deles, isso é regra capilar e não decisão de engenharia.

## 12. Change Log

| Data | Mudança |
|---|---|
| 2026-09-03 | SPEC criada. A etapa passa a existir; o conteúdo dela continua no `F38`, atrás do gate. |
