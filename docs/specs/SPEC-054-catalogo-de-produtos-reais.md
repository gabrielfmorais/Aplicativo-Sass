# SPEC-054 — O catálogo de produtos reais (`F32`), e a prateleira que o consome

| Campo | Valor |
|---|---|
| ID | SPEC-054 |
| Status | **IMPLEMENTED** (2026-09-07) — infraestrutura validada a 390px no DEV real com o catálogo **vazio**, que é o estado permanente até a ingestão (§25). ⛔ **A ingestão é TRUE HUMAN GATE** — as opções investigadas estão em §26. |
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
- FR8 — ⚠️ **Com o catálogo vazio, a tela DIZ que ele está em expansão** — e não esconde a busca, nem
  finge que ela falhou. **A primeira versão escondia**, e o dono mostrou o custo: ele digitou
  *"wella"*, não achou nada, e não teve como saber se o catálogo estava vazio ou se a busca tinha
  quebrado. Os **dois vazios são distintos**: catálogo sem linhas diz *"ainda em expansão"*, termo sem
  par diz *"não encontramos esse produto"*, e antes da resposta a tela **não afirma nada**. O cadastro
  manual é nomeado ali mesmo (§25.1).

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

## 24.1 Evidência — validado a 390px no DEV real (2026-09-07)

Migration aplicada pelo dono. Com o catálogo **vazio** — o estado permanente até a ingestão:

| o que foi pedido | medido |
|---|---|
| catálogo vazio com UX correta | ✅ **"Catálogo de produtos ainda em expansão"**, e ⛔ **nunca** *"erro"* ou *"não encontramos"* |
| produto manual continua funcionando | ✅ digitar → categoria → **Adicionar** → cadastrado → **persistiu no reload** → desfeito |
| a prateleira dela intacta | ✅ os três produtos manuais, todos `catalog_product_id: null` |
| busca consultando a tabela certa | ✅ `catalog_products` respondendo **200 `[]`**, não erro |
| RLS e direito de imagem | ✅ `42501` no INSERT/UPDATE/DELETE do cliente; a trava de direito é pgTAP em CI |
| nenhuma marca real ingerida | ✅ **zero linhas**, de qualquer origem |
| console | ✅ zero problema |

⚠️ **O que a validação a 390px NÃO prova, e por quê.** Buscar, escolher um produto real e ver a foto
na prateleira e na execução exigem **linhas no catálogo**, e o cliente **não tem grant de escrita** —
que é a garantia central desta SPEC, não uma limitação a contornar. Semear exigiria `service_role`,
que não está aqui. Esses caminhos estão cobertos por **RNTL** (busca, escolha, marca/linha/variante na
tela, identidade reutilizada na execução) e por **pgTAP** contra o Postgres real (RLS, publicação,
direito de imagem, `on delete set null`). Fica dito em vez de disfarçado.

⚠️ **Dois achados de MEDIÇÃO, não do produto.** (1) O `innerText` **não mostra placeholder**, então
o campo de nome "sumia" para o driver enquanto estava lá. (2) Clicar por texto em *"Máscara"* pegava
a **legenda de categoria de um produto da lista**, não o chip do formulário — e o cadastro parecia
quebrado. Clicando o chip por `role="radio"`, o fluxo passou inteiro. **Consequência para validações
futuras: num app com vocabulário fechado, o mesmo rótulo aparece em vários papéis — clicar por texto
é clicar no primeiro que aparecer.**

## 25. Diagnóstico da ingestão, medido no DEV (2026-09-07)

O dono usou o produto, buscou *"wella"* e não achou nada. O diagnóstico pedido, medido contra o DEV
real com a migration aplicada:

| pergunta | medido |
|---|---|
| quantos `catalog_products` existem? | **0** (`Content-Range: */0`) |
| a busca consulta mesmo essa tabela? | **sim** — `or(brand,name,line ilike)` e `ean=eq` em `catalog_products`, **HTTP 200 `[]`**, não erro |
| o estado vazio está correto? | **sim** — `isAvailable()` devolve vazio, e a tela agora **diz por quê** (§25.1) |
| alguma marca real foi ingerida? | **não** — zero linhas, de qualquer origem |
| a prateleira manual sobreviveu? | **sim** — 3 produtos, todos `catalog_product_id: null` |
| o cliente consegue escrever no catálogo? | **não** — `42501` no INSERT, no UPDATE e no DELETE |

