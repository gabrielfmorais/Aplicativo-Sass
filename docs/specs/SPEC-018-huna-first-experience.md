# SPEC-018 — Huna: a primeira experiência

| Campo | Valor |
|---|---|
| ID | SPEC-018 |
| Status | **APPROVED v0.1 (agente, §0.2/§0.3, a pedido explícito e detalhado do dono, 2026-08-31)** — direção visual, marca e apresentação. Não muda regra capilar, schema de avaliação nem autorização. |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Nenhum — transversal de apresentação**, como a SPEC-016. Vive em `apps/mobile`. |
| Related ADRs | ADR-001 (UI não contém regra), ADR-007 (gate de domínio), ADR-008 (datas) |
| Related SPECs | SPEC-001 (auth), SPEC-002 (onboarding), SPEC-004 (geração do plano), **SPEC-016 (a fundação que esta evolui)** |
| Fase | Prioridade de produto — pausa temporária do MASTER PRODUCT BACKLOG por decisão do dono |
| Criado | 2026-08-31 |

## 1. Context

O produto tem nome: **Huna**. E tem um problema concreto de primeira impressão — o app **abre numa tela chamada "Entrar"**. Não há marca, não há proposta de valor, não há um momento em que a usuária entenda o que este app é antes de ser convidada a entrar nele.

A SPEC-016 deu ao produto uma identidade visual honesta — base quente, ameixa, escala tipográfica, estados em palavra — e **essa fundação continua válida**. O que falta não é sistema de design: é **a entrada**.

> **DESIGN ATUAL = BASE EM EVOLUÇÃO.** Nada da SPEC-016 é jogado fora. Os tokens evoluem quando houver benefício visual concreto, nunca por preferência.

## 2. Problem

Uma usuária que abre o Huna pela primeira vez encontra um formulário. A sequência inteira — entrar, oito perguntas, um botão, uma tabela — é **eficiente e sem alma**. Ela investe tempo contando sobre o cabelo dela e o produto nunca reage a isso.

Três faltas concretas, medidas no app rodando:

| Momento | Hoje | Deveria |
|---|---|---|
| Abertura | **não existe** — o app começa em "Entrar" | um momento de marca |
| Login | título "Entrar", botões, campo | marca, proposta de valor, confiança |
| Geração do plano | o botão vira "Criando…" e a tabela aparece | *"estamos criando algo para você"* → revelação |

## 3. Goals

- G1 — A usuária entende **o que é o Huna** antes de entrar nele.
- G2 — O login comunica **marca, valor, simplicidade e privacidade** — não é formulário.
- G3 — Um **hero visual com cabelo como protagonista**, com movimento orgânico e sutil.
- G4 — **Uma ideia importante por tela**, com muito espaço e composição mobile excelente.
- G5 — A fundação da SPEC-016 é **evoluída, não substituída**.
- G6 — **Zero dependência nova** (a mesma disciplina da SPEC-016 NG3).

## 4. Non-Goals

- NG1 — **Redesign do app inteiro.** O escopo é a primeira experiência: abertura → login → onboarding → nome → avaliação → momentos → geração → reveal.
- NG2 — Mudar regra capilar, pergunta substantiva da avaliação, schema de avaliação ou autorização.
- NG3 — **Dependência nova**: nada de Lottie, `react-native-svg`, `reanimated` ou biblioteca de animação. O que a plataforma já dá tem de bastar, e basta.
- NG4 — Copiar Flo: identidade, logo, assets, ilustrações, textos, telas ou composição literal.
- NG5 — Paywall na entrada. **D-83 é lei**: nenhuma tela de bloqueio antes do valor.
- NG6 — Qualquer infraestrutura de IA.

## 5. O que aprendemos das referências — e o que recusamos

Analisadas: 9 screenshots do fluxo de onboarding do Flo e 2 vídeos (32s e 1m38s), amostrados em 41 frames.

**Princípios que valem, e por quê:**

| Princípio | Por que funciona |
|---|---|
| Uma ideia por tela, muito espaço | a pergunta parece importante, e a tela parece calma |
| CTA primário fixado, desabilitado até responder | ela nunca procura o botão |
| Barra de progresso no topo | "isto tem fim" |
| **Feedback na própria opção escolhida** | o app **reage a ela** — é a batida emocional mais barata que existe |
| Confirmação com o nome dela | vínculo, sem custo de tela |
| Interstícios entre blocos de perguntas | ritmo; evita fadiga de formulário |
| Loading enquadrado como criação | espera vira antecipação |
| Login como momento de marca | primeira impressão não se repete |

