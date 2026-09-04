# SPEC-044 — Share Card Huna: a fundação (F45)

| Campo | Valor |
|---|---|
| ID | SPEC-044 |
| Status | Implemented |
| Owner | dono do produto |
| Bounded Context | **Growth** (ativado; `packages/core/src/sharing` + tela própria) |
| Related ADRs | ADR-001 (core sem framework), ADR-008 (datas), **D-103**, **D-101** (dependência reversível), **D-32** (mídia/base legal), **D-83** (Free) |
| Related SPECs | SPEC-043 (a conquista), SPEC-036 (a linguagem visual), SPEC-042 (avatar), SPEC-021/019 (ciclo, para o `F46`) |
| Capability | `F45` — **COMMITTED · INEGOCIÁVEL** |
| Fase do roadmap | MASTER PRODUCT BACKLOG — F45, depois do F40–F42 |
| Criado / Atualizado | 2026-09-04 / 2026-09-04 |

## 1. Context

> O ato de compartilhar é **FREE**. Crescimento orgânico não fica atrás de paywall. — D-103

A Huna acabou de ganhar conquistas reais (SPEC-043): níveis, sequência e marcos, todos derivados de
fato canônico. Uma conquista que só existe dentro do app não é compartilhável, e o Blueprint §25 é
explícito sobre o princípio, emprestado do Strava: **conquista → card visual → compartilhar**.

⚠️ **Esta capability não sai do roadmap em replanejamento, não é adiada por conveniência e não
depende da Community** (D-103).

## 2. Problem

Ela mantém a rotina por semanas e não tem **nada** para mostrar. Um print de tela mostra a interface
do app, não a conquista dela — e leva junto tudo o que estava na tela.

## 3. Goals

- **G1** Ela vê **exatamente** o que vai sair, antes de sair.
- **G2** Um card **autoral** da Huna, não um print: a linguagem visual do hero (SPEC-036).
- **G3** O que aparece é **escolha dela**, campo a campo.
- **G4** Share **nativo do sistema** — o que estiver instalado.
- **G5** Fundação reutilizável: o `F46` acrescenta **gatilhos**, não outro caminho.

## 4. Non-Goals

- **NG1** ⛔ **Nenhuma publicação automática.** Nunca, por nenhum caminho.
- **NG2** ⛔ **Nenhuma integração direta com app específico** nesta fatia (Instagram API, WhatsApp
  Business). Cada uma é dependência e superfície de manutenção; o share nativo já alcança todas.
- **NG3** ⛔ **Nenhuma foto.** Antes × Depois e Hair Progress dependem de mídia com base legal
  (D-32) e são `F46`/`F28` — **foto nunca entra num card sozinha**.
- **NG4** ⛔ Nenhum backend: sem tabela, sem RPC, sem registro de "ela compartilhou". Contar shares é
  analytics, e analytics tem provider indefinido (D-31).
- **NG5** ⛔ Nenhum gatilho novo além do que a Jornada já produz — gatilhos são o `F46`.
- **NG6** ⛔ Nada aqui fala do cabelo dela. A conquista é **aderência ao plano** (D-103/D-26).

## 5. User Stories

- **US1** Como usuária, quero ver o card antes de compartilhar, para decidir com o que sai o meu nome.
- **US2** Como usuária, quero tirar meu nome do card e mesmo assim compartilhar a conquista.
- **US3** Como usuária Free, quero compartilhar sem esbarrar em assinatura.

## 6. Functional Requirements

- **FR1** O card é desenhado em `react-native-svg` — a mesma linguagem do hero. **Zero dependência
  nova para desenhar**, e ele renderiza no preview web, o que mantém a validação a 390px viva.
- **FR2** Dois formatos: **9:16** (Stories, 1080×1920) e **1:1** (feed, 1080×1080).
- **FR3** Tela de preview: o card **em tamanho real de proporção**, os controles do que aparece, e
  uma única ação de compartilhar.
- **FR4** Controles: **nome** e **avatar** entram só se ela quiser. O número da conquista é o
  conteúdo do card e não se desliga — desligá-lo deixaria um card vazio.
- **FR5** Captura por `Svg.toDataURL()` → PNG base64 → arquivo temporário (`expo-file-system`, já
  presente) → `expo-sharing`. **Uma dependência nova, e só para o share.**
- **FR6** Onde o share não existe (preview web), o botão diz isso e **não finge** — a mesma
  disciplina fail-closed dos adapters de notificação (SPEC-008).
- **FR7** Entrada na Jornada (SPEC-043), que é onde a conquista mora.

## 7. Business Rules

- **BR1** ⚠️ **`user_id`, ids de fato, e-mail e qualquer identificador interno NUNCA aparecem** — nem
  no card, nem no nome do arquivo, nem no texto que acompanha o share. Barreira de teste.
- **BR2** ⚠️ **O preview é o consentimento.** Não há caminho de código que compartilhe sem passar por
  ele. Barreira de teste.
- **BR3** **Free.** Nenhuma checagem de entitlement em nenhum ponto deste fluxo (D-83/D-103).
- **BR4** O conteúdo do card deriva de `JourneyView` — fato já canônico. **Nenhum número novo é
  calculado aqui**, senão o card e a tela poderiam discordar.
- **BR5** Nenhuma porcentagem, nota ou comparação com outras pessoas — as recusas da SPEC-009/019/021
  valem no card exatamente como valem na tela.
