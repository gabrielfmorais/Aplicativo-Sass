# SPEC-048 — Qual finalização ela fez (`F38`, fatia de registro)

- **Status:** Implemented (fatia 1 de `F38`) · vocabulário **CANDIDATE**
- **Capability:** `F38` — Finalizações
- **Depende de:** SPEC-039 (`F37`, a etapa), SPEC-024 (`F25`/`F27`, o hub do Wash Day)
- **Alimenta:** SPEC-047 (`P2` Hair Intelligence), SPEC-049 (`P6`), `P8`
- **ADRs:** ADR-001 (fronteiras), ADR-008 (dia civil)
- **Decisões:** D-26/D-70 (gate de domínio), D-102 (`F37`/`F38` como escopo), D-92/D-94

---

## 1. O problema

A SPEC-039 entregou a **etapa**: *se* ela finalizou (`done` / `skipped`). O que faltava era **qual**
— e a SPEC-047 §13 registrou, por escrito, por que aquilo **não** entrou junto com a dimensão de
técnica: registrar *qual* exige um **vocabulário de finalizações**, e a SPEC-039 §8 já tinha marcado
esse vocabulário como *"conteúdo capilar substantivo, atrás do gate D-26/D-70"*.

⚠️ **A barreira não era técnica, era de autoridade.** Inventar a lista é exatamente o que a D-26
proíbe engenharia de fazer, e texto livre foi recusado na SPEC-024 porque destruiria
`P5`/`P6`/`P7`/`P8`. **O que faltava era decisão humana, e ela veio.**

## 2. A lista, e de onde ela vem

**O dono forneceu o vocabulário em 2026-09-04**, e ele entra como **`candidate`**:

| valor | rótulo na tela |
|---|---|
| `fitagem_tradicional` | Fitagem tradicional |
| `fitagem_estruturada` | Fitagem estruturada |
| `dedoliss` | Dedoliss |
| `rake_and_shake` | Rake and shake |
| `plopping` | Plopping |
| `twist_out` | Twist out |
| `other` | Outra finalização |
| `unknown` | Não sei o nome |

⛔ **`day_after` ficou de fora desta versão**, por decisão do dono — revitalização/day after é
conceito separado e entra se o roadmap justificar. **Há teste que recusa `day_after`**, para que a
decisão não volte por distração.

## 3. A regra que carrega a fatia inteira

> **Esta lista permite REGISTRO, não recomendação.**
>
> *"Eu fiz Fitagem"* é **fato observável informado pela usuária**.
> *"Fitagem é melhor para o seu cabelo"* continua **bloqueado por D-26/D-70**.

É essa contenção — e não uma revisão de domínio — que torna a **fatia de registro** utilizável antes
do sign-off. Nada aqui indica, ordena, pontua, promete efeito ou ensina.

## 4. Business Rules

- **BR1 — vocabulário fechado.** `CHECK` no banco com os oito valores. Nenhum caminho de escrita
  aceita outra coisa; **sem campo de texto livre** (SPEC-024), porque `other` cobre a técnica fora da
  lista e `unknown` é *"fiz e não sei o nome"*.
- **BR2 — `null` não é `unknown`.** `null` é *"ainda não disse qual"*; `unknown` é uma **resposta**.
  A mesma distinção que o `F35` teve de fazer entre ausência e resposta — e, como lá, **sem
  `DEFAULT`**, porque default é uma resposta que ninguém deu.
- **BR3 — técnica só existe com a etapa em `done`.** *"Pulei a finalização, e a técnica foi
  fitagem"* é estado impossível, e o `CHECK` é o único lugar onde ele fica impossível de verdade:
  uma checagem de aplicação seria contornada por retry, outro aparelho ou cliente adulterado.
- **BR4 — os dois vocabulários são disjuntos.** As catorze `WASH_DAY_TECHNIQUES` **ficam onde
  estão** e o histórico não é reescrito (SPEC-039 §8). Seis delas são movimentos de finalização e
  continuam sendo técnicas. Nenhum valor atravessa, nos dois sentidos, com trava de teste.
- **BR5 — trocar a etapa para `skipped` limpa a técnica na mesma escrita.** Sem isso a escrita
  falharia contra o `CHECK` e ela veria um erro por uma incoerência que o app é que devia resolver.

## 5. Onde ela responde

Duas superfícies, e as duas mostram **o mesmo fato**:

1. **O cartão do cuidado na Hoje** — a etapa já estava ali (SPEC-039 FR2); *qual* aparece logo
   abaixo, e **só depois** de ela dizer "Finalizei".
2. **"Seu registro"** (`WashDayScreen`) — a tela cheia, dentro da seção **Finalização** que já
   existia.

