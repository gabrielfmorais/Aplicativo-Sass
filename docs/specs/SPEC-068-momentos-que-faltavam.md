# SPEC-068 — Os momentos que faltavam do `F46`

| Campo | Valor |
|---|---|
| ID | SPEC-068 |
| Status | Approved (frente definida pelo dono: *"quero FECHAR o F46 de verdade"*) |
| Owner | dono do produto |
| Bounded Context | **Growth** (`packages/core/src/sharing`) + Progress |
| Related ADRs | ADR-001, **D-103**, **D-26/D-70**, **D-83** (Free) |
| Related SPECs | SPEC-044 (a fundação), **SPEC-045** (os cinco primeiros momentos), SPEC-021 (o ciclo), SPEC-014 (o total vitalício), SPEC-043 (a Jornada) |
| Capability | `F46` — **COMMITTED** |
| Criado / Atualizado | 2026-09-09 / 2026-09-09 |

## 1. Context — o que o `F46` prometia, e o que existia

O dono pediu para **fechar o `F46` de verdade**, recuperando os gatilhos originalmente previstos em
vez de aceitar "alguns momentos já existem" como conclusão. A lista canônica está no
`MASTER-PRODUCT-BACKLOG`:

> cuidado concluído · Wash Day · sequência · marco/badge · ciclo concluído · **progresso** ·
> **resumo mensal** · **comparação de ciclos**

**Confirmado pelo código e pelos testes**, não pela prosa:

| Gatilho | Estado medido antes desta SPEC |
|---|---|
| cuidado concluído | ✅ `careDoneMoment`, entrada na Hoje, ⛔ avulsa excluída |
| Wash Day | ✅ `washDayMoment`, entrada na tela de registro, ⛔ só cuidado do plano |
| sequência | ✅ dentro de `journeyMoment` (a sequência é o herói quando existe) |
| marco/badge | ✅ `milestoneMoments`, ⛔ só os alcançados |
| ciclo | ⚠️ **parcial** — existia o ciclo **em andamento**; o **encerrado** não |
| progresso | ❌ não existia |
| resumo mensal | ❌ não existia |
| comparação de ciclos | ⛔ ver §3 |

## 2. Goals

- **G1** Todo gatilho **desbloqueado** da lista original produz um card.
- **G2** O ciclo **encerrado** é um momento próprio — a tela já o trata como outro estado (SPEC-021).
- **G3** O seletor de momentos continua legível quando a lista cresce.
- **G4** As invariantes de escolha ficam **testadas**, não confiadas a um arquivo de tela.

## 3. ⛔ O que continua BLOCKED, e por quê — medido, não presumido

### 3.1 Comparação de ciclos — **BLOCKED**, por dois motivos independentes

**(a) Aritmética, antes de domínio.** A SPEC-045 registrou que comparar ciclos é *"a porta mais curta
para melhorou/piorou"*. Verdade, mas há uma razão **anterior e mais dura**: os ciclos **não têm o
mesmo tamanho**. A auditoria do motor (SPEC-038 §21) mediu que a personalização do v1 é a **cadência
— 4, 8 ou 12 cuidados** conforme a frequência de lavagem —, e uma reavaliação troca o plano. Então
*"12 neste ciclo contra 9 no anterior"* compara **denominadores diferentes**: 12 de 12 e 9 de 9 são a
mesma consistência, e o card diria que ela melhorou.

⛔ **A versão honesta exige uma proporção** — e proporção é recusa registrada em **três** SPECs
(009/019/021) e no **NG4 da própria SPEC-045**. Não existe redação que resolva isso: o problema é o
número.

**(b) O dado não existe.** O `CareBoard` lê **o plano ativo e só ele** — é exatamente por isso que
`lifetimeDoneCount` é uma contagem separada, vinda do servidor. Contagem por ciclo anterior exigiria
leitura nova (planos anteriores + execuções deles), porta nova e adapter novo.

**Consequência:** ⛔ fica **BLOCKED**, e não "adiado por conveniência". Reabrir exige uma decisão de
produto sobre comparar consistência entre ciclos de tamanhos diferentes — e essa decisão precisa da
proporção que o produto recusa, ou de outra régua que ainda não existe.

### 3.2 Antes × Depois e Hair Progress — **BLOCKED** (D-32)