⚠️ **A infraestrutura está certa e o catálogo está vazio — as duas coisas ao mesmo tempo.** A busca
funciona, aponta para a tabela certa e devolve zero porque **há zero**. Nada quebrou.

### 25.1 O estado vazio deixou de esconder e passou a explicar

⚠️ **A primeira versão ESCONDIA a busca com o catálogo vazio** (FR8 original), com o raciocínio de que
uma busca que sempre volta vazia é um beco. **O dono usou o produto e mostrou o custo real:** ele
digitou *"wella"*, não achou nada, e **não teve como saber se o catálogo estava vazio ou se a busca
tinha quebrado**. Esconder não protege dela — apaga a informação de que a capability existe.

A tela passou a distinguir **dois vazios que são coisas diferentes**:

| situação | o que ela lê |
|---|---|
| catálogo sem linhas | **"Catálogo de produtos ainda em expansão"** — o app está crescendo, não falhou |
| catálogo com linhas, termo sem par | *"Não encontramos esse produto"* — a busca rodou |
| ainda não se sabe | **nada** — afirmar sobre o catálogo antes de consultá-lo seria inventar |

E o caminho manual é **nomeado ali mesmo**: *"escreva o nome do jeito que você chama — é assim que a
sua prateleira funciona, e nada se perde depois"*.

## 26. Como POPULAR o catálogo — as opções, e o que depende do dono

⛔ **Nada abaixo foi executado.** A ingestão é **TRUE HUMAN GATE**, e o que segue é a investigação
pedida: o que existe, o que é legalmente utilizável, e o que exatamente o dono precisa conseguir.

### 26.1 Rota A — GS1 Brasil / Cadastro Nacional de Produtos ⭐ **a recomendada**

**O que é.** O registro oficial de código de barras no Brasil. A API do CNP devolve **marca,
descrição do produto, classificação, NCM, peso, e `URL Foto`** — e o encaixe com o schema desta SPEC
é praticamente um-para-um.

⚠️ **É a rota com a melhor posição jurídica, e a razão é estrutural:** os dados só voltam quando **o
dono da marca cadastrou o produto e autorizou compartilhar**. A autorização não é interpretada por
nós — ela **é a condição de existência do dado**. É exatamente o que `image_rights = 'brand_authorized'`
afirma, e aqui a afirmação é verificável na origem.

⚠️ **HUMAN GATE — o que o dono precisa conseguir, e de quem:**
1. **Associação da empresa à GS1 Brasil** (exige CNPJ; é uma associação anual, com custo).
2. **Acesso à API do CNP**, solicitado à GS1 Brasil — atendimento por telefone **(11) 4000-1936**,
   e-mail **atendimento@gs1br.org** ou chat, pelo portal `apicnp.gs1br.org`.
3. **As credenciais** (chave de API) chegam aqui como secret de ambiente, nunca no repositório.

**Limite conhecido:** só volta produto cujo fabricante cadastrou **e** liberou. A cobertura é da
indústria, não nossa — e um produto ausente cai no cadastro manual, que continua inteiro.

### 26.2 Rota B — autorização direta da marca (kit de imprensa / assessoria)

**O que é.** Escrever para a marca e obter permissão **por escrito** para usar nome e foto oficial no
app. É lento e é de graça.

**Serve para o conjunto de lançamento:** 20 a 50 produtos das marcas que a usuária brasileira mais
tem em casa, enquanto a Rota A é providenciada. ⚠️ **A permissão precisa ser escrita e guardada** — é
ela que `image_rights = 'brand_authorized'` e `source_ref` passam a apontar.

**HUMAN GATE:** é o dono quem pede e quem assina.

### 26.3 Rota C — Open Beauty Facts (dado aberto)

