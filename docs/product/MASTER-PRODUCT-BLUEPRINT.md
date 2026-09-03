# MASTER PRODUCT BLUEPRINT — o que cada capability significa

| Campo | Valor |
|---|---|
| Autoridade | **Decisão humana do dono (D-94, 2026-08-31).** Complemento canônico do MASTER PRODUCT SCOPE (D-92). |
| Responde | *"O que esta capability significa funcionalmente para a usuária?"* |
| **Não** responde | *"Como implementar."* Isso é SPEC. |
| Atualizado | 2026-09-02 (D-102) |

## 0. Por que este documento existe

O [MASTER PRODUCT BACKLOG](MASTER-PRODUCT-BACKLOG.md) responde **o que ainda falta construir**. Ele guarda nomes e estados. Nomes não sobrevivem sozinhos: daqui a seis meses, "Smart Shelf" e "Wash Day" são duas palavras que qualquer um pode reinterpretar de um jeito plausível e errado.

Este documento guarda a **intenção funcional** — por que a capability existe, o que ela resolve, como deve se comportar, e principalmente **o que ela não pode fazer**. Ele foi escrito para ser lido por alguém que não participou da conversa em que o produto foi decidido.

```
MASTER PRODUCT BACKLOG  →  o que falta            (estado)
MASTER PRODUCT BLUEPRINT →  o que significa        (intenção)   ← este documento
SPEC-NNN                 →  como será construído   (contrato)
Código                   →  a construção
Testes + DEV real        →  a prova de que funciona
```

**Não antecipar implementação aqui.** Nada de tabela, RPC, endpoint, componente, biblioteca ou schema — quando alguma dessas aparece abaixo, é porque **já existe** e está sendo citada como fato, nunca como plano.

### 0.1 Como este documento trata o que já está pronto

As capabilities **DONE** têm SPEC aprovada, código e testes. A SPEC delas já responde às dezessete perguntas melhor do que um resumo responderia, e um resumo criaria uma segunda fonte de verdade que envelhece em silêncio — o erro que este projeto já pagou duas vezes (D-87, D-93). Então elas aparecem em **§2, com ponteiro para a SPEC**, não recontadas.

O tratamento completo é dado a **tudo que ainda não existe**, que é exatamente onde a intenção está em risco de se perder.

## 1. Princípios funcionais — inequívocos

### 1.1 A divisão Free / Premium

> **FREE executa e registra. PREMIUM interpreta, compara, aprende e adapta.**

Essa frase é a régua. Diante de qualquer dúvida sobre onde uma funcionalidade cai, pergunte: *ela faz a usuária **fazer/registrar** alguma coisa, ou faz o app **entender** alguma coisa a partir do que ela já registrou?* A primeira é Free. A segunda é Premium.

Corolários que não podem ser violados:

- **O Free é um produto realmente útil e completo no core** (D-83), não uma demonstração. Não há paywall antes do valor.
- **Registrar nunca é premium.** Se a usuária não puder registrar, não haverá o que interpretar depois — e cobrar pelo registro destrói a base de dados de que o Premium depende.
- **Nenhuma capability hoje gratuita pode virar paga** (D-83/BR3). Mover uma é mudança material na proposta de valor ⇒ human gate.

### 1.2 Um único tier pago

**PREMIUM**, e só. Mensal e anual têm **exatamente as mesmas funcionalidades** — a diferença é o ciclo de cobrança, nunca o produto.

Referência comercial do dono: **R$ 19,90/mês · R$ 149,90/ano · 7 dias de trial**. Preço e período **vêm da loja em runtime, nunca hard-coded** (D-83) — um número digitado numa tela é um número que um dia estará errado, e o teste que trava isso já existe.

### 1.3 Honestidade sobre o que o produto sabe

Três proibições que atravessam quase todas as capabilities abaixo e valem como regra geral:

1. **Não inventar causalidade.** Uma correlação observada é uma correlação observada. *"A Máscara X apareceu em 4 dos seus 5 Wash Days mais bem avaliados"* é verdade; *"a Máscara X recuperou seu cabelo"* é invenção.
2. **Não inventar dados.** Sem produto, composição, indicação, benefício, preço ou URL fabricados. Nem para preencher uma tela vazia.
3. **Não diagnosticar.** Tudo que a usuária registra é **relato dela**, não achado clínico. Foto não vira diagnóstico. Couro cabeludo "sensível" é o que ela sentiu, não uma condição dermatológica. (D-26; linguagem de diagnóstico é gate.)

Quando não há dados suficientes, a resposta certa é **dizer que ainda estamos aprendendo** — nunca preencher a interface com um insight fabricado. Uma tela honestamente vazia constrói mais confiança que uma cheia de nada.

## 2. O que já está pronto — intenção preservada na SPEC

Estas capabilities estão **DONE**. A SPEC é a fonte: ela tem as regras de negócio, os critérios de aceite, os edge cases e os modos de falha, tudo já revisado e testado.

| # | Capability | Tier | Onde a intenção está escrita |
|---|---|---|---|
| F1 | Conta | Free | SPEC-001 (identidade, sessão, exclusão de conta) |
| F2 | Perfil capilar | Free | SPEC-002 (o snapshot que alimenta a avaliação) |
| F3 | Onboarding | Free | SPEC-002 + SPEC-016 fatia 1 (uma pergunta por etapa) |
| F4 | Avaliação inicial | Free | SPEC-004 §Assessment (D-66) |
| F5 | Cronograma personalizado H/N/R | Free | SPEC-004 (engine + `generate-plan`) |
| F6 | Tela Hoje | Free | SPEC-005 + SPEC-016 fatia 2 (cartão de foco) |
| F7 | Cuidado do dia | Free | SPEC-005 |
| F8 | Como fazer | Free | SPEC-007 — conteúdo `candidate`, **gate D-26 para release** |
| F9 | Concluir cuidado | Free | SPEC-005 (planejado ≠ executado, D-69) |
| F10 | Reagendar | Free | SPEC-005 BR8 (janela hoje…+28) |
| F11 | Pular | Free | SPEC-005 |
| F12 | Desfazer | Free | SPEC-005 (janela de 15 min, D-69/D-12) |
| F13 | Lembretes | Free | SPEC-008 |
| F14 | Check-in de cabelo | Free | SPEC-006 (a base que §8 estende) |
| F15 | Histórico | Free | SPEC-005 (histórico nunca é sobrescrito) |
| F16 | Progresso | Free | SPEC-009 + SPEC-016 fatia 3 |
| F17 | Reavaliação | Free | SPEC-014 |
| F18 | Novos ciclos | Free | SPEC-014 + D-82 |
| F19 | Preservação do histórico | Free | SPEC-014 FR7 (contagem vitalícia atravessa a troca de plano) |
| P1 | Plan Customization | **Premium** | SPEC-015 — a primeira capability paga |

**F20, F21, F22, F23, F25, F26, F27, F29 e F31 ficaram DONE depois desta tabela** (SPEC-017 a SPEC-025). As seções §3 a §10 abaixo continuam valendo como intenção — a SPEC de cada uma é a fonte do que foi de fato construído.

---

# 3. Ciclo e calendário — `F20` · `F29` Resumo de ciclo

**Objetivo da usuária.** Ver o desenho das quatro semanas dela e, ao fim delas, entender o que aconteceu — antes de decidir o próximo ciclo.

**Problema que resolve.** Hoje ela vê o **dia** (a Hoje) e as **quatro semanas** só no preview, antes de confirmar. Depois disso o ciclo some: não há onde olhar para trás e ver a forma do mês. Sem isso, "novo ciclo" é uma decisão sem informação.

**Tier.** Free.

**Entry points.** A partir da Hoje — a faixa da semana já existe e é o começo natural; e ao fim do ciclo, junto da oferta de reavaliação que já existe (D-82).

**Fluxo funcional.**
1. Da Hoje, ela abre a visão do ciclo.
2. Vê as quatro semanas com o que já aconteceu em cada uma — feito, pulado, reagendado, ainda por vir.
3. Ao fim do ciclo, o **resumo** conta o mês em números que ela mesma produziu, e oferece o próximo.

**Inputs conceituais.** O plano ativo e tudo que foi registrado contra ele.

**Outputs.** Uma leitura do ciclo — nunca uma nota, nunca um score.

**Dados conceitualmente necessários.** Já existem todos. Esta capability não pede dado novo.

