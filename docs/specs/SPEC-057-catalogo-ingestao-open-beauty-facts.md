# SPEC-057 — Catálogo real, populado de Open Beauty Facts (F32)

| Campo | Valor |
|---|---|
| ID | SPEC-057 |
| Status | Implemented |
| Owner | dono do produto |
| Bounded Context | **Products / Catalog** (`catalog_products`) + ingestão fora de banda + UI de atribuição |
| Related ADRs | ADR-001, **D-104** (a cadeia começa no catálogo), **D-26/D-70** (identidade, nunca alegação) |
| Related SPECs | **SPEC-054** (o catálogo e o vínculo com a prateleira — reaproveitado, não duplicado), SPEC-041 (F48), SPEC-023 (prateleira) |
| Capability | `F32` — **COMMITTED**; sai de "infra pronta + catálogo vazio" para **catálogo populado** |
| Legal | `docs/legal/OPEN-BEAUTY-FACTS-COMPLIANCE.md` |
| Criado / Atualizado | 2026-09-08 / 2026-09-08 |

## 1. Context

A SPEC-054 entregou `catalog_products` e deixou a ingestão como **TRUE HUMAN GATE** (fonte de dados,
direito de imagem, possível contrato). O dono **removeu o gate operacional** e pediu para investigar
sozinho uma fonte legalmente reutilizável — começando por **Open Beauty Facts (OBF)** — e executar tudo
que os termos permitirem.

## 2. Decisão jurídica (fonte oficial, atual)

**Sem bloqueio real.** OBF: dados sob **ODbL 1.0** + **DbCL 1.0**, imagens sob **CC BY-SA 3.0**, **uso
comercial permitido**, **sem contrato, pagamento ou aceite**. Obrigações: atribuição, aviso de licença,
share-alike (que alcança **só os fatos do catálogo**, não o app nem o dado da usuária), imagens
exibidas sem modificação, **User-Agent** identificado, e **exportação, nunca scraping da API** (regra
oficial). Análise cláusula-a-cláusula em `docs/legal/OPEN-BEAUTY-FACTS-COMPLIANCE.md`.

## 3. Goals

- **G1** Popular `catalog_products` com produtos **reais de cabelo**: marca, linha, nome, variante,
  categoria, EAN e **foto real**, com **origem e licença rastreáveis**.
- **G2** Reaproveitar SPEC-054/F32/F48 — **zero catálogo paralelo**; a mesma entidade e a mesma foto
  alimentam busca, prateleira, execução, histórico.
- **G3** Conformidade **estrutural** (schema + script + UI), não comentário.
- **G4** Ingestão **repetível** e sem operação manual do dono (workflow).

## 4. Non-Goals

- **NG1** ⛔ Nenhuma alegação capilar — "bom para cabelo X", indicação, benefício, ranking (D-26/P18).
- **NG2** ⛔ Nada de inventar produto, foto ou dado faltante (nem por IA).
- **NG3** ⛔ Nunca a API para ingestão em massa (regra da OBF) — só a **exportação** oficial.
- **NG4** ⛔ Nenhuma imagem sem `source` + `rights/license` + origem rastreável.
- **NG5** ⛔ `service_role`/token nunca no cliente — a escrita é fora de banda.

## 5. Data Model — aditivo (migration `20260922000000_catalog_open_data.sql`)

Sobre `catalog_products` (SPEC-054), **idempotente**:
- `source` ganha `open_beauty_facts`; `image_rights` ganha `open_licensed`.
- Colunas novas: `source_url` (página do produto na OBF), `data_license` (`ODbL-1.0`), `image_license`
  (`CC-BY-SA-3.0`).
- `CHECK`: imagem `open_licensed` **exige** `image_credit` + `image_license` + `source_url`; linha de
  `open_beauty_facts` **exige** `source_url` + `data_license`.
- RLS/grants **inalterados**: cliente só `SELECT` onde `published_at is not null`.

## 6. Ingestão (`scripts/ingest-catalog.mjs` + `.github/workflows/ingest-catalog.yml`)

- **Fonte:** exportação CSV oficial (`en.openbeautyfacts.org.products.csv.gz`), com o User-Agent exigido.
- **Filtro (qualidade, não quantidade):** produto **de cabelo** (categories_tags), **EAN válido** (GTIN
  8/12/13/14), **marca e nome** não vazios. Malformado/não-cabelo/sem-EAN descartado.
- **Mapa determinístico:** categories_tags → vocabulário fechado (shampoo/conditioner/mask/oil/leave_in/
  styler/other); quantidade → variante; imagem front hospedada pela OBF → `image_url`.
- **Dedup por EAN** (mais completa vence); **ranking** Brasil → com foto → mais completa; **corte** no
  `--limit`. **Upsert idempotente** `on conflict (ean)`: reingerir atualiza, não duplica.
- **Escrita:** workflow **manual** (`workflow_dispatch`), **DEV-ref constante**, via **Management API**
  com o secret `SUPABASE_ACCESS_TOKEN` — o mesmo padrão seguro do `deploy-dev-functions`.

## 7. Atribuição (UI)

- **Global e autoritativa:** tela **"Fontes de dados"** (Conta → Sobre) com OBF + ODbL + DbCL + CC BY-SA
  3.0 e os links das licenças.
- **Contextual e discreta:** uma linha nos resultados da busca — *"Fotos e informações dos produtos:
  Open Beauty Facts (CC BY-SA)"* —, não por cartão (a licença pede atribuição, não poluição).

## 8. Acceptance Criteria

- **AC1** `catalog_products` tem produtos reais de OBF; buscar **"Wella"** (e marcas do mercado BR)
  retorna resultados com foto, marca, nome, variante.
- **AC2** Toda linha de OBF tem `source`, `source_url`, `data_license`; toda imagem tem `image_rights`,
  `image_license`, `image_credit` — o `CHECK` recusa o contrário.
- **AC3** Adicionar à prateleira, reload, execução mostram a mesma identidade/foto (F48).
- **AC4** Cadastro manual e busca vazia continuam honestos (SPEC-054 intacta).
- **AC5** Atribuição presente (tela Fontes de dados + crédito na busca); nenhuma alegação capilar.

## 9. Open Questions / HUMAN GATE restante

- **OQ1** Scanner (`F33`) — dependência nativa de câmera, fora desta fatia.
- **OQ2** `line` fica `null` (a exportação CSV não separa linha comercial de forma confiável) — melhoria
  futura via JSONL/atributos.
- **HUMAN GATE restante:** **nenhum de licença.** Só sobra o que sempre foi de infraestrutura: aplicar
  o schema/ingestão no DEV usa o secret do dono já existente no CI (o workflow), e ampliar para produção
  é decisão de release. Nada de contrato, pagamento ou aceite jurídico.

## 10. Change Log

| Data | Mudança |
|---|---|
| 2026-09-08 | SPEC criada e implementada. Pesquisa jurídica oficial (sem bloqueio), migration aditiva de conformidade, script de ingestão a partir da exportação da OBF, workflow manual DEV, e UI de atribuição. Sai de "catálogo vazio" para catálogo real de produtos de cabelo. |
