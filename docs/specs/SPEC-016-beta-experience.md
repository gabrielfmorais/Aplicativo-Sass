# SPEC-016 — Beta Experience: identidade visual, design system e refinamento da jornada

| Campo | Valor |
|---|---|
| ID | SPEC-016 |
| Status | **APPROVED v0.1 (agente, §0.2/§0.3 — D-88, 2026-08-31)**, a pedido explícito do dono. Nada aqui muda regra de negócio, schema, autorização ou domínio capilar; é apresentação, e apresentação é reversível arquivo a arquivo. |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Nenhum — transversal de apresentação.** Não cria conceito de domínio e não entra no DOMAIN-MAP: vive inteiramente em `apps/mobile` (DOMAIN-MAP §5, o lado de UI), consumindo os contextos que já existem. |
| Related ADRs | ADR-001 (arquitetura: UI não contém regra), ADR-008 (datas) |
| Related SPECs | Todas as de produto — 001, 002, 004, 005, 006, 007, 008, 009, 010, 014, 015 — pelo lado da tela, nunca pelo da regra |
| Fase do roadmap | Entre 9 e 10: transformar o produto funcional em produto apresentável antes do beta |
| Criado / Atualizado | 2026-08-31 / 2026-08-31 |

## 1. Context
O core está completo: onboarding → plano → Hoje → execução → check-in → Progresso → reavaliação → conta → customização premium. O loop diário e o mensal fecham. E, olhando o app rodando no preview web, ele **parece o que é: um protótipo funcional**. Fonte do sistema, cinza neutro, borda de 1px, preto sólido como único estado "selecionado", nenhuma escala tipográfica ou de espaçamento, oito perguntas empilhadas numa rolagem só.

Isso foi correto até aqui — as fatias anteriores compraram comportamento, não aparência, e cada uma disse isso explicitamente ("UI funcional mínima"). A dívida foi contraída de propósito. Agora ela vence.

## 2. Problem
Um beta não é julgado só pelo que faz. Uma usuária decide em segundos se um app de cuidado pessoal merece a rotina dela, e hoje o produto **não passa nesse teste** — não por falta de função, mas por falta de identidade, hierarquia e acabamento. Além disso, cada tela foi construída em fatia própria com estilos locais: não há vocabulário compartilhado, então cada nova tela reinventa botão, espaçamento e cor, e a inconsistência cresce sozinha.

## 3. Goals
- G1 — **Identidade visual própria e consistente**, aplicada por tokens em vez de valores soltos.
- G2 — **Design system mínimo e real**: tokens + primitivas com consumidor imediato. Nada especulativo.
- G3 — Hierarquia e ritmo visual: tipografia, espaçamento e densidade que guiam o olho.
- G4 — Estados completos e bonitos: selecionado, loading, vazio, erro, ação em curso, sucesso.
- G5 — Onboarding **muito** mais refinado — é a primeira impressão real do produto.
- G6 — Acessibilidade preservada e melhorada: contraste, alvo ≥ 44–48px, rótulos, `accessibilityState`.
- G7 — Premium parecendo **evolução natural**, nunca free degradado (D-83).

## 4. Non-Goals
- NG1 — **Mudar regra de negócio, schema, RLS, RPC ou engine.** Zero. Se uma mudança visual pedir isso, ela sai do escopo.
- NG2 — Reescrever arquitetura. As telas continuam recebendo ports por props; a composition root não muda de forma.
- NG3 — **Dependência nova** (biblioteca de UI, fonte custom, animação, ícones). §4 é gate; e o primeiro passo não precisa. Fica como OQ.
- NG4 — Web como plataforma de produto (D-80). O preview é onde se olha, não para onde se desenha.
- NG5 — Purchase flow / paywall transacional — segue nos gates externos (D-79/D-86).
- NG6 — Ilustração, fotografia e motion design elaborados. Sem asset pipeline nesta fatia.
- NG7 — Android, community, dark mode. DEFERRED explicitamente.

## 5. User Stories
- US1 — Como usuária nova, quero que o onboarding pareça uma conversa curta e cuidadosa, não um formulário, para eu confiar no que vem depois.
- US2 — Como usuária diária, quero abrir a Hoje e entender em um olhar o que fazer agora.
- US3 — Como usuária, quero que uma ação minha tenha resposta visível e imediata.
- US4 — Como usuária free, quero ver o que o premium acrescenta sem me sentir bloqueada.