**Regras importantes.**
- Feito e atrasado continuam **derivados**, nunca armazenados (D-69).
- O resumo é **factual**: contagens e frações do que ela registrou. Sem percentual sobre amostra pequena, sem tendência, sem comparação com "usuárias parecidas".
- Reagendado não é falha; pular é resultado válido, não erro.

**Relações.** Alimenta `F29`, que alimenta `P12` (comparação entre ciclos) e `P16` (relatórios).

**Sem dados suficientes.** Ciclo recém-criado: mostra a forma das semanas, e o resumo diz que aparece conforme ela registra — como a tela de Progresso já faz.

**O que NÃO deve fazer.** Não pontuar o ciclo. Não comparar com outras pessoas. Não sugerir mudança de cronograma — isso é `P4`.

**Sucesso.** Ao fim de quatro semanas ela consegue dizer o que fez sem abrir mais nada, e decide o próximo ciclo com base nisso.

**Dependências.** Nenhuma. Pode ser construída agora.

**Estado.** `F20` **IN PROGRESS** (faixa da semana entregue) · `F29` **COMMITTED**.

---

# 4. "Por que isso está no meu plano?" — `F21`

**Objetivo da usuária.** Entender por que o cronograma dela é assim, no momento em que ela olha para ele.

**Problema.** A explicação existe e é mostrada **uma vez**, no preview, antes de confirmar. Depois some. No segundo dia ela vê "Hidratação" e nada liga aquilo às oito perguntas que respondeu.

**Tier.** Free.

**Entry points.** A tela Hoje.

**Fluxo funcional.** A avaliação que originou o plano fica disponível, **fechada por padrão**, na mesma gramática de "Como fazer": terciária, abre em contexto, nunca compete com a ação do dia.

**Inputs / Outputs.** A avaliação do plano **ativo** → as frases já aprovadas que a traduzem.

**Regras importantes.**
- **A evidência é do plano, não do cuidado.** A engine produz ênfase e evidência no nível do cronograma. Dizer "esta hidratação está aqui porque X" é fabricar causalidade que ninguém calculou.
- A explicação tem de descrever o **plano ativo**, não o perfil mais recente: reavaliar-e-cancelar dessincroniza os dois, e explicar com confiança um plano que ela não tem é o defeito que a SPEC existe para evitar.

**Sem dados suficientes.** Seção ausente. Ausência é melhor que explicação possivelmente errada.

**O que NÃO deve fazer.** Nenhum texto capilar novo. Nenhuma razão por cuidado individual.

**Sucesso.** Ela responde "por que isso?" sem sair da Hoje, e a resposta continua verdadeira depois de uma reavaliação abandonada.

**Dependências.** Nenhuma. **SPEC-017 em Draft**, OQ1 BLOCKING.

**Estado.** **IN PROGRESS.**

---

# 5. Pausa do cronograma — `F22`

**Objetivo da usuária.** Parar sem perder nada, e voltar sem culpa.

**Problema.** Viagem, doença, gravidez, cabelo em proteção, uma semana impossível. Hoje a única saída é pular cuidado por cuidado, e o app acumula atrasos que a fazem sentir que falhou — quando ela apenas viveu.

**Tier.** Free. Pausar não pode ser pago: cobrar por parar é cobrar pela vida dela.

**Entry points.** Conta; e a Hoje quando há vários atrasados, que é justamente o momento em que a pausa faria diferença.

**Fluxo funcional.**
1. Ela pausa, opcionalmente dizendo por quê (ligando com `F23`).
2. Enquanto pausado: sem lembretes, sem atrasos acumulando, o cronograma não anda.
3. Ela retoma quando quiser. O app decide com clareza o que acontece com os cuidados do período — e **diz isso a ela antes** de retomar, não depois.

**Inputs.** A decisão de pausar e a de retomar.

**Outputs.** Um cronograma que parou honestamente e um retorno previsível.

**Dados conceitualmente necessários.** O estado "pausado" precisa ser real, não simulado: um plano pausado é diferente de um ativo, e lembretes, progresso e atraso têm de enxergar essa diferença.

**Regras importantes.**
- Pausar **não apaga** nada. Histórico é intocável.
- Enquanto pausado, **nada é atrasado** — atraso pressupõe compromisso vigente.
- Lembretes silenciam.
- O período pausado não conta contra ela em nenhum número que ela veja.

**Relações.** `F23` (o motivo costuma ser um evento) · `F13` lembretes · `F16` progresso · `F29` resumo.

**Sem dados suficientes.** N/A.

**O que NÃO deve fazer.** Não pausar sozinho. Não retomar sozinho. Não transformar a volta numa avalanche de atrasados — isso seria punir a pausa.

**Sucesso.** Ela pausa três semanas, volta, e o app não a trata como alguém que abandonou.

**Dependências.** Toca o estado do plano ⇒ SPEC própria, com decisão de dados.

**Estado.** **COMMITTED.**

---

# 6. "Meu cabelo mudou" e SOS — `F23` · `F24`

**Objetivo da usuária.** Contar ao app que algo importante mudou, e ver o app reagir a isso.

**Problema.** Ela descolore o cabelo numa sexta. O cronograma de segunda continua o mesmo, montado para um cabelo que não existe mais. **O maior risco do produto é continuar tratando como atual um contexto capilar que mudou** — e nem saber.

**Tier.** Free registra e dispara a reavaliação. Premium, depois, usa evento + histórico para adaptar com mais inteligência (`P4`).

**Entry points.** Conta; Hoje; e, quando existir, o próprio Wash Day — onde ela já está contando o que fez.

**Fluxo funcional.**
1. Ela registra o que aconteceu, de uma lista reconhecível: química · coloração · descoloração · corte · calor intenso · praia/piscina · tranças/protective styles · pausa · "mudou e eu percebi".
2. O app reconhece que o contexto mudou e oferece o caminho adequado — em geral, reavaliar.
3. O evento **fica no histórico** e passa a fazer parte da linha do tempo dela.

**Inputs.** O tipo de evento e quando aconteceu.

**Outputs.** Um evento registrado e um caminho oferecido.

**Dados conceitualmente necessários.** Um registro de eventos com tipo e data, ancorado no histórico dela.

**Regras importantes.**
- **O app oferece, não impõe** — reavaliar substitui o cronograma, e a decisão é dela (a mesma regra de D-28).
- Nenhum evento apaga histórico.
- **SOS** é a face urgente disto: "aconteceu algo agora e eu não sei o que fazer". Aqui mora o maior risco de domínio: qualquer texto que oriente cuidado depois de uma química malfeita é **conteúdo capilar substantivo** e **exige sign-off** (D-26/D-70). Sem sign-off, o SOS **registra e encaminha; não aconselha**.

**Relações.** `F17` reavaliação · `F22` pausa · `P4` adaptativo · `P2` Hair Intelligence (eventos explicam viradas no histórico) · `F30` orientação profissional.

**Sem dados suficientes.** N/A — é registro pontual.

**O que NÃO deve fazer.** Não prescrever tratamento. Não dizer que o cabelo dela "está danificado" — isso é diagnóstico. Não reavaliar sozinho.

**Sucesso.** Depois de uma mudança grande, o cronograma dela deixa de ser o de antes — porque ela contou e o app ouviu.

**Dependências.** `F23` não depende de nada novo. `F24` depende de **conteúdo validado**.

**Estado.** `F23` **COMMITTED** · `F24` **COMMITTED**, com o conteúdo **BLOQUEADO por D-26**.

---

# 7. Recursos de segurança e orientação profissional — `F30`

**Objetivo da usuária.** Saber quando o app **não** é a resposta.

**Problema.** Queda acentuada, feridas, dor, descamação persistente, reação química. Um app de cuidado cosmético que fica em silêncio nessas horas é pior que um que diz "isto é hora de procurar alguém".

**Tier.** Free, sempre. Segurança nunca é paga.

**Entry points.** Onde o sinal aparece — check-in de couro cabeludo, SOS — e um lugar fixo e encontrável.

**Fluxo funcional.** Diante de sinais que fogem do cosmético, o app diz claramente que ali é assunto de profissional (dermatologista, tricologista) e **para de opinar**.

**Regras importantes.**
- **Este é o texto mais sensível do produto inteiro**, porque decide quando alguém procura ajuda. **Exige sign-off de domínio** (D-26/D-70) — sem exceção e sem versão "provisória".
- Nunca nomear condição, nunca sugerir tratamento, nunca tranquilizar ("provavelmente não é nada").
- O produto **não é diagnóstico**, e a linguagem tem de deixar isso óbvio, não escondido num rodapé.

