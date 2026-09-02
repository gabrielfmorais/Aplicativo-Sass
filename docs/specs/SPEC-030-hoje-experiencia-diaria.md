# SPEC-030 — A Hoje como experiência diária

| Campo | Valor |
|---|---|
| ID | SPEC-030 |
| Status | Implemented (aceite visual do dono pendente) |
| Owner | dono do produto |
| Bounded Context | Care tracking (UI) — `apps/mobile/src/features/care` |
| Related SPECs | SPEC-005, SPEC-007, SPEC-016, SPEC-019, SPEC-024, SPEC-026, SPEC-027 |
| Criado / Atualizado | 2026-09-02 / 2026-09-02 |

## 1. Context

A Hoje é a tela que a usuária abre todo dia, e era a que menos tinha sido tratada como experiência.
Ela funcionava: cuidado do dia, faixa da semana, seções, ações. Mas **medida**, ela tinha
**4,23 telas de rolagem** com um plano pequeno — e quase tudo era repetição.

## 2. Problem

Três problemas, e o primeiro foi medido antes de ser resolvido:

1. **Densidade.** "Próximos" renderizava **nove cartões praticamente idênticos**, ~155px cada,
   repetindo os mesmos quatro botões para cuidados a semanas de distância.
2. **Dia livre virava beco.** "Nenhum cuidado hoje" dizia o próximo cuidado e parava ali.
3. **Sem ritmo visual.** Um bloco tingido no topo e cartão branco em todo o resto — quatro seções,
   um único tom, nenhuma pista de que uma delas é o passado.

## 3. Goals

- G1 — Ver o cronograma sem rolar uma sequência enorme de cartões, **sem esconder ação nenhuma**.
- G2 — Um dia sem cuidado oferece um passo, e não um vazio.
- G3 — "Sugestões para você" consolidada, e a Home preparada para receber "Produtos para você".
- G4 — Mais identidade Huna: menos branco genérico, sem somar elementos.

## 4. Non-Goals

- NG1 — Nada de banco, core, RPC ou feature nova.
- NG2 — Nenhum catálogo, marketplace, afiliado, tracking ou backend comercial.
- NG3 — Não reabrir hero, Perfil, navegação nem o comportamento aprovado da faixa da semana.
- NG4 — Nenhuma sugestão que afirme necessidade capilar, diagnóstico ou causalidade (D-26).

## 5. Functional Requirements

- FR1 — "Próximos" e "Histórico" mostram **três** e oferecem `Ver mais N`, com **N explícito**.
- FR2 — Cada cartão revelado continua **inteiro**: mesmas ações, mesmo componente.
- FR3 — Num dia sem cuidado, o cartão de foco oferece **Ver meu ciclo**.
- FR4 — Existe **uma** porta para o ciclo por vez: no cartão de foco quando o dia está livre, no pé
  quando há cuidado ou o plano acabou.
- FR5 — As sugestões vivem num **painel único**, com as ofertas separadas por filete.
- FR6 — As seções da Home compartilham um cabeçalho (`HomeSection`), e o corpo é livre.
- FR7 — A escada tonal: ameixa (a resposta do dia) · roxo (oferta) · branco (a fazer) · bege (feito).

## 6. Business Rules

- BR1 — Toda sugestão é um **fato dela**, nunca uma afirmação sobre cabelo (herdado de SPEC-026).
- BR2 — Nada conta, pontua, compara ou insiste.
- BR3 — `Ver mais N` **declara** o que guarda: nada some em silêncio.

## 7–13. Dados, contratos, autorização, segurança, privacidade, analytics

Nenhum impacto. A rodada é UI.

## 14. UX Notes

**"Produtos para você" ≠ "Minha Prateleira".** A prateleira é o que ela **já tem** (`F26`, cadastrado
por ela, sem preço, sem marca, sem link). A seção comercial futura é **descoberta** — catálogo real e
links afiliados (Mercado Livre, Amazon, Shopee, TikTok Shop). São duas seções com títulos diferentes,
e nunca uma só: misturá-las faria o app parecer que recomenda o que ela mesma cadastrou, ou que ela
possui o que o app está vendendo.

