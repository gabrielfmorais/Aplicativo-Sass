# SPEC-023 — Minha Prateleira: os produtos que ela já tem

| Campo | Valor |
|---|---|
| ID | SPEC-023 |
| Status | **DONE** (agente, §0.2/§0.4 — aguarda ratificação humana). Jornada completa executada e observada no DEV real a 390×844 em 2026-09-01. |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Hair Profile** (DOMAIN-MAP §3.2) — o inventário é dela, como o perfil |
| Related ADRs | ADR-001, ADR-008 |
| Related SPECs | SPEC-020 (o precedente de "o Free registra, sem interpretar"), SPEC-016/SPEC-018 (design) |
| Fase | MASTER PRODUCT BACKLOG — **F26**, antes do `F25` |
| Criado | 2026-09-01 |

## 1. Context

O Blueprint §10 abre com o problema inteiro: *"Ela tem doze produtos no banheiro e não sabe quais estão ajudando. Compra mais."*

**Por que esta capability vem antes do Wash Day (`F25`), e não depois.** O Blueprint chama o Wash Day de *hub do produto* e diz, em §9, que ele **consome** `F26`. Um Wash Day sem produtos é um hub sem nada relevante para pendurar: técnica e avaliação já existem (SPEC-006), e o que falta para responder *"o que funciona comigo?"* é justamente **o que ela usou**. Construir o hub primeiro produziria uma tela de registro que não registra a informação que importa — e um modelo de dados desenhado sem o seu principal consumidor. *(Sequenciamento é do agente, §0.4/D-97.)*

## 2. Problem

O app sabe o que estava planejado, se ela fez, e como ela avaliou. Não sabe **com o quê**. Sem isso, `P6` Smart Shelf, `P8` padrões e as recomendações que *"preferem o que ela já possui"* não têm de onde partir — e a regra do Blueprint de nunca recomendar o que ela não tem depende de alguém saber o que ela tem.

## 3. Goals

- G1 — Ela cadastra, em segundos, um produto que já possui, **do jeito que ela chama**.
- G2 — Ela vê a prateleira dela, e tira dali o que não usa mais **sem perder histórico**.
- G3 — O modelo suporta o vínculo **produto ↔ uso ↔ resultado** que `F25`/`P6` vão precisar, **sem retrabalho**.

## 4. Non-Goals

- **NG1 — Não é loja e não é catálogo.** É a prateleira dela. Catálogo global é `P18`.
- **NG2 — Nunca inventar composição, indicação, preço, benefício, marca ou link.** O app guarda o que ela digitou e mais nada (§1.3 do Blueprint).
- **NG3 — Não interpreta.** Nada de "mais usado", ranking, combinação ou correlação: isso é `P6`, é Premium, e **exige volume mínimo**.
- **NG4 — Sem paywall.** Registrar nunca é pago: cobrar pelo registro seca a fonte que o Premium bebe.
- **NG5 — Não é o Wash Day.** Marcar quais produtos ela usou num dia é `F25`, e é a razão desta SPEC existir antes.
- **NG6 — Nenhuma dependência nova.**

## 5. User Stories

- Como usuária com doze produtos no banheiro, quero ter todos num lugar só.
- Como usuária que acabou um produto, quero tirá-lo da prateleira sem apagar que eu já o usei.
- Como usuária apressada, quero cadastrar um produto em dois campos, não em oito.

## 6. Functional Requirements

- FR1 — Ela adiciona um produto com **nome** (como ela chama) e **categoria** de uma lista fechada.
- FR2 — A prateleira lista os produtos ativos, do mais recente para o mais antigo.
- FR3 — Ela **arquiva** um produto que não usa mais. Ele some da lista e a linha continua no banco.
- FR4 — Ela renomeia um produto — corrigir um erro de digitação não pode exigir apagar e recadastrar.
- FR5 — Adicionar duas vezes o mesmo nome não cria dois produtos ativos.
- FR6 — Prateleira vazia é um convite claro, não uma tela vazia.
- FR7 — Tudo compõe dos tokens e primitivas de `apps/mobile/src/design/`.

## 7. Business Rules

- BR1 — A UI não decide nada (ADR-001).
- BR2 — **O nome é dela.** O app não normaliza, não corrige, não sugere e não completa a partir de catálogo nenhum.
- BR3 — A categoria é enum fechado, validado no banco **e** em zod (P07), e é **organização de prateleira, não afirmação capilar**: nenhum valor pode sugerir para que serve ou o que faz. É o que mantém esta capability fora do gate D-26.
- BR4 — Arquivar **não apaga** (D-69). Um produto que já foi usado precisa continuar existindo para o uso continuar fazendo sentido.
- BR5 — Nada aqui é interpretado, comparado ou pontuado.

