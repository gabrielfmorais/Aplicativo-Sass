# SPEC-051 — O que você notou (`P13`, fatia de registro do cabelo)

| Campo | Valor |
|---|---|
| ID | SPEC-051 |
| Status | Implemented |
| Owner | dono do produto |
| Bounded Context | **Care Tracking** (`packages/core/src/care-tracking`) |
| Related SPECs | **SPEC-006** (`F14`, o check-in de um toque) · SPEC-025 (`F31`, o couro) · SPEC-024 (o padrão de junção) · SPEC-048 (o precedente de vocabulário) · SPEC-047/SPEC-050 (quem vai consumir) |
| Related ADRs / Decisões | **D-26/D-70** (nada afirma sobre cabelo) · **D-32** (dado de saúde) · D-94 (o Blueprint é a intenção oficial) · D-47/D-48 |
| Capability | `P13` — **COMMITTED**; o **registro** é Free (Blueprint §8) |
| Criado | 2026-09-05 |

---

## 1. Context — e o problema está escrito pelo dono

> **"O check-in atual é uma nota de 1 a 5 sobre o cuidado. Suficiente para começar, insuficiente para
> aprender: '3' não diz se o problema foi frizz, ressecamento ou o couro cabeludo coçando."**
>
> **"É o combustível de `P2`, `P14`, `P15`, `P8` e `P16`. Sem check-in rico, o Premium não tem o que
> interpretar."** — MASTER PRODUCT BLUEPRINT §8

A SPEC-047, a SPEC-049 e a SPEC-050 leem **quatro** eixos de entrada — produto, técnica, finalização
e prateleira — e **um único número** como eixo de resultado. Tudo o que a camada consegue dizer é
*"você avaliou bem"*; ela não consegue dizer **o quê** ficou melhor.

⚠️ **Este é o gargalo do critério mestre.** Nenhuma engenharia de agregação melhora um sinal de
resultado de um bit. Enriquecer o que ela registra sobre o **resultado** é o que faz a Huna aprender.

## 2. Goals

- **G1** Ela registra **o que notou** no cabelo, em poucos toques, sem sair da Hoje.
- **G2** O registro é **opcional e sem penalidade** — pular não custa nada (Blueprint §8).
- **G3** O check-in de **um toque continua sendo de um toque**.
- **G4** O vocabulário é **fechado e estável**, para a série histórica significar a mesma coisa em
  janeiro e em junho.

## 3. Non-Goals

- **NG1** ⛔ **Nenhum diagnóstico e nenhuma condição de pele.** *"Você marcou frizz"* é relato dela;
  *"seu cabelo está danificado"* seria alegação capilar (D-26/D-70).
- **NG2** ⛔ **O couro cabeludo NÃO entra nesta fatia.** A lista do Blueprint para couro inclui
  *sensível · coçando · descamando*, e a fronteira entre isso e sintoma clínico é fina — é a **OQ2 da
  SPEC-025**, atrás de **duas** chaves que não são do agente: base legal LGPD (**D-32**) e sign-off de
  domínio (**D-26**). O que já existe de couro (`scalp_feel`, SPEC-025) fica onde está.
- **NG3** ⛔ **Nenhum texto livre** — recusado na SPEC-024 porque não se compara nem se agrega, e
  porque é PII sem consumidor (DATA-MODEL §4).
- **NG4** ⛔ **Nenhuma tendência, nenhuma interpretação, nenhuma agregação nesta fatia.** Registro
  primeiro; consumir é a fatia seguinte, como o `F38` fez (SPEC-048 → SPEC-047 §14).
- **NG5** ⛔ **O check-in não vira formulário.** *"O check-in vale porque é barato"* (Blueprint §8).
- **NG6** ⛔ Nenhuma penalidade, nenhuma cobrança, nenhum "complete seu registro".

## 4. O vocabulário — e de onde ele vem

**Do Blueprint §8, escrito pelo dono**, na metade **cabelo**:

| valor | rótulo na tela |
|---|---|
| `softness` | Maciez |
| `shine` | Brilho |
| `frizz` | Frizz |
| `definition` | Definição |
| `dryness` | Ressecamento |

**Entra como `candidate`**, pelo mesmo motivo do `F38`: é vocabulário capilar, e sair de `candidate`
é decisão de revisor de domínio (D-26/OQ-REL). **PUBLIC RELEASE bloqueado** até lá.

### ⚠️ A pergunta é "o que você notou", e a escolha é deliberada

A tela pergunta **"O que você notou?"** e ela marca o que se destacou. Duas alternativas foram
consideradas e recusadas:

| alternativa | por que não |
|---|---|
| cada qualidade com **direção** (`maciez boa` / `maciez ruim`) | dobra o vocabulário e os toques, e transforma o check-in barato num formulário (NG5) |
| **dois baldes** (*"o que ficou bom"* / *"o que incomodou"*) | exigiria **eu** decidir que frizz é ruim e maciez é boa — uma classificação de valor que a lista plana do Blueprint não faz |