**O que recusamos explicitamente:**

- ❌ **Porcentagem falsa** (o "83%" da referência). Não temos progresso mensurável; inventar número é mentir para criar sensação de progresso.
- ❌ **Prova social que não temos** ("220 milhões de pessoas", depoimentos de 5 estrelas). Números inventados são dados inventados.
- ❌ **Consentimento de dados de saúde.** O Huna não coleta dado de saúde; nossa copy reflete **o nosso** produto e a LGPD real (D-32).
- ❌ **Modal de saída com apelo emocional** (o ursinho chorando). Dark pattern.
- ❌ **Múltiplos planos / plano família.** Existe **um** tier pago.
- ❌ **Paywall logo após o onboarding.** D-83.
- ❌ Rosa clichê, visual de salão, excesso de elementos.

## 6. Functional Requirements

- FR1 — Existe uma **tela de abertura** com a marca Huna, a proposta de valor em poucas palavras, o hero visual e **uma** ação primária.
- FR2 — O **login** é redesenhado como momento de marca e confiança. Os fluxos oficiais (Apple · Google · e-mail) e a arquitetura de segurança **não mudam**. O DEV sign-in continua estritamente separado.
- FR3 — O **hero** é uma composição abstrata de fios em movimento, contínuo, lento e orgânico.
- FR4 — O movimento **respeita a preferência de redução de movimento** do sistema: quando ligada, a composição fica estática.
- FR5 — Tudo compõe dos tokens (SPEC-016 FR2/AC1 continuam valendo).
- FR6 — O nome do produto passa a ser **Huna** onde o app se identifica.
- FR8 *(fatia 3)* — O onboarding tem **ritmo**: a troca de passo é uma transição visível, a opção escolhida **responde ao toque**, e entre blocos de perguntas há uma pausa curta que diz onde ela está. Nada disso é pré-requisito para ler a tela nem para responder.
- FR7 *(fatia 2)* — Depois de entrar e **antes** das perguntas sobre cabelo, o app pergunta **como a usuária quer ser chamada**, e responde com um cumprimento pelo nome. Responder é opcional: **pular não custa nada e é registrado**, para que a pergunta não volte. A pergunta **nunca** impede o uso do app — falha de gravação oferece tentar de novo e seguir.

## 7. Business Rules

- BR1 — A UI não decide nada (ADR-001).
- BR2 — Nenhum texto novo com orientação capilar substantiva (D-26/D-70). Copy de marca e de interface não é conteúdo capilar.
- BR3 — Nenhuma afirmação factual que não possamos sustentar: sem número de usuárias, sem depoimento, sem promessa de resultado.
- BR4 — Acessibilidade não regride: alvo ≥ 44px, rótulo, papel, estado; e o hero é **decorativo** para tecnologia assistiva, nunca conteúdo que ela precise "ver" para agir.

## 8. Data Model Impact

**Fatia 1: nenhum.** **Fatia 2: uma tabela nova, `public.profiles`** — a entidade que D-63 desenhou e adiou "até haver requisito concreto". O requisito é FR7.

| Coluna | Tipo | Por quê |
|---|---|---|
| `user_id` | uuid PK, FK `auth.users` on delete cascade | a linha é dela e morre com a conta |
| `display_name` | text null, `check` 1..60 e `btrim <> ''` | **PII.** Nulo = "prefiro não dizer" |
| `created_at` / `updated_at` | timestamptz not null | `updated_at` por trigger existente |

**A existência da linha é o registro de que já perguntamos**; `display_name` nulo é a resposta "não quero dizer". Sem essa distinção o app perguntaria de novo, a cada abertura, exatamente a quem já disse não.

**Não criadas** (D-47/D-48, e D-63 no caso da última): `timezone` — o fuso viaja na chamada (ADR-008); `locale` — sem consumidor; `onboarding_status` — D-63 derivou "onboarding concluído" da existência de um `hair_profiles`, e continua assim. `DATA-MODEL.md` §3.1/§4.1/§4.2 e o diagrama ER foram reconciliados na mesma PR.

## 9. API / Contracts