## 6. Functional Requirements
- FR1 — Um módulo `apps/mobile/src/design/` expõe **tokens** (cor, tipografia, espaçamento, raio, elevação) e **primitivas** (`Screen`, `Text`, `Button`, `Chip`, `Card`, `Field`, `ProgressBar`). Toda primitiva nasce com pelo menos um consumidor real na mesma PR.
- FR2 — Valor visual literal (`'#1c1c1e'`, `padding: 14`) em tela de produto passa a ser bug: a cor e o espaço vêm do token.
- FR3 — O onboarding vira **fluxo em etapas**, uma pergunta por vez, com progresso visível e navegação para frente e para trás; as perguntas, as opções e a validação **são exatamente as da SPEC-002**.
- FR4 — Toda tela tem os quatro estados desenhados: conteúdo, carregando, vazio, erro com retry.
- FR5 — Tipo de cuidado ganha cor semântica consistente em todo o app (hidratação/nutrição/reconstrução).
- FR6 — Premium é apresentado como capacidade a mais, nunca como remoção do free (D-83/G7).

## 7. Business Rules
- BR1 — **A UI não decide nada.** Continua sem regra de negócio (ADR-001/CLAUDE.md §2); o que muda é como o resultado é mostrado.
- BR2 — Nenhum texto novo com orientação capilar substantiva. Copy de interface (rótulo, estado vazio, erro) não é conteúdo capilar; qualquer frase que oriente cuidado cai no gate D-26/D-70.
- BR3 — Nenhuma capacidade hoje gratuita passa a ser premium (D-83).
- BR4 — Acessibilidade não regride: todo controle mantém `accessibilityRole`, rótulo e estado; alvos ≥ 44px.

## 8. Data Model Impact
**Nenhum.** Ver `docs/architecture/DATA-MODEL.md` — nenhuma tabela, coluna, índice ou constraint é tocada. Se uma fatia desta SPEC precisar de dado novo, ela para e vira SPEC própria.

## 9. API / Contracts
**Nenhum contrato novo.** Nenhuma RPC, Edge Function ou port muda de assinatura por motivo visual. Props de componente são contrato interno da UI e podem mudar livremente.

## 10. Authorization
**Nada.** Nenhuma decisão de acesso é tomada, movida ou alterada. O gate premium continua onde está: no servidor (SPEC-015 FR3). `EntitlementService` no cliente continua sendo só UI.

## 11. Security Considerations
Checklist SECURITY-BASELINE §13:
- Tabela/coluna nova + RLS: **N/A**, nenhuma.
- Autorização server-side: **inalterada**.
- Inputs validados: inalterados — o onboarding em etapas usa a **mesma** validação da SPEC-002; dividir em telas não afrouxa nada, e o servidor continua sendo quem decide.
- Cliente adulterado: superfície inalterada.
- **PII:** a UI não passa a exibir, logar ou emitir dado que já não exibisse. Sem texto livre novo (ver `DATA-MODEL.md` §4 — a ausência de campo livre é propriedade a preservar).
- Segredo: nenhum.

## 12. Privacy Considerations
Nenhum dado novo coletado, derivado ou exibido. Nenhum evento novo.

## 13. Analytics Events
**Nenhum.** Continua adiado com o provider (D-31/Fase 10). Não construir emissor sem consumidor.

## 14. UX Notes — a direção visual escolhida
Público: mulheres jovens/adultas querendo cuidar melhor do cabelo com orientação simples. Nível de acabamento de apps modernos de wellness/beauty, **com identidade própria** — nada de copiar interface, composição ou assets de ninguém.

Princípios, nesta ordem:
1. **Clareza antes de charme.** Se um enfeite disputa atenção com a ação, o enfeite sai.
2. **Leveza.** Espaço em branco generoso; a tela respira em vez de encher.
3. **Confiança.** Tipografia estável, contraste alto, nada de infantil.
4. **Calor.** Base neutra **quente** (osso/areia), não cinza frio — a diferença entre "clínico" e "cuidado".

Decisões de identidade (D-88): base neutra quente · tinta grafite quente em vez de preto puro · **um** acento saturado (ameixa profunda) — adulto e feminino sem cair no clichê de rosa · cores semânticas por tipo de cuidado, que informam em vez de decorar · cantos suaves · elevação discreta, quase sem sombra.

**Sem fonte custom nesta fatia**: seria dependência nova (§4) mais carregamento e *flash of unstyled text*. A stack do sistema, com escala e pesos bem usados, chega longe; fonte própria vira OQ com gatilho.

