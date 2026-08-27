# SPEC-004 — Domain Rules V1 (CANDIDATE)

| Campo | Valor |
|---|---|
| Status | **V1 CANDIDATE** (decisão humana de produto 2026-08-27 — D-67). **Cosmetic product heuristics — NÃO** diagnóstico médico/dermatológico. |
| validation_status | **candidate** — implementável em **dev/internal beta**; **PUBLIC RELEASE** exige `validated` (domain reviewer sign-off) — D-26 (esclarecido em D-67) / ADR-007 A1. |
| Inputs autoritativos | os 8 campos da SPEC-002 apenas. Termo de produto: **"Avaliação capilar"**. |

> Estas regras são **heurísticas de produto**, não fatos científicos. Não apresentar `nutrition` como alimentação biológica do fio, `reconstruction` como reparo permanente, nem nenhum care type como tratamento médico.

---

## 1. Care types — approved for V1
| code | UX (pt-BR) | Definição operacional (cosmética) | NÃO é |
|---|---|---|---|
| `hydration` | Hidratação | cuidado condicionante focado em maciez, desembaraço e manejo de ressecamento | reparo médico |
| `nutrition` | Nutrição | cuidado condicionante de perfil lipídico/óleos: lubrificação, maleabilidade, frizz | alimentação biológica do fio |
| `reconstruction` | Reconstrução | cuidado com proteínas/aminoácidos hidrolisados: condicionamento/fortalecimento **temporário** cosmético | reparo permanente / tratamento de doença |

## 2. Minimal AssessmentOutput (V1)
`AssessmentOutput = { emphasis: 'hydration' | 'nutrition' | 'balanced'; includeReconstruction: boolean; evidenceCodes: string[] }`.
- `evidenceCodes` = só códigos de decisões realmente tomadas (§11).
- **REMOVE:** levels, score, confidence, percentages, severity, passthrough do HairProfile.

## 3. Emphasis rules (ordem determinística)
**Prioridade 1 — `primary_goal`:**
| primary_goal | emphasis | evidence |
|---|---|---|
| softness_and_hydration | hydration | goal_hydration |
| definition_and_frizz_control | nutrition | goal_frizz_definition |
| reduce_breakage_and_strengthen | hydration | goal_breakage_strength |
| recover_chemical_or_heat_damage | hydration | goal_damage_recovery |
| maintain_healthy_hair | (continua avaliação ↓) | — |

**Prioridade 2 — `current_concerns`** (se goal não decidiu):
- contém `dryness` OR `tangling` OR `dullness` OR `breakage` → **hydration** (evidence: concern_dryness/concern_tangling/concern_dullness/concern_breakage conforme presentes)
- senão contém `frizz` → **nutrition** (concern_frizz)

**Prioridade 3 — `hair_pattern`** (se ainda não decidiu):
- `curly` OR `coily` OR `transitioning_or_mixed` → **hydration** (textured_hair_moisture_support)
- senão → **balanced** (balanced_default)

Não usar `strand_thickness` nem `scalp_tendency` para alterar H/N/R na V1. Nem todo input altera o Schedule (por design).

## 4. Reconstruction rule
- `CHEMICAL = chemical_treatments.length > 0`
- `HIGH_HEAT = heat_usage ∈ {three_to_four_weekly, almost_daily}`
- `DAMAGE = current_concerns contém breakage OR primary_goal ∈ {reduce_breakage_and_strengthen, recover_chemical_or_heat_damage}`
- `includeReconstruction = true` **somente** se ≥ 2 de {CHEMICAL, HIGH_HEAT, DAMAGE}; senão `false`. (Conservadora.)
- evidence: chemical_exposure / frequent_heat / (goal_breakage_strength|goal_damage_recovery|concern_breakage) conforme as categorias presentes.

## 5. Care sessions / week (do cronograma — NÃO recomenda lavagem)
| wash_frequency | sessions/week |
|---|---|
| once_or_less_weekly | 1 |
| twice_weekly | 2 |
| three_to_four_weekly | 3 |
| five_or_more_weekly | 3 |
| varies | 2 |
evidence: wash_frequency_baseline.

