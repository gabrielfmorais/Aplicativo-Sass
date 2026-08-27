# SPEC-004 — Domain Rules Worksheet (para preenchimento/aprovação humana)

| Campo | Valor |
|---|---|
| Status | **WORKSHEET — aguardando design de regra humano/especialista** (D-26 / ADR-007 A1). Nada aqui é regra validada. |
| Relacionados | SPEC-004 §13, ADR-007 (A1/A2), SPEC-002 §6 (inputs), DATA-MODEL §3.9, MVP-ROADMAP F4 |
| Regra | Engenharia **não** preenche comportamento capilar. Toda célula de comportamento = `TBD — HUMAN/DOMAIN VALIDATION`. Só `validation_status = validated` entra em produção. |

> **Inputs autoritativos (únicos):** os 8 campos da SPEC-002 — `hair_pattern`, `strand_thickness`, `scalp_tendency`, `wash_frequency`, `chemical_treatments`, `heat_usage`, `current_concerns`, `primary_goal`. Nenhum outro dado entra sem nova SPEC. Termo de produto: **"Avaliação capilar"** (cosmético, não médico).

---

## 1. Candidate care types
Candidatos vindos dos docs existentes (DATA-MODEL §3.9; ciclo "H/N/R" em MVP-ROADMAP F4). **Não** são regra científica; carecem de aprovação.

| code | Nome UX (pt-BR) | Propósito de produto | O que **NÃO** significa | Status |
|---|---|---|---|---|
| `hydration` | Hidratação | passo de cuidado cosmético (rótulo de agenda) | não é tratamento médico; não repõe nada "clinicamente" | **CANDIDATE** |
| `nutrition` | Nutrição | passo de cuidado cosmético | idem | **CANDIDATE** |
| `reconstruction` | Reconstrução | passo de cuidado cosmético | idem | **CANDIDATE** |
| _(outro?)_ | _TBD_ | _só se houver requisito de produto concreto_ | — | **TBD** |

**Decisões humanas:** confirmar/renomear o conjunto; aprovar `code`s finais; decidir se há outros (ex.: limpeza/finalização) — **sem inventar**.

## 2. Assessment outputs requiring decisions
Estrutura **mínima** para o Schedule decidir. Proibido: `confidence`, score, porcentagem, severidade arbitrária.

| Output candidato | Decisão do Schedule que habilita | Por que não é derivável direto do perfil | Status |
|---|---|---|---|
| "necessidade" por care type (ex.: precisa de hidratação? nível?) | escolher mix/ênfase dos cuidados | requer mapear características → necessidade (conhecimento capilar) | **TBD — HUMAN** |
| flag "cabelo quimicamente tratado" | possível ênfase de reconstrução/cautela | está perto do observado (`chemical_treatments`) → talvez **não** agregue decisão além da necessidade | **TBD — decidir se agrega** |
| flag "alto uso de calor" | possível ênfase | idem `heat_usage` observado | **TBD — decidir se agrega** |
| reason codes (§6) | explicar o "porquê" na tela | derivado da regra que disparou | **TBD — só se houver tela e regra** |

**Decisão humana:** qual é o `AssessmentOutput` mínimo (provável: um conjunto de "necessidades" por care type) — **sem** níveis/pesos até validação.

## 3. Input → rule matrix
Valores de cada input são factuais (SPEC-002). **Efeitos no schedule = TBD.** Não preencher "se X então Y".

### `hair_pattern` (straight · wavy · curly · coily · transitioning_or_mixed · unknown)
| Input value | Possible effect on schedule | Evidence/rationale required? | Rule status |
|---|---|---|---|
| straight / wavy / curly / coily / transitioning_or_mixed / unknown | _(por valor)_ | Sim | **TBD — HUMAN/DOMAIN VALIDATION** |

### `strand_thickness` (fine · medium · coarse · unknown)
| Input value | Possible effect | Evidence required? | Rule status |
|---|---|---|---|
| fine / medium / coarse / unknown | — | Sim | **TBD — HUMAN/DOMAIN VALIDATION** |

### `scalp_tendency` (oily_quickly · balanced · dry_tendency · unknown)
| Input value | Possible effect | Evidence required? | Rule status |
|---|---|---|---|
| oily_quickly / balanced / dry_tendency / unknown | — | Sim | **TBD — HUMAN/DOMAIN VALIDATION** |

### `wash_frequency` (once_or_less_weekly · twice_weekly · three_to_four_weekly · five_or_more_weekly · varies)
| Input value | Possible effect | Evidence required? | Rule status |
|---|---|---|---|
| (cada faixa) / varies | — (provável base para nº de cuidados/semana) | Sim | **TBD — HUMAN/DOMAIN VALIDATION** |

### `chemical_treatments` (coloring · bleaching_or_highlights · straightening_relaxing_or_progressive · perm_or_chemical_texturizing · [] = nenhuma)
| Input value | Possible effect | Evidence required? | Rule status |
|---|---|---|---|
| cada química / combinação / nenhuma | — | Sim | **TBD — HUMAN/DOMAIN VALIDATION** |

### `heat_usage` (almost_never · one_to_two_weekly · three_to_four_weekly · almost_daily)
| Input value | Possible effect | Evidence required? | Rule status |
|---|---|---|---|
| cada faixa | — | Sim | **TBD — HUMAN/DOMAIN VALIDATION** |