⚠️ **O risco que fica registrado:** a lista mistura qualidades de sinal oposto (`softness` puxa para
um lado, `frizz` para outro). Na prática ninguém marca *"frizz"* querendo dizer *"sem frizz"* — as
palavras carregam o próprio sinal em português —, e a nota de 1 a 5 continua carregando a valência
geral. **Mas isso importa para quem consumir**: uma agregação ingênua diria *"frizz esteve em 4 dos 5
cuidados que você avaliou bem"*, que é verdade e soa estranho. **A fatia de consumo terá de tratar o
sinal**, e é por isso que ela é outra fatia. Registrado como **OQ2**.

🔒 **Mudar o vocabulário depois quebra a série histórica** (Blueprint §8). É a razão de a decisão de
congelá-lo ser do dono, e de esta SPEC parar exatamente antes da migration.

## 5. Functional Requirements

- **FR1** Depois de responder *"Como ficou?"*, a Hoje **oferece** marcar o que ela notou.
- **FR2** Seleção **múltipla**: tocar marca, tocar de novo desmarca.
- **FR3** Cada marcação é **uma escrita própria** — sem botão de salvar (o padrão da SPEC-024).
- **FR4** As marcações **sobrevivem ao reload** e aparecem no histórico da Hoje.
- **FR5** Sem check-in respondido, **a pergunta não existe** — não há a que ancorar.
- **FR6** Nenhum rótulo, título ou estado vazio afirma nada sobre o cabelo dela.

## 6. Business Rules

- **BR1 — vocabulário fechado**, com `CHECK` no banco. Nenhum caminho de escrita aceita outra coisa.
- **BR2 — a marcação pendura no CHECK-IN**, não na execução: o assunto é o **resultado**, e o
  check-in é o registro do resultado. Um por execução (SPEC-006 BR1), então a âncora é única.
- **BR3 — ⚠️ `checkins` continua APPEND-ONLY.** A nota de 1 a 5 permanece imutável: ela é o fato
  âncora. As marcações são **junção**, e junção aceita `DELETE` — desmarcar é ela corrigindo o que
  marcou, não apagando histórico. É exatamente a divisão que a SPEC-025 já fez entre o check-in
  imutável e o couro no hub.
- **BR4 — posse validada nas DUAS pontas**: a policy olha o dono da linha, e a **FK composta** olha o
  dono do check-in. Sem a segunda, um cliente adulterado penduraria a própria marcação no check-in
  alheio — invisível para todos e contável por `P8`.
- **BR5 — sem `DEFAULT` e sem linha implícita.** Ausência é *"ela não disse"*, e isso não é uma
  resposta (a lição do `F35` e do `F38`).
- **BR6 — nada muda no `submit_checkin`.** Marcar depois é o que mantém o check-in em um toque (G3);
  passar as marcações como parâmetro faria a pergunta virar formulário.

## 7. Data Model Impact

**Uma tabela nova e um índice único novo em `checkins`.**

- `checkin_marks (checkin_id, mark, user_id, created_at)`, PK `(checkin_id, mark)`, `CHECK` fechado
  nos cinco valores, FK composta `(checkin_id, user_id) → checkins (id, user_id)`.
- `checkins` ganha `unique (id, user_id)` — **aditivo**, só para a FK composta poder existir. É a
  mesma construção que `care_executions` já tem e que `checkins` já usa como alvo.
- Grants: `select, insert, delete` para `authenticated`, RLS + FORCE, policies por `auth.uid()`.
  ⚠️ **Sem RPC**: a linha não guarda invariante de servidor — nem dia civil, nem idempotência de
  transação. É o mesmo raciocínio do `F26`/`F25`.

## 8. Edge Cases

- **EC1** Sem check-in: a pergunta não aparece (FR5).
- **EC2** Duplo toque: `PK (checkin_id, mark)` — a segunda inserção é violação de unicidade, não uma
  segunda linha. A tela reverte a marcação que falhou e diz **qual** foi (o padrão da SPEC-024 §16).
- **EC3** Execução anulada: `checkins` cai por cascade, e as marcações caem com ele.
- **EC4** Marcar e desmarcar rápido: mesma fila por marcação, como os chips do Wash Day.
- **EC5** Cliente adulterado: `42501` para `user_id` forjado, `23503` para check-in alheio.

## 9. Acceptance Criteria

- **AC1** No DEV real a 390px: responder o check-in → marcar → reload → persistido → desmarcar.
- **AC2** O check-in continua sendo **um toque** — barreira de teste de que `submit_checkin` não
  mudou de assinatura.
- **AC3** Nenhum rótulo afirma nada sobre o cabelo — barreira de teste.
- **AC4** Vocabulário fechado medido **contra o DEV real**, não só no CI.
- **AC5** Nenhum valor de couro cabeludo é aceito aqui — os dois vocabulários seguem disjuntos.

## 10. Evidência

- `pnpm verify` verde — core **391**, mobile **447**, e os nove checks. `check:remote-schema` →
  **23 tabelas**.
