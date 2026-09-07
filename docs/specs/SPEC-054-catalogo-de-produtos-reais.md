# SPEC-054 — O catálogo de produtos reais (`F32`), e a prateleira que o consome

| Campo | Valor |
|---|---|
| ID | SPEC-054 |
| Status | **Draft** |
| Owner | dono do produto |
| Bounded Context | Products (`packages/core/src/products`) + Care Tracking (execução) |
| Related ADRs | ADR-001, ADR-006, **D-104** (a cadeia inteira), D-26/D-70, D-47/D-48 |
| Related SPECs | **SPEC-023** (`F26` a prateleira manual, que continua), SPEC-024 (`F25` o Wash Day), SPEC-041 (`F48` produtos na execução), SPEC-049 (`P6` Smart Shelf) |
| Fase do roadmap | MASTER PRODUCT BACKLOG — `F32` catálogo · `F33` EAN (parcial) · `F48` (evolução) |
| Criado / Atualizado | 2026-09-07 / 2026-09-07 |

## 1. Context

A `SPEC-023` entregou a prateleira: ela cadastra o que tem, **do jeito que chama**. Funciona, é dela,
e é a base de tudo o que veio depois — Wash Day, Smart Shelf, Hair Intelligence.

O que falta é o outro lado: *"Máscara da feira"* é um nome, não um produto. Não tem marca, não tem
foto, não tem como aparecer igual na execução, e não tem como duas usuárias falarem da mesma coisa.

O dono pediu (2026-09-07), com a fonte de verdade transcrita:

> *"Quero a Minha Prateleira com: produto real; marca real; linha; variante/tamanho; categoria; foto
> REAL/OFICIAL; busca; adicionar à prateleira. A mesma entidade/imagem deve aparecer também na
> execução quando aquele produto estiver associado ao cuidado."*

E a proibição, também transcrita:

> *"Não usar: Google Images aleatório; scraping sem direito; imagem de ecommerce sem autorização;
> embalagem inventada; imagem gerada fingindo ser produto real."*

> *"Se assets reais dependerem de contrato/feed/direito de imagem: isso bloqueia apenas a ingestão
> real. Construa todo o restante autonomamente."*

## 2. Problem

⚠️ **A prateleira manual não escala para o que vem depois dela.** A cadeia da D-104 —
`catálogo → prateleira → execução → histórico → Smart Shelf → Hair Intelligence → recomendações` —
tem o catálogo na **cabeça**, e sem ele cada elo trabalha com um texto que só significa alguma coisa
para quem digitou.

## 3. Goals

- G1 — Existe uma **entidade de produto real** com marca, linha, nome, variante/tamanho, categoria,
  EAN e imagem — e **cada uma dessas coisas é identidade, nunca alegação**.
- G2 — Ela **busca e adiciona** um produto do catálogo à prateleira dela, em vez de digitar.
- G3 — ⚠️ **A prateleira manual continua inteira.** O catálogo chega **por cima** da mesma linha em
  `products`, nunca no lugar dela.
- G4 — O mesmo produto aparece **igual** na execução (`F48`), com a mesma marca e a mesma imagem.
- G5 — **Toda imagem carrega a origem e o direito sob o qual está ali** — e o banco recusa uma que
  não carregue.
- G6 — **Pronto para EAN** (`F33`): o campo, o índice e a busca existem; o scanner é o que falta.

## 4. Non-Goals

- NG1 — ⛔ **O catálogo NÃO guarda composição, indicação, benefício, "para que serve", "para qual
  cabelo" ou qualquer efeito.** É a mesma linha da SPEC-023, e agora com mais razão: um catálogo com
  campo de indicação vira **conteúdo capilar substantivo** ⇒ **gate D-26/D-70**. Barreira de teste.
- NG2 — ⛔ **Não é vitrine e não é marketplace** (D-104). Sem preço, sem link de compra, sem loja,
  sem "onde comprar". Afiliados são o `T2` e dependem de contrato real.