⚠️ **A preparação é o formato, não um componente vazio.** A Home é uma pilha de seções tituladas.
`HomeSection` não impõe nada sobre o corpo — lista vertical e trilha horizontal são o mesmo
`children`. Construir hoje uma trilha de produtos sem produtos seria código morto, que a regra de
necessidade proíbe (D-47/D-48). A seção entra assim, sem redesenhar nada:

```tsx
<HomeSection title="Produtos para seu próximo Wash Day">
  <ProductRail products={…} />
</HomeSection>
```

## 15. Edge Cases

- EC1 — Sem sugestão, a seção inteira **desaparece** (título incluído).
- EC2 — Menos itens que o limite: `Ver mais` não aparece.
- EC3 — Outro dia selecionado: tudo o que fala de hoje some (decisão da SPEC-026, preservada).

## 16. Failure Modes

Inalterados: loading, erro e retry continuam os da SPEC-005/SPEC-016.

## 17. Acceptance Criteria

- AC1 — A rolagem da Hoje cai de **4,23** para **~2,7 telas** no mesmo estado.
- AC2 — Nenhuma ação deixa de existir: "Fiz hoje", "Como fazer", "Reagendar", "Pular", "Contar esse
  cuidado" e o check-in continuam em cada cartão renderizado.
- AC3 — Um dia livre oferece uma ação.
- AC4 — Existe no máximo **uma** entrada para o ciclo na tela.
- AC5 — As sugestões formam um bloco, não uma pilha de cartões.

## 18. Testing Strategy

RNTL sobre a `TodayScreen` (306 testes do app verdes). ⚠️ **Dois guardrails existentes reprovaram
tentativas desta fatia e estão registrados no §24** — eles são a prova de que "não esconder
funcionalidade" e "uma porta por destino" não são frases, são testes.

Validação visual a 390px é parte do DONE (D-90). Para ver a seção de sugestões sem cenário no DEV,
usou-se **fixture local temporário** (`productCount: 0`), removido antes de qualquer commit — nada
foi escrito no banco para fabricar cenário.

## 19–22. Dependências, plano, migração, rollback

Nenhuma dependência nova. Sem migration. Reverter os arquivos desfaz tudo.

## 23. Open Questions

- OQ1 (CAN DEFER) — As sugestões que a direção citou e **não** entraram: *"seu próximo cuidado é
  sábado"* e *"quer revisar seu ciclo?"* já estão na tela (cartão de foco e botão do ciclo);
  repeti-las seria a mesma resposta duas vezes. **Conteúdo editorial** depende de conteúdo com
  sign-off de domínio (D-26). Entram quando houver o que dizer que a tela ainda não diz.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-02 | v0.1 — a rodada de densidade e identidade da Hoje, com **duas tentativas reprovadas por guardrail antes de acertar**. **(1)** A primeira versão trocou os cartões de "Próximos" por linhas que abriam ao toque: sete testes caíram na hora, porque aquilo escondia **"Contar esse cuidado"** — a entrada do Wash Day (SPEC-024), que alimenta Prateleira e Hair Intelligence — e escondia **"Como fazer"**, que a SPEC-007 AC5 promete em todo cuidado acionável; a SPEC-016 já tinha registrado que as seções ficam quietas, **nunca colapsadas**, exatamente por AC5. **(2)** O cartão de foco vazio ganhou um "Ver meu ciclo" e passaram a existir **dois** na mesma tela — o defeito que a SPEC-027 tinha acabado de corrigir na navegação. **(3)** Tentei preencher o vazio da vista "outro dia" com o ciclo, e o teste da SPEC-026 reprovou: num outro dia, tudo o que fala de hoje some. Vazio não justifica reabrir decisão. | agente (§0.2) |