**Relações.** `F31` scalp · `F24` SOS · `P15` insights de couro cabeludo — a capability com maior risco de escorregar para linguagem clínica.

**O que NÃO deve fazer.** Não diagnosticar, não minimizar, não substituir profissional.

**Sucesso.** Uma usuária com um problema real procura ajuda mais cedo por causa do app.

**Dependências.** **Revisão de domínio.** Nenhuma linha vai a público sem sign-off.

**Estado.** **BLOCKED** — aguardando revisor de domínio.

---

# 8. Check-in de cabelo e de couro cabeludo — `F31` · `P13`

**Objetivo da usuária.** Registrar como ficou, em poucos toques, e com o tempo ver isso virar uma história.

**Problema.** O check-in atual é uma nota de 1 a 5 sobre o cuidado. Suficiente para começar, insuficiente para aprender: "3" não diz se o problema foi frizz, ressecamento ou o couro cabeludo coçando.

**Tier.** **O registro básico permanece Free** — sem ele não há base para nada. Premium interpreta tendências históricas (`P14`, `P15`).

**Entry points.** Onde já está hoje: logo depois de concluir um cuidado, sem navegação. E, quando existir, dentro do Wash Day.

**Fluxo funcional.** Ela registra percepção sobre:

- **cabelo** — maciez · brilho · frizz · definição · ressecamento
- **couro cabeludo** — normal · oleoso · seco · sensível · coçando · descamando

Continua opcional, continua rápido, continua sem penalidade por pular.

**Inputs.** A percepção dela, em vocabulário fechado.

**Outputs.** Um relato datado, ancorado no que aconteceu.

**Dados conceitualmente necessários.** Um vocabulário **estável**: comparar ao longo do tempo exige que a palavra signifique a mesma coisa em janeiro e em junho. **Mudar o vocabulário depois quebra a série histórica** — por isso ele merece cuidado agora, não depois.

**Regras importantes.**
- **São relatos da usuária, não diagnósticos.** A interface diz "você marcou", como o Progresso já faz.
- Vocabulário **fechado**, sem texto livre — decisão já tomada, que protege privacidade (DATA-MODEL §4) e comparabilidade.
- Pular o check-in não pode custar nada a ela.
- O vocabulário de couro cabeludo pode exigir **revisão de domínio**: a fronteira entre "sensível" e sintoma clínico é fina.

**Relações.** É o combustível de `P2`, `P14`, `P15`, `P8` e `P16`. **Sem check-in rico, o Premium não tem o que interpretar.**

**Sem dados suficientes.** Poucos registros: mostrar os registros, não tendências. Tendência com três pontos é ruído com aparência de conhecimento.

**O que NÃO deve fazer.** Não virar formulário longo — o check-in vale porque é barato. Não nomear condição de pele. Não exigir resposta.

**Sucesso.** Meses depois, a série de check-ins responde perguntas que nenhum registro isolado responderia.

**Dependências.** `F31` estende SPEC-006. `P13` depende de `F31`.

**Estado.** `F31` **COMMITTED** · `P13` **COMMITTED**.

---

# 9. Wash Day — `F25` (Free registra) · `P5` (Premium interpreta)

> **Wash Day é estrutural.** Não é uma tela de anotação, e tratá-la como tal inviabiliza metade do Premium.

**Objetivo da usuária.** Registrar o dia em que ela realmente cuidou do cabelo — o que usou, como fez, e como ficou — e, com o tempo, descobrir o que dá certo para ela.

**Problema.** O produto sabe o que estava **planejado** e se ela **fez**. Não sabe **o que ela fez de fato**: quais produtos, em que ordem, com qual técnica, e com que resultado. Sem isso, "o que funciona comigo?" é uma pergunta sem dados — e é a pergunta central do Premium.

**Tier.** **Free registra a experiência essencial. Premium interpreta e compara.** Registrar nunca é pago: cobrar pelo registro seca a fonte que o Premium bebe.

**Entry points.** A partir do cuidado do dia (o caminho natural: ela acabou de fazer); e um registro avulso, porque a vida real não pede licença ao cronograma.

**Fluxo funcional.**
1. Ela abre o Wash Day, em geral logo após um cuidado.
2. Registra o que fez — progressivamente, nunca tudo de uma vez.
3. O registro fica ligado ao cuidado, ao dia e ao histórico dela.
4. **Premium**, depois: o app compara este Wash Day com os anteriores e mostra o que se repete nos melhores.

**O que o Wash Day deve conseguir relacionar** (progressivamente, não tudo na primeira fatia):

```
cuidado → produtos → técnicas → cabelo → couro cabeludo
        → resultado → foto → contexto → clima (quando aplicável)
```

**Inputs conceituais.** O cuidado a que se refere · produtos usados (de `F26`) · técnicas · percepção sobre cabelo e couro cabeludo (`F31`) · avaliação · opcionalmente foto (`F28`) e contexto (`P21`).

**Outputs.** Um registro estruturado e comparável de uma rotina real.

**Dados conceitualmente necessários.** Uma entidade **Wash Day** que amarre tudo acima. A palavra que importa é **estruturado**: um campo de texto livre seria fácil agora e destruiria `P5`, `P6`, `P7` e `P8`, porque texto livre não se compara nem se agrega. **É o modelo de dados decidido no Free que viabiliza — ou inviabiliza — o Premium inteiro.**

**Regras importantes.**
- **Free registra, Premium interpreta.** O registro é completo no Free; o que o Premium acrescenta é leitura, não campos.
- **Vocabulário controlado** em vez de texto livre, pelo mesmo motivo de `F31`: comparabilidade e privacidade.
- Registrar tem de ser **rápido**. Um formulário longo não é preenchido, e um Wash Day não preenchido não vale nada.
- Nada aqui é diagnóstico: é o que ela fez e o que ela percebeu.

**Relações.** **É o hub do produto.** Alimenta `P2` Hair Intelligence · `P6` Smart Shelf · `P8` padrões produto × técnica × resultado · `P9` Hair Progress avançado · `P16` relatórios · `P4` cronograma adaptativo · e, por último, `P23` Assistente IA. Consome `F26` produtos, `F31` check-in, `F28` fotos.

**Sem dados suficientes.** Um único Wash Day: mostra o registro, e diz honestamente que padrões aparecem com o tempo. **Nunca extrair "insight" de um registro só.**

**Segurança / privacidade.** Fotos e rotina pessoal são dados sensíveis dela. Vocabulário fechado evita PII acidental em texto livre. Foto entra pelas regras de `F28`.

**O que NÃO deve fazer.** Não virar diário de texto livre. Não exigir todos os campos. Não afirmar causalidade entre produto e resultado — nem no Free, nem no Premium. Não bloquear o registro atrás de paywall.

**Sucesso.** Depois de alguns meses, os Wash Days dela respondem "o que funciona comigo?" com fatos que ela mesma registrou.

**Dependências.** `F26`/`F27` (produtos) tornam o Wash Day muito mais útil e provavelmente vêm antes ou junto. `F28` (fotos) e `P21` (clima) podem entrar depois, sem retrabalho, **se o modelo previr o encaixe** — e é por isso que ele precisa ser desenhado com essas conexões em mente, ainda que não implementadas.

**Estado.** `F25` **COMMITTED** · `P5` **DEFERRED BY DEPENDENCY** (depende de `F25`).

---

# 10. Minha Prateleira e Smart Shelf — `F26` · `F27` (Free) · `P6` · `P7` · `P8` (Premium)

**Objetivo da usuária.** Free: ter num lugar só os produtos que ela já tem. Premium: descobrir quais deles realmente funcionam para ela.

**Problema.** Ela tem doze produtos no banheiro e não sabe quais estão ajudando. Compra mais. O app não pode responder isso sem saber o que ela usa — e não pode saber sem que registrar seja fácil e gratuito.

**Tier.**
- **Free — Minha Prateleira:** ela registra o que possui e usa. **Não é uma loja.** **Não bloquear o registro básico por paywall.**
- **Premium — Smart Shelf:** transforma o histórico de uso em inteligência pessoal.

**Entry points.** Uma tela própria; e de dentro do Wash Day, na hora em que ela está dizendo o que usou — que é quando o cadastro custa menos.

**Fluxo funcional.**
1. **Free:** ela adiciona um produto; ao registrar um Wash Day, marca quais usou.
2. **Premium:** com histórico suficiente, o app mostra o que se repete.

