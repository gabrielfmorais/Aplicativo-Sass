# content (bounded context)

Implementado na **SPEC-007** (Content v1). Ver `docs/architecture/DOMAIN-MAP.md` §3.8.

Responsabilidade: o conteúdo contextual por `care_type` que a tela Hoje mostra em "Como fazer" —
o que o cuidado faz no cabelo, os passos, a duração aproximada e os erros comuns.

## Layout

- `domain/care-guide.ts` — `CareGuideSchema` (zod) e os tipos `CareGuide` / `CareGuides`.
- `v1/guides.ts` — os guias em pt-BR.
- `index.ts` — superfície pública: `CARE_GUIDES`, `CareGuideSchema`, tipos.

## Invariantes

- **Um guia por care type, garantido pelo compilador.** `CareGuides` é
  `Record<CareTypeCode, CareGuide>`: um novo care type quebra o build até ganhar guia. O conjunto
  de códigos pertence à SPEC-004 — este contexto **consome**, nunca estende (BR5).
- **Conteúdo não é regra executável** (BR1). Nenhum guia influencia avaliação, cronograma, datas ou
  transições. Trocar um texto nunca altera o plano de ninguém.
- **Governança D-26, aplicada ao texto por D-70.** Todo guia declara `validationStatus` e
  `rationaleSource`. Conteúdo escrito pela engenharia nasce `candidate`: liberado para
  dev/internal beta, **PUBLIC RELEASE bloqueado** até o sign-off de domínio (OQ-REL).
- **Texto procedimental e cosmético** (BR3): sem marca, sem produto comercial, sem dosagem química,
  sem promessa de resultado e sem linguagem de diagnóstico. Tempo de pausa remete sempre à
  embalagem do produto da usuária. Verificado por teste (`content.test.ts`).

## Sem tabela (D-71)

Não existem `care_types` nem `content_articles`. O conteúdo vive no bundle: disponível offline,
sem loading, sem erro, sem retry, sem policy ou grant novos. Gatilhos para criar as tabelas em
`docs/specs/SPEC-007-content-v1-care-guides.md` §8.2.