- **BR6** O padrão é **privado**: nome e avatar começam **desligados**. Ela liga o que quiser.

## 8. Data Model Impact

**Nenhum.** Sem tabela, sem coluna, sem migration. O card lê `JourneyView`, que já existe. Ver
`docs/architecture/DATA-MODEL.md` — nada a atualizar.

## 9. API / Contracts

**Nenhum contrato de servidor.** Uma porta de plataforma:

```ts
type SharePort = {
  isAvailable(): Promise<boolean>;
  share(input: { pngBase64: string; fileName: string }): Promise<void>;
};
```

`fileName` é gerado sem nenhum dado dela (BR1).

## 10. Security & Privacy

- **Sem PII em log, nome de arquivo ou telemetria** (SECURITY-BASELINE §13).
- O arquivo temporário vive no diretório de cache do app e não contém nada além do PNG.
- Nenhuma permissão nova de sistema: `expo-sharing` abre a folha do SO, não escreve na galeria.
- Sem rede, sem upload, sem servidor. O card não sai do aparelho a não ser pela mão dela.

## 11. Edge Cases

- **EC1** Sem jornada (sem plano): não há conquista e a entrada não aparece.
- **EC2** Share indisponível (web, ou SO sem folha de compartilhamento): o botão explica, e o preview
  continua servindo — ela vê o card.
- **EC3** Captura falha: mensagem honesta e nova tentativa; nada é compartilhado pela metade.
- **EC4** Toque duplo no compartilhar: a ação é guardada, uma folha só.
- **EC5** Nome muito longo: trunca no card em vez de vazar do quadro.
- **EC6** Ela pulou a pergunta do nome (SPEC-018): o controle de nome não aparece — não há nome.

## 12. Acceptance Criteria

- **AC1** No DEV real a 390px: abrir a Jornada → abrir o card → ver o preview nos dois formatos →
  ligar/desligar nome e avatar → o card muda **na hora**.
- **AC2** Nenhum identificador interno em lugar nenhum do card — barreira de teste.
- **AC3** Nenhum caminho compartilha sem preview — barreira de teste.
- **AC4** Free: nenhuma consulta de entitlement no fluxo — barreira de teste.
- **AC5** O preview web continua funcionando depois da dependência nova (D-101).

## 13. Open Questions

- **OQ1 (CAN DEFER)** Texto que acompanha o share (`message`). Assunção adotada: **nenhum** — o card
  fala por si, e um texto pré-escrito colocaria palavra nossa na boca dela.
- **OQ2 (CAN DEFER)** Salvar na galeria além de compartilhar. Assunção: **fora** — exigiria permissão
  de mídia (D-32) para uma conveniência que o share nativo já cobre.
- **OQ3 (CAN DEFER)** Gatilhos além da Jornada (cuidado concluído, ciclo, Wash Day) — são o `F46`.

## 14. Change Log

| Data | Mudança |
|---|---|
| 2026-09-04 | SPEC criada. A fundação do share: card autoral em SVG, preview como consentimento, share nativo, zero backend. |
| 2026-09-04 | Implementada e validada a 390px no DEV real. Quatro correções vieram de **olhar**, não de teste (§15). |

## 15. Evidência

**Validado a 390px no DEV real:** Jornada → *Compartilhar minha jornada* → preview nos dois formatos
→ ligar e desligar nome e marca, com o card mudando na hora → estado indisponível do share honesto no
web. **O padrão privado foi confirmado na árvore renderizada**, não só no tipo: com nome e avatar
existentes, o card sai sem os dois até ela ligar.

**Quatro coisas que só apareceram olhando** — e três delas nenhum teste pegaria:

1. **A primeira família de mechas lia como fita/tentáculo** — o modo de falha que o dono nomeou para
   o hero. Quatro famílias foram desenhadas e comparadas **fora do app** antes de qualquer uma entrar
   na tela (o método da SPEC-036); o que resolveu foi densidade com variação e convergência.
2. **A composição deixava a metade de baixo do 9:16 vazia.** Ancorar o conteúdo na base resolve os
   dois formatos com um número só.
3. **O `<Text>` do `react-native-svg` não herda a tipografia do app**: no web caía no padrão do
   documento e o card saía inteiro em **serifada**. Nenhuma outra tela precisa disso, porque todas
   passam pelas primitivas.
4. **As mechas terminavam ~40px antes da base** e o `strokeLinecap="round"` deixava **as pontas
   arredondadas visíveis dentro do card** — cabelo que começa e termina no meio do quadro vira
   objeto. Esticar até a altura do formato faz sangrar pelas duas bordas.

E uma de hierarquia: com o card de 9:16 no corpo rolável, **"Compartilhar" caía abaixo da dobra**
enquanto "Voltar" ficava fixo no rodapé — a tela pedia rolagem para chegar à única coisa que ela veio
fazer. A ação primária passou para o rodapé.

⚠️ **O que NÃO foi validado, e por quê.** `Svg.toDataURL()` e `expo-sharing` **não existem no preview
web** — a folha de compartilhamento é do sistema operacional. O que o DEV real prova é o card, o
preview, os controles, o padrão privado e o **estado indisponível**; a rasterização e a folha só se
exercem num build nativo, que está atrás do gate de development build (DEFERRED por constraint do
dono). É a mesma situação das notificações (SPEC-008), e a tela **diz** que não dá em vez de fingir.
