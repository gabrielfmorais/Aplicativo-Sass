# MASTER PRODUCT BACKLOG — a fonte oficial das capabilities COMMITTED

| Campo | Valor |
|---|---|
| Autoridade | **Decisão humana do dono (D-92, 2026-08-31).** Este documento é escopo aprovado, não brainstorm. |
| Fonte de verdade para | O que o produto **vai** ter. Não para *quando* — a ordem é decidida pelo agente (§0.3). |
| Atualizado | 2026-08-31 |

> 📖 **O que cada capability significa** está em [`MASTER-PRODUCT-BLUEPRINT.md`](MASTER-PRODUCT-BLUEPRINT.md) (D-94). Este documento guarda **estado**; o Blueprint guarda **intenção funcional** — objetivo, fluxo, regras, limites e o que a capability **não** pode fazer. Antes de escrever uma SPEC, ler os dois.

## 1. O que este documento é

Toda capability listada aqui é **COMMITTED**: faz parte oficialmente do produto e **será construída**. Não são ideias, sugestões nem possibilidades. A pergunta *"isso vai ser feito?"* já está respondida com **sim**; a pergunta em aberto é sempre *"qual é o melhor momento e a melhor forma de construir?"*.

Uma capability COMMITTED só sai daqui por três motivos:

1. evidência técnica posterior de que deve ser **substituída** por solução melhor;
2. decisão comercial/de produto **explícita do dono** que a remova;
3. impedimento **legal, de segurança ou de domain review**.

Fora disso, nada aqui expira, e nada aqui depende de o dono pedir de novo.

## 2. Estados

| Estado | Significado |
|---|---|
| **COMMITTED** | Aprovada. Ainda não começou. |
| **IN PROGRESS** | Fatia em andamento. |
| **DONE** | Entregue **e validada na jornada real** (regra de DONE, CLAUDE.md §0.1). |
| **BLOCKED** | Parada por gate externo (credencial, custo, domain review, decisão legal). |
| **DEFERRED BY DEPENDENCY** | **Vai ser construída**, mas depende de algo que ainda não existe. Nunca significa "talvez". |

⚠️ **"Future idea" não é um estado.** Se está aqui, é compromisso.

## 3. Sequenciamento — de quem é a decisão

O **dono** define a visão e as decisões materiais. O **agente** decide a ordem, as SPECs, as fatias, a arquitetura, quais dados precisam existir antes, e quando estabilizar em vez de empilhar mais uma camada.

Ao concluir uma fatia, o agente reavalia este backlog e escolhe a próxima capability de maior valor considerando: dependências · estabilidade · jornada da usuária · valor Free/Premium · dados disponíveis · risco · complexidade · custo · necessidade de domain review · maturidade da arquitetura.

### 3.1 Duas restrições de ordem que **não** são do agente

- 🔒 **O Assistente IA é obrigatoriamente a ÚLTIMA grande capability.** É COMMITTED, não é opcional, e **será** construída — depois de tudo o que a alimenta. **Até lá é proibido criar infraestrutura antecipada de IA:** sem embeddings, pgvector, RAG, agentes, chatbot, API de LLM, tabelas de chat, prompts de produção ou abstrações de LLM. *A IA será construída sobre o sistema; o sistema não será construído em torno da IA.*
- 🔒 **Community fica DEFERRED BY DEPENDENCY por bastante tempo** — depende de escala, moderação, segurança, privacidade e massa crítica. **Não sai do roadmap**, e não se constrói infraestrutura social prematuramente.

## 4. FREE — o app é realmente útil e completo no core (D-83)

Não há paywall na entrada. Nenhuma capability hoje gratuita pode virar premium (D-83/BR3).