**Fatia 1: nenhum.** **Fatia 2: um port novo, nenhuma RPC e nenhuma Edge Function.**

```ts
type UserProfile = { readonly displayName: string | null };
interface ProfilePort {
  get(): Promise<UserProfile | null>;      // null = a pergunta nunca foi feita
  save(displayName: string | null): Promise<void>;
}
```

Mais `DisplayNameSchema` em `packages/core/src/identity/domain/` — a mesma regra que o banco aplica (normaliza espaço, 1..60), para o erro chegar como "faltou algo" e não como falha de escrita. Sem RPC de propósito: não há invariante de servidor aqui, é a declaração dela sobre ela mesma — como `plan_preferences`, e ao contrário de planos e execuções.

## 10. Authorization

**Fatia 1: nada.** **Fatia 2:** posse por RLS, não por RPC. `SELECT`/`INSERT`/`UPDATE` **apenas da própria linha**, com `using` e `with check` em `user_id = auth.uid()` — é o `with check` que impede um cliente adulterado de escrever o nome de outra pessoa. **Sem `DELETE` concedido:** a linha morre por cascade a partir de `auth.users`, e "apagar meu nome" é um `UPDATE` para nulo. Os fluxos de autenticação seguem preservados integralmente.

## 11. Security Considerations

- **Tabela nova (fatia 2):** RLS `enable` + `force`, três policies de linha própria, grants na allowlist, e uma policy `for all to postgres` porque `force` vale também para o dono. **Nenhum `SECURITY DEFINER`.** Coberta por pgTAP (§18).
- Autorização: **inalterada** nos fluxos existentes.
- **DEV sign-in continua com as quatro travas de D-85** e visualmente separado do fluxo real — um desenvolvedor olhando a tela nunca deve confundir os dois.
- PII: **a fatia 2 introduz o primeiro dado pessoal declarado pela usuária** (`display_name`). Não é logado, não vai para analytics (não há — D-31) e não sai do dispositivo dela para lugar nenhum além da própria linha.
- Segredo: nenhum.

## 12. Privacy Considerations

A tela de login **diz** o que o produto faz com os dados dela, em linguagem verdadeira sobre o Huna. Consentimento formal e a tabela `consents` seguem em D-32 — **e esta SPEC não os antecipa nem finge que existem**.

**Fatia 2 — o nome.** É PII, e por isso: (a) a pergunta explica na própria tela para que serve e que não aparece para mais ninguém; (b) responder é **opcional**, com uma saída que é botão de verdade, não link escondido; (c) ela pode apagar o nome depois — `UPDATE` para nulo, e o app volta a não a chamar pelo nome; (d) o dado sai junto com a conta, por cascade. `DATA-MODEL.md` §4.1 passa a listá-lo no inventário do que é coletado hoje. **Nada disso cria consentimento novo nem antecipa a base legal de D-32** — é dado fornecido por ela para a função que ela pediu.

## 13. Analytics Events

**Nenhum** (D-31).

## 14. UX Notes — a direção da Huna

**Identidade.** A base da SPEC-016 permanece: canvas quente, ameixa/vinho como identidade, grafite quente, contraste alto. O que evolui é o **uso**: mais espaço, hierarquia mais forte, menos elementos por tela.

**O hero.** Cabelo como protagonista, **em registro abstrato**: fios que fluem, se sobrepõem e se movem devagar. A escolha do abstrato não é economia — é a resposta certa ao requisito de **diversidade capilar**: ilustrar uma mulher obriga a escolher **um** tipo de cabelo, e o produto atende liso, ondulado, cacheado e crespo. Fios abstratos representam cabelo sem eleger textura.

**Sequência-alvo da primeira experiência:**

```
abertura (marca + hero)
→ login (marca + confiança)
→ onboarding: uma pergunta por tela, com batidas emocionais entre blocos
→ nome + confirmação com o nome
→ criação do plano ("estamos criando", nunca "83%")
→ revelação do primeiro cronograma
```

## 15. Edge Cases

- EC1 — Tela pequena (320pt) e fonte grande do sistema: a abertura **cresce**, não quebra; o hero cede espaço ao texto, nunca o contrário.
- EC2 — Redução de movimento ligada: sem animação, composição estática, nada perdido.
- EC3 — Teclado aberto no campo de e-mail: o CTA continua alcançável.
- EC4 — Safe area (notch, home indicator): a abertura é full-bleed e **respeita** as duas.
- EC5 — Texto longo em pt-BR: sem truncar sentido.

