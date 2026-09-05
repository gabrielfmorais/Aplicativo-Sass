# MASTER PRODUCT BACKLOG — a fonte oficial das capabilities COMMITTED

| Campo | Valor |
|---|---|
| Autoridade | **Decisão humana do dono (D-92, 2026-08-31).** Este documento é escopo aprovado, não brainstorm. |
| Fonte de verdade para | O que o produto **vai** ter. Não para *quando* — a ordem é decidida pelo agente (§0.3). |
| Atualizado | 2026-09-02 (D-102) |

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
| F22 | **Pausa do cronograma** | **DONE** | SPEC-022 (OQ2 = deslocar preservando intervalos, D-98). Pausada **nada atrasa** — atraso pressupõe compromisso vigente — e nenhum lembrete toca. A volta desloca o que sobrou, com o fim do ciclo como limite natural, e **diz o que vai acontecer antes de ela confirmar**. Free: cobrar por parar é cobrar pela vida dela. |
| F23 | **"Meu cabelo mudou"** | **DONE** | SPEC-020: o Free registra o evento e o app **oferece** reavaliar — não interpreta, não aconselha, não diagnostica, e é essa contenção que o mantém fora do gate D-26. Validado no DEV real. | Registrar eventos (química, coloração, descoloração, corte, calor, praia/piscina, tranças, pausa, mudança percebida). No Free, **dispara reavaliação**. |
| F24 | **SOS básico** | **COMMITTED** | Depende de conteúdo com orientação capilar substantiva ⇒ **gate D-26/D-70**. |
| F25 | **Wash Day básico** | **DONE** | SPEC-024: o hub do que ela realmente fez, ancorado na execução. **Vocabulário fechado em tudo** — produtos da prateleira dela, catorze técnicas de lista fechada, **zero campo de texto sobre o cuidado**: texto livre não se compara nem se agrega e destruiria P5, P6, P7 e P8. Hub sem coluna de conteúdo, para F28/F31/P21 pendurarem sem mexer nas anteriores. Validado no DEV real. |
| F26 | **Minha Prateleira** | **DONE** | SPEC-023: ela cadastra o que tem, do jeito que chama. Não é loja, não é catálogo e não interpreta — interpretar é `P6`, é Premium e exige volume. Base de `F27`, `P6` e da Hair Intelligence, e é o que permite recomendar **o que ela já possui**. Validada no DEV real. |
| F27 | **Cadastro dos produtos utilizados** | **DONE** | SPEC-024 fatia 2: `wash_day_products` liga produto ↔ execução, e a tela marca em dois toques. Entregue **junto** com o F25 porque é a mesma junção: separá-los teria criado um hub sem o consumidor que o justifica. Um produto arquivado continua no registro em que foi usado (BR3). |
| F28 | **Fotos básicas de evolução** | **COMMITTED** | Primeira capability com **mídia**: storage, privacidade, LGPD, custo. Dependência real de infraestrutura. |
| F29 | **Resumo de ciclo** | **DONE** | SPEC-021: na visão de ciclo, as contagens **do `Progress`** (reusadas, nunca recontadas) fecham o mês e levam à oferta do próximo. Sem percentual, nota ou comparação. Alimenta `P12` e `P16`. |
| F30 | **Recursos de segurança / orientação profissional** | **COMMITTED** | Quando procurar um profissional. **Gate D-26** por natureza. |
| F31 | **Check-in básico de couro cabeludo** | **DONE** | Mora no **hub do Wash Day**, não em `checkins` — append-only ali transformaria o check-in de um toque em dois. Vocabulário = o `scalp_tendency` da SPEC-002, que **já passou pelo gate**, o que dispensou o domain review temido. **Sintoma clínico fica fora** atrás de duas chaves (D-32 base legal + D-26 domínio), registrado como OQ2. Não é escala: nenhum valor é melhor que outro. |
| F34 | **Perfil dela: nome, avatar e foto** | **DONE no Free** (SPEC-042) · arte em refinamento futuro (OQ4) · foto é `P24`, bloqueada por D-32 | O acesso já existe — o avatar no cabeçalho de toda aba (SPEC-026 fatia 7), hoje com a inicial do nome. Falta o resto: **editar nome** · **escolher um avatar próprio da Huna** · preferências · lembretes · Premium · privacidade · conta. Lembretes, Premium e conta **já estão lá**; nome e avatar não. **D-102 fixa a divisão de tier:** os **avatares da Huna são Free** — personalização de verdade sem infraestrutura de mídia —, e a **foto própria é Premium** (`P24`), porque foto é mídia e divide a dependência do `F28`: storage, custo, privacidade e base legal. |
| F32 | **Catálogo Huna de produtos reais** | **DEFERRED BY DEPENDENCY** | Marca · produto · linha · categoria · variante/tamanho quando aplicável · **imagem real de fonte autorizada** · EAN quando disponível. Busca por marca e por produto, **adicionar o produto real à Minha Prateleira**, **selecioná-lo no Wash Day**, e **preservá-lo no histórico mesmo depois de arquivado** (a mesma regra do `F26` BR4, que já vale). **O manual é obrigatório como fallback** — *"Não encontrou seu produto? Adicione manualmente"* —, porque um catálogo que não acha o vidro dela não pode virar um beco. **O catálogo não substitui a prateleira: ele facilita o cadastro dela.** Interface **baseada em busca**, não uma parede de logos; marcas populares fáceis de achar sem que a tela vire vitrine. **Brasil primeiro** na curadoria, internacional depois. **Nada é inventado** — produto, composição, benefício, preço ou URL (D-100). Trava no que não é engenharia: **fonte de dados sustentável e legalmente utilizável** (nunca scraping improvisado), direito de uso de imagem e possível custo/contrato ⇒ **TRUE HUMAN GATE**. Não some do roadmap. **D-104: é a cabeça da cadeia** `catálogo → prateleira → execução → wash day → histórico → smart shelf → hair intelligence → recomendações → afiliados`, e **catálogo não é vitrine**: ele existe para ela cadastrar o vidro dela mais rápido, não para vender. |
| F33 | **Scanner / EAN** | **DEFERRED BY DEPENDENCY** | Identificação por código de barras para achar o produto no `F32` sem digitar. Depende do `F32` existir e **ter EAN** (um scanner sem catálogo lê um número que não significa nada) e de **dependência nativa de câmera** — a primeira do projeto, com permissão, privacidade e revisão de loja junto. Etapa posterior ao `F32`, nunca simultânea. Não some do roadmap. |
| F35 | **Avaliação capilar ampliada** | **DONE** (SPEC-037 fatia 1, validada no DEV real) | D-102. A lista do dono foi **medida contra `hair_profiles`** (8 inputs, D-62) e a maior parte **já é coletada**: curvatura e espessura, oleosidade (`scalp_tendency`), química, calor, ressecamento/quebra/frizz/embaraço/opacidade (`current_concerns`), frequência de lavagem e objetivo; "mudanças percebidas ao longo do tempo" já são `F17` + `F23`. **O que falta é curto e nomeável: porosidade percebida · rotina e disponibilidade real de tempo** — e, se o dono quiser, o objetivo deixar de ser único. ⚠️ **Uma pergunta que o motor não usa é uma pergunta que só custa o tempo dela** (D-47/D-48): esta capability só entra **junto** com o `F36`, e a regra que ler o input novo é regra capilar ⇒ nasce `candidate` (D-26). |
| F36 | **Motor de cronograma por necessidade** | **DONE** (SPEC-038: quarto tipo validado no DEV real; motor v2 pronto e testado. ⚠️ **Versão corrente segue v1 por OQ4** — deriva cliente/Edge Function medida) | D-102. A frequência de **Hidratação · Nutrição · Reconstrução** deixa de ser sequência fixa igual para todas e passa a depender do perfil e da necessidade; **Restauração/recuperação** entra como quarto tipo quando fizer sentido. Tecnicamente é **nova versão de engine** (`schedule/engine/v2` — nunca editar versão liberada, ADR-001/§2) mais um valor novo no vocabulário de `care_type`, que hoje atravessa CHECK do banco, guias (`F8`) e as cores por tipo de cuidado. **Bloqueado para PUBLIC RELEASE por D-26/OQ-REL:** "de quanto em quanto tempo este cabelo precisa de reconstrução" é exatamente a regra que exige sign-off de domínio. Construível como `candidate` em dev/internal beta. |
| F37 | **Fluxo Wash Day: Lavou → Tratamento → Finalização → Resultado** | **DONE** (SPEC-039) | D-102. O `F25` já registra **o que ela fez** e **o que usou**; falta a etapa que vem depois do tratamento. **Finalização não é cuidado opcional secundário** — para a maioria das usuárias ela faz parte do processo, e o app tem de conduzir naturalmente até lá. Tratamento e finalização são **etapas diferentes**, com registro próprio. "Pular finalização" existe; **não é o padrão**. Estrutural: é a etapa que o `P8` precisa para correlacionar produto × técnica × **finalização** × resultado. Pendura no hub do Wash Day (SPEC-024), que nasceu **sem coluna de conteúdo** exatamente para isto. **SPEC-039 (em curso):** a **estrutura** entra — `wash_day_finish`, uma resposta por execução (`done`/`skipped`), a Hoje perguntando a etapa **acima** do check-in, e a barreira de teste contra a fusão com `WASH_DAY_TECHNIQUES`. ⚠️ **A fusão já tinha começado sozinha:** seis das catorze técnicas são movimentos de finalização, e a lista aceitaria mais uma sem erro nenhum — a proibição vivia só em prosa. O **conteúdo** (quais finalizações, como fazer) continua no `F38`, atrás do gate D-26/D-70. ✅ **Validada no DEV real a 390px (2026-09-03):** a etapa aparece acima do check-in, o check-in continua acessível, a resposta persiste numa sessão nova, dois cuidados respondidos = duas linhas (uma por execução), e as três travas foram medidas contra o banco real — `done` como técnica, `scrunched` e `fitagem` como etapa, todas `23514`. ⚠️ **A medição corrigiu uma afirmação da SPEC:** desfazer é `voided_at` e não `DELETE`, então o cascade não dispara num desfazer — imprecisão **herdada** da SPEC-024/025 e registrada como OQ4, fora do escopo do `F37`. |
| F38 | **Área de Finalizações** | **IN PROGRESS** — fatia de **registro** DONE (SPEC-048); conteúdo segue bloqueado por D-26/D-70 | D-102, expandida em 2026-09-03. **Área própria dentro de Cuidados**, com duas entradas: **Recomendadas para você** e **Todas as finalizações**. ⚠️ **Não é o `F37`, e a separação é permanente:** o `F37` é a **etapa da execução** (diz **se** finalizou, DONE na SPEC-039); o `F38` é **descoberta e aprendizado** (diz **o que é e como faço**). Cada finalização poderá ter nome · apresentação visual · contexto/perfil indicado **quando houver regra validada** · **"Como fazer"** passo a passo · produtos da execução · **prioridade para o que ela já possui** · CTA para registrar que fez · ligação com o **check-in** posterior · **histórico daquela finalização**. São **várias técnicas**: definição · volume · frizz · leveza · fitagem · por curvatura · day after · combinações com creme, leave-in, gelatina, óleo. Jornada: `PERFIL → RECOMENDADAS → COMO FAZER → PRODUTOS → EXECUÇÃO → COMO FICOU? → HISTÓRICO → HAIR INTELLIGENCE`. ⚠️ **"Melhores finalizações para o seu cabelo" é recomendação capilar** ⇒ **gate D-26/D-70**. **A arquitetura pode ser construída antes do sign-off** — catálogo, navegação, registro, vínculo com execução e resultado, histórico — **sem afirmar qual é a melhor para ela**; ⛔ **não inventar recomendação para preencher interface**. O `F48` deve mostrar produtos reais/da Prateleira **também dentro da execução de Finalização**. ⛔ **Nunca fundir com `WASH_DAY_TECHNIQUES`** — a SPEC-039 §8 tem barreira executável em três travas. A personalização **por resultado real dela** é outra coisa e é Premium (`P5`/`P8`). ✅ **Fatia de registro DONE (SPEC-048, 2026-09-05):** o dono forneceu o vocabulário de oito valores (`fitagem_tradicional`, `fitagem_estruturada`, `dedoliss`, `rake_and_shake`, `plopping`, `twist_out`, `other`, `unknown`) e ele entra como **`candidate`** — ⚠️ **permite REGISTRO, não recomendação:** *"eu fiz Fitagem"* é fato dela, *"Fitagem é melhor para o seu cabelo"* continua bloqueado. `day_after` ficou **de fora desta versão** por decisão do dono, com teste que o recusa. Coluna `finish_technique` com `CHECK` fechado, `CHECK` de coerência (técnica só com a etapa em `done`), e os dois vocabulários **medidos disjuntos contra o DEV real**. ⚠️ **A validação a 390px achou a pergunta faltando em "Seu registro"** — a tela cheia perguntava *se* ela finalizou e nunca *qual*, e nenhum teste via porque cada tela era testada contra a própria expectativa. **Continua fora:** "melhores para você", indicação por curvatura/perfil, efeitos, **passo a passo substantivo**, ranking e a área própria dentro de Cuidados. |
| F39 | **Rotina de óleo capilar** | **DONE** (SPEC-040) | D-102. Óleo ganha presença própria e **deixa de existir apenas escondido dentro de Nutrição**: rotina de uso, frequência personalizada, lembrete no app, notificação configurável, marcar **feito** ou **adiar**, orientação de momento e forma de uso, e depois integração com os produtos da Prateleira (`F26`). *"Hora do seu óleo — você programou óleo nas pontas para hoje."* Tecnicamente barato: é um **quinto intent** no `NotificationScheduler` (SPEC-008/D-22), que já tem opt-in duplo, teto diário e id determinístico. ⚠️ A **orientação de uso** é conteúdo capilar ⇒ **gate D-26**; o lembrete e o registro, não. |
| F40 | **Jornada Huna — pontos, progressão e níveis** | **DONE** | SPEC-043 (#121), validada a 390px no DEV real. D-103. A camada de motivação, e ela mede **consistência com o plano**, nunca quantidade de tratamento. ⚠️ **Deriva de fato canônico, nunca de uma segunda verdade:** `care_executions`, `checkins`, `wash_days` e `plan_pauses` já são a verdade; o motor de pontos **lê** esses fatos e não guarda uma contagem paralela que possa divergir. **Idempotência é requisito, não detalhe:** o mesmo `care_execution_id` não pontua duas vezes por retry, reload ou reprocessamento — a chave é o fato, não a sessão. **Regras de pontuação são versionadas** como as de engine (ADR-007): mudar a régua **não reescreve o passado**, então o ponto concedido é gravado como fato datado, não recalculado. ⚠️ **Pontuação NÃO é regra capilar e não entra no gate D-26/D-70** — ela fala de aderência, não de cabelo; é justamente por isso que não pode se disfarçar de avaliação capilar. **FREE participa integralmente** e **Premium não tem multiplicador** (D-83 + D-103: nada de pay-to-win). |
| F41 | **Sequência de consistência (streak)** | **DONE** | SPEC-043 (#121). D-103. ⚠️ **Não é diária, e essa é a decisão que define a capability.** Um streak diário num produto cujo plano tem 4 a 12 cuidados por mês só poderia ser cumprido lavando mais — exatamente o incentivo proibido. A sequência conta **cuidado planejado atendido**, então **dia sem cuidado planejado não quebra nada**. **Pausa real do cronograma (`F22`/SPEC-022) congela a sequência** — e, como no F22, isso entra na **derivação**, não numa checagem de tela: pausado, nada atrasa e nada quebra. Reparo/perdão é OQ, não promessa. |
| F42 | **Marcos e conquistas** | **DONE** | SPEC-043 (#121). D-103. Badges e marcos derivados dos mesmos fatos canônicos do `F40` — primeiro ciclo concluído, primeira reavaliação, prateleira montada, Wash Day registrado. **Celebração e microinteração vivem aqui**, e são o único lugar do produto em que o app comemora: em toda outra tela, elogio é ruído (SPEC-009/019/021). ⚠️ Nenhum marco pode ser conquistado **fazendo mais** do que o plano pede. |
| F43 | **Desafios** | **DEFERRED BY DEPENDENCY** | D-103. Depende de `F40` + `F42` existirem e de haver histórico suficiente para um desafio significar algo. Desafio é sobre **manter o próprio plano**, nunca sobre volume. |
| F44 | **Ranking de consistência** | **DEFERRED BY DEPENDENCY** | D-103. Amarrado à **Community** (`F19`, `DEFERRED BY SCALE`), e sujeito às mesmas travas: participação **opcional**, amigos/grupos antes de qualquer coisa pública, e ranking por **consistência relativa ao próprio plano**, nunca por quantidade absoluta de cuidados — um ranking absoluto premiaria quem lava mais. ⛔ **Nada de ranking público prematuro.** |
| F45 | **Share card Huna — a fundação** | **DONE** | SPEC-044 — fundação entregue: preview como consentimento, card autoral em SVG, share nativo. D-103. O card visual autoral e o caminho `conquista → card → compartilhar`. **Transversal: não depende da Community.** Compartilhamento **nativo do sistema** como fundação (Instagram, WhatsApp e o que estiver instalado); integração direta com um app específico só se trouxer benefício concreto. Formatos: **9:16** para Stories e um formato de feed/share genérico. Direção visual: vinho/ameixa/roxo, mechas abstratas da Huna, logo discreta, tipografia forte, dado legível. ⚠️ **Privacidade é parte da capability, não um extra:** `preview → ela decide → share`, **nunca publicação automática**; nome, avatar, foto, produto, resultado e estatística são **controláveis**; dado sensível não entra sozinho; **`user_id` e dado interno nunca aparecem**. **O ato de compartilhar é FREE** — crescimento orgânico não fica atrás de paywall (D-103). |
| F46 | **Momentos compartilháveis** | **IN PROGRESS** | SPEC-045 — quatro momentos entregues (jornada · marco · cuidado concluído · ciclo) em três entradas. **Faltam** Wash Day, progresso detalhado e comparação de ciclos (OQ1), e Antes × Depois segue atrás de mídia com base legal (D-32). D-103. Os gatilhos que produzem um card, progressivamente: cuidado concluído · Wash Day · sequência · marco/badge · ciclo concluído · progresso · resumo mensal · comparação de ciclos. Depende do `F45`. ⚠️ **Antes × Depois e Hair Progress dependem de infraestrutura de mídia com base legal** (`F28`/`P24`/D-32) e entram **só por seleção explícita** — foto nunca entra num card sozinha. |
| F48 | **Produtos na execução** | **DONE** (SPEC-041) | D-104. Cada execução do plano mostra, **no contexto dela**, os produtos que fazem parte daquele momento — Hidratação · Nutrição · Reconstrução · **Restauração** · Finalização (`F37`) · Óleo (`F39`), e as etapas seguintes onde produto realmente faz parte. Mostra **nome, marca e imagem** do que ela **já tem**, selecionado da Prateleira (`F26`), e o vínculo com o Wash Day e o histórico vem depois pela mesma linha. ⚠️ **Não é o `F25` nem a `P18`, e a diferença é a responsabilidade:** o `F25` **registra o que ela usou, depois**; a `P18` **recomenda**; esta **apresenta no momento da execução o que já é dela**. ⚠️ **Prioridade obrigatória: o que ela já possui vem antes de sugerir compra** (§8). ⚠️ **Não se cria regra capilar substantiva só para escolher produto** — associar produto a tipo de cuidado por composição ou indicação é conteúdo de domínio e cai no gate D-26/D-70; o que esta capability faz é mostrar **a escolha dela**, não decidir por ela. ✅ **SPEC-041, sem migration e sem dado novo** — leitura sobre `products` (SPEC-023) e `wash_day_products` (SPEC-024): painel "Meus produtos" no cartão, com *da última vez você usou* e o resto da prateleira **sem filtro por categoria** (barreira de teste). Validada no DEV real a 390px: marcar um produto no registro → o próximo cuidado do mesmo tipo mostra "da última vez". **Achado que só o DEV viu:** a `Section` declarava a prop e não a repassava, então o painel só chegava ao cartão de foco — e o teste não via porque perguntava "existe?" em vez de "em quantos?". Marca e imagem chegam com o `F32`. |
| F47 | **Recap anual "Meu ano na Huna"** | **DEFERRED BY DEPENDENCY** | D-103. Depende do `F45` e de **um ano de dados reais** — um recap sobre três semanas não é um recap. |

## 5. PREMIUM — um único plano pago

**Existe somente um plano pago: PREMIUM.** Mensal e anual têm **exatamente as mesmas funcionalidades**. Referência comercial do dono: **R$ 19,90/mês · R$ 149,90/ano · 7 dias de trial**. Preço e período **vêm da loja em runtime, nunca hard-coded** (D-83).

Premium vende personalização, inteligência e conveniência — **nunca** a remoção de algo que era gratuito (D-83/G7).

| # | Capability | Estado | Do que depende |
|---|---|---|---|
| P1 | Plan Customization | **DONE** | SPEC-015 (#42/#43/#44) — a primeira capability premium |
| P2 | **Hair Intelligence** | **IN PROGRESS** | SPEC-047 — primeira fatia: repetição de **produto** nos cuidados que ela avaliou bem, com estado honesto de poucos dados. Faltam as outras dimensões (técnica, finalização, couro, dia da semana), que dependem de decidir onde mora o vocabulário de exibição (OQ1). §6. Depende de dados reais: F25, F26, F14/F31, F16, ciclos. **Determinística primeiro, sem IA.** |
| P3 | **"O que funciona comigo?"** | **DEFERRED BY DEPENDENCY** | Superfície de leitura da P2. Precisa de volume de registros. |
| P4 | **Cronograma adaptativo** | **DEFERRED BY DEPENDENCY** | Precisa de P2 **e** de regras capilares validadas (**D-26**) para qualquer adaptação substantiva. |
| P5 | **Wash Day avançado** | **DEFERRED BY DEPENDENCY** | Premium **interpreta** o que o Free registrou. Depende de F25. |
| P6 | **Smart Shelf** | **IN PROGRESS** | SPEC-049 — primeira fatia: contagem de uso por produto e "ainda sem registro". Faltam **combinações** nos melhores registros (OQ1); **avaliação por produto** fica de fora de propósito, porque é o caminho mais curto para o ranking `P7`. Depende de F26/F27 + histórico. |
| P7 | **Ranking pessoal de produtos** | **DEFERRED BY DEPENDENCY** | Depende de P6 + avaliações. |
| P8 | **Padrões produto × técnica × resultado** | **IN PROGRESS** — primeira fatia DONE (SPEC-050) | Depende de P6 + F25 + check-ins. **D-102 acrescenta a finalização à quádrupla:** tratamento + produto + **finalização** + resultado percebido — sem a etapa de finalização (`F37`) registrada, metade do que ela realmente faz no cabelo fica fora da correlação. ✅ **A dependência ficou satisfeita em 2026-09-05** — `P6` (SPEC-049), `F25` (SPEC-024), check-ins (SPEC-006) e a finalização (SPEC-048) existem —, e a **primeira fatia entrou (SPEC-050)**: pares de **tipos diferentes** (produto × técnica, produto × finalização, técnica × finalização) com as duas contagens — *"apareceram juntos em 5 cuidados que você avaliou, e em 4 deles você avaliou bem"*. **Zero migration e zero mudança de adapter.** ⛔ **Sem trio, sem ranking (`P7`), sem porcentagem, sem couro** (é um **estado observado**, não uma ação: cruzá-lo com a avaliação lê como causa). ⚠️ **Três recusas medidas:** o par que **nunca aparece separado** é descartado (não separa nada); `other`/`unknown` nunca são membros mas os cuidados deles **continuam no denominador**; e o par com **zero** cuidados bem avaliados não existe — *"em 0 deles você avaliou bem"* é **acusação**, o espelho de *"é ideal para você"*, e a direção negativa é `P18`. **Falta**: recência, couro, e a decisão sobre fundir com o `combo` de produto × produto. |
| P9 | **Hair Progress avançado** | **DEFERRED BY DEPENDENCY** | Depende de F28. |
| P10 | **Timeline fotográfica** | **DEFERRED BY DEPENDENCY** | Depende de F28. |
| P11 | **Antes × Depois** | **DEFERRED BY DEPENDENCY** | Depende de F28/P10. |
| P12 | **Comparação entre ciclos** | **DEFERRED BY DEPENDENCY** | Depende de F29 + ≥2 ciclos reais. |
| P13 | **Check-ins avançados** | **IN PROGRESS** — metade `cabelo` **DONE** (SPEC-051); falta a metade `couro` | Extensão de F14/F31. Vocabulário pode exigir **domain review**. ⚠️ **É o gargalo do critério mestre, e o Blueprint §8 já dizia:** *"o check-in atual é uma nota de 1 a 5 sobre o cuidado. Suficiente para começar, insuficiente para aprender"* e *"sem check-in rico, o Premium não tem o que interpretar"*. A SPEC-047/049/050 lê **quatro** eixos de entrada (produto, técnica, finalização, prateleira) e **um único número** como eixo de resultado — nenhuma engenharia de agregação melhora um sinal de um bit. **SPEC-051** entrega a metade **cabelo** como junção `checkin_marks` (maciez · brilho · frizz · definição · ressecamento), `candidate`, ancorada no check-in. ⚠️ **O check-in continua sendo de UM toque**: a marcação vem **depois** da nota, é opcional, e pular não custa nada (Blueprint §8: *"o check-in vale porque é barato"*). ⚠️ **`checkins` continua append-only** — a nota é o fato âncora; a junção aceita `DELETE` porque desmarcar é corrigir, e é a mesma divisão que a SPEC-025 fez. ⛔ **A metade `couro` NÃO entra** (*sensível · coçando · descamando*): é sintoma, atrás de **D-32** (base legal LGPD) **e** **D-26** — a OQ2 da SPEC-025. ✅ **Vocabulário V1 aprovado pelo dono em 2026-09-05** (maciez · brilho · frizz · definição · ressecamento) e migration aplicada — o que o congela. Sair de `candidate` continua sendo do revisor de domínio. |
| P14 | **Insights de cabelo** | **DEFERRED BY DEPENDENCY** | Saída da P2. |
| P15 | **Insights de couro cabeludo** | **DEFERRED BY DEPENDENCY** | Depende de F31/P13. **Risco de linguagem clínica — D-26.** |
| P16 | **Relatórios avançados** | **DEFERRED BY DEPENDENCY** | Depende de P2, F28, F29. |
| P17 | **Padrões de longo prazo** | **DEFERRED BY DEPENDENCY** | Precisa de meses de histórico. |
| P18 | **Recomendações personalizadas** | **DEFERRED BY DEPENDENCY** | §8. **D-104: a execução atual é contexto de primeira classe** — a sugestão acontece dentro do momento (`F48`) e/ou em Cuidados, considerando perfil, objetivo, execução, histórico, o que ela já possui e resultados anteriores. Depende de F26 + catálogo controlado. |
| P19 | **Recomendações com produtos já existentes** | **DEFERRED BY DEPENDENCY** | Depende de F26. **Prioridade sobre comprar algo novo.** |
| P20 | **Recomendações com orçamento** | **DEFERRED BY DEPENDENCY** | Depende de P18. |
| P21 | **Clima / umidade / contexto** | **DEFERRED BY DEPENDENCY** | §9. Provider externo = **custo real** ⇒ gate. Começa observacional. |
| P22 | **Inteligência baseada no histórico pessoal** | **DEFERRED BY DEPENDENCY** | O núcleo da P2, maduro. |
| P24 | **Foto de perfil própria** | **DEFERRED BY DEPENDENCY** | D-102. No Free ela personaliza com os **avatares da Huna** (`F34`); no Premium pode usar **foto própria**. Divide a dependência de mídia do `F28` — storage, custo, privacidade, base legal (D-32) — e é por isso que não nasce junto com o avatar. **Não é regressão de D-83/BR3:** foto de perfil nunca existiu no Free. |
| P23 | 🔒 **Assistente IA pessoal** | **DEFERRED BY DEPENDENCY** | **OBRIGATORIAMENTE A ÚLTIMA.** Ver §3.1. |
| P25 | **Cards de insight Premium compartilháveis** | **DEFERRED BY DEPENDENCY** | D-103. O **conteúdo** do insight é Premium (`P2`/`P3`/`P5`), então o card também é — mas isso **não é o share atrás de paywall**: o ato de compartilhar é Free (`F45`), e o que muda é a informação que existe para caber no card. Depende de `F45` + Hair Intelligence. |

## 5.1 Transversal

| # | Capability | Estado | Do que depende |
|---|---|---|---|
| T1 | 🔒 **Community** | **DEFERRED BY DEPENDENCY** | Pertence à visão de produto e **não sai do roadmap**. Depende de escala, moderação, segurança, privacidade, experiência social e massa crítica de usuárias. Pode ficar aqui por bastante tempo. **Não construir infraestrutura social prematuramente** — uma tabela de posts sem moderação é um passivo, não um começo. |
| T2 | **Afiliados e parceria comercial** | **COMMITTED** | D-104. Monetizar sugestões de produtos reais por **afiliados, parceiros, comissão por venda** e, quando aplicável, **por conversão/clique**. **Transversal:** não é tier, não cria plano novo e não altera a D-83 (só existe um plano pago, PREMIUM). ⚠️ **As cinco regras são a capability, não o contorno dela:** (1) **comissão nunca torna um produto "melhor recomendado" em silêncio** — a ordem de preferência de §8 não se dobra a ela; (2) **recomendação pessoal e monetização continuam distinguíveis** para a usuária; (3) **conteúdo patrocinado/afiliado é transparente**, sempre; (4) **utilidade para ela vem primeiro**; (5) **não empurrar compra quando ela já tem produto adequado** — o que é a mesma regra da `P19`, agora com dinheiro do outro lado. ⛔ **A Huna não vira marketplace genérico.** Depende de `F32` + `P18` existirem, e de contrato/parceria real ⇒ **TRUE HUMAN GATE** (custo, contrato, obrigação legal). **A confiança da recomendação vale mais que a comissão** — se as duas colidirem, a comissão cede. |

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

Wash Day tem de produzir **dados estruturados** o bastante para ligar: cuidado · produtos · técnicas · **finalização** · cabelo · couro cabeludo · resultado · fotografia · contexto · clima (quando houver) · avaliação.

⚠️ **O fluxo é `Lavou → Tratamento → Finalização → Resultado/Check-in` (D-102).** Finalização **não** é um cuidado opcional pendurado ao lado do tratamento: são **etapas diferentes**, e para a maioria das usuárias a finalização faz parte natural do processo depois da lavagem. Registrá-la é o que permite ao `P8` correlacionar **produto × técnica × finalização × resultado** — sem ela, metade do que ela de fato faz no cabelo fica fora da conta.

**Free registra. Premium interpreta.** O modelo de dados é decidido no Free, e decidi-lo mal ali inviabiliza P5/P6/P8 depois — por isso Wash Day merece SPEC própria e cuidado de schema, não uma tabela de texto livre.

## 8. Recomendações — ordem de preferência obrigatória

1. **produtos que a usuária já possui**
2. histórico real dela
3. etapa/cuidado atual
4. perfil
5. orçamento
6. catálogo controlado

**Nunca inventar** produto, composição, indicação, preço, link ou benefício.

**Monetização (D-104, `T2`) — cinco obrigações que não são negociáveis:**

1. **Comissão nunca reordena a lista em silêncio.** A ordem acima é a ordem, com ou sem afiliado.
2. **Recomendação pessoal e monetização continuam distinguíveis** para ela.
3. **Conteúdo patrocinado/afiliado é transparente**, sempre.
4. **Utilidade para ela vem primeiro.**
5. **Não empurrar compra quando ela já tem produto adequado** — é a regra 1 desta lista, agora com dinheiro do outro lado.

**A monetização futura nunca degrada a confiança** — se um dia houver afiliação, ela não pode alterar a ordem acima.

## 9. Clima / contexto

Implementar no momento arquiteturalmente correto, não antes. Começa **observacional**, a partir dos registros da própria usuária. **Sem linguagem causal sem evidência.** Provider externo de clima é custo real ⇒ human gate.

## 10. Limites da autonomia (TRUE HUMAN GATES)

Autonomia técnica não muda decisão comercial. **Não** alterar autonomamente: existência de Free + Premium · criação de novos tiers · preço aprovado · estratégia de monetização material · lançamento em produção · contratos/custos · decisões legais · domínio clínico/profissional · mudança material de marca.

## Dívidas conhecidas

| dívida | desde | estado | destrava com |
|---|---|---|---|
| ✅ **`F38` — a lista de finalizações** | SPEC-039 §8 / SPEC-047 §13 → **SPEC-048** | **DESTRAVADA em 2026-09-04**: o dono forneceu a lista, e ela entra como `candidate`. O que segue bloqueado é o **conteúdo** (recomendação, efeito, passo a passo), não o registro | **feito.** Coluna `finish_technique`, `CHECK` fechado, porta, chips nas duas superfícies e a quarta trava de disjunção — tudo medido contra o DEV real. **O que ainda depende de revisor de domínio** é a saída de `candidate` e todo o conteúdo do `F38`: recomendação, indicação por perfil, efeito e **passo a passo** (SPEC-048 §9) |
| ⚠️ **`perceived_porosity` e `routine_availability` são coletadas no onboarding e NÃO têm consumidor** | SPEC-037 (`F35`) | **VISÍVEL, não remover** | uma **regra validada** que as leia, no motor (`F36`). Traduzir porosidade em frequência é a alegação mais substantiva do conjunto ⇒ **gate D-26/D-70**; "este cuidado cabe no seu tempo" é veto explícito do dono. Enquanto isso, são **duas perguntas que custam o tempo dela e não mudam nada** — o custo fica registrado aqui, à vista, em vez de esquecido no código |
| **A v2 do motor existe, está testada e não está ligada** | SPEC-038 (`F36`) | **destravada tecnicamente** pela SPEC-046 | decisão do dono (SPEC-038 **OQ2**) + deploy da `generate-plan` |

## 11. Change log

| Data | Mudança | Autor |
|---|---|---|
| 2026-08-31 | Documento criado a partir do MASTER PRODUCT SCOPE (D-92). 31 capabilities Free e 23 Premium registradas com estado. IA fixada como última; Community como DEFERRED BY DEPENDENCY permanente até escala. | agente (§0.3), a partir de decisão humana |
| 2026-09-02 | **D-102 (dono).** Sete pontos de escopo registrados **sem alterar a ordem em curso**: `F34` ganha a divisão de tier da identidade (**avatares Huna no Free**, **foto própria no Premium** = `P24`); entram `F35` avaliação capilar ampliada, `F36` motor de cronograma por necessidade (com **Restauração** como quarto tipo), `F37` fluxo `Lavou → Tratamento → Finalização → Resultado`, `F38` área de Finalizações e `F39` rotina de óleo capilar; `P8` passa a incluir a finalização na correlação. **Achado ao medir em vez de assumir:** a lista de avaliação do dono foi comparada com `hair_profiles` (8 inputs, D-62) e **quase tudo já é coletado** — o que falta é **porosidade percebida** e **rotina/disponibilidade**. Três dos novos itens carregam conteúdo capilar substantivo e continuam atrás do **gate D-26/D-70**. | agente (§0.3), a partir de decisão humana |
| 2026-09-03 | **D-103 (dono).** Duas frentes novas COMMITTED, registradas sem interromper o F36 e sem implementação: **Jornada Huna** (`F40` pontos/progressão/níveis · `F41` sequência · `F42` marcos e conquistas · `F43` desafios · `F44` ranking) e **Social Sharing** (`F45` fundação **INEGOCIÁVEL** · `F46` momentos · `F47` recap anual · `P25` cards Premium). **A regra que define a gamificação:** recompensa **consistência com o plano**, nunca quantidade de tratamentos — sequência **não diária**, pausa congela, Free participa, Premium sem multiplicador. **Share é transversal e Free**, com `preview → ela decide → share` e sem `user_id` em card nenhum. **Achado ao registrar:** existe barreira de teste viva na Progresso reprovando `score`/`nota`/`pontuação`/`aderência`/`%` — não é contradição (o recusado é pontuar **cabelo e ciclo**; a Jornada mede **aderência**), mas obriga a Jornada a ter **superfície própria**. | agente (§0.3), a partir de decisão humana |
| 2026-09-03 | **D-104 (dono).** Adendo de produtos reais e monetização, registrado sem mudar a prioridade. **Auditado antes de criar:** o catálogo pedido já era o `F32` inteiro, o scanner o `F33`, e a camada de sugestão a `P18`/`P19`/`P20` — expandidos, não duplicados. Novas por responsabilidade distinta: **`F48` produtos na execução** (mostra no momento do cuidado o que ela já tem — não é o `F25`, que registra depois, nem a `P18`, que recomenda) e **`T2` afiliados e parceria comercial** (transversal, não é tier, não altera a D-83). §8 ganhou as **cinco obrigações numeradas** de monetização. A cadeia estrutural ficou registrada inteira, com o catálogo na frente e os afiliados no fim. | agente (§0.3), a partir de decisão humana |