## 8. Data Model Impact

**Uma tabela: `public.products`.**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid not null, FK `auth.users` cascade | ownership direto (D-63) |
| `name` | text not null, `check` 1..80 e `btrim <> ''` | **PII** — como ela chama o produto dela |
| `category` | text not null, `CHECK` em lista fechada | shampoo · condicionador · máscara · leave-in ou creme · óleo ou sérum · finalizador · outro |
| `archived_at` | timestamptz null | fora da prateleira; a linha fica (BR4) |
| `created_at` | timestamptz not null | |

Índice único parcial em `(user_id, lower(name)) where archived_at is null`: **um produto ativo por nome**, o que resolve o duplo toque de FR5 sem chave de idempotência e ainda permite recadastrar depois de arquivar.

**Sobre o texto livre.** A SPEC-020 recusou texto livre porque seria PII **sem consumidor**. Aqui é o contrário: o nome **é** o produto — sem ele não há prateleira, e um vocabulário fechado de nomes de produto seria um catálogo global, que é `P18` e explicitamente não é isto. O limite de 80 caracteres e a ausência de qualquer outro campo aberto mantêm o dado do tamanho de um nome, não de um diário.

**O encaixe que o Wash Day vai usar** (não implementado aqui): `F25` liga uso a produto por uma tabela de junção `wash_day_products (wash_day_id, product_id)`. Nada nesta tabela precisa mudar para isso acontecer — é por isso que ela nasce agora.

## 9. API / Contracts

**Um port novo, nenhuma RPC.** Como `profiles` e `plan_preferences`, e ao contrário de planos e execuções: esta linha **não guarda invariante de servidor** — não há dia civil a decidir nem idempotência a garantir (o índice único cuida do duplo toque). Posse é RLS mais `with check`.

```ts
type Product = {
  readonly id: string;
  readonly name: string;
  readonly category: ProductCategory;
};
interface ProductPort {
  list(): Promise<readonly Product[]>;               // ativos, mais recente primeiro
  add(input: { name: string; category: ProductCategory }): Promise<void>;
  rename(input: { id: string; name: string }): Promise<void>;
  archive(id: string): Promise<void>;
}
```

Mais `ProductNameSchema` e `ProductCategorySchema` em `packages/core`, espelhando as constraints.

## 10. Authorization

`SELECT`/`INSERT`/`UPDATE` **apenas da própria linha**, com `using` e `with check` em `user_id = auth.uid()`. **Sem `DELETE`:** arquivar é `UPDATE`, e a linha morre por cascade com a conta.

## 11. Security Considerations

- Tabela nova: RLS `enable` + `force`, três policies de linha própria, grants na allowlist, policy `for all to postgres` porque `force` vale para o dono. **Nenhum `SECURITY DEFINER`** — não há invariante de servidor a proteger.
- Cliente adulterado: `with check` impede escrever na prateleira de outra pessoa; sem `DELETE`, nada é apagado.
- Entrada validada em zod **e** por constraint.
- PII: o nome do produto. Nunca em log, nunca em analytics (não há — D-31).

## 12. Privacy Considerations

É **inventário pessoal**. Não sai do app, não vira perfil comercial, não é enviado a lugar nenhum. Sai com a conta por cascade. `DATA-MODEL` §4.1 passa a listá-lo.

## 13. Analytics Events

**Nenhum** (D-31).

## 14. UX Notes (sem design visual)

- Dois campos e um botão. Um formulário longo não é preenchido, e uma prateleira vazia não vale nada.
- Categoria como escolha de uma linha, no mesmo registro dos chips do onboarding.
- Prateleira vazia: uma frase que convida, sem cobrança.
- Arquivar é ação quieta, na linha do produto — não um botão vermelho.

## 15. Edge Cases

- EC1 — Prateleira vazia: convite (FR6).
- EC2 — Nome repetido: a tela diz que ela já tem esse produto, em vez de mostrar o erro do banco.
- EC3 — Nome só com espaços: recusado pelo banco e pela tela.
- EC4 — Nome longo: cortado em 80, como o nome dela em `profiles`.
- EC5 — Arquivar e recadastrar o mesmo nome: permitido — o índice único só vale entre os ativos.
- EC6 — Sem rede: erro explícito e nova tentativa.
- EC7 — Tela pequena e fonte grande: rola.