## 16. Failure Modes

Inalterados. A abertura não faz leitura de rede: não tem como falhar por dado.

## 17. Acceptance Criteria

- AC1 — Existe uma abertura com marca Huna, proposta de valor, hero e uma ação primária.
- AC2 — O login não parece formulário e preserva os três fluxos oficiais + o DEV separado.
- AC3 — O hero se move de forma contínua e sutil, e **para** com redução de movimento ligada.
- AC4 — **Zero dependência nova** (`package.json` inalterado nas dependências).
- AC5 — Nenhum literal de cor/espaçamento fora de `design/` (AC1 da SPEC-016 continua).
- AC6 — Acessibilidade: hero decorativo; alvos ≥ 44px; rótulos e estados preservados.
- AC7 — **Validação visual real em viewport mobile (390px)** — testes automatizados **não bastam** para esta fatia.
- AC8 — `pnpm verify` verde. *(Fatia 1: nenhuma mudança em `packages/core`, `supabase/` ou contrato de port. **Fatia 2 muda os três, pelo que §8–§11 descrevem, e só por isso.**)*
- AC9 *(fatia 2)* — A pergunta do nome aparece **uma vez**: quem respondeu e quem pulou não a vê de novo. Uma leitura que **falha** não a faz reaparecer no meio da sessão nem trava a entrada — na dúvida, o app segue.
- AC10 *(fatia 2)* — Nenhum caminho desta tela deixa a usuária presa: erro de gravação oferece tentar de novo **e** seguir sem salvar.
- AC11 *(fatia 2)* — Um cliente adulterado não escreve, não lê e não altera o nome de outra usuária (pgTAP, positivo e negativo).
- AC12 *(fatia 3)* — Entre os blocos de perguntas existem pausas que **não são perguntas**: não entram na contagem, têm volta, e nenhuma delas comenta o cabelo dela, interpreta uma resposta ou promete resultado.
- AC13 *(fatia 3)* — Nenhuma animação começa **antes** de a preferência de redução de movimento ser conhecida, e nenhum conteúdo depende de uma animação para aparecer.

## 18. Testing Strategy

- RNTL: a abertura renderiza, a ação leva ao login, o login preserva os três fluxos, o hero não é anunciado como conteúdo.
- Redução de movimento: teste do comportamento, não da animação.
- **Validação visual obrigatória a 390px** (AC7): scroll, teclado, safe area, textos longos, estados desabilitados.
- Regressão: as suítes de SignIn e Onboarding continuam passando **sem afrouxamento**.
- **Fatia 2** — pgTAP em `supabase/tests/security/090_spec018_profiles.sql`: guardrails de fundação, posse, isolamento entre duas usuárias e os limites do nome (>60 e só-espaço recusados pelo banco). Vitest para `DisplayNameSchema`, incluindo nomes com acento, hífen, apóstrofo e fora do ASCII — recusar um nome real seria dizer a alguém que o nome dela está errado. RNTL para a tela: validação antes de gravar, pular grava nulo e **não** cumprimenta, falha oferece seguir, e durante a gravação não há segundo toque a dar.

## 19. Dependencies

**Nenhuma nova.** Animação com o `Animated` da própria plataforma; composição com Views e tokens.

## 20. Implementation Plan

1. **Abertura + hero + login + marca Huna.** A entrada inteira. ✅ #69
2. **Nome da usuária + confirmação com o nome.** Tabela `profiles`, port, tela. ✅ #70 · composição corrigida na validação a 390px (#71) · **DONE validada no DEV real** (2026-09-01): nome, pular, erro de gravação, nome de 60 caracteres, reload e persistência.
3. **Batidas emocionais e transições no onboarding.** ← esta fatia
4. **Criação do plano + revelação do primeiro cronograma.**

## 21. Migration Plan

Fatia 1: N/A. **Fatia 2:** `supabase/migrations/20260904000000_profiles.sql` — aditiva, cria a tabela, as policies e os grants. Não altera tabela existente, não move dado e não tem passo de backfill: quem já usa o app simplesmente ainda não tem linha, que é exatamente o estado "ainda não perguntamos". Deploy DEV pelo caminho normal de migration; nenhuma Edge Function muda.