- NG3 — ⛔ **Nenhuma ordenação por mérito.** A busca ordena por **correspondência e nome**, nunca por
  patrocínio, popularidade ou "melhor para você" — o primeiro é o `T2`, o último é a `P18`.
- NG4 — ⛔ **Nenhuma imagem sem direito declarado**, e isso é `CHECK`, não política (§11).
- NG5 — ⛔ **Nenhuma imagem gerada.** Não existe caminho para "criar" a foto de um produto real: o
  campo é uma URL de origem declarada, e uma embalagem inventada é o oposto do que esta SPEC existe
  para dar.
- NG6 — **Sem scanner** (`F33` completo): ele soma a primeira dependência nativa de câmera, e o
  development build segue DEFERRED por constraint do dono. O que entra é a **busca por EAN**.
- NG7 — **A ingestão de produtos reais não acontece aqui.** É contrato, feed e direito de imagem ⇒
  **TRUE HUMAN GATE**. Esta SPEC constrói tudo o que fica em volta.

## 5. User Stories

- Como usuária, quero **procurar meu shampoo pelo nome** e adicioná-lo com marca e foto, em vez de
  digitar um apelido que só eu entendo.
- Como usuária que tem um produto que o app não conhece, quero **continuar digitando o nome** e nada
  mudar para mim.
- Como usuária, quero ver **a mesma embalagem** no momento do cuidado e no meu registro.

## 6. Functional Requirements

- FR1 — `catalog_products` guarda **marca · linha · nome · variante/tamanho · categoria · EAN ·
  imagem com origem**. Global, **somente leitura** para o cliente.
- FR2 — Só linhas **publicadas** aparecem: `published_at is null` é rascunho de ingestão e **não
  existe** para o app.
- FR3 — Busca por **texto** (marca, linha, nome) e por **EAN exato**, com teto de resultados.
- FR4 — `products.catalog_product_id` liga a prateleira dela ao catálogo. **Anulável**: `null` é a
  entrada manual, que continua sendo o caminho completo (G3).
- FR5 — ⚠️ **A linha da prateleira mantém o próprio `name` e a própria `category`.** O catálogo
  preenche na hora de adicionar e **não manda depois**.
- FR6 — A prateleira e a execução mostram **marca e imagem** quando existem, e ficam **exatamente
  como hoje** quando não existem (FR7).
- FR7 — ⚠️ **Fallback sem foto é caminho normal, não estado de erro.** Um produto de catálogo pode
  não ter imagem — e um sem imagem tem de ficar tão utilizável quanto um com.
- FR8 — ⚠️ **Com o catálogo vazio, a superfície de busca NÃO aparece.** O fluxo de adicionar é o de
  hoje, letra por letra.

## 7. Business Rules

- BR1 — ⚠️ **Identidade, nunca alegação.** Todo campo do catálogo responde *"que produto é este?"*.
  Nenhum responde *"o que ele faz?"* ou *"para quem serve?"*.
- BR2 — ⚠️ **Imagem só com origem e direito declarados.** `image_url` preenchida **exige**
  `image_source` e `image_rights`, e o banco recusa a linha se faltar (§11). ⚠️ **A engenharia não
  consegue verificar se o direito é verdadeiro** — o que ela consegue é tornar **impossível gravar
  uma imagem que não afirme qual é**, e deixar a afirmação rastreável até quem a inseriu.
- BR3 — **A prateleira dela é dela.** Corrigir ou despublicar uma linha do catálogo **não muda** o
  nome que ela vê. É a mesma regra do snapshot da SPEC-017: o registro é do momento em que foi feito.
- BR4 — **EAN é único quando existe**, e `null` é a maioria dos casos — nem todo produto tem, e nem
  toda ingestão traz.
- BR5 — ⚠️ **O catálogo não cria produto na prateleira sozinho.** Adicionar é ato dela, e o índice
  único por nome ativo (SPEC-023) continua valendo — inclusive contra adicionar duas vezes o mesmo.
- BR6 — A busca **nunca** ordena por patrocínio, popularidade ou adequação (NG3).

## 8. Data Model Impact

Ver `docs/architecture/DATA-MODEL.md`.