**O que o Smart Shelf deve conseguir mostrar** (não inventar nada além disto):
- produtos mais utilizados;
- produtos presentes nos Wash Days mais bem avaliados;
- a avaliação **dela** associada a cada produto;
- combinações que aparecem nos melhores registros;
- produtos **que ela já possui** e que são relevantes para o contexto atual.

**Inputs.** Os produtos dela; o uso registrado nos Wash Days; as avaliações dela.

**Outputs.** Free: uma lista fiel. Premium: leituras do próprio histórico dela.

**Dados conceitualmente necessários.** Uma noção de **produto da usuária** e o vínculo **produto ↔ uso ↔ resultado**. No Free ela cadastra o que tem, do jeito que chama.

**O catálogo de produtos reais é COMMITTED, e é o `F32`** (D-100). Marca · produto · linha · categoria · variante/tamanho quando aplicável · **imagem real de fonte autorizada** · EAN quando disponível. Busca por marca e por produto, **adicionar o produto real à Minha Prateleira**, **selecioná-lo no Wash Day**, e **preservá-lo no histórico mesmo depois de arquivado** — que é a regra do `F26` BR4 e já vale hoje. O `F33` acrescenta o scanner/EAN **depois**, nunca junto.

**O catálogo não substitui a prateleira: ele facilita o cadastro dela.** O manual continua **obrigatório** — *"Não encontrou seu produto? Adicione manualmente"* —, porque um catálogo que não encontra o vidro dela viraria um beco, e porque a prateleira precisa funcionar para quem usa produto de feira, de manipulação ou de marca que catálogo nenhum lista.

**Continua não sendo loja.** O que `§1.3` proíbe inventar continua proibido: produto, composição, benefício, preço e URL. O que vier do catálogo vem **de fonte autorizada**, nunca de palpite e nunca de **scraping improvisado** — quando chegar a hora, a fonte de dados precisa ser sustentável e legalmente utilizável, e as imagens precisam ter direito de uso. **Brasil primeiro** na curadoria, internacional depois.

**A interface é busca, não vitrine.** Marcas populares fáceis de encontrar, sem uma parede de centenas de logos: a regra de simplicidade não é suspensa porque a base cresceu.

A prateleira de hoje é a fundação evolutiva de tudo isso: a mesma linha em `products`, o mesmo vínculo com o Wash Day, ganhando identidade real por cima.

**Regras importantes.**
- **Não é loja e não é catálogo.** É a prateleira dela.
- **Não inventar causalidade.** *"A Máscara X apareceu em 4 dos seus 5 Wash Days mais bem avaliados"* é observação. *"A Máscara X recuperou seu cabelo"* é invenção.
- Nunca inventar composição, indicação, preço ou benefício de um produto (§1.3).
- Correlação exige **volume mínimo**; abaixo dele, silêncio.

**Relações.** `F25` Wash Day é a origem do uso · `F32`/`F33` dão identidade real ao que ela cadastra · `P2` Hair Intelligence consome · `P18`/`P19` recomendações preferem o que ela já tem — e é a Prateleira que sabe o que é isso.

**A cadeia inteira, e a ordem dela.** Catálogo Huna → Minha Prateleira → Wash Day → Smart Shelf → Hair Intelligence → relatórios → cronograma adaptativo → recomendações. Cada elo lê o anterior: é por isso que o vocabulário do Wash Day é fechado e que a prateleira não guarda benefício nem preço. Um texto livre no meio dessa cadeia não quebra nada hoje e inviabiliza tudo o que vem depois.

**Sem dados suficientes.** Prateleira vazia: convite claro para adicionar. Poucos usos: mostrar a lista, e dizer que os padrões aparecem com o tempo. **Nunca um ranking de dois registros.**

**Segurança / privacidade.** É inventário pessoal dela. Não sai do app, não vira perfil comercial.

**O que NÃO deve fazer.** Não bloquear o registro. Não recomendar compra aqui. Não ranquear com dados insuficientes. Não inventar produto.

**Sucesso.** Ela abre o Smart Shelf e reconhece a própria experiência: "é verdade, meus melhores dias têm essa máscara".

**Dependências.** `F27` depende de `F26`. `P6`/`P7`/`P8` dependem de `F25` + `F26` + histórico real.

**Estado.** `F26`/`F27` **COMMITTED** · `P6`/`P7`/`P8` **DEFERRED BY DEPENDENCY**.

---

# 11. Hair Progress — `F28` (Free) · `P9` · `P10` · `P11` · `P12` (Premium)

**Objetivo da usuária.** Ver a própria evolução — porque cabelo muda devagar demais para a memória perceber.

**Problema.** Mudança capilar acontece em meses. Sem registro visual, ela não vê progresso mesmo quando ele existe, e desiste antes de colher. É a razão mais comum de abandono num produto como este.

**Tier.**
- **Free:** experiência fotográfica básica — registrar e rever.
- **Premium:** timeline · Antes × Depois · comparação entre ciclos · múltiplos ângulos quando fizer sentido · alinhamento de enquadramento · histórico visual avançado.

**Entry points.** Wash Day (o momento natural: cabelo recém-cuidado); resumo de ciclo; e uma galeria própria.

**Fluxo funcional.**
1. Ela registra uma foto, opcionalmente ligada a um Wash Day ou a um marco do ciclo.
2. **Free:** revê as fotos em ordem.
3. **Premium:** compara — dois momentos lado a lado, a linha do tempo, ciclo contra ciclo.

**Inputs.** Fotos dela, e quando foram tiradas.

**Outputs.** Uma linha do tempo visual da própria usuária.

**Dados conceitualmente necessários.** Armazenamento de mídia com controle de acesso estrito, e a data. **Esta é a primeira capability do produto com mídia** — e ela traz consigo armazenamento, custo real, privacidade e LGPD. Isso não é detalhe de implementação: é a razão de `F28` exigir decisão antes de código.

**Regras importantes.**
- **Foto não é diagnóstico.** Nem no Free, nem no Premium, nem quando a comparação parecer óbvia.
- A foto é **dela**: acesso estrito, exclusão de conta tem de levar as fotos junto, e nada disso é opcional.
- Comparação mostra, não conclui. "Antes × Depois" apresenta dois momentos; quem interpreta é ela.
- Alinhamento de enquadramento é **ajuda para tirar a foto**, não retoque — o produto nunca embeleza o resultado dela.

**Relações.** `F25` Wash Day (origem natural) · `F29`/`P12` ciclos · `P16` relatórios · `P2` Hair Intelligence, que pode referenciar registros visuais sem interpretá-los.

**Sem dados suficientes.** Uma foto só: mostra a foto e explica que a comparação aparece com a segunda. Nunca comparar uma foto consigo mesma.

**Segurança / privacidade.** Dado pessoal sensível. Acesso restrito à dona; sem compartilhamento; exclusão de conta remove; **base legal LGPD é pré-requisito** (D-32, e a tabela `consents` ainda não existe). Nenhuma foto sai do app.

**O que NÃO deve fazer.** Não diagnosticar. Não avaliar o cabelo dela. Não compartilhar. Não usar foto para nada além de mostrar a ela.

**Sucesso.** Ela vê progresso que não teria percebido, e continua.

**Dependências.** Armazenamento de mídia + privacidade/LGPD ⇒ **decisão de custo e base legal antes de construir**. `P9`–`P12` dependem de `F28`; `P12` também de ≥2 ciclos reais.

**Estado.** `F28` **COMMITTED** (com dependência de custo/LGPD) · `P9`–`P12` **DEFERRED BY DEPENDENCY**.

---

# 12. Hair Intelligence — `P2` · `P3` · `P14` · `P15` · `P17` · `P22`

> **A capability central do Premium.** A pergunta que ela precisa responder: **"O que funciona comigo?"**

**Objetivo da usuária.** Descobrir, a partir do que ela mesma registrou, o que dá certo no cabelo dela.

**Problema.** Toda a internet fala do cabelo genérico. Ninguém fala do dela. O produto acumula meses de dados reais dela — e sem interpretação eles são só um arquivo.

**Tier.** Premium. É o coração do que se paga.

**Entry points.** Uma superfície própria ("O que funciona comigo?", `P3`); e insights em contexto, onde a informação é útil.

**Fluxo funcional — e a ordem importa:**

```
dados reais → agregações → métricas → comparações
            → padrões determinísticos → insights transparentes
```

**Primeiro é determinística. Não depende de IA.** Nenhuma etapa acima precisa de modelo de linguagem, e construir IA antes disto seria construir o sistema em torno da IA em vez do contrário.

