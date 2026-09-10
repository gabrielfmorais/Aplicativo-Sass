# SPEC-071 — A rotina de óleo deixa de estar escondida

- **Status:** DONE
- **Bounded context:** Care Tracking (`F39`)
- **Autorizada por:** o dono, 2026-09-09 (*"a Rotina de óleo existe e funciona, mas está escondida
  demais"*), com o formato do resumo e da tela interna descritos por ele.
- **Gate:** ⛔ **não atravessa D-26/D-70 nem D-103.** Ver §3.

---

## 1. Problem — o que estava errado

A SPEC-040 deu à rotina de óleo um endereço em **Cuidados**, e a SPEC-053 lhe deu **horários** —
inclusive vários no mesmo dia. Juntas, elas puseram naquela aba **a configuração inteira**: os chips
de intervalo, a lista de horários com adicionar, editar, remover e ligar/desligar o lembrete de cada
um, e o botão de desligar a rotina.

⚠️ **O resultado é uma inversão medida.** A SPEC-067 já tinha contado o custo — o cartão ocupava
**792px, 94% de uma tela inteira** — e resolveu movendo-o para baixo. Mas mover não resolveu o que
ele **diz**: a pergunta que ela faz todo dia (*"quando é a próxima?"*) ficava numa `caption` no **fim**
do cartão, depois de tudo o que ela ajusta uma vez. E a linha respondia só o **dia** — *"Próxima: qui,
10/09"* — mesmo depois de a SPEC-053 lhe ter dado horários, escondendo metade do que ela configurou.

## 2. Goals

1. A aba **Cuidados** mostra o **estado** da rotina: o próximo momento (dia **e hora**), quantos
   horários ela tem, e uma porta.
2. A **configuração** ganha tela própria, com os horários apresentados de forma clara.
3. Nada muda na **Hoje**: a ocorrência do dia, com *Feito* e *Adiar*, continua exatamente onde está.

## 3. Non-Goals — o que continua proibido

- ⛔ **Nada diz o que o óleo faz** e **nenhum intervalo é apresentado como recomendado** (SPEC-040
  BR4/NG2, D-26/D-70). *"A cada 3 dias é o ideal"* é afirmação capilar sem sign-off.
- ⛔ **Nada premia usar mais** (D-103): sem contagem de quantas vezes ela passou óleo, sem sequência,
  sem elogio, sem comparação. `doneCount` existe na view e **não** aparece no resumo.
- ⛔ **Vencida não vira cobrança** (D-28): diz o dia em que estava marcada e para por aí.
- ⛔ **A Hoje não vira mural de lembretes.** O dono foi explícito, e nada foi acrescentado lá.
- ⛔ Zero migration, zero coluna, zero RPC, zero dependência.

## 4. Functional Requirements

- **FR1** — `nextOilMoment` devolve o **dia e a hora** do próximo momento da rotina. Puro: `today` e
  `nowTime` são **entrada**, nunca relógio lido dentro (ADR-008, o mesmo contrato de
  `buildNotificationIntents`).
- **FR2** — o resumo em Cuidados mostra o próximo momento, quantos horários, e a porta *"Ver rotina"*.
- **FR3** — sem rotina, o resumo convida com *"Configurar rotina"*.
- **FR4** — a configuração (intervalo, horários, desligar) vive na tela `oilRoutine`, empilhada, que
  volta pelo gesto do iPhone e pelo botão físico do Android (SPEC-061/ADR-012).
- **FR5** — a tela reusa o **mesmo `OilRoutineCard`**: duas configurações poderiam discordar sobre a
  mesma rotina.

## 5. Business Rules

- **BR1 — `at: null` é resposta, não falha.** Dois casos honestos: rotina **sem horários** (o estado
  de toda rotina anterior à SPEC-053, e aí a linha volta a ser exatamente a da SPEC-040), e **hoje
  com todos os horários já passados** — a ocorrência continua sendo hoje, e dizer *"hoje, 07:30"* às
  20:00 apontaria um horário que não existe mais.
- **BR2 — horário com lembrete DESLIGADO conta como momento da rotina.** Ele continua nela e continua
  registrável (SPEC-053 FR3): o que a chave desliga é a **notificação**, não o horário. Por isso a
  linha se chama *"Próximo"* e nunca *"Lembrete"* — descreve a rotina, não promete um toque.
- **BR3 — a contagem é de TODOS os horários**, com a ressalva ao lado quando há algum sem lembrete.
  ⚠️ *"3 horários ativos"* foi **recusado como frase única**: chamar de inativo um horário que ela
  mantém seria errado, e tirá-lo da contagem seria pior — a rotina é dela, não da notificação.
- **BR4 — `HH:MM` compara como string.** 24h com zero à esquerda é cronológico por construção, então
  nenhum `Date` entra (mesma disciplina de `YYYY-MM-DD`, ADR-008).
- **BR5 — a ordem dos horários vem do `buildOilRoutineView`**, que já os entrega em ordem
  cronológica. Reordenar aqui criaria duas regras de ordem para a mesma lista.

## 6. Data Model / API / Authorization

**Nada muda.** É leitura sobre a `OilRoutineView` que já existia; a única adição é uma função pura no
domínio. As escritas continuam nas RPCs `SECURITY DEFINER` da SPEC-040/053.

## 7. Edge Cases

- **EC1** — sem rotina: convite, com CTA de configurar. ⚠️ A frase **não** promete *"crie seus
  horários"*: o intervalo vem antes, e não por ordem de tela — o banco recusa um horário sem rotina
  (a FK aponta para `oil_routines`).
- **EC2** — rotina sem horários: só o dia, exatamente como antes da SPEC-053.
- **EC3** — hoje com horários já passados: só o dia (BR1).
- **EC4** — vencida: o dia em que estava marcada, sem tom.
- **EC5** — o horário **exato** ainda conta como próximo (`>=`, não `>`).

## 8. Acceptance Criteria

- **AC1** — a aba mostra o próximo momento com hora quando ela tem horários.
- **AC2** — a configuração inteira continua existindo, na tela dela, sem perder nenhuma ação.
- **AC3** — voltar da tela cai em **Cuidados**.
- **AC4** — nenhum texto recomenda frequência, afirma efeito, premia repetição ou cobra atraso
  (barreira de teste).
- **AC5** — validado a 390px no DEV real, com console limpo.

## 8.1 Evidência — medido a 390px no DEV real (2026-09-09)

Com a rotina real dela (três horários, um sem lembrete — os mesmos da validação da SPEC-053):

| medição | valor |
|---|---|
| resumo em Cuidados | *"Rotina de óleo · Próximo: qui, 10/09, 07:30 · 3 horários · 1 sem lembrete · Ver rotina"* |
| altura rolável da aba Cuidados | **1038** (era **1640** na medição da SPEC-067) |
| tela da rotina | intervalos · horários com ligar/desligar e remover · adicionar · próxima e última vez · desligar a rotina |
| voltar | cai em **Cuidados** |
| transbordo horizontal | nenhum |

⚠️ **A aba encolheu ~600px** porque a configuração saiu dela, não porque algo tenha sido escondido:
tudo continua existindo, na tela onde se ajusta. E o que ela **ganhou** foi a hora — a linha antes
dizia só *"Próxima: qui, 10/09"*.

⚠️ **Um defeito que só apareceu olhando a tela real:** ela dizia **"Rotina de óleo" duas vezes** — o
título da tela e o cabeçalho do cartão — com duas frases sobre a mesma coisa uma embaixo da outra. O
cartão tinha título porque vivia **dentro de uma aba, ao lado de outros cartões**; virando o corpo de
uma tela que já se apresenta, o título dele virou eco. Removido, com o teste que o afirmava reescrito
para afirmar a **configuração** — que é o que aquele cartão de fato guarda. Medido depois: **uma**
ocorrência do título.

**Console limpo:** zero erro, zero exceção; sobram as deprecações do `react-native-web` que já
existiam.

## 9. O que só se prova em iPhone nativo (G7)

O gesto de voltar da pilha nativa e o disparo real dos lembretes de cada horário — o segundo já era
DEFERRED desde a SPEC-053.

## 10. Change Log

- 2026-09-09 — criada e entregue a partir da prioridade do dono.
