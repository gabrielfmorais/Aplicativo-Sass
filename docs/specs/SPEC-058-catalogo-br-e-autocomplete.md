# SPEC-058 — Cobertura BR do catálogo + busca com autocomplete (F32/F33)

| Campo | Valor |
|---|---|
| ID | SPEC-058 |
| Status | Implemented |
| Owner | dono do produto |
| Bounded Context | Products/Catalog (ingestão + busca) + UI |
| Related | **SPEC-057** (ingestão OBF), SPEC-054 (catálogo), `docs/product/BR-HAIR-MARKET.md`, `docs/legal/OPEN-BEAUTY-FACTS-COMPLIANCE.md` |
| Capability | `F32` (cobertura + busca) · `F33` (busca por EAN; scanner segue fora) |
| Criado / Atualizado | 2026-09-08 / 2026-09-08 |

## 1. Problema

Duas lacunas do catálogo real: **(1) cobertura BR** — 2.456 produtos, mas o dono procurou **Eudora** e não
achou; e **(2) UX de busca** — digitar + clicar "Buscar", não autocomplete.

## 2. Parte 1 — Cobertura BR

**Auditoria (`docs/product/BR-HAIR-MARKET.md`):** a causa do gap era o **filtro**, não a fonte. A 1ª
ingestão exigia **tag de categoria em inglês**; produtos BR trazem nome/tag em **português** → ~4.500
produtos de cabelo do OBF caíam como "não-cabelo" (Eudora, Salon Line, Novex, Inoar, Felps…).

- **FR1** Filtro loose: sinal de cabelo em **EN + PT**, no **nome e nas tags**, com **exclusão de skincare/
  maquiagem** (para "máscara"/"óleo"/"creme" ambíguos não virarem face care).
- **FR2** Mapa de categoria **EN + PT** (xampu, condicionador, máscara capilar, óleo, creme de pentear,
  modelador…).
- **FR3** Ranking de ingestão prioriza **marca relevante no BR** → tag de Brasil → com foto → mais completo.
  É **representatividade, não recomendação** (só decide a ordem no corte do `--limit`).
- **Resultado medido:** **2.456 → 3.866** produtos, Brasil-tag **19 → 86**, **Eudora agora presente**.
- **NG1** Não inventa produto/foto/dado. **NG2** Fotos oficiais das marcas BR (esp. Grupo Boticário) =
  **GS1 CNP / autorização direta = TRUE HUMAN GATE** (identidade real sem foto > foto irregular).

## 3. Parte 2 — Autocomplete (busca em tempo real)

- **FR4** A busca vai para o **servidor**: RPC `catalog_search(q, lim)`, `SECURITY INVOKER` (RLS → só
  publicado), com **coluna gerada `search_text`** (minúsculo + sem acento via `f_unaccent` imutável) e
  **índice GIN trigram**. Preparada para dezenas de milhares.
- **FR5** UI **typeahead**: sugere ao digitar (a partir de 1 letra), **debounce 250ms**, guarda de resposta
  velha (a última vence). O botão "Buscar" **sai** — a experiência é instantânea.
- **FR6** Resultados em duas seções: **Marcas** (atalho — tocar filtra pela marca) e **Produtos** (tocar
  adiciona à prateleira).
- **FR7** **Acento/maiúscula-insensível**, busca por marca/linha/nome/EAN.
- **BR1 — ranking textual, nunca mérito:** marca exata → prefixo → contém → com foto. ⛔ Nunca "melhor
  para você" (P18/D-26) nem comissão (T2). Barreira de teste na tela e no core.

## 4. Data Model (migration `20260923000000_catalog_search.sql`, aditiva)

`unaccent` + `pg_trgm` (schema `extensions`); `public.f_unaccent` imutável; coluna gerada `search_text`;
índice `catalog_products_search_trgm` (GIN trigram, só publicado); RPC `catalog_search` (`grant execute`
para `authenticated`, `revoke` de public). RLS/grants de escrita **inalterados**.

## 5. Acceptance Criteria (validado a 390px no DEV real)

- **AC1** Digitar "w" → sugestões sem clicar. **AC2** "wella" → Wella rápido. **AC3** "eudora" → aparece
  (ingerido). **AC4** tocar na marca → produtos dela. **AC5** tocar no produto → adiciona; reload persiste.
- **AC6** Foto real permanece; sem foto → fallback honesto. **AC7** Busca sem resultado → empty state real.
- **AC8** Console limpo. **AC9** pgTAP: RPC só devolve publicado, acento-insensível, ranking, grant.

## 6. Open Questions / HUMAN GATE

- **GS1 CNP / autorização direta** para fotos oficiais e profundidade das marcas BR (esp. Grupo Boticário)
  — **TRUE HUMAN GATE** (associação/termo/contrato). É o item que fecha a cobertura BR profunda.
- **F33 scanner** — dependência nativa de câmera; a busca por EAN digitado já funciona.

## 7. Change Log

| Data | Mudança |
|---|---|
| 2026-09-08 | SPEC criada e implementada. Filtro BR-aware (EN+PT, exclui skincare) → 2.456→3.866, Eudora incluída; autocomplete server-side (RPC + search_text + trigram) substituindo o "Buscar"; marcas+produtos, acento-insensível, ranking textual. GS1/foto oficial das marcas BR fica como HUMAN GATE. |