**Inputs conceituais.** Ciclos · execuções · Wash Days · produtos · técnicas · check-ins de cabelo e couro cabeludo · Hair Progress · contexto e clima · eventos de mudança.

**Outputs.** Insights **transparentes**: ela consegue ver de onde saiu cada afirmação.

**Regras importantes — as mais duras do produto.**
- **Não inventar causalidade.**
  - ✅ *"A Máscara X apareceu em 4 dos seus 5 Wash Days mais bem avaliados."*
  - ✅ *"Você reagendou 70% dos cuidados marcados para quarta-feira."*
  - ✅ *"Nos registros com umidade elevada, você marcou mais frizz."*
  - ❌ *"A Máscara X recuperou seu cabelo."*
  - ❌ *"A umidade causou seu frizz."*
- **Volume mínimo antes de afirmar qualquer padrão.** Abaixo dele, dizer que ainda estamos aprendendo.
- **Nunca inventar um insight para preencher a interface.** Tela honestamente vazia > tela cheia de nada.
- Todo insight é **rastreável** aos registros dela. Se não dá para mostrar de onde veio, não se mostra.
- Regra capilar substantiva continua sob **domain review** (D-26).

**Relações.** Consome praticamente tudo. É consumida por `P3`, `P4` (adaptativo), `P16` (relatórios), `P18` (recomendações) e, por último, `P23` (IA). **É a camada que a IA vai consultar** — por isso vem antes dela.

**Sem dados suficientes.** O estado padrão no começo, e tem de ser bem feito: dizer o que ainda falta para o app aprender, e por quê. Esse estado é a maior parte da vida útil da capability para uma usuária nova.

**Segurança / privacidade.** Opera sobre o histórico pessoal dela. Nada sai, nada agrega com terceiros, nada vira benchmark contra outras pessoas.

**O que NÃO deve fazer.** Não afirmar causalidade. Não comparar com outras usuárias. Não diagnosticar. Não fabricar. Não usar IA nesta camada — a IA consulta o que aqui é produzido.

**Sucesso.** Ela lê um insight e pensa "é verdade, eu não tinha percebido" — e consegue ver por que o app disse aquilo.

**Dependências.** `F25` Wash Day · `F26`/`F27` produtos · `F14`/`F31` check-ins · `F16` progresso · ciclos. **Volume real de dados é a dependência de verdade** — e ela não se resolve com código.

**Estado.** `P2` **COMMITTED** · `P3`, `P14`, `P15`, `P17`, `P22` **DEFERRED BY DEPENDENCY**. `P15` (couro cabeludo) tem risco elevado de linguagem clínica ⇒ **D-26**.

---

# 13. Cronograma adaptativo — `P4`

**Objetivo da usuária.** Que os próximos ciclos evoluam com ela, em vez de repetirem para sempre a resposta de oito perguntas feitas uma vez.

**Problema.** O cronograma é montado a partir de um retrato inicial. Ela vive: reagenda sempre nas quartas, pula reconstrução, marca frizz depois de certos cuidados, muda de cabelo. Nada disso volta para o plano.

**Tier.** Premium.

**Entry points.** Ao gerar um novo ciclo — o momento em que uma proposta de mudança é útil e não intrusiva.

**Fluxo funcional.**
1. Ao montar o próximo ciclo, o app considera o que aprendeu com o anterior.
2. Propõe um cronograma que reflete isso.
3. **Explica a mudança** em termos do que ela fez.
4. Ela confirma. Como sempre, nada substitui um plano ativo sem confirmação explícita.

**Inputs conceituais.** Execuções · reagendamentos · skips · check-ins · Wash Days · preferências · eventos de mudança · ciclos anteriores · padrões pessoais (`P2`).

**Outputs.** Uma proposta de próximo ciclo, com a razão junto.

**Regras importantes.**
- **A usuária deve entender por que a mudança foi proposta.** Adaptação sem explicação é o app decidindo pelas costas dela — e destrói a confiança que `F21` constrói.
- **Nada substitui um plano ativo sem confirmação** (SPEC-014 G3, invariante do produto).
- **Regra capilar substantiva continua sob domain review.** Mudar *quando* um cuidado cai é placement — território já aberto por `P1`. Mudar **quais** cuidados, ou **com que frequência**, é regra capilar: **exige sign-off** (D-26). A fronteira entre as duas é exatamente onde esta capability pode escorregar.
- Adaptar não pode apagar histórico nem reescrever ciclos passados.

**Relações.** Consome `P2` · usa `F23` eventos · respeita `P1` preferências · produz o próximo ciclo dentro de `F18`.

**Sem dados suficientes.** Sem histórico, **não adaptar**. O cronograma da avaliação é a resposta certa, e dizer isso é honesto — não é limitação.

**O que NÃO deve fazer.** Não mudar sozinho. Não mudar sem explicar. Não inventar regra capilar. Não usar a adaptação como argumento de venda antes de ela funcionar de verdade.

**Sucesso.** O terceiro ciclo dela é visivelmente mais parecido com a vida dela que o primeiro — e ela sabe por quê.

**Dependências.** `P2` Hair Intelligence madura · ciclos reais · **domain review** para qualquer regra substantiva.

**Estado.** **DEFERRED BY DEPENDENCY.**

---

# 14. Recomendações — `P18` · `P19` · `P20`

**Objetivo da usuária.** Saber o que usar — começando pelo que ela já tem.

**Problema.** Recomendação de produto é onde apps como este perdem a confiança da usuária, porque o incentivo comercial empurra para "compre isto". Se ela sentir que a recomendação serve ao app e não a ela, tudo o mais perde valor junto.

**Tier.** Premium.

**Entry points.** No contexto do cuidado ou do Wash Day; e a partir do Smart Shelf.

**Ordem de preferência — obrigatória, nesta sequência:**

1. **o que a usuária já possui**
2. histórico pessoal dela
3. o cuidado/contexto atual
4. o perfil
5. o orçamento
6. catálogo controlado

**Fluxo funcional.** Diante de um cuidado, o app olha primeiro a prateleira dela. Só quando não houver nada adequado ali é que se fala de algo novo — e mesmo então, respeitando orçamento e catálogo controlado.

**Inputs.** Prateleira (`F26`) · histórico (`P2`) · cuidado atual · perfil · orçamento · catálogo.

**Outputs.** Uma sugestão justificada pelo histórico dela.

**Regras importantes.**
- **Nunca inventar** produto, URL, composição, indicação, benefício ou preço. Um produto que não existe, ou um benefício não comprovado, é uma mentira com consequência real.
- **A monetização futura nunca degrada a confiança.** Se um dia houver afiliação, ela **não pode alterar a ordem acima**. Preferir o que ela já tem é a regra, mesmo quando isso significa não ganhar nada.
- Catálogo **controlado** — não uma varredura da internet.
- Orçamento é restrição, não sugestão.

**Relações.** `F26`/`P6` prateleira e Smart Shelf · `P2` histórico · `F25` Wash Day.

**Sem dados suficientes.** Sem prateleira e sem histórico, a recomendação honesta é fraca — e é melhor recomendar pouco e certo do que muito e genérico.

**Segurança / privacidade.** Nenhum dado dela sai para parceiro comercial.

**O que NÃO deve fazer.** Não inventar. Não empurrar compra. Não deixar incentivo comercial reordenar a lista. Não recomendar o que ela não pode pagar.

**Sucesso.** Ela segue uma recomendação, funciona, e ela percebe que o app olhou para o armário dela antes de olhar para a loja.

**Dependências.** `F26` prateleira · `P2` histórico · catálogo controlado (**decisão comercial + possível custo ⇒ human gate**).

**Estado.** `P18`, `P19`, `P20` **DEFERRED BY DEPENDENCY.**

---

# 15. Clima e contexto — `P21`

**Objetivo da usuária.** Entender por que às vezes o mesmo cuidado dá resultados diferentes.

**Problema.** Ela faz tudo igual e o cabelo responde diferente. Parte disso é contexto — umidade, estação, rotina. Sem registrar contexto, o histórico tem um buraco que faz padrões reais parecerem aleatórios.

**Tier.** Premium.

**Entry points.** Junto do Wash Day e dos check-ins, onde o contexto acontece.

**Fluxo funcional.** **Inicialmente observacional**: a partir dos registros da **própria usuária**, o app mostra coincidências.

> ✅ *"Nos registros realizados em dias de umidade elevada, você marcou mais frizz."*
> ❌ *"A umidade causou seu frizz."*

**Inputs.** Contexto associado aos registros dela; clima quando disponível.