```
catalog_products                        (global, leitura pública autenticada)
  id, brand, line?, name, variant?, category, ean? unique
  image_url?, image_source?, image_rights?, image_credit?
  source, source_ref?, verified_at?, published_at?
  created_at, updated_at

products                                (a prateleira dela, SPEC-023)
  + catalog_product_id uuid null → catalog_products(id) on delete set null
```

⚠️ **`on delete set null`, nunca cascade:** o catálogo não é dono da prateleira dela. Uma linha
removida do catálogo transforma o produto dela em **manual**, e ela nem percebe — que é o
comportamento certo (BR3).

## 9. API / Contracts

`ProductCatalogPort` — `search({ text, ean, limit })` e `getById(id)`. **Sem RPC:** a leitura é de uma
tabela pública-para-autenticadas, sem invariante de servidor a proteger; e `products` continua sem
RPC pela razão que a SPEC-023 já mediu.

## 10. Authorization

- `catalog_products`: RLS ON + FORCE. `select` para `authenticated` **apenas onde
  `published_at is not null`**. ⛔ **Nenhum `insert`, `update` ou `delete` para o cliente** — a
  ingestão é fora de banda, por `service_role`, e é o gate do dono.
- `products`: inalterada — a coluna nova entra sob as policies que já existem.

## 11. Security Considerations

- ⚠️ **A trava de direito de imagem é um `CHECK`, e é o coração desta SPEC.**
  `image_url is not null` obriga `image_source` **e** `image_rights` preenchidos, com `image_rights`
  num vocabulário fechado (`brand_authorized` · `licensed_feed` · `owned`). ⛔ Não existe valor para
  *"achei no Google"*, e não existe caminho para gravar uma imagem sem dizer de onde ela veio.
- **Rastreabilidade** — `source`, `source_ref` e `verified_at` dizem de onde a linha veio e quando
  alguém a conferiu. Uma linha sem `verified_at` pode existir, mas **não publicada** (FR2).
- **Cliente adulterado** — não escreve nada: sem grant de escrita, não há superfície.
- **Vazamento entre usuárias** — o catálogo é global e não contém dado de ninguém; `products`
  continua sob a RLS dela.
- **PII** — nenhuma. Um produto de catálogo não descreve pessoa alguma.

## 12. Privacy Considerations

⚠️ **Ligar a prateleira ao catálogo NÃO torna a prateleira menos privada.** `catalog_product_id`
mora na linha dela, sob a RLS dela; ninguém consegue perguntar *"quem tem este produto?"*.

## 13. Analytics Events

Nenhum. Não há provider (D-31). ⚠️ **E contar buscas seria o primeiro passo para ordenar por
popularidade**, que a NG3 proíbe.

## 14. UX Notes (sem design visual)

- Adicionar produto: **busca primeiro, digitar sempre disponível** — e com o catálogo vazio, só
  digitar (FR8).
- O resultado mostra **marca · nome · linha · variante**, com a imagem quando existe e uma marca
  visual neutra quando não (FR7). ⛔ Nada de *"recomendado"*, *"popular"* ou *"para o seu cabelo"*.
- Na prateleira e na execução, a marca aparece **junto do nome**, não no lugar dele: o nome continua
  sendo o que ela reconhece.

## 15. Edge Cases

- EC1 — **Catálogo vazio** — a busca não aparece; tudo funciona como hoje. **É o estado atual e
  permanente até a ingestão acontecer.**
- EC2 — **Produto de catálogo sem imagem** — caminho normal (FR7).
- EC3 — **Ela adiciona do catálogo um produto que já tem manualmente** — cai no índice único por
  nome ativo e é traduzido como *"você já tem esse produto"* (SPEC-023).
- EC4 — **Linha do catálogo despublicada depois** — a prateleira dela não muda (BR3); o que some é a
  busca encontrá-la.
- EC5 — **Linha do catálogo apagada** — `catalog_product_id` vira `null` e o produto dela vira
  manual, sem perda.
- EC6 — **Busca sem resultado** — oferece digitar, que é o caminho que sempre existiu.
- EC7 — **EAN duplicado na ingestão** — recusado pelo índice único, na ingestão, não na tela.