- **Probe contra o DEV real** (anon key + JWT dela + RLS), **23/23**: os cinco valores entram;
  `23514` para texto livre, para `itching`/`flaking`/`sensitive` (**sintoma não entra**), para o
  vocabulário do couro (`oily_quickly`), para técnica (`diffuser`), para finalização (`plopping`) e
  para os escapes `other`/`unknown`; duplo toque → **`23505`**, e duas em paralelo deixam **uma**
  linha; `user_id` forjado → **`42501`** (policy); check-in alheio → **`23503`** (FK composta);
  `DELETE` da marcação → **204**; e ⚠️ **`checkins` continua append-only**, medido: `UPDATE` da nota
  → **`42501`**, `DELETE` → **`42501`**.
- **Jornada a 390px no DEV real, zero problema de console:** sem check-in a oferta **não existe**
  (FR5) → responder a nota (**um toque**) → a oferta aparece → marcar duas → reload → persistidas →
  desmarcar uma → reload → só aquela saiu.

### ⚠️ O guardrail pegou uma omissão minha

A primeira PR **reprovou no pgTAP**, e no lugar certo: `tests.grants_allowlist` não conhecia
`checkin_marks`, então **todo** teste de *"no unapproved grants"* falhou — não só o desta SPEC.

⚠️ **A allowlist não é burocracia: é onde um grant é DECLARADO e JUSTIFICADO.** Tabela nova com
grant novo que não passa por ela é privilégio existindo em silêncio, que é exatamente o que o
guardrail impede. Declarada com a justificativa de cada privilégio — e **sem `UPDATE`**: uma
marcação não muda de valor, ela existe ou não existe; conceder `UPDATE` permitiria reescrever
`mark` numa linha existente, que é apagar-e-criar sem passar pelo `DELETE` que a policy audita.

### ⚠️ Um achado de MEDIÇÃO, não do produto: `aria-checked` não existe no preview web

Ao tentar aferir o estado dos chips, a validação mediu **zero elementos com `aria-checked` na página
inteira** — inclusive os chips `radio` já validados na SPEC-042 e na SPEC-048. O `role` chega
(`checkbox`: 5, `radio`: 10), o **estado não**: o `react-native-web` 0.21 descarta o
`accessibilityState` legado, que é a API que o `Chip` usa.

⚠️ **Isto não é defeito do produto:** `accessibilityState` é a API suportada no iOS/Android, e **web
não é plataforma de produto** (D-80). ⚠️ **Mas também não está medido no nativo** — e não pode
estar, enquanto o development build seguir DEFERRED por constraint do dono.

**Consequência prática, e ela vale para toda validação futura:** a 390px o estado de um chip
**não pode ser aferido por ARIA**; afere-se pelo canal que ela realmente vê — o rótulo do chip
marcado é escrito em ameixa (`accent`). Está na mesma família de `toDataURL` e da folha do SO
(SPEC-044): coisas que o preview web não prova.

⛔ **Não corrigido de propósito.** São **nove** usos de `accessibilityState` (incluindo a `TabBar` da
SPEC-035), então consertar só o `Chip` deixaria o app inconsistente; e o alvo do conserto seria o
ambiente de validação, não o produto. Fica registrado como **OQ4**, fora do escopo desta SPEC.

## 11. Open Questions

- **OQ1 (RESOLVIDA)** ✅ **O dono aprovou o vocabulário V1 em 2026-09-05** — maciez · brilho ·
  frizz · definição · ressecamento — e aplicou a migration, que é o ato que o congela. Sair de
  `candidate` continua sendo do revisor de domínio (D-26/OQ-REL).
- ~~**OQ1 🔒 (do dono)** **Congelar os cinco valores.**~~ Mudar depois quebra a série histórica. A lista
  é a do Blueprint §8; esta SPEC não a inventa, mas também não a congela sozinha — o ato de congelar
  é **aplicar a migration**.
- **OQ2 (RESOLVIDA)** ✅ **O sinal deixou de ser problema porque o denominador mudou.** A SPEC-047
  §16 conta a marca sobre **todos** os cuidados avaliados, não sobre o subconjunto bem avaliado — a
  marca *é* o resultado, e contá-la dentro de outro resultado é que produzia a frase estranha.
- ~~**OQ2** **O sinal das marcações**, para quem consumir (§4).~~ Uma agregação ingênua diria *"frizz
  esteve em 4 dos 5 cuidados que você avaliou bem"*. A fatia de consumo terá de resolver isso.
- **OQ3 (bloqueada)** A metade **couro** do Blueprint §8 — **D-32** + **D-26**, SPEC-025 OQ2.
- **OQ4** `accessibilityState` não chega ao DOM no `react-native-web` 0.21 (§10). Nove usos no app.
  Trocar para as props `aria-*` (suportadas no RN 0.71+ e no web) é pequeno, mas é mudança
  transversal de primitivo e não pertence a esta SPEC.