**Outputs.** Observações — nunca explicações causais.

**Regras importantes.**
- **Sem linguagem causal sem evidência.** A frase certa descreve coincidência entre registros dela.
- **Começa observacional.** Qualquer coisa além disso é decisão posterior.
- Provider externo de clima é **custo real** ⇒ human gate. Enquanto não houver, o contexto é o que ela registra.

**Relações.** `F25` Wash Day · `F31` check-ins · `P2` Hair Intelligence — que é quem transforma contexto em padrão.

**Sem dados suficientes.** Não afirmar nada. Contexto precisa de muitos registros antes de qualquer coincidência valer.

**Segurança / privacidade.** Localização é dado sensível: usar a granularidade **mínima** que serve (região, não endereço), e só com consentimento explícito.

**O que NÃO deve fazer.** Não afirmar causalidade. Não rastrear localização além do necessário. Não contratar provider sem decisão de custo.

**Sucesso.** Ela entende uma variação que antes parecia aleatória.

**Dependências.** Volume de registros · decisão de custo para provider · privacidade/LGPD para localização.

**Estado.** **DEFERRED BY DEPENDENCY.**

---

# 16. Relatórios — `P16` (Premium) e o resumo Free

**Objetivo da usuária.** Ver o conjunto, não só o dia.

**Tier.**
- **Free:** resumo **factual** — o que ela fez, em números que ela mesma produziu. É o que a tela de Progresso já faz.
- **Premium:** comparações, padrões, produtos, técnicas, fotos, Hair Intelligence e evolução entre ciclos.

**Entry points.** Fim de ciclo; e uma superfície própria no Premium.

**Inputs.** Tudo que ela registrou.

**Outputs.** Uma leitura organizada do período.

**Regras importantes.**
- Free é **factual**, sem interpretação — a fronteira entre os tiers é exatamente essa.
- Nenhum relatório inventa causalidade, e nenhum compara com outras pessoas.
- Sem dados, o relatório diz que está aprendendo. Não se emite relatório vazio com aparência de cheio.

**Relações.** Consome `F29` ciclos · `P2` Hair Intelligence · `F28`/`P9` fotos · `P6` prateleira.

**O que NÃO deve fazer.** Não pontuar a usuária. Não comparar com outras. Não transformar ausência de dado em conclusão.

**Sucesso.** No fim de um ciclo ela entende o mês inteiro em um minuto.

**Dependências.** `P2`, `F28`, `F29`.

**Estado.** **DEFERRED BY DEPENDENCY.**

---

# 17. Assistente IA — `P23`

> 🔒 **COMMITTED, não é opcional, e obrigatoriamente a ÚLTIMA grande capability.**

**Objetivo da usuária.** Perguntar em linguagem natural sobre o **próprio** cabelo e receber uma resposta baseada na história dela.

**Problema.** Toda a inteligência que o produto acumula fica espalhada por várias telas. Uma pergunta direta — *"por que meu cabelo está mais ressecado esse mês?"* — não tem onde ser feita.

**Tier.** Premium.

**O que ela é, e o que ela não é.**

> **A IA é uma interface sobre o sistema que já existe. Não é um chatbot genérico de cabelo.**

**O sistema produz os fatos. A IA ajuda a consultá-los e explicá-los.**

**Fluxo funcional.** Ela pergunta. O assistente **consulta** perfil · cronograma · ciclos · execuções · Wash Days · produtos · check-ins · Hair Intelligence · eventos · histórico · conteúdo profissional validado. Responde a partir **disso**, e mostra em que se baseou.

**Regras importantes — absolutas.**
- **Nunca:** LLM inventa explicação → apresenta como fato. Esse é o modo de falha que anula o produto inteiro.
- Se o sistema não tem o fato, a resposta é que não sabe. Nunca preencher a lacuna com plausibilidade.
- Conteúdo capilar continua sob **D-26**: a IA não cria regra capilar; ela consulta conteúdo **validado**.
- Não diagnostica. Não substitui profissional.

**Restrição de sequenciamento — inegociável.** Nada de IA antes de: produto principal maduro · histórico confiável · Wash Day · Minha Prateleira · Hair Progress · check-ins ricos · Hair Intelligence · ciclos · cronograma adaptativo · recomendações estruturadas · contexto · dados reais suficientes · regras validadas · segurança e privacidade adequadas.

**Até lá, é proibida infraestrutura antecipada de IA:** embeddings · pgvector · RAG · agentes · chatbot · API de LLM · tabelas de chat · prompts de produção · abstrações de LLM.

**Sem dados suficientes.** Sem história, o assistente não tem o que consultar — e é exatamente por isso que ele vem por último.

**Segurança / privacidade.** Opera sobre o histórico pessoal inteiro. Custo real por uso ⇒ decisão comercial. Ambos são human gates.

**Sucesso.** Ela pergunta e recebe uma resposta que **só o app dela** poderia dar, com as fontes à vista.

**Estado.** **DEFERRED BY DEPENDENCY** — por decisão de sequenciamento, não por falta de compromisso.

---

# 18. Community — `T1`

**Objetivo da usuária.** Encontrar pessoas com cabelo parecido e trocar experiência real.

**Tier.** Transversal.

**Por que fica adiada.** Depende de escala, moderação, segurança, privacidade, experiência social e **massa crítica**. Uma comunidade vazia é pior que nenhuma, e uma sem moderação é passivo — não começo.

**Regras importantes.** Não construir infraestrutura social prematuramente. Conteúdo gerado por usuária traz moderação, denúncia, privacidade e responsabilidade legal — **nada disso é opcional**, e todos são pré-requisito, não melhoria posterior.

**O que NÃO deve fazer.** Não criar tabela de posts "para depois". Não lançar sem moderação. **Não sair do roadmap.**

**Estado.** **DEFERRED BY DEPENDENCY** — por bastante tempo, e sem prazo.

---

# 19. Identidade dela: nome, avatar e foto — `F34` (Free) · `P24` (Premium)

**Objetivo da usuária.** Que o app seja **dela** — que a área de perfil tenha a cara dela e não uma inicial num círculo.

**Problema.** O avatar já está no cabeçalho de toda aba (SPEC-026 fatia 7) e hoje mostra a inicial do nome. Isso é um marcador, não uma identidade.

**Tier (D-102).** **Free: os avatares próprios da Huna** — personalização de verdade, e é personalização que não custa infraestrutura. **Premium: foto própria.**

**Fluxo funcional.** Ela abre Você pelo avatar do cabeçalho → edita o nome → escolhe um avatar da Huna → (Premium) troca por uma foto sua.

**Regras importantes.**
- ⚠️ **Foto é mídia**, e mídia arrasta a mesma dependência do `F28`: storage, custo, privacidade e base legal (D-32). É por isso que a foto **não** nasce junto com o avatar.
- **Não é regressão de D-83/BR3:** foto de perfil nunca existiu no Free, então nada gratuito virou pago.
- O conjunto de avatares é **da marca Huna**, coerente com a identidade visual — não é uma galeria genérica de ícones.

**O que NÃO deve fazer.** Não pedir foto no onboarding. Não usar a imagem dela para nada além de mostrá-la a ela mesma. Não transformar o avatar em requisito.

**Sucesso.** Ela reconhece a própria conta de relance, e a área de perfil deixa de parecer uma tela de configurações.

**Estado.** `F34` **COMMITTED** · `P24` **DEFERRED BY DEPENDENCY** (mídia).

---

# 20. Avaliação capilar ampliada — `F35`

**Objetivo da usuária.** Que o cronograma seja montado para o cabelo **dela**, e não para uma média.

**Problema, medido antes de assumir.** A lista do dono (curvatura · condição atual · química · ressecamento · quebra · frizz · oleosidade · porosidade percebida · frequência de lavagem · objetivos · rotina/disponibilidade · mudanças ao longo do tempo) foi comparada com o que `hair_profiles` **já coleta** (8 inputs, D-62). **Quase tudo já está lá:** `hair_pattern` e `strand_thickness` (curvatura e espessura), `scalp_tendency` (oleosidade), `chemical_treatments`, `heat_usage`, `current_concerns` (ressecamento, quebra, embaraço, opacidade, frizz), `wash_frequency` e `primary_goal`. "Mudanças ao longo do tempo" já são `F17` (reavaliação) e `F23` (`hair_events`).

**O que realmente falta:** **porosidade percebida** · **rotina e disponibilidade real de tempo**. E, se o dono quiser, o objetivo deixar de ser **único**.