| # | Capability | Estado | Onde está / do que depende |
|---|---|---|---|
| F1 | Conta | **DONE** | SPEC-001 (#3) |
| F2 | Perfil capilar | **DONE** | SPEC-002 (#6) |
| F3 | Onboarding | **DONE** | SPEC-002; refinado em SPEC-016 fatia 1 (#54) e em SPEC-018 (nome da usuária, ritmo, interstícios, revelação — #70/#72/#73) |
| F4 | Avaliação inicial | **DONE** | SPEC-004 (assessment dentro, D-66) |
| F5 | Cronograma personalizado H/N/R | **DONE** | SPEC-004 (#11) |
| F6 | Tela Hoje | **DONE** | SPEC-005 (#14); redesenhada em SPEC-016 fatia 2 (#55) |
| F7 | Cuidado do dia | **DONE** | SPEC-005 |
| F8 | Como fazer | **DONE** | SPEC-007 (#19) — conteúdo `candidate`, gate D-26 para release |
| F9 | Concluir cuidado | **DONE** | SPEC-005 |
| F10 | Reagendar | **DONE** | SPEC-005 (BR8, janela de 28 dias) |
| F11 | Pular | **DONE** | SPEC-005 |
| F12 | Desfazer | **DONE** | SPEC-005 (D-69/D-12, janela de 15 min) |
| F13 | Lembretes | **DONE** | SPEC-008 (#24) |
| F14 | Check-in de cabelo | **DONE** | SPEC-006 (#21) |
| F15 | Histórico | **DONE** | SPEC-005 (planejado ≠ executado, D-69) |
| F16 | Progresso | **DONE** | SPEC-009 (#26); redesenhado em SPEC-016 fatia 3 (#60) |
| F17 | Reavaliação | **DONE** | SPEC-014 (#28) |
| F18 | Novos ciclos | **DONE** | SPEC-014 + D-82 (#45) |
| F19 | Preservação do histórico | **DONE** | SPEC-014 FR7 (contagem vitalícia atravessa a substituição de plano) |
| F20 | Calendário / ciclo | **DONE** | Faixa da semana (SPEC-016 fatia 2, #55), preview agrupado por semana (#60) e a **visão de ciclo** (SPEC-019): as quatro semanas do plano ativo com o que aconteceu em cada uma, semana corrente marcada em palavra, sem SQL e sem contrato novo. Alimenta o F29. |
| F21 | **"Por que isso está no meu plano?"** | **DONE** | SPEC-017 (OQ1 = A, D-98): a evidência do plano ativo na Hoje, fechada por padrão, derivada do snapshot que **originou** o plano — nunca do perfil corrente. Sem schema novo. A seção se cala quando não puder ser reproduzida. |
| F22 | **Pausa do cronograma** | **BLOCKED** — SPEC-022 (Draft), OQ2 | Precisa de estado de plano novo + regra do que acontece com os cuidados na volta. **A regra da volta é decisão humana (§0.1):** move o cronograma dela e redefine o que "meu plano" significa depois de uma ausência. Free por decisão do dono — cobrar por parar é cobrar pela vida dela. |
| F23 | **"Meu cabelo mudou"** | **DONE** | SPEC-020: o Free registra o evento e o app **oferece** reavaliar — não interpreta, não aconselha, não diagnostica, e é essa contenção que o mantém fora do gate D-26. Validado no DEV real. | Registrar eventos (química, coloração, descoloração, corte, calor, praia/piscina, tranças, pausa, mudança percebida). No Free, **dispara reavaliação**. |
| F24 | **SOS básico** | **COMMITTED** | Depende de conteúdo com orientação capilar substantiva ⇒ **gate D-26/D-70**. |
| F25 | **Wash Day básico** | **COMMITTED** | Estrutural (§6). Free **registra**. **Depois do F26** (SPEC-023): o Wash Day é o hub e consome os produtos. |
| F26 | **Minha Prateleira** | **IN PROGRESS** — SPEC-023 (Draft) | Cadastro dos produtos que ela possui e usa. Base de F27, P6 e da Hair Intelligence. **Sequenciada antes do F25**: o Blueprint §9 diz que o Wash Day **consome** os produtos, e o hub desenhado sem o seu principal consumidor nasceria errado. |
| F27 | **Cadastro dos produtos utilizados** | **COMMITTED** | Liga produto ↔ cuidado/Wash Day. Depende de F26. |
| F28 | **Fotos básicas de evolução** | **COMMITTED** | Primeira capability com **mídia**: storage, privacidade, LGPD, custo. Dependência real de infraestrutura. |
| F29 | **Resumo de ciclo** | **DONE** | SPEC-021: na visão de ciclo, as contagens **do `Progress`** (reusadas, nunca recontadas) fecham o mês e levam à oferta do próximo. Sem percentual, nota ou comparação. Alimenta `P12` e `P16`. |
| F30 | **Recursos de segurança / orientação profissional** | **COMMITTED** | Quando procurar um profissional. **Gate D-26** por natureza. |
| F31 | **Check-in básico de couro cabeludo** | **COMMITTED** | Extensão do check-in (SPEC-006). Vocabulário de couro cabeludo pode exigir **domain review**. |

## 5. PREMIUM — um único plano pago

**Existe somente um plano pago: PREMIUM.** Mensal e anual têm **exatamente as mesmas funcionalidades**. Referência comercial do dono: **R$ 19,90/mês · R$ 149,90/ano · 7 dias de trial**. Preço e período **vêm da loja em runtime, nunca hard-coded** (D-83).

Premium vende personalização, inteligência e conveniência — **nunca** a remoção de algo que era gratuito (D-83/G7).

| # | Capability | Estado | Do que depende |
|---|---|---|---|
| P1 | Plan Customization | **DONE** | SPEC-015 (#42/#43/#44) — a primeira capability premium |
| P2 | **Hair Intelligence** | **COMMITTED** | §6. Depende de dados reais: F25, F26, F14/F31, F16, ciclos. **Determinística primeiro, sem IA.** |
| P3 | **"O que funciona comigo?"** | **DEFERRED BY DEPENDENCY** | Superfície de leitura da P2. Precisa de volume de registros. |
| P4 | **Cronograma adaptativo** | **DEFERRED BY DEPENDENCY** | Precisa de P2 **e** de regras capilares validadas (**D-26**) para qualquer adaptação substantiva. |
| P5 | **Wash Day avançado** | **DEFERRED BY DEPENDENCY** | Premium **interpreta** o que o Free registrou. Depende de F25. |
| P6 | **Smart Shelf** | **DEFERRED BY DEPENDENCY** | Depende de F26/F27 + histórico. |
| P7 | **Ranking pessoal de produtos** | **DEFERRED BY DEPENDENCY** | Depende de P6 + avaliações. |
| P8 | **Padrões produto × técnica × resultado** | **DEFERRED BY DEPENDENCY** | Depende de P6 + F25 + check-ins. |
| P9 | **Hair Progress avançado** | **DEFERRED BY DEPENDENCY** | Depende de F28. |
| P10 | **Timeline fotográfica** | **DEFERRED BY DEPENDENCY** | Depende de F28. |
| P11 | **Antes × Depois** | **DEFERRED BY DEPENDENCY** | Depende de F28/P10. |
| P12 | **Comparação entre ciclos** | **DEFERRED BY DEPENDENCY** | Depende de F29 + ≥2 ciclos reais. |
| P13 | **Check-ins avançados** | **COMMITTED** | Extensão de F14/F31. Vocabulário pode exigir **domain review**. |
| P14 | **Insights de cabelo** | **DEFERRED BY DEPENDENCY** | Saída da P2. |
| P15 | **Insights de couro cabeludo** | **DEFERRED BY DEPENDENCY** | Depende de F31/P13. **Risco de linguagem clínica — D-26.** |
| P16 | **Relatórios avançados** | **DEFERRED BY DEPENDENCY** | Depende de P2, F28, F29. |
| P17 | **Padrões de longo prazo** | **DEFERRED BY DEPENDENCY** | Precisa de meses de histórico. |
| P18 | **Recomendações personalizadas** | **DEFERRED BY DEPENDENCY** | §8. Depende de F26 + catálogo controlado. |
| P19 | **Recomendações com produtos já existentes** | **DEFERRED BY DEPENDENCY** | Depende de F26. **Prioridade sobre comprar algo novo.** |
| P20 | **Recomendações com orçamento** | **DEFERRED BY DEPENDENCY** | Depende de P18. |
| P21 | **Clima / umidade / contexto** | **DEFERRED BY DEPENDENCY** | §9. Provider externo = **custo real** ⇒ gate. Começa observacional. |
| P22 | **Inteligência baseada no histórico pessoal** | **DEFERRED BY DEPENDENCY** | O núcleo da P2, maduro. |
| P23 | 🔒 **Assistente IA pessoal** | **DEFERRED BY DEPENDENCY** | **OBRIGATORIAMENTE A ÚLTIMA.** Ver §3.1. |

## 5.1 Transversal

| # | Capability | Estado | Do que depende |
|---|---|---|---|
| T1 | 🔒 **Community** | **DEFERRED BY DEPENDENCY** | Pertence à visão de produto e **não sai do roadmap**. Depende de escala, moderação, segurança, privacidade, experiência social e massa crítica de usuárias. Pode ficar aqui por bastante tempo. **Não construir infraestrutura social prematuramente** — uma tabela de posts sem moderação é um passivo, não um começo. |

## 6. Hair Intelligence — o caminho, explicitamente

Capability central. **Não depende de IA para começar**, e começar por IA seria construir o sistema em torno dela.

```
dados reais → histórico → métricas → agregações → comparação
→ padrões determinísticos → insights
```

Insights são **observações sobre o que ela mesma registrou**:

> "A Máscara X apareceu em 4 dos seus 5 Wash Days mais bem avaliados."
> "Você reagendou 70% dos cuidados marcados para quarta-feira."
> "Nos registros com umidade elevada, você marcou mais frizz."

**Não inventar causalidade. Não inventar dados.** Uma correlação observada é uma correlação observada — a linguagem tem de dizer isso, e não "X causa Y". Isso vale mesmo quando o padrão parece óbvio; é exatamente onde D-26 e a honestidade do produto se encontram.

## 7. Wash Day — capability estrutural, não tela de anotação

Wash Day tem de produzir **dados estruturados** o bastante para ligar: cuidado · produtos · técnicas · cabelo · couro cabeludo · resultado · fotografia · contexto · clima (quando houver) · avaliação.

**Free registra. Premium interpreta.** O modelo de dados é decidido no Free, e decidi-lo mal ali inviabiliza P5/P6/P8 depois — por isso Wash Day merece SPEC própria e cuidado de schema, não uma tabela de texto livre.

## 8. Recomendações — ordem de preferência obrigatória

1. **produtos que a usuária já possui**
2. histórico real dela
3. etapa/cuidado atual
4. perfil
5. orçamento
6. catálogo controlado

**Nunca inventar** produto, composição, indicação, preço, link ou benefício. **A monetização futura nunca degrada a confiança** — se um dia houver afiliação, ela não pode alterar a ordem acima.

## 9. Clima / contexto

Implementar no momento arquiteturalmente correto, não antes. Começa **observacional**, a partir dos registros da própria usuária. **Sem linguagem causal sem evidência.** Provider externo de clima é custo real ⇒ human gate.

## 10. Limites da autonomia (TRUE HUMAN GATES)

Autonomia técnica não muda decisão comercial. **Não** alterar autonomamente: existência de Free + Premium · criação de novos tiers · preço aprovado · estratégia de monetização material · lançamento em produção · contratos/custos · decisões legais · domínio clínico/profissional · mudança material de marca.

## 11. Change log

| Data | Mudança | Autor |
|---|---|---|
| 2026-08-31 | Documento criado a partir do MASTER PRODUCT SCOPE (D-92). 31 capabilities Free e 23 Premium registradas com estado. IA fixada como última; Community como DEFERRED BY DEPENDENCY permanente até escala. | agente (§0.3), a partir de decisão humana |
