# SPEC-035 — A barra, os ícones e a tela Você

| Campo | Valor |
|---|---|
| ID | SPEC-035 |
| Status | Implemented (aceite visual do dono pendente) |
| Owner | dono do produto |
| Bounded Context | Design system (`apps/mobile/src/design`) + Account (UI, `apps/mobile/src/features/account`) |
| Related ADRs | ADR-001 (fronteiras) |
| Related SPECs | SPEC-016 (o design system), SPEC-026, SPEC-027 (a barra de quatro e a porta única), SPEC-036 (o hero abstrato), SPEC-030 (a Hoje), SPEC-032 (o cabeçalho) |
| Fase do roadmap | Huna Core Experience — auditoria visual |
| Criado / Atualizado | 2026-09-03 / 2026-09-03 |

## 1. Context

A SPEC-027 fechou a navegação em quatro categorias e decidiu que o avatar do cabeçalho é a **única**
porta de **Você**. A SPEC-032 inverteu o cabeçalho para que ele dissesse o que a barra não diz. As
duas mediram o que estava na tela e consertaram o que encontraram.

Esta rodada é a auditoria seguinte, e ela olhou três coisas que as anteriores não tinham medido: o
**estado ativo** da barra, os **quatro ícones lado a lado** no tamanho real e a tela **Você** —
a única do app que nunca passou por passe de hierarquia.

## 2. Problem

**(1) A pastilha da aba ativa era invisível, e isso foi medido, não achado.** Ela vinha em
`accentSoft` (`#F6E9EF`) sobre uma barra em `brandTint` (`#F6EDF0`): **1,03:1**. Dois cremes
praticamente iguais. A barra prometia quatro canais de estado — pastilha, palavra, peso e cor — e
entregava três. Ninguém notou porque *"tem uma pastilha"* é verdade no código-fonte.

**(2) Os quatro ícones não eram um conjunto.** O traço 1.9 numa caixa de 22 era mais leve que o
rótulo embaixo, então a densidade da barra morava no texto e a fileira parecia rascunho. **Cuidados**
lia `( )` — a mecha com cacho no pé é um bom desenho grande, mas a 22px o cacho vira borrão e sobram
duas curvas paralelas. **Progresso** era uma curva fina de canto a canto, sem massa para se afirmar
ao lado de três desenhos fechados. **Prateleira** era o dobro da densidade dos outros: dois frascos
desenhados por dentro, com tampa sólida, onde os vizinhos têm duas linhas.

**(3) A tela Você era seis cartões brancos idênticos.** Reavaliação, assinatura, dias preferidos,
lembretes, exclusão e sair chegavam com o mesmo peso, um embaixo do outro. Uma tela em que tudo grita
não hierarquiza nada — e punha **cobrança e exclusão no mesmo plano do cabelo dela**. Pior: a saída
("Voltar") vivia no `footer` fixo, mas a tela é **empilhada sobre uma aba**, então a barra continuava
embaixo — duas faixas de rodapé, uma sobre a outra, comendo ~100pt num aparelho de 844.

**(4) O medalhão do hero lia como recorte.** A faixa larga da SPEC-028 cortava a personagem, que é
vertical; o medalhão pequeno que a substituiu resolveu o corte e não tinha presença para segurar o
topo de uma tela.

## 3. Goals

- G1 — O estado ativo da barra é **visível**, com o contraste provado por número.
- G2 — Os quatro ícones lêem como **um conjunto**: mesma massa óptica, mesmo traço, mesmo vocabulário.
- G3 — A tela Você tem **hierarquia declarada**: identidade e cabelo antes de conta, cobrança e exclusão.
- G4 — Uma tela empilhada tem **uma** faixa de rodapé, não duas.
- G5 — O hero das telas de faixa tem **composição própria**, não um recorte do pôster vertical.

## 4. Non-Goals

- NG1 — **Não** entra capability nova do roadmap (`F34`/`P24`, foto de perfil, ficam onde estão).
- NG2 — **Não** existe "trocar foto": foto real depende de infraestrutura de mídia com base legal
  (D-32) que esta rodada não cria. Botão que abre nada promete o que o produto não tem.
- NG3 — **Não** entra dependência nova.
- NG4 — **Não** se muda schema, RPC, RLS nem `packages/core`. A rodada é UI.
- NG5 — **Não** se cria avatar ilustrado por usuária: o `Avatar` é a inicial dela sobre a cor da marca.

## 5. Functional Requirements

- FR1 — A pastilha da aba ativa é **ameixa sólida** com o ícone em `onFilled`. Barreira de teste de
  contraste: pastilha × barra > 4,5:1 e ícone × pastilha > 4,5:1.
- FR2 — Traço **2.15** numa grade de 24 com margem viva de 3; cada ícone tem **duas a três** formas
  e **no máximo um** detalhe preenchido.
- FR3 — Nenhum ícone é portador de estado: o desenho é o mesmo em ativo e inativo, e o que muda é
  pastilha, cor, peso e palavra.
- FR4 — A tela Você abre pelo painel de **identidade** (avatar grande + nome editável), seguido por
  **Seu cabelo**, **Suas preferências**, **Seu plano** e, por último e quieto, **Conta e dados**.