## 16. Failure Modes

- Falha ao listar ⇒ erro com nova tentativa; nunca uma prateleira vazia que finge que ela não cadastrou nada.
- Falha ao adicionar ⇒ nada foi gravado, e a tela diz isso.
- Violação de unicidade ⇒ tratada como mensagem, não como falha (EC2).

## 17. Acceptance Criteria

- AC1 — Ela adiciona um produto com nome e categoria, e ele aparece na prateleira.
- AC2 — Adicionar o mesmo nome duas vezes não cria dois ativos, e a tela explica.
- AC3 — Arquivar tira da lista e **preserva a linha** no banco.
- AC4 — Renomear funciona sem recadastrar.
- AC5 — Um cliente adulterado não lê, escreve nem arquiva produto de outra usuária (pgTAP).
- AC6 — **Nenhum texto afirma composição, indicação, preço, benefício ou eficácia** — barreira de teste com amostras que precisam casar.
- AC7 — Nenhuma interpretação: sem ranking, "mais usado", correlação ou pontuação.
- AC8 — Nenhum literal de cor/espaçamento fora de `design/`.
- AC9 — `pnpm verify` verde, pgTAP verde no CI, **validação visual a 390px**.

## 18. Testing Strategy

pgTAP para posse, isolamento entre duas usuárias, ausência de `DELETE`, unicidade entre ativos e recadastro após arquivar · Vitest para os dois schemas · RNTL para adicionar, duplicar, arquivar, renomear, vazio, erro, e as barreiras de AC6/AC7.

## 19. Dependencies

**Nenhuma nova.**

## 20. Implementation Plan

Fatia única: migration + allowlist + pgTAP · schemas e port no core · adapter e tela · validação a 390px · `F26` → DONE.

## 21. Migration Plan

Aditiva. **Aplicar no DEV é ação do dono** (runbook `DEV-DATABASE-PROVISION` §5).

## 22. Rollback Plan

Reverter a PR e `drop table if exists public.products`.

## 23. Open Questions

- **OQ1 — CAN DEFER — a lista de categorias.** Sete valores neutros cobrem o banheiro típico; qualquer um a mais é fácil de acrescentar e difícil de tirar depois. *Assunção:* os sete de §8. *Gatilho:* alguém dizer que o produto dela não cabe em nenhum.
- **OQ2 — CAN DEFER — marca separada do nome.** Separar marca ajudaria `P18`, mas hoje ninguém consome, e dois campos viram formulário. *Assunção:* um campo só; ela escreve como quiser.
- **OQ3 — CAN DEFER — quantidade, validade, preço.** Todos são valor real e nenhum tem consumidor hoje (D-47/D-48). *Assunção:* fora. *Gatilho:* a capability que os pedir.
- **OQ4 — CAN DEFER — onde a prateleira vive.** Tela própria a partir da conta é o mínimo; o Blueprint também cita "de dentro do Wash Day, quando o cadastro custa menos" — mas o Wash Day não existe. *Assunção:* só a conta, por ora.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-01 | v0.3 — **DONE.** Migration aplicada no DEV; jornada observada a 390×844: vazio → cadastrar com o nome normalizado só no espaço → **nome repetido em outra caixa recusado pelo índice e traduzido em frase** → segundo produto, mais recente primeiro → arquivar → **recadastrar o mesmo nome, permitido** → reload e novo login persistindo → leitura falhando mostra carregando, depois erro com nova tentativa, e **nunca** o estado vazio. Zero BLOCKER/IMPORTANT na execução real. | agente (§0.2) |
| 2026-09-01 | v0.2 — **implementada.** `products` sem RPC — a linha não guarda invariante de servidor, e o duplo toque cai no índice único parcial. A violação de unicidade é **traduzida na fronteira**: chega à tela como "você já tem esse produto", não como falha. 15 asserções pgTAP. | agente (§0.2) |
| 2026-09-01 | v0.1 — Draft criada para o **F26**, movido para **antes** do `F25` porque o Blueprint §9 diz que o Wash Day **consome** os produtos: construir o hub primeiro daria um modelo desenhado sem o seu principal consumidor. Texto livre aqui é justificado ao contrário de SPEC-020 — o nome **é** o produto, e um vocabulário fechado de nomes seria o catálogo global que `P18` reserva. | agente (§0.4/D-97) |