## 6. Plan window
**28 dias / 4 semanas.**

## 7. Base care cycle
- emphasis=hydration: `H → N → H → …`
- emphasis=nutrition: `N → H → N → …`
- emphasis=balanced: `H → N → …`

## 8. Reconstruction placement
Quando `includeReconstruction=true`: **máx. 1 R** na janela de 28 dias; substituir o **primeiro** care programado em/ após o **dia 14** por `R`. Sem frequência maior na V1.

## 9. Date distribution (DATE determinístico; `starts_on` = 1ª sessão)
- 1/week offsets (dias): `0, 7, 14, 21`
- 2/week offsets: `0, 4, 7, 11, 14, 18, 21, 25`
- 3/week offsets: `0, 2, 5, 7, 9, 12, 14, 16, 19, 21, 23, 26`

## 10. Unknown / varies policy
**UNKNOWN NEVER ESCALATES CARE INTENSITY.**
- `hair_pattern=unknown` → sem efeito · `strand_thickness=unknown` → sem efeito · `scalp_tendency=unknown` → sem efeito (não usados na V1 de qualquer forma).
- `wash_frequency=varies` → 2/week.
- `chemical_treatments=[]` → sem CHEMICAL.
- `current_concerns=[no_major_concern]` → sem sinal de concern.
- Nenhuma regra gera direção suficiente → `emphasis=balanced`, `includeReconstruction=false`.

## 11. Evidence codes (só os disparados por regra real; sem copy pt-BR no core)
`goal_hydration` · `goal_frizz_definition` · `goal_breakage_strength` · `goal_damage_recovery` · `concern_dryness` · `concern_tangling` · `concern_dullness` · `concern_frizz` · `concern_breakage` · `chemical_exposure` · `frequent_heat` · `textured_hair_moisture_support` · `wash_frequency_baseline` · `balanced_default`. Cada code é emitido apenas quando o ramo da regra correspondente dispara; remover qualquer code sem consumidor/decisão real.

## 12. Safety
SPEC-004 é estritamente cosmética. Os 8 inputs não têm sintomas médicos → **não** criar sistema de red-flag/diagnóstico não utilizado nesta SPEC. Nunca produzir diagnóstico de couro/alopecia, tratamento de doença ou promessa médica. Free-text/AI futuro terá safety boundary própria.

## 13. Validation register (D-26 / ADR-007 A1)
Todas as regras abaixo nascem `candidate` (decisão humana de produto D-67); **PUBLIC RELEASE exige `validated`** por domain reviewer.
| rule_id | rationale/source | reviewer (domain) | validation_status | version |
|---|---|---|---|---|
| `assess.emphasis_by_goal` | D-67 (human product decision) — §3 P1 | _(pendente)_ | **candidate** | v1 |
| `assess.emphasis_by_concern` | D-67 — §3 P2 | _(pendente)_ | **candidate** | v1 |
| `assess.emphasis_by_pattern` | D-67 — §3 P3 | _(pendente)_ | **candidate** | v1 |
| `assess.include_reconstruction_2of3` | D-67 — §4 (conservadora) | _(pendente)_ | **candidate** | v1 |
| `schedule.sessions_per_week` | D-67 — §5 | _(pendente)_ | **candidate** | v1 |
| `schedule.plan_window_28d` | D-67 — §6 | _(pendente)_ | **candidate** | v1 |
| `schedule.base_cycle` | D-67 — §7 | _(pendente)_ | **candidate** | v1 |
| `schedule.reconstruction_placement` | D-67 — §8 | _(pendente)_ | **candidate** | v1 |
| `schedule.date_offsets` | D-67 — §9 | _(pendente)_ | **candidate** | v1 |
| `assess.unknown_no_escalation` | D-67 — §10 | _(pendente)_ | **candidate** | v1 |

Build/teste de **produção pública** deve falhar se referenciar regra não `validated` (ADR-007 A1).

---

V1 CANDIDATE RULES — implementable in dev/internal beta; PUBLIC RELEASE gated on domain validation (D-26/D-67).