## 16. Failure Modes

- Busca falha → a tela oferece digitar, e a prateleira não quebra (o padrão da SPEC-026: uma oferta
  ausente não é um erro a mostrar).
- Imagem não carrega → o fallback sem foto, que já é caminho normal (FR7).

## 17. Acceptance Criteria

- AC1 — Com catálogo vazio, **a prateleira se comporta byte a byte como hoje**. **Teste.**
- AC2 — Busca por texto e por EAN, com teto. **Teste.**
- AC3 — Adicionar do catálogo cria a linha dela **com o vínculo**, e o nome/categoria ficam **na
  linha dela**. **Teste.**
- AC4 — Apagar a linha do catálogo **não muda** o produto dela. **pgTAP.**
- AC5 — ⛔ **Imagem sem `image_source`/`image_rights` é recusada pelo banco.** **pgTAP** — é a NG4.
- AC6 — Cliente sem grant de escrita no catálogo: `42501` no INSERT, UPDATE e DELETE. **pgTAP.**
- AC7 — Linha **não publicada** não aparece para o cliente. **pgTAP.**
- AC8 — ⛔ Nenhum campo, rótulo ou texto do catálogo afirma efeito, indicação ou adequação. **Teste
  de linguagem**, com amostras que precisam casar.
- AC9 — A execução (`F48`) mostra **a mesma marca e a mesma imagem** que a prateleira. **Teste.**
- AC10 — **Validação a 390px no DEV real** com o catálogo **semeado por mim e depois desfeito** —
  ⚠️ com produtos **fictícios explicitamente marcados**, nunca com marca real sem direito.

## 18. Testing Strategy

Core: busca, ligação e o degradar-para-manual. RNTL para as telas. pgTAP para RLS, grants, o `CHECK`
de direito de imagem, publicação e o `set null`. Validação a 390px com dados de teste marcados.

## 19. Dependencies

Nenhuma nova. ⛔ **Nenhuma dependência de imagem, cache ou CDN** — a imagem é uma URL, e o que a
renderiza é o `Image` do React Native.

## 20. Implementation Plan

1. Migration (aditiva) → **HUMAN GATE de aplicação no DEV**.
2. Testes e barreiras primeiro.
3. Domínio + porta.
4. Adapter.
5. Telas (prateleira e execução).
6. 390px, pgTAP, `improve`, PR.

## 21. Migration Plan

Uma tabela nova e **uma coluna anulável** em `products`. Nenhuma linha existente é invalidada: toda
prateleira de hoje continua com `catalog_product_id = null`, que é o caminho manual.

## 22. Rollback Plan

`alter table public.products drop column catalog_product_id;` e
`drop table public.catalog_products;` — sem dado de produção.

## 23. Open Questions

- **OQ1 — TRUE HUMAN GATE — a ingestão.** Marcas reais, fotos oficiais e o direito de usá-las
  dependem de **contrato, feed ou autorização**. ⛔ **Engenharia não resolve isto e não deve tentar:**
  a única coisa que ela pode fazer — e faz aqui — é tornar **impossível gravar uma imagem que não
  declare o direito sob o qual está ali**.
- **OQ2 — CAN DEFER — o scanner (`F33`).** O EAN está pronto no schema e na busca; o scanner soma a
  primeira dependência nativa de câmera, e o development build segue DEFERRED.
- **OQ3 — CAN DEFER — busca por relevância.** Com o catálogo vazio, `ilike` mais ordenação por nome
  é honesto e mede o mesmo que qualquer coisa mais sofisticada. Índice de trigrama entra quando
  houver linhas o bastante para a diferença ser mensurável — **não antes**.
- **OQ4 — IMPORTANT — quem corrige uma linha errada do catálogo?** Um produto real com marca errada é
  um erro que a usuária vê e não pode consertar. Fora desta fatia (não há ingestão), mas **entra
  junto com a ingestão**, não depois.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-07 | v0.1 — rascunho a partir da fonte de verdade do dono. | agente |