**Regras importantes.**
- ⚠️ **Pergunta que o motor não usa é pergunta que só custa o tempo dela** (D-47/D-48). Esta capability entra **junto** com o `F36` — coletar antes de usar transforma o onboarding num formulário.
- **É personalização, não diagnóstico** (D-26). "Porosidade percebida" é a percepção dela, e a palavra *percebida* não é decorativa: ninguém mede porosidade num app.
- O snapshot continua **imutável por `id`** (D-64): ampliar a avaliação **acrescenta colunas**, nunca reescreve um snapshot existente, e os planos antigos continuam explicáveis pelo snapshot que os originou (`F21`).

**O que NÃO deve fazer.** Não perguntar o que não muda nenhuma saída. Não nomear condição. Não transformar em quiz longo o que hoje ela responde em etapas curtas.

**Estado.** **COMMITTED**, acoplada ao `F36`.

---

# 21. Cronograma por necessidade, e a Restauração — `F36`

**Objetivo da usuária.** Que a frequência de cada tratamento venha **da necessidade do cabelo dela**, e não de uma sequência fixa igual para todas.

**Fluxo funcional.** A avaliação (`F35`) alimenta o motor, que decide **necessidade e frequência** de: **Hidratação · Nutrição · Reconstrução · Restauração/recuperação quando fizer sentido**.

**Regras importantes.**
- ⚠️ **Isto é regra capilar, e é o gate D-26 no seu ponto mais claro.** "De quanto em quanto tempo este cabelo precisa de reconstrução" exige **sign-off de domínio**; nasce `candidate`, roda em dev/internal beta, e **PUBLIC RELEASE segue bloqueado** (OQ-REL).
- **Nova versão de engine, nunca edição da liberada** (ADR-001 / CLAUDE.md §2): `schedule/engine/v2`.
- **Restauração é vocabulário novo de `care_type`**, e esse vocabulário hoje atravessa CHECK do banco, os guias (`F8`) e as cores por tipo de cuidado. Qualquer decisão de UI tomada antes disso tem de continuar funcionando com **quatro** tipos — este é o efeito prático imediato de D-102 sobre a fase atual.
- Nenhuma adaptação substantiva sem regra validada. O motor pode variar frequência; ele não pode **afirmar** por quê sem sign-off.

**O que NÃO deve fazer.** Não inventar intervalo com cara de ciência. Não apresentar heurística como fato clínico. Não reescrever plano ativo — mudar de regra gera **novo ciclo**, não reescrita do histórico (D-69).

**Estado.** **COMMITTED**, com o conteúdo **BLOQUEADO por D-26** para release.

---

# 22. Tratamento → Finalização — `F37` (o fluxo) · `F38` (a área)

**Objetivo da usuária.** Terminar o Wash Day como ela realmente termina: **lavou, tratou, finalizou** — e só então contar como ficou.

**Problema.** O `F25` registra o cuidado e os produtos, e para aí. Mas o que decide como o cabelo dela **fica** é em boa parte a finalização, e hoje ela não existe no modelo. Tratada como "mais um cuidado opcional", ela vira nota de rodapé de uma etapa que, para a maioria das usuárias, é parte natural do processo.

**Fluxo funcional (D-102).**

```
LAVOU → TRATAMENTO (Hidratação/Nutrição/Reconstrução/Restauração) → FINALIZAÇÃO → RESULTADO/CHECK-IN
```

Depois do tratamento, a Huna **conduz naturalmente** até a finalização recomendada. **"Pular finalização" existe** — mas o padrão é que ela faz parte da rotina.

**A área de Finalizações (`F38`).** Endereço próprio dentro de **Cuidados**, ao lado dos guias: definição · volume · redução de frizz · leveza · fitagem · técnicas por curvatura (ondulado, cacheado, crespo, liso) · day after · combinações com creme, leave-in, gelatina, óleo. A Huna prioriza **"Finalizações recomendadas para o seu cabelo"** — a partir de curvatura, objetivos e avaliação —, e ainda assim deixa **explorar o resto**: recomendar não pode virar esconder.

**Regras importantes.**
- **Tratamento e finalização são etapas diferentes**, com registro próprio. Fundi-las destrói o `P8`.
- ⚠️ O texto das técnicas **e** o "para o seu cabelo" são **conteúdo capilar substantivo** ⇒ **gate D-26/D-70** para release.
- **Vocabulário fechado**, como as catorze técnicas do `F25`: texto livre não se compara nem se agrega (SPEC-024).
- Personalização **por resultado real dela** é outra coisa, e é Premium (`P5`/`P8`).

**Relações.** `F25`/`F27` Wash Day · `F26` Prateleira (o óleo e o creme que ela usa na finalização são os dela) · `P8` padrões · `F14` check-in de resultado.

**Estado.** `F37` **COMMITTED** · `F38` **COMMITTED**, conteúdo atrás do gate.

---

# 23. Óleo capilar com rotina própria — `F39`

**Objetivo da usuária.** Lembrar do óleo. Simples assim.

**Problema.** Óleo hoje só existe **escondido dentro de Nutrição**. Mas para muita gente ele é uma rotina paralela — nas pontas, entre lavagens, com frequência própria — e uma rotina que o app não conhece é uma rotina que ele não ajuda a manter.

**Fluxo funcional.** Ela define uma rotina de óleo (frequência própria) → o app lembra no dia → ela marca **feito** ou **adia** → com o tempo, o óleo aparece no histórico como qualquer outro cuidado dela.

> *"Hora do seu óleo — você programou óleo nas pontas para hoje."*

**Regras importantes.**
- Tecnicamente é um **quinto intent** no `NotificationScheduler` (SPEC-008 / D-22), que já tem opt-in duplo, teto diário, horizonte e id determinístico. **O domínio não conhece Expo Notifications** — isso não muda. *(A D-102 dizia "quarto"; medido em `NOTIFICATION_INTENT_TYPES`, já existem quatro — `care_overdue`, `care_today`, `checkin_pending`, `reassessment_due` — então o óleo é o quinto. Corrigido em 2026-09-03.)*
- **Adiar é primeira classe**, não um fracasso: a mesma regra do D-28 (mostrar estado e pedir ação; nunca mover o cronograma sozinho).
- Integração futura com a Prateleira (`F26`): o óleo lembrado é **o óleo que ela tem**, nunca um produto inventado (§8).
- ⚠️ **Orientação de momento e forma de uso é conteúdo capilar** ⇒ **gate D-26**. O lembrete e o registro, não.

**O que NÃO deve fazer.** Não notificar sem opt-in. Não passar do teto diário. Não prometer resultado.

**Estado.** **COMMITTED**.

---
---

# 24. Jornada Huna — a gamificação — `F40` · `F41` · `F42` · `F43` · `F44`

**Objetivo da usuária.** Ver que ela está mantendo a própria rotina, e querer manter.

**A frase que define a capability inteira, e da qual tudo aqui deriva:**

> A Huna recompensa **consistência com o plano**, não **quantidade de tratamentos**.

**O que ela representa, e o que não representa.** A Jornada diz *"minha consistência na jornada"*. Ela **não** diz *"quão saudável ou bonito está meu cabelo"* — essa segunda frase seria avaliação capilar, precisaria de revisor (D-26), e o produto já a recusou três vezes (SPEC-009, SPEC-019, SPEC-021).

## ⚠️ A tensão com as recusas já registradas, e como ela se resolve

O produto **recusa pontuar** em três SPECs, com **barreira de teste viva** na aba Progresso que reprova as palavras `score`, `nota`, `pontuação`, `aderência`, `desempenho` e qualquer `\d+%`. Uma camada de pontos parece contradizer isso frontalmente. Não contradiz, e a distinção precisa estar escrita antes de alguém tentar implementar:

- **O que foi recusado é pontuar o CABELO e o CICLO** — dar nota ao resultado dela, transformar contagem em avaliação, dizer "você cumpriu 83%". Isso continua proibido e as barreiras continuam de pé.
- **O que a Jornada mede é a ADERÊNCIA AO PLANO** — um objeto diferente, verificável, que não afirma nada sobre cabelo.

**Consequência de arquitetura, e é dura:** a Jornada tem **superfície própria**. Ela **não** é um widget pendurado na Progresso nem na visão de ciclo — aquelas telas respondem *"o que aconteceu"* e continuam sem nota. Quem implementar isto deve encontrar as barreiras da Progresso **verdes e intocadas** no fim.

## Fluxo funcional