### `current_concerns` (dryness · breakage · tangling · dullness · frizz · no_major_concern)
| Input value | Possible effect | Evidence required? | Rule status |
|---|---|---|---|
| cada queixa / no_major_concern | — | Sim | **TBD — HUMAN/DOMAIN VALIDATION** |

### `primary_goal` (softness_and_hydration · reduce_breakage_and_strengthen · recover_chemical_or_heat_damage · definition_and_frizz_control · maintain_healthy_hair)
| Input value | Possible effect | Evidence required? | Rule status |
|---|---|---|---|
| cada objetivo | — (provável peso na priorização) | Sim | **TBD — HUMAN/DOMAIN VALIDATION** |

## 4. Cadence decisions required
Slots explícitos para decisão humana (nenhum número preenchido):
- Nº de cuidados por semana: **TBD** (função de `wash_frequency`?).
- Proporção/mix entre care types: **TBD**.
- Intervalo mínimo entre certos care types (ex.: espaçar reconstruções): **TBD**.
- Comportamento quando há química (`chemical_treatments ≠ []`): **TBD**.
- Comportamento com alto uso de calor (`heat_usage` alto): **TBD**.
- Comportamento para `unknown`/`varies`: **TBD** (default conservador — §6 abaixo).
- Limites conservadores (mínimo/máximo por semana; teto de intensidade): **TBD**.

## 5. Plan-window options
Comparação **de produto** (sem escolher ciência):
| Janela | Benefício de produto | Custo de produto | Status |
|---|---|---|---|
| **2 semanas** | menos compromisso percebido; re-engajamento mais frequente; regenera cedo se o hábito mudar | mais regenerações/lembretes; menos "visão de longo prazo" | opção |
| **4 semanas** | senso de plano/rotina; menos regenerações | maior chance de o plano "envelhecer" antes de refazer | opção |
| outra | só com requisito concreto | — | **TBD** |

**Decisão humana:** escolher a janela (ou regra de extensão). Sem impacto em ciência capilar — é decisão de produto/UX.

## 6. Unknown/varies policy
- Toda dimensão aceita `unknown`; `wash_frequency` aceita `varies` (SPEC-002).
- Política de engine: **nunca erro**; cair em **default conservador** — **qual default? TBD — HUMAN/DOMAIN VALIDATION**.
- Regra: não penalizar/assumir dano sem evidência declarada.

## 7. Explainability decisions
Estrutura mínima **se** a tela mostrar "Por que este cronograma?":
- `evidence: { reasonCode }[]` — identificadores **estáveis**, um por regra aprovada.
- **Não** criar reason codes sem uma regra correspondente aprovada; **não** escrever copy final (a copy pt-BR é da camada de UI/conteúdo).
- Lista de reason codes: **TBD — depende das regras aprovadas (§3/§4)**.

## 8. Safety boundary (cosmético, não médico)
O engine é **cosmético**; não diagnostica couro cabeludo nem doença. Os 8 inputs atuais são todos cosméticos (não coletam sintoma médico). Categorias de **relato** que, se um dia forem coletadas/relatadas, devem ficar **FORA** do engine e **orientar procurar profissional** (dermatologista/tricologista) — **sem** o app diagnosticar ou tratar:
- Queda de cabelo súbita/acentuada ou falhas.
- Feridas, sangramento, crostas, pus no couro.
- Dor, ardência intensa ou coceira persistente.
- Descamação severa/persistente; sinais de infecção.
- Reação alérgica a produto.
**Decisão humana:** aprovar esta fronteira e a mensagem de encaminhamento (copy = UI/conteúdo). Nada disso vira regra diagnóstica.

## 9. Rules requiring external/domain validation (Validation Register)
Toda regra futura (assessment e schedule) preenche este registro (ADR-007 A1). Nenhuma entrada ainda.
| rule_id | rationale/source | reviewer (domain validator) | validation_status | version |
|---|---|---|---|---|
| _(ex.: `assess.hydration_need`)_ | _(fonte/racional)_ | _(especialista)_ | `draft` → `awaiting_domain_review` → `validated` | `v1` |
| _(a preencher)_ | — | — | **draft** | — |

Só `validation_status = validated` compõe a versão de produção; build/teste falha se produção referenciar regra não validada.

## 10. Exact decisions needed from human
1. **Care types**: confirmar o conjunto e os `code`s (§1).
2. **AssessmentOutput mínimo**: quais "necessidades"/flags existem e o que cada uma habilita (§2) — sem níveis/pesos até validado.
3. **Regras `input → efeito`** para os 8 inputs (§3), incl. combinações relevantes.
4. **Cadência** (§4): nº/semana, mix, intervalos, comportamento com química/calor, limites conservadores.
5. **`unknown`/`varies` default** (§6).
6. **Janela do plano** (§5) — decisão de produto.
7. **Reason codes** (§7) — só os atrelados a regras aprovadas.
8. **Fronteira de segurança** e mensagem de encaminhamento (§8).
9. Para cada regra: `rule_id` + `rationale/source` + `reviewer` + `validation_status` + `version` (§9).

---

DOMAIN WORKSHEET READY FOR HUMAN RULE DESIGN
