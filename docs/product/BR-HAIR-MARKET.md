# Cobertura do catálogo — mercado brasileiro de hair care

**Objetivo:** um catálogo **representativo do Brasil**, não apenas grande. Este documento é a auditoria
de mercado + a matriz de cobertura que orientou o enriquecimento (SPEC-058), e o registro honesto do
que ainda **não** pode ser ingerido legalmente.

**Data:** 2026-09-08. **Método:** pesquisa multi-sinal (varejo BR — Beleza na Web/PRO, Época, Amazon.com.br;
drogaria/perfumaria; best-sellers públicos; ABIHPEC/Euromonitor/Mordor; estudo Kantar do Grupo Boticário;
Google Trends; recorrência entre fontes) cruzada com a medição direta da **exportação Open Beauty Facts**.
⚠️ Share de mercado por marca **não é público** (Euromonitor é pago) — os tiers abaixo são **qualitativos**.

## 1. Marcas mais relevantes no Brasil (tiers)

**T1 — massa (drogaria/super/venda direta/e-tail):** Elseve (L'Oréal), Seda (Unilever), Pantene (P&G),
Dove (Unilever), Tresemmé (Unilever), **Siàge/Eudora (Grupo Boticário — Kantar #1 marca preferida, 2 anos
seguidos)**, Novex (Embelleze), Salon Line, Skala, Natura; + O Boticário, Amend, Bio Extratus, Clear.
**T1 — profissional/salão:** Wella Professionals, L'Oréal Professionnel, Kérastase, Redken, **Truss (BR)**.
**T2 — BR-origem pro/cachos:** Forever Liss, Inoar, Cadiveu, Braé, Lola Cosmetics, Haskell, Felps,
Schwarzkopf, K.Pro. **T3/nicho:** Joico, Alfaparf, Keune, Lowell, Aussie, Soul Power, Apse.
**Corrigidos da lista inicial:** **Vult** é majoritariamente maquiagem (não priorizar p/ cabelo);
**Sebastian** e **Senscience** têm baixa relevância BR atual (Senscience praticamente descontinuada).

## 2. Cobertura da Huna — antes → depois (medido na exportação OBF)

| | 1ª ingestão (SPEC-057) | Enriquecida (SPEC-058) |
|---|---|---|
| Filtro | só tags EN de cabelo | tags **EN + PT** + nome, com exclusão de skincare |
| Produtos de cabelo | 2.456 | **3.866** (+57%) |
| Com foto | ~2.226 | ~3.336 |
| Tag de Brasil | 19 | **86** |
| Marcas distintas | 748 | 1.543 |

⚠️ **A causa do gap era o filtro, não a fonte:** a 1ª versão exigia **tag de categoria em inglês**, e os
produtos BR trazem nome/tag em **português** — ~4.500 produtos de cabelo do OBF caíam como "não-cabelo".
Loosear o filtro (PT + nome, excluindo skincare) trouxe as marcas BR que faltavam.

## 3. Matriz de cobertura das marcas prioritárias (no OBF)

`existe no OBF? · com EAN · com foto · fonte`. Medição direta da exportação:

| Marca | No OBF (total) | Com foto | Entrou na Huna | Fonte de foto legal |
|---|---|---|---|---|
| L'Oréal/Elseve | ~1.200 | maioria | sim (muitos) | OBF (CC BY-SA) |
| Dove | 573 | 518 | sim | OBF |
| Schwarzkopf | 248 | 225 | sim | OBF |
| Natura | 223 | 192 | sim | OBF |
| Pantene | 126 | 108 | sim | OBF |
| Tresemmé | ~70 | ~58 | sim | OBF |
| Wella | 32 | 26 | sim | OBF |
| Seda | 23 | 18 | sim | OBF |
| Novex | 22 | 20 | sim (agora) | OBF |
| Redken · Kérastase · Joico · Sebastian · Keune | 10-16 cada | maioria | sim | OBF |
| Salon Line | 5 | 0 | sim (sem foto) | — (identidade) |
| **Eudora/Siàge** | **3** | 2 | **sim: 1 (Siàge Men Pomada)** | OBF (1) |
| Inoar · Felps · Lola · Bio Extratus · Truss · Amend · Haskell · Forever Liss · Cadiveu · Alfaparf | 1-3 cada | variável | sim (parcial) | OBF |
| **Ausentes do OBF** | 0 | — | **não** | — |

**Ausentes do OBF (precisam de outra fonte):** **Siàge** (a linha, como marca), **O Boticário**, **Braé**,
**K.Pro**, **Lowell**, **Senscience**, **Apse**, **Soul Power**.

## 4. Gaps prioritários

1. **Grupo Boticário (Eudora/Siàge/O Boticário)** — a marca **#1 preferida** do BR, com **cobertura
   ridícula no OBF** (3 produtos, 1 utilizável). É o maior gap de representatividade. Fonte legal de
   identidade+foto: **GS1 CNP** (eles são associados GS1) ou autorização direta — **HUMAN GATE**.
2. **Profissional BR** (Truss, Braé, Cadiveu, Inoar, Forever Liss, Felps, Lola) — presença rala no OBF
   (1-3 cada). Identidade parcial ingerida; profundidade precisa de GS1/marca.
3. **Salon Line/Novex** — relevantes e agora presentes, mas muitos sem foto no OBF.

## 5. Fontes legais — o que dá e o que não dá (confirmado, §7 do relatório)

| Fonte | Identidade | Imagem | Comercial | Gate |
|---|---|---|---|---|
| **Open Beauty Facts** | ✅ ODbL | ⚠️ CC BY-SA (colaborador, cobertura BR rala) | ✅ | **nenhum (autônomo)** |
| **GS1 Brasil / CNP** | ✅✅ oficial, por EAN | ✅ oficial (consentimento embutido) | ✅ | **TRUE HUMAN GATE** (associação/termo) |
| Wikidata / Commons | ✅ CC0 (marcas, não SKUs) | ⚠️ por arquivo, cobertura ~zero p/ SKU BR | ✅ | nenhum, mas inútil p/ SKU |
| APIs de barcode pagas (Barcode Lookup, Go-UPC…) | ⚠️ pago | ❌ imagem **não redistribuível** | — | pago |
| Feeds de afiliado (Awin/Eudora…) | ✅ | ❌ licença **só p/ levar tráfego** → é `T2`, não `F32` (D-104) | — | contrato |
| Scraping de e-commerce/marca | — | ❌ **proibido** (sem direito) | — | — |

**Conclusão:** para ingestão **autônoma e legal**, **OBF é a única fonte de imagem**. Fotos oficiais das
marcas BR (esp. Grupo Boticário) exigem **GS1 CNP** ou **autorização direta** — ambos **TRUE HUMAN GATE**.
Regra do dono respeitada: **identidade real sem foto** é preferível a foto usada irregularmente.

## 6. Eudora / Siàge — investigação específica

- **Por que não aparecia:** o OBF **tem** 3 produtos Eudora, mas a 1ª ingestão exigia tag EN e todos os
  três tinham tag PT/vazia → caíram como "não-cabelo". **Corrigido pelo filtro loose.**
- **O que dá para colocar agora, legalmente:** **1** produto claramente capilar — *"Eudora Siàge Men Pomada
  Modeladora"* (`pt:modelador-capilar`, EAN `37891033522140`), sem foto no OBF. Os outros 2 do OBF são
  ambíguos (*"Máscara acelera o crescimento"*, *"Bruma"*) e foram **excluídos por prudência** (sem sinal
  forte de cabelo) — preferir preciso a inflar.
- **Fotos legais de Eudora/Siàge:** só via **GS1 CNP** (Grupo Boticário é associado) ou autorização direta.
  Scraping de eudora.com.br é **proibido**.
- **Cobertura real de Siàge hoje:** **rala (1)**. Fechar esse gap é **HUMAN GATE** (GS1/autorização), e é o
  item nº 1 do §4.

## 7. Como ampliar (próximos passos)

- **Autônomo:** re-rodar o workflow `ingest-catalog` quando a exportação da OBF crescer (idempotente).
- **HUMAN GATE (fora do agente):** obter acesso ao **GS1 CNP** (atendimento@gs1br.org / (11) 4000-1936) —
  destrava identidade **e foto oficiais** das marcas BR, esp. Grupo Boticário; e/ou **autorização direta**
  das marcas do conjunto de lançamento. É a única forma de dar ao catálogo cobertura BR profunda com foto.