## 22. Rollback Plan

Fatia 1: reverter a PR; nada toca core, banco ou contrato. **Fatia 2:** reverter a PR e `drop table if exists public.profiles`. Antes do release não há dado de produção a preservar; depois dele, reverter só o app já basta — a tabela órfã não faz mal a ninguém, e apagá-la apagaria nomes que as usuárias deram.

## 23. Open Questions

- **OQ1 — 🎨 ASSET NECESSÁRIO, REGISTRADO (IMPORTANT).** O hero entregue é uma **textura abstrata** — formas translúcidas curvas, em movimento lento, nos tons da marca. Ele é honesto e bonito no registro dele, mas **não é a ilustração de cabelo que a direção pede**, e não deve ser confundido com ela.

  **O que eu tentei, e o que aprendi.** Quatro iterações com formas nativas: (1) formas largas → manchas sobrepostas; (2) fios estreitos e retos → cerca de listras; (3) leque aberto de 46° → pincel, porque fios convergindo num ponto leem como cerdas; (4) foices opacas → cortina. **A conclusão é estrutural, não de esforço: retângulo plano não vira fio.** Cabelo precisa de curva de verdade, e curva de verdade precisa de *path* — ou seja, `react-native-svg` (dependência nova, §4) — ou de uma ilustração.

  **O que é preciso:** uma ilustração autoral de cabelo em movimento, com diversidade de textura (liso, ondulado, cacheado, crespo), na paleta quente/ameixa, exportável em formato que não exija runtime pesado. **Não improvisei um substituto ruim para dar a fatia por encerrada** — a estrutura (`HairFlow`, com respeito a redução de movimento e tratamento decorativo para leitor de tela) está pronta para receber o asset trocando o conteúdo do palco. *Gatilho:* decisão de marca/ilustração do dono.
- **OQ2 — Logo/wordmark da Huna (IMPORTANT — decisão do dono).** Existe o nome, não existe marca gráfica. *Assunção:* o wordmark é tipográfico, feito com a escala que já temos — o que também mantém a marca fácil de trocar, como o dono pediu.
- **OQ3 — Fonte própria (CAN DEFER).** Reaberta pela direção de marca, mas continua sendo dependência nova (§4) + FOUT. *Assunção:* stack do sistema.
- **OQ4 — Nome do app nas lojas (CAN DEFER).** `app.json` passa a "Huna"; o nome de publicação é decisão comercial do dono.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-01 | v0.3 — **fatia 3 implementada.** FR8, AC12–AC13. `useReduceMotion` extraído para `design/motion.ts` e `Reveal` criado (dois consumidores reais cada, AC3 da SPEC-016); `Chip` responde ao toque ao **marcar**; duas pausas entre os blocos de perguntas, contadas fora da numeração e com volta. **Defeito real corrigido na implementação:** a leitura da preferência de redução de movimento é assíncrona, e o valor inicial otimista fazia a animação começar antes da resposta — quem tinha a preferência ligada via a transição assim mesmo. O estado inicial passou a ser `null` ("ainda não sabemos"), e ninguém anima sem saber. | agente (§0.2/§0.3) |
| 2026-09-01 | v0.2 — **fatia 2 implementada.** FR7, AC9–AC11. `public.profiles` nasce com **uma** coluna de produto (D-63 destravada por requisito concreto; `timezone`/`locale`/`onboarding_status` continuam não existindo). `ProfilePort` + `DisplayNameSchema` no core, adapter sem RPC, posse por RLS + `with check`. §8–§12, §18, §21 e §22 passam a distinguir fatia 1 de fatia 2, e AC8 registra que esta fatia **muda** core/`supabase`/port — por FR7, não por conveniência. | agente (§0.2/§0.3) |
| 2026-08-31 | v0.1 — SPEC criada e aprovada a pedido explícito e detalhado do dono. **Huna** passa a ser o nome oficial de trabalho. Escopo: a primeira experiência, evoluindo a fundação da SPEC-016 sem substituí-la. Referências analisadas e **recusas registradas** (porcentagem falsa, prova social inexistente, consentimento de saúde, dark pattern de saída, múltiplos planos). Hero em registro **abstrato** por decisão de diversidade capilar, com `Animated` da plataforma e **zero dependência nova**. | agente (§0.3) |