**O que é.** Base colaborativa de cosméticos, irmã do Open Food Facts. **Banco sob Open Database
License, conteúdos sob Database Contents License, e as imagens sob Creative Commons
Attribution-ShareAlike.** É legalmente utilizável **sem contrato**, com **atribuição**.

⚠️ **Mas as fotos são de colaboradores, não oficiais** — e o pedido do dono é *"foto REAL/OFICIAL"*.
Usá-la como fonte de imagem trocaria "oficial" por "aberta", que é outra coisa.

✅ **Onde ela serve de verdade: como resolvedor de EAN → identidade.** Código de barras, marca e nome
vindos de dado aberto, com a **foto ficando vazia** — e `image_url is null` já é caminho normal
(FR7). É a única rota que **não** depende de decisão de ninguém, e por isso é a candidata natural a
um piloto.

⚠️ **Consequência de schema, se esta rota for escolhida:** `image_rights` teria de ganhar um valor
para licença aberta (algo como `open_licensed`), e `image_credit` passaria a ser **obrigatório de
exibir**, porque CC-BY-SA exige atribuição visível. ⛔ **Não foi acrescentado** — seria schema sem
decisão (D-47/D-48).

### 26.4 Rota D — feed de afiliado ⛔ **não recomendada para o catálogo**

**O que é.** Redes de afiliados e APIs de varejo trazem catálogo com foto. A da Amazon (a PA-API foi
descontinuada em janeiro de 2025 e substituída pela Creators API) licencia o conteúdo **apenas para
levar tráfego para a Amazon**, exige conta de afiliado ativa, e proíbe usar o conteúdo apontando para
qualquer outro lugar.

⛔ **Isso muda o que o catálogo É.** Um catálogo cujas imagens só podem existir enquanto apontarem
para um varejista transforma **cada cartão de produto numa colocação de afiliado** — e a D-104 diz,
literalmente, que *"a Huna não vira marketplace"* e que afiliados são o **`T2`**, com contrato
próprio e cinco obrigações. Não é uma decisão de `F32`; é uma decisão de `T2`, e vem depois.

### 26.5 O que NÃO é opção, e por quê

⛔ **Google Images, scraping, foto de e-commerce sem autorização, embalagem inventada e imagem
gerada.** As cinco foram vetadas pelo dono, e o banco já as torna **impossíveis de gravar sem
mentir**: `image_url` preenchida exige `image_source` **e** `image_rights`, e o vocabulário de
direito é fechado — **não existe valor para *"achei na internet"***. A engenharia não consegue
verificar se um direito é verdadeiro; consegue exigir que ele seja **declarado e rastreável**.

### 26.6 A recomendação, em ordem

1. **Rota A (GS1 CNP)** como espinha dorsal — oficial, autorizada na origem, nativa em EAN.
2. **Rota B (autorização direta)** para o conjunto de lançamento, em paralelo.
3. **Rota C (Open Beauty Facts)** como piloto de **identidade sem foto**, se o dono quiser ver a
   capability viva antes de qualquer contrato. É a única que **não depende de ninguém**.
4. **Rota D: não** — é `T2`, não `F32`.

⚠️ **O que fica pronto para qualquer uma delas:** o schema, a busca, o vínculo com a prateleira, a
reutilização na execução, o fallback sem foto, a rastreabilidade de origem e a trava de direito. A
ingestão é um trabalho de **`service_role`, fora do app**, e ela **não muda uma linha** do que já
está construído — troca apenas de onde vêm as linhas.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-07 | v0.1 — rascunho a partir da fonte de verdade do dono. | agente |
| 2026-09-07 | v0.2 — **IMPLEMENTADA**, validada a 390px no DEV real com o catálogo vazio (§24.1). ⚠️ **FR8 mudou depois de o dono usar o produto:** a busca deixou de se esconder e passou a **dizer que o catálogo está em expansão**, distinguindo isso de *"não encontramos"*. **§25** traz o diagnóstico medido da ingestão e **§26** as rotas investigadas — GS1 Brasil CNP (recomendada), autorização direta, Open Beauty Facts (piloto sem foto) e ⛔ feed de afiliado (é `T2`, não `F32`). | agente |