```
fato canônico (care_execution, check-in, wash day, pausa)
        ↓
evento elegível (idempotente, por id do fato)
        ↓
pontos · sequência · marco
        ↓
celebração no lugar dela
```

## Regras importantes

- **Deriva de fato canônico; nunca uma segunda verdade.** O motor **lê** `care_executions`, `checkins`, `wash_days` e `plan_pauses`. Uma contagem paralela divergiria na primeira mudança de regra, e a divergência apareceria como a Huna discordando de si mesma.
- **Idempotência pelo id do FATO, não pela sessão.** O mesmo `care_execution_id` não pontua duas vezes por retry, reload ou reprocessamento. É a mesma disciplina do `client_execution_id` da SPEC-005.
- **Regras de pontuação são versionadas** (padrão do ADR-007). Mudar a régua **não reescreve o passado**: o ponto concedido é **fato datado**, não recálculo. Histórico falsificável é histórico inútil.
- ⚠️ **Pontuação não é regra capilar e não entra no gate D-26/D-70.** Ela fala de aderência. É exatamente por isso que ela não pode se disfarçar de leitura capilar em nenhuma cópia.
- **A sequência (`F41`) não é diária.** Um streak diário num plano de 4 a 12 cuidados por mês só se cumpre lavando mais — o incentivo proibido. Ela conta **cuidado planejado atendido**; **dia sem cuidado planejado não quebra nada**.
- **Pausa real congela a sequência** (`F22`/SPEC-022), e entra na **derivação**, não numa checagem de tela — foi assim que o F22 impediu o progresso de continuar contando durante a pausa.
- **FREE participa integralmente. Premium não tem multiplicador.** Nada de pay-to-win (D-83 + D-103).
- **Nenhum marco se conquista fazendo mais** do que o plano pede.

## O que NÃO deve fazer

Criar incentivo para **lavar mais**, fazer **mais reconstruções**, aplicar **mais produto**, repetir cuidado desnecessário ou agir fora do plano por pontos. Copiar interface ou identidade de Duolingo, Strava, Finch ou Fabulous — os benchmarks são **conceituais**. Pôr nota no cabelo dela por outro nome.

**Relações.** `F5` care tracking (o fato) · `F22` pausa · `F19`/`F29` ciclo · `F45` share · Community (`F44`).

**Estado.** `F40`/`F41`/`F42` **COMMITTED** · `F43`/`F44` **DEFERRED BY DEPENDENCY**.

---

# 25. Social Sharing — `F45` (fundação) · `F46` (momentos) · `F47` (recap) · `P25`

**Objetivo da usuária.** Mostrar o que ela conquistou, do jeito dela, para quem ela quiser.

⚠️ **INEGOCIÁVEL (D-103).** Esta capability não sai do roadmap em replanejamento, não é adiada por conveniência e **não depende da Community**.

**O princípio, emprestado do Strava:**

```
resultado/conquista → card visual bonito → compartilhar → Instagram · WhatsApp · o que estiver instalado
```

## Fluxo funcional

```
momento compartilhável
        ↓
PREVIEW DO CARD  ← ela vê exatamente o que vai sair
        ↓
ela decide (e escolhe o que aparece)
        ↓
share nativo do sistema
```

**Nunca publicação automática.** O preview não é cortesia: é o mecanismo pelo qual ela consente.

## Regras importantes

- **Compartilhamento nativo é a fundação.** Integração direta com um app específico só se trouxer benefício concreto — cada uma é uma dependência e uma superfície de manutenção.
- **Formatos:** ao menos **9:16** (Stories) e um formato de feed/share genérico.
- **Direção visual:** vinho/ameixa/roxo, mechas abstratas da Huna (a mesma linguagem do hero, SPEC-036), **logo discreta**, tipografia forte, dado legível. Card autoral — não um print de tela.
- ⚠️ **Privacidade é parte da capability, não um extra.** Nome, avatar, foto, produto, resultado e estatística são **controláveis**. Dado potencialmente sensível **não entra sozinho**. **`user_id` e dado interno nunca aparecem em card nenhum.**
- ⚠️ **Foto só por seleção explícita.** Antes × Depois e Hair Progress dependem de mídia com base legal (`F28`/`P24`/D-32) e nunca entram automaticamente.
- **O ato de compartilhar é FREE.** Crescimento orgânico não fica atrás de paywall. Um card de insight Premium (`P25`) é Premium **pelo conteúdo**, não pelo botão.

## O que NÃO deve fazer

Publicar sozinho. Pôr dado que ela não escolheu. Vazar identificador interno. Bloquear o botão por ela ser Free. Depender da Community para existir.

**Relações.** `F40`–`F42` Jornada (a conquista) · `F14`/`F29` resultado e ciclo · `F28`/`P24` mídia · `P2` Hair Intelligence (`P25`) · Community (reuso futuro: conquista → compartilhar **na** Community, mesma fundação).

**Estado.** `F45`/`F46` **COMMITTED** (`F45` **INEGOCIÁVEL**) · `F47`/`P25` **DEFERRED BY DEPENDENCY**.

# 26. Como usar este documento

**Ao escolher a próxima capability:** o [backlog](MASTER-PRODUCT-BACKLOG.md) diz o que falta e o que depende do quê; este documento diz o que a capability **significa**. Os dois juntos decidem; nenhum dos dois sozinho.

**Ao escrever uma SPEC:** as seções *Regras importantes*, *O que NÃO deve fazer* e *Estado sem dados suficientes* são matéria-prima direta de Business Rules, Non-Goals e Edge Cases. Se a SPEC contradisser este documento, **uma das duas está errada** — e resolver isso é obrigatório antes de implementar.

**Ao revisar:** *Critério funcional de sucesso* é a pergunta a fazer no DEV real. Não "compila?", mas "a usuária consegue o que esta capability existe para dar?".

**Quando encontrar um caminho melhor:** use-o. Este documento fixa **o que resolver**, não como. Se a mudança alterar materialmente o objetivo ou a proposta de valor, aí é decisão material de produto ⇒ human gate.

## 27. Change log

| Data | Mudança | Autor |
|---|---|---|
| 2026-08-31 | v0.1 — Blueprint criado (D-94) como complemento canônico do MASTER PRODUCT SCOPE (D-92). Tratamento funcional completo das capabilities **ainda não construídas**, que é onde a intenção corre risco de se perder; as **DONE** apontam para a SPEC, que já preserva a intenção com mais autoridade do que um resumo preservaria. Fixa em §1 os princípios inequívocos — Free executa e registra / Premium interpreta, um único tier pago, e as três proibições de honestidade (não inventar causalidade, não inventar dados, não diagnosticar). | agente (§0.3), a partir de decisão humana |
| 2026-09-02 | v0.2 — **D-102 (dono).** Cinco seções novas: §19 identidade (avatares Huna no Free, foto própria no Premium), §20 avaliação capilar ampliada, §21 cronograma por necessidade com a **Restauração** como quarto tipo, §22 **Tratamento → Finalização** e a área de Finalizações, §23 óleo com rotina própria. §7 do backlog passa a fixar o fluxo `Lavou → Tratamento → Finalização → Resultado`. **O achado que muda o trabalho de hoje:** a avaliação que o dono pediu **já é quase toda coletada** — falta porosidade percebida e rotina/disponibilidade —, e o que realmente precisa de cuidado agora é não fechar porta para **um quarto tipo de cuidado**, uma **etapa de finalização** pendurada na execução, um **quinto intent** de notificação e uma **foto de perfil**. | agente (§0.3), a partir de decisão humana |
| 2026-09-03 | **D-103 (dono).** Duas frentes novas COMMITTED, registradas sem interromper o F36 e sem implementação: **Jornada Huna** (`F40` pontos/progressão/níveis · `F41` sequência · `F42` marcos e conquistas · `F43` desafios · `F44` ranking) e **Social Sharing** (`F45` fundação **INEGOCIÁVEL** · `F46` momentos · `F47` recap anual · `P25` cards Premium). **A regra que define a gamificação:** recompensa **consistência com o plano**, nunca quantidade de tratamentos — sequência **não diária**, pausa congela, Free participa, Premium sem multiplicador. **Share é transversal e Free**, com `preview → ela decide → share` e sem `user_id` em card nenhum. **Achado ao registrar:** existe barreira de teste viva na Progresso reprovando `score`/`nota`/`pontuação`/`aderência`/`%` — não é contradição (o recusado é pontuar **cabelo e ciclo**; a Jornada mede **aderência**), mas obriga a Jornada a ter **superfície própria**. | agente (§0.3), a partir de decisão humana |