⚠️ **A segunda só entrou porque a validação a 390px a encontrou vazia.** A primeira versão desta
fatia acrescentou a pergunta *só* no cartão da Hoje, e a tela que se chama **"Seu registro"** — a que
ela alcança por *"Ver o que contei"* — perguntava *se* ela finalizou e nunca *qual*. Duas superfícies
sobre o mesmo fato, uma delas mostrando metade dele. Nenhum teste via isso, porque cada tela era
testada contra a sua própria expectativa.

⚠️ **Consequência de projeto:** `FINISH_TECHNIQUE_LABEL` mora na `WashDayScreen`, junto de
`TECHNIQUE_LABEL` e `SCALP_LABEL`, e a Hoje **importa** o mapa. Duas cópias discordariam na primeira
renomeação, e o mesmo registro dela apareceria com nomes diferentes em duas telas.

## 6. Edge cases medidos

- **EC1 — sair de `done` e voltar.** O `skipped` limpa a coluna no banco; se a tela guardasse a
  técnica antiga, dizer *"Finalizei"* de novo **ressuscitaria uma escolha que já não existe**.
  ⚠️ A primeira barreira escrita para isso **passou com o defeito dentro**: enquanto a etapa está em
  `skipped` a seção inteira some, então a técnica velha fica *escondida* em vez de corrigida. O
  teste que vale é o da **volta**.
- **EC2 — dois toques rápidos.** Técnica e etapa escrevem na **mesma linha**, então compartilham a
  **mesma fila** (`'finish'`). Em filas separadas, escolher a técnica e trocar a etapa em sequência
  poderiam chegar fora de ordem e a última a gravar venceria.
- **EC3 — retry.** `upsert` por `wash_day_id`: duas escritas iguais em paralelo deixam **uma** linha.

## 7. Segurança

**Nenhum grant novo.** O cliente já tinha `select/insert/update/delete` em `wash_day_finish`
(SPEC-039 §7) e a coluna entra sob as policies existentes. Posse validada nas duas pontas — `user_id`
forjado e hub alheio.

## 8. Non-Goals — ⛔ o que esta fatia NÃO faz

Cada item abaixo é `F38` COMMITTED e **aguarda sign-off profissional (D-26/D-70)** antes de release
público:

- ⛔ *"melhores finalizações para você"* — recomendação capilar
- ⛔ indicação por curvatura, porosidade ou qualquer traço de perfil
- ⛔ efeitos e promessas (*"define os cachos"*, *"reduz o frizz"*)
- ⛔ **passo a passo substantivo** ("Como fazer" de cada finalização)
- ⛔ ranking de técnicas, nota, ordem de mérito
- ⛔ `day_after` no vocabulário
- ⛔ área própria de Finalizações dentro de Cuidados (Blueprint §22)

## 9. 🔒 O que precisa de sign-off antes do release público

| item | estado | quem destrava |
|---|---|---|
| **o vocabulário de 8 valores** | `candidate` (dono, 2026-09-04) | revisor de domínio |
| os rótulos em pt-BR | `candidate` | revisor de domínio |
| tudo em §8 | não construído | revisor de domínio |

**O que NÃO precisa:** a coluna, os `CHECK`, as portas, a persistência, o reload e o histórico — são
mecanismo de registro, e registrar o que ela informou não afirma nada sobre cabelo.

## 10. Evidência

- **`pnpm verify` verde** — core 357, mobile 434.
- **Probe contra o DEV real** (anon key + JWT dela + RLS), 22 asserções: vocabulário fechado
  (`23514` para texto livre, `day_after`, `diffuser`, `scrunched`, `done`), técnica exigindo `done`,
  o caminho do adapter, `user_id` forjado → `42501`, hub alheio → `23503`, duas escritas paralelas →
  **uma** linha, e os seis valores de finalização recusados em `wash_day_techniques`.
- **Jornada a 390px no DEV real**, com **zero problema de console**: marcar → persistir → reload →
  trocar → pular limpando a técnica → reload → voltar a *"Finalizei"* **perguntando de novo**.
- **As duas superfícies conferidas olhando:** *Fitagem estruturada* escolhida no cartão da Hoje
  aparece marcada em "Seu registro".

## 11. Open Questions

- **OQ1 — a lista sai de `candidate` quando?** Depende do revisor de domínio (D-26/OQ-REL).
- **OQ2 — `day_after`.** Fora por decisão do dono; entra se o roadmap justificar.
- **OQ3 (RESOLVIDA)** — `other` e `unknown` **não viram observação** na SPEC-047 §14: a primeira
  agregaria técnicas **diferentes** sob um rótulo só, a segunda é ausência de identificação. As duas
  continuam sendo respostas legítimas e contando como registro; o que não fazem é virar padrão.