## 15. Edge Cases
- EC1 — Texto longo em pt-BR (rótulos de chip são compridos): nada pode truncar sentido nem quebrar layout.
- EC2 — Fonte grande do sistema (Dynamic Type): a tela cresce, não quebra.
- EC3 — Tela estreita (320pt): as primitivas seguem legíveis e tocáveis.
- EC4 — Onboarding em etapas: sair no meio, voltar, mudar resposta anterior — nada se perde e nada é salvo antes da confirmação final (SPEC-002 inalterada).
- EC5 — Conexão lenta: estado de carregando é desenhado, não uma tela branca.

## 16. Failure Modes
Inalterados. O que muda: falha passa a ter forma — mensagem legível, retry visível, e nunca uma tela em branco. Em desenvolvimento, o motivo real continua aparecendo (D-87).

## 17. Acceptance Criteria
- AC1 — Nenhuma tela de produto contém cor ou espaçamento literal; tudo vem de `design/tokens`. (verificável por lint/grep)
- AC2 — Onboarding em etapas produz **exatamente** o mesmo `HairProfileInput` que a versão em rolagem única, para as mesmas respostas. (unit/RNTL)
- AC3 — Toda primitiva tem consumidor real; nenhuma existe "para depois". (revisão de PR)
- AC4 — Toda tela demonstra conteúdo/carregando/vazio/erro. (RNTL)
- AC5 — Acessibilidade não regride: role, rótulo e estado em todo controle; alvos ≥ 44px. (RNTL)
- AC6 — `pnpm verify` verde; nenhuma mudança em `packages/core`, `supabase/` ou contrato de port.

## 18. Testing Strategy
- RNTL por tela: estados e comportamento, nunca aparência pixel a pixel — teste de screenshot seria frágil e não é o que protege a usuária.
- Unit nas primitivas onde houver lógica (ex.: progresso, passos).
- **Regressão é o que mais importa:** as suítes existentes das SPECs 002/005/006/009/015 continuam passando **sem afrouxamento**. Se um teste antigo precisar mudar, a mudança é justificada por escrito na PR ou o código está errado.
- Validação visual no preview web (D-80), por fatia.

## 19. Dependencies
`react-native` e o que já existe. **Nenhuma dependência nova** (NG3). Nenhum serviço, credencial ou custo.

## 20. Implementation Plan
Fatias pequenas, cada uma verificável e mergeável sozinha:
1. **Tokens + primitivas + Onboarding em etapas + SignIn.** A primeira impressão inteira, e o sistema nasce com consumidor.
2. **Hoje + execução do cuidado + check-in.** A tela do dia a dia, onde a usuária mais volta.
3. **Plano/preview + Progresso.** O momento "isto é meu" e a leitura de evolução.
4. **Conta + Plan Customization/Premium.** Premium como evolução (G7).
5. **Passada de consistência** e `improve --full` antes do beta.

## 21. Migration Plan
N/A — sem dado, sem schema, sem migration.

## 22. Rollback Plan
Reverter a PR da fatia. Como nenhuma fatia toca core, banco ou contrato, o rollback é sempre local à apresentação.

## 23. Open Questions
- **OQ1 — Fonte própria (CAN DEFER).** Uma tipografia própria elevaria muito a percepção, mas é dependência (§4) + carregamento + FOUT. *Assunção:* stack do sistema bem usada nesta fatia. *Gatilho para reabrir:* quando a identidade estiver estabilizada e houver decisão de marca.
- **OQ2 — Ícones (CAN DEFER).** Hoje não há nenhum. *Assunção:* seguir sem, usando tipografia e cor para hierarquia; se virar necessidade real, avaliar `@expo/vector-icons` (já vem com o SDK, então talvez nem seja dependência nova).
- **OQ3 — Dark mode (CAN DEFER).** *Assunção:* fora. Os tokens são estruturados para permitir depois sem reescrita.
- **OQ4 — Motion (CAN DEFER).** *Assunção:* só transições baratas nativas; sem `reanimated` (dependência).
- **OQ5 — Nome e marca do produto (IMPORTANT — decisão do dono).** O app se chama "Hair Care Foundation" no `app.json`, que é nome de andaime. **Decisão de marca é material e é do dono**; enquanto não houver, a identidade é construída sem depender de um nome específico, e nada no design fica preso a ele.

## 24. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-31 | v0.1 — SPEC criada e aprovada (D-88) para o milestone Beta Experience. Escopo: identidade, design system e refinamento da jornada, **sem** tocar regra, schema, autorização ou domínio capilar. Direção visual decidida em §14; fonte custom, ícones, dark mode e motion ficam como OQ com gatilho; nome/marca é decisão do dono (OQ5). | agente (§0.3) |