Inalterado: mídia com base legal (`F28`/`P24`/**D-32**), e foto **nunca entra num card sozinha**.

## 4. Non-Goals

- **NG1** ⛔ Nenhuma porcentagem, nota, média ou comparação — as recusas de SPEC-009/019/021 valem
  aqui como valem na tela.
- **NG2** ⛔ Nenhuma afirmação sobre o cabelo dela (D-26/D-70).
- **NG3** ⛔ Nenhum backend novo, tabela, RPC ou registro de "ela compartilhou".
- **NG4** ⛔ Nenhuma publicação automática: o preview continua sendo o consentimento (SPEC-044 BR2).
- **NG5** ⛔ Nenhuma regra de gamificação nova (D-103): todo número vem de view já canônica.

## 5. Functional Requirements

- **FR1** **Ciclo encerrado** é um momento próprio (`cycle_closed`), com manchete própria.
- **FR2** **Progresso** é um momento próprio (`progress`): o total que atravessa a troca de plano.
- **FR3** O **resumo mensal** da lista original é atendido pelo ciclo encerrado — ⛔ nenhum sexto card
  é inventado para preencher checklist.
- **FR4** O chip do seletor é um **nome**, não a frase inteira do marco.
- **FR5** A escolha de qual card o Progresso oferece é **pura e testada** (`cycleMoments`).

## 6. Business Rules

- **BR1** ⛔ **Exatamente um** card de ciclo por vez: encerrado **ou** em andamento, nunca os dois.
- **BR2** ⛔ **Nenhum** card de ciclo com zero cuidado atendido (EC4 da SPEC-045) — e a regra mora em
  quem **constrói o momento**, não no botão da tela.
- **BR3** O card de progresso **não existe** quando empataria com o número do ciclo: dois cartões com
  o mesmo número lado a lado é o defeito que a auditoria da SPEC-026 mediu.
- **BR4** ⛔ *"Ciclo concluído"* é proibido como manchete: lê como *"cumpri tudo"*, e a contagem não
  diz isso. A palavra é **encerrado**, a mesma que a tela usa (SPEC-021).
- **BR5** `isCycleEnded` tem **duas** entradas (a data de fim **ou** não ter sobrado nada) e vive num
  lugar só, consumido pela tela **e** pelo card.
- **BR6** O total vitalício é **aderência, não volume**: a execução avulsa não entra nele (SPEC-052).

## 7. Data Model / API / Authorization / Privacy

**Nenhum impacto.** Zero tabela, zero coluna, zero migration, zero RPC, zero leitura nova. Todo número
vem de `Progress`, `CycleView` e `JourneyView`, que as telas já constroem.

A fronteira de privacidade da SPEC-044 continua sendo a **assinatura** de `buildShareCard`: não há
`user_id`, id de fato ou e-mail que possa chegar ao card, porque não são parâmetros e o tipo de saída
não tem onde guardá-los.

## 8. Edge Cases

- **EC1** Ciclo em andamento com cuidado atendido: o card corrente.
- **EC2** Ciclo encerrado pela **data**: o card encerrado.
- **EC3** Ciclo encerrado por **não sobrar nada** (D-82): idem — é a entrada que se esquece.
- **EC4** Zero cuidado atendido: ⛔ nenhum card de ciclo; o de *até aqui* continua, quando existe.
- **EC5** Primeiro ciclo (`lifetimeDone === done`): ⛔ sem card de progresso (BR3).
- **EC6** Logo depois de uma reavaliação (`done === 0`, `lifetimeDone > 0`): só o card de *até aqui*.
- **EC7** Marco novo com outro final de frase: o chip mantém o rótulo inteiro em vez de virar um nome
  errado.

## 9. Acceptance Criteria

- **AC1** Ciclo encerrado e em andamento têm manchetes diferentes e nunca coexistem — teste.
- **AC2** Nenhum card de ciclo com zero atendido — teste.
- **AC3** O card de progresso não duplica o número do ciclo — teste.
- **AC4** Os chips do seletor continuam distintos entre si depois de encurtados — teste.
- **AC5** Nenhum momento novo cai nas listas proibidas (porcentagem, nota, média, cabelo) — as
  varreduras existentes passam a incluir os novos.
- **AC6** Validado a 390px no DEV real, console limpo.

## 10. O que só se prova em iPhone nativo

⛔ `toDataURL` e a folha do sistema não existem no preview web (SPEC-044): rasterização e share só se
exercem em build nativo (gate **G7**). O que o 390px prova é o momento, o card, o seletor, o padrão
privado e o estado indisponível honesto.

## 10.1 Evidência — o que foi medido

⭐ **O seletor foi medido, não estimado.** Com sete momentos, a 390px:

| | Antes | Depois |
|---|---|---|
| Linhas do seletor | **4** (topos 580 · 636 · 692 · 748) | **3** |
| Chip mais largo | **170px** (*"10 cuidados do seu plano"*) | 113px (*"Primeiro cuidado"*) |

⚠️ **Isto reverte uma decisão da SPEC-045** — *"o rótulo do marco vai como está, porque o chip é
interface e interface fala com ela"*. A premissa continua certa; o que mudou foi o **tamanho da
lista**, e o custo virou medida: ~224px, mais de um quarto da tela, só para escolher qual card. ⛔ E
nada se perde: a frase inteira continua **no card**, que está logo acima.

⚠️ **Um achado da auditoria, no próprio diff.** A escolha de qual card o Progresso oferece nasceu
dentro de `apps/mobile/src/app/index.tsx` — **900+ linhas e zero cobertura de teste** —, e ela guarda
três invariantes que ninguém veria quebrar ali: exatamente um card de ciclo, nunca os dois, e nenhum
com zero atendido. Virou `cycleMoments`, função pura, com as três testadas. Na tela ficou só a
montagem das views.

⚠️ **E a regra de "o ciclo acabou?" tinha uma cópia só na tela.** Com o card passando a consumi-la,
duas cópias discordariam **no lugar em que ela mostra o app para outras pessoas** — a tela dizendo que
o mês está em andamento e o card dizendo que acabou. Virou `isCycleEnded`, no core, com teste para as
**duas** entradas.

✅ **Validado a 390px no DEV real, com o histórico real da usuária de desenvolvimento:**

- `MEU CICLO · 3 · cuidados do meu plano neste ciclo · 18 cuidados do meu plano no total`
- `ATÉ AQUI · 18 · cuidados do meu plano desde o começo · 3 neste ciclo`
- seletor: `Meu ciclo · Meu progresso · Minha jornada · Primeiro cuidado · 5 cuidados · 10 cuidados ·
  3 seguidos`

⚠️ **O que a validação NÃO prova:** o card de **ciclo encerrado** não apareceu porque o ciclo da
usuária de desenvolvimento está **aberto** (há cuidado planejado). Ele está coberto por **teste**, nas
duas entradas de "encerrado", não por medição. ⚠️ E o `401` visto no console é o **desvio de relógio**
já documentado (SPEC-038, `JWT issued at future`), que o app repete uma vez — a tela carregou.

## 11. Auditoria de UX dos cards existentes (pedido do dono)

| Pergunta | Resposta medida |
|---|---|
| Faz sentido compartilhar? | Sim — todo card é uma conquista de **consistência**, nunca uma nota |
| Tem identidade Huna? | Sim — ameixa, mechas abstratas da SPEC-036, marca discreta, sem print de tela |
| A informação principal está clara? | Sim — herói numérico, frase curta abaixo, no máximo uma nota de rodapé |
| Alguém postaria isso? | Sim, na régua do Strava: número grande, contexto curto, arte própria |
| iPhone-first | O conteúdo fica no **terço inferior** do 9:16, onde a interface do Stories não cobre |
| Privacidade | Nome e avatar **desligados por padrão**; controles só existem quando há o que mostrar |
| Excesso de informação | ⚠️ Era o **seletor**, não o card — corrigido nesta SPEC (4 → 3 linhas) |
| Aparência genérica | Não: sem template, sem ícone de biblioteca, sem gradiente de banco de imagem |

## 12. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-09 | Criada. Fecha os gatilhos **desbloqueados** do `F46` (ciclo encerrado + progresso), encurta o seletor com medida a 390px, extrai `isCycleEnded` e leva a escolha do card para função pura testada. ⛔ Comparação de ciclos fica **BLOCKED** com motivo **aritmético** (ciclos de tamanhos diferentes exigiriam proporção, que é recusa registrada) além do gate de domínio | agente |