- FR5 — O nome dela é **editável** ali: o dado (`profiles.display_name`, SPEC-018 fatia 2) já
  existia e não tinha porta depois do onboarding.
- FR6 — Numa tela empilhada, a saída é um alvo no **topo à esquerda**, não um `footer`.
- FR7 — O `Avatar` é um primitivo com `name` e `size`, consumido pelo cabeçalho (40) e pelo painel de
  identidade (64). No dia em que a foto existir, é ele que muda — nenhuma tela sabe como ele é feito.
- FR8 — As telas de faixa usam o enquadramento `banner` da SPEC-036, com a altura vinda de
  `FRAME_HEIGHT` — nenhum literal de dimensão em tela de produto (SPEC-016 FR2/AC1).

## 6. Business Rules

- BR1 — **Um estado que não se enxerga não é um estado.** Todo canal de estado novo ou alterado na
  navegação nasce com contraste medido em teste.
- BR2 — **Ordem é mensagem.** Na tela Você, cabelo e identidade vêm antes de cobrança; sair e excluir
  ficam por último, onde o polegar não cai por acidente.
- BR3 — **Nome é opcional e continua opcional.** Quem preferiu não dizer vê "Seu perfil", não uma
  saudação inventada nem um apelido escolhido por ela.
- BR4 — Escrita de nome é **idempotente por toque**: duas batidas no botão gravam uma vez.

## 7–13. Dados, contratos, autorização, segurança, privacidade, analytics

Sem mudança. Nenhuma tabela, coluna, RPC, policy ou grant é tocada; a escrita de nome usa o
`ProfilePort` da SPEC-018 fatia 2, que já existia. Nenhum dado novo é coletado e nenhum evento novo é
emitido.

## 14. UX Notes

O painel de identidade é a única superfície de marca da tela; as quatro seções abaixo são
`overline` + conteúdo, e a última é `faint` de propósito. A falha de escrita do nome é dita na
própria seção e não prende a tela: o valor volta ao que estava e o botão continua disponível.

## 15. Edge Cases

- EC1 — **Sem nome gravado.** O avatar mostra a marca e a linha diz "Seu perfil".
- EC2 — **Nome só com espaços.** `DisplayNameSchema` recusa e o botão de salvar não age.
- EC3 — **Falha ao gravar.** A seção diz que não deu, o estado anterior permanece, e tentar de novo é
  possível sem sair da tela.
- EC4 — **Sem plano ativo.** "Reavaliar meu cabelo" não aparece — não há o que substituir — e a
  seção "Seu cabelo" desaparece com ele em vez de ficar um título sozinho.
- EC5 — **Tela aberta como aba x empilhada.** Sem `onBack` não há saída no topo; a barra embaixo é a
  navegação.

## 16. Failure Modes

- FM1 — Leitura do nome falha: a tela abre com "Seu perfil" e não bloqueia nada.
- FM2 — Escrita falha: EC3. Nunca se afirma que gravou.

## 17. Acceptance Criteria

- AC1 — *(humano, sem teste)* A barra, os ícones e a tela Você parecem parte do mesmo produto premium?
- AC2 — A pastilha ativa se distingue da barra e o ícone se lê dentro dela. **Teste.**
- AC3 — A tela Você abre pela identidade, e não por um título genérico. **Teste** (a âncora da tela
  passou a ser o painel).
- AC4 — O nome pode ser editado, grava uma vez por intenção, e a falha de escrita não mente. **Teste.**
- AC5 — A saída existe só quando a tela é empilhada. **Teste.** Que exista **uma** faixa de rodapé é
  consequência de não haver `footer` nesta tela, e isso é verificado por leitura do código e a
  390px — não há teste que conte faixas de rodapé.
- AC6 — Zero literal de cor ou dimensão fora de `apps/mobile/src/design/` em tela de produto.
  **Varredura.**
- AC7 — Validação a **390px no DEV real**: barra com a aba certa acesa, os quatro ícones lado a lado,
  a tela Você inteira rolada, edição de nome com reload.

## 18. Testing Strategy

`palette-contrast.test.ts` cobre AC2 com números. `account-screen.test.tsx` cobre AC3/AC4/AC5.
`tab-bar.test.tsx` continua garantindo as quatro categorias e a porta única. AC1 e AC7 são humanos e
visuais — teste automatizado não os alcança, e é por isso que a validação a 390px é parte do DONE.

## 19–22. Dependências, plano, migração, rollback

Nenhuma dependência nova, nenhuma migration, nada a migrar. Rollback é reverter o commit.

## 23. Open Questions

- OQ1 — **Foto de perfil real** (`F34`/`P24`, D-102) espera infraestrutura de mídia e base legal
  (D-32). A estrutura fica pronta no `Avatar`; a capability não é desta rodada.
- OQ2 — **Avatares próprios da Huna no Free** (D-102) são conteúdo ilustrado, e portanto dependem da
  mesma frente artística do hero (SPEC-036 OQ1). Registrado, não implementado.

## 24. Change Log

| Data | Mudança |
|---|---|
| 2026-09-03 | Criada retroativamente para a rodada implementada. As citações no código apontavam para a SPEC-030, que é o contrato da Hoje — corrigidas para esta. |
