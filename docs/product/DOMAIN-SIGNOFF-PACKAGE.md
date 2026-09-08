# Pacote de sign-off de domínio (D-26 / D-70) — para revisão profissional capilar

**Para quem:** um(a) profissional de cuidados capilares (revisor de domínio).
**Por quê:** a engenharia projeta os mecanismos, mas **não inventa regra capilar de produção** (D-26). Todo item abaixo está implementado e utilizável em **dev / beta interno** como `candidate`; nenhum vai para **PUBLIC RELEASE** até ser marcado `validated` por esta revisão (D-26 / D-70 / OQ-REL).
**Como responder:** para cada item, uma de três decisões — **`validated`** (aprovado como está), **`needs change`** (aprovado com as correções anotadas) ou **`rejected`** (não usar). O que não for validado permanece bloqueado para release, sem travar o resto do produto.

> Nada aqui é diagnóstico dermatológico nem promessa clínica. São heurísticas cosméticas e procedimentais. Sintoma clínico de couro é um item à parte, e depende **também** de base legal (D-32) — ver §5.

Atualizado: 2026-09-08.

---

## 1. Regras de frequência do cronograma (o núcleo do produto)

**Onde:** `packages/core/src/schedule/engine/v1` e `.../v2` (`SCHEDULE_RULES_V1/V2`). **Estado:** `candidate`. A v2 é a versão **corrente em dev/beta** (autorizada pelo dono); a v1 é imutável e histórica.

**O que a engenharia decidiu como hipótese, e precisa de validação:**
- Os quatro tipos de cuidado — **Hidratação, Nutrição, Reconstrução, Restauração** — e a ideia de distribuir as vagas do ciclo de 28 dias por "necessidade" do perfil.
- **Reconstrução** é acionada por 2 de 3 sinais {tratamento químico · calor alto · dano percebido}. Perfil sem sinal recebe **zero** reconstruções; com todos, recebe duas + restauração.
- Cadência (4, 8 ou 12 cuidados no ciclo) derivada da **frequência de lavagem**.
- A ênfase (proporção entre tipos) vem de `primary_goal → current_concerns → hair_pattern`.

**Decisões de domínio pendentes, específicas:**
1. As frequências e o gatilho de reconstrução acima são orientação capilar sólida? (V1 e V2.)
2. **Quatro das dez perguntas do onboarding não influenciam o plano hoje:** `perceived_porosity` e `routine_availability` são recusa deliberada da engenharia (traduzir porosidade em frequência, ou dizer "este cuidado cabe no seu tempo", seria recomendação capilar); `strand_thickness` e `scalp_tendency` simplesmente **não têm regra** que as use. **Deveriam influenciar?** Se sim, como? (Escrever essa regra é exatamente o que a D-26 reserva para esta revisão.)

**O que validar isto desbloqueia:** o **PUBLIC RELEASE do cronograma** (é o coração do produto); a capability **P4 (cronograma adaptativo)**; e afirmações causais em "Por que este cronograma?".

---

## 2. Conteúdo dos guias de cuidado (SPEC-007)

**Onde:** `packages/core/src/content/v1/guides.ts`. **Estado:** `candidate` (D-70).

**O que é:** o texto procedimental de "como fazer" cada cuidado — sem marca, sem produto comercial, sem dosagem química, sem promessa de resultado; o tempo de pausa sempre remete à embalagem do produto da usuária.

**Decisão de domínio pendente:** o texto de cada guia é orientação capilar correta e segura?

**O que desbloqueia:** o **PUBLIC RELEASE dos guias** (hoje liberados só em dev/beta).

---

## 3. Finalizações — a parte de recomendação e "como fazer" (F38)

**Onde:** vocabulário em `packages/core/src/care-tracking/domain/wash-day.ts` (`FINISH_TECHNIQUES`); área em `apps/mobile/src/features/care/FinishesScreen.tsx` (SPEC-056).

**Já liberado sem depender desta revisão (é só registro/descoberta):** a lista das seis finalizações nomeadas (`fitagem_tradicional`, `fitagem_estruturada`, `dedoliss`, `rake_and_shake`, `plopping`, `twist_out`) e a contagem de quantas vezes a usuária registrou cada uma. O vocabulário já foi aprovado pelo dono para **registro**.

**O que precisa desta revisão para existir:**
1. **"Recomendadas para você"** — quais finalizações combinam com quais perfis/curvaturas.
2. **"Como fazer"** passo a passo substantivo de cada finalização.
3. Apresentação/descrição e efeitos de cada uma.
4. `day_after` (revitalização) — hoje deliberadamente fora, com teste que o recusa.

**O que desbloqueia:** o resto do **F38** (a área de descoberta e aprendizado além do shell); e a atribuição de finalização a resultado como conselho (parte de P8/P14).

---

## 4. Marcas de check-in — atribuição (F35 / P13 / P14)

**Onde:** vocabulário `checkin_marks` (SPEC-051): **maciez · brilho · frizz · definição · ressecamento**. **Estado:** `candidate` (aprovado pelo dono para coleta em 2026-09-05).

**Já liberado (é só a usuária relendo a si mesma):** *"Frizz — você notou em 4 dos 6 cuidados que você avaliou"* — co-ocorrência, sem atribuição a nenhuma entrada.

**O que precisa desta revisão:**
1. Sair de `candidate` → `validated` para o vocabulário em si (release público das marcas).
2. **A atribuição marca → entrada** — *"nos cuidados em que você usou a Máscara X, você notou maciez em 4 de 5"* (SPEC-047 OQ5). Aqui a co-ocorrência tem **nome de propriedade capilar**, e a distância entre "apareceu junto" e "causou" colapsa. É a alegação mais valiosa do Premium e a que mais precisa de julgamento profissional.

**O que desbloqueia:** **PUBLIC RELEASE** com as marcas; **P14 (insights de cabelo)**; e é um pré-requisito da promessa central "o que funciona comigo".

---

## 5. Couro cabeludo — sintomas clínicos (P13 metade `couro` / P15)

**Onde:** recusado hoje no banco (`itching`, `flaking`, `sensitive` → CHECK). **Gate duplo:** D-26 **e** D-32 (base legal LGPD para dado de saúde — a tabela `consents` não existe).

**O que precisa desta revisão (a parte D-26):** é apropriado e seguro coletar *sensível · coçando · descamando*? Onde fica a fronteira com o clínico/dermatológico que o produto **não** pode cruzar?

**O que desbloqueia:** **P13 (metade couro)** e **P15 (insights de couro)** — mas só depois de a base legal (D-32) também existir.

---

## Resumo — o que cada sign-off libera

| Item | Estado | Libera |
|---|---|---|
| 1. Regras de frequência (v1/v2) | `candidate` | PUBLIC RELEASE do cronograma; P4 |
| 2. Guias de cuidado | `candidate` | PUBLIC RELEASE dos guias |
| 3. Finalizações — recomendação/como-fazer | bloqueado | resto do F38 |
| 4. Marcas + atribuição | `candidate` | PUBLIC RELEASE das marcas; P14; "o que funciona comigo" |
| 5. Sintomas de couro | bloqueado (D-26 + D-32) | P13 couro; P15 |

**PUBLIC RELEASE do app depende de 1, 2 e 4.** Os itens 3 e 5 ampliam o valor, mas não bloqueiam o release do core.
