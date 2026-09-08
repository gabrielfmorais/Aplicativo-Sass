# Beta readiness — o que falta, e de quem depende

**Atualizado:** 2026-09-08 (checkpoint após SPEC-045 Wash Day e SPEC-056).
**Resumo:** o produto está **funcional de ponta a ponta em dev/beta interno** — a jornada real (sign-in dev → onboarding → cronograma → Hoje → registro → check-in → jornada) foi medida no DEV real. O que separa isto de um **beta público** não é engenharia de features: é um conjunto de **TRUE HUMAN GATES** (credenciais externas, sign-off profissional, base legal, contas de loja, custo real) que só o dono pode destravar. O agente segue construindo o roadmap desbloqueado sem esperar por eles.

Este documento é o registro **separado** desses gates (pedido do dono). O pacote de decisões que precisa de revisão profissional capilar está em **[DOMAIN-SIGNOFF-PACKAGE.md](DOMAIN-SIGNOFF-PACKAGE.md)**.

---

## 1. TRUE HUMAN GATES (bloqueiam beta/release; não são do agente)

Cada gate tem: **o que é · quem age · o que desbloqueia**. Nenhum é resolvível por código.

### G1 — Auth de produção (D-84 / D-85 / D-86) — **o maior bloqueador de beta**
- **Estado medido:** no projeto DEV, o provider **Google não está habilitado**, a confirmação de email é obrigatória, o email embutido está em `429 over_email_send_rate_limit`, e o template manda **Magic Link**, não o código de 6 dígitos que a UI pede. **Nenhum fluxo de login de produto funciona hoje.** O DEV sign-in (`signInWithPassword`, web, `.env.local`) desbloqueia **só a visualização** e **não conta** (D-86).
- **Quem age (dono, externo):** console do Google (habilitar provider + credenciais OAuth + redirects), conta **Apple Developer** (Sign in with Apple), **custom SMTP** ou provider de email para o Email OTP entregar o código que a UI espera, e as allowlists de redirect/callback por plataforma (`haircare://`, universal/app links).
- **Desbloqueia:** **qualquer beta ou publicação** (D-86: auth real testado nos fluxos reais é requisito obrigatório).

### G2 — Sign-off de domínio capilar (D-26 / D-70 / OQ-REL)
- **Estado:** regras de cronograma (v1/v2), guias (SPEC-007), vocabulário de finalizações e de marcas de check-in são `candidate` — usáveis em dev/beta, **PUBLIC RELEASE bloqueado**.
- **Quem age:** um profissional de cuidados capilares. Detalhe e itens em **[DOMAIN-SIGNOFF-PACKAGE.md](DOMAIN-SIGNOFF-PACKAGE.md)**.
- **Desbloqueia:** PUBLIC RELEASE do core (cronograma + guias + marcas) e a camada de recomendação/insight mais valiosa do Premium.

### G3 — Base legal / mídia (D-32) — a tabela `consents` não existe
- **Estado:** não há base legal LGPD nem `consents` (SPEC-013 deferida) para dado de saúde e mídia.
- **Quem age:** dono + jurídico.
- **Desbloqueia:** **F28** (fotos de evolução), **P24** (foto de perfil própria), **P9/P10/P11** (progresso fotográfico, timeline, antes×depois), e a **metade `couro`** do check-in / **P15** (junto com G2).

### G4 — Catálogo de produtos reais — ingestão (SPEC-054 §26)
- **Estado:** a infraestrutura está pronta e testada (busca, EAN, imagem com trava de direito por `CHECK`, vínculo com a prateleira); **zero linha ingerida**. A prateleira manual funciona inteira sem ele.
- **Quem age (dono):** acesso a uma fonte legalmente utilizável — **GS1 Brasil / CNP** (a API só devolve o produto quando o dono da marca autorizou compartilhar — a autorização é a condição de existência do dado; exige associação da empresa à GS1 e pedido de acesso), **autorização direta por marca**, ou **Open Beauty Facts** (identidade sem foto oficial). **Feed de afiliado não serve** (licença de imagem só vale para levar tráfego — vira `T2`, não `F32`). Direito de imagem e possível custo/contrato.
- **Desbloqueia:** **F32** catálogo populado, **F33** scanner com significado, e a qualidade de **P18** (recomendações com produtos reais).

### G5 — IAP / assinaturas (SPEC-010 Parte 2, DEFERRED) — contas de loja + custo
- **Estado:** toda a cadeia de entitlements é provider-agnóstica e testada; falta o **adapter nativo RevenueCat** (`react-native-purchases`), a conta RevenueCat e os produtos nas lojas. **Sem isso ninguém consegue virar premium** → a hipótese de monetização (H5) não é mensurável.
- **Quem age (dono):** conta RevenueCat, App Store Connect + Google Play Console, produtos/preços configurados (preço e período vêm da loja em runtime, nunca hard-coded — D-83).
- **Desbloqueia:** o fluxo de compra premium e a medição de conversão.

### G6 — Provider de analytics (D-31) — custo real
- **Estado:** não há provider de analytics escolhido.
- **Quem age (dono):** decisão de custo/provider.
- **Desbloqueia:** medição de ativação/retenção/conversão e a Fase 10 (release).

### G7 — Development build nativo (DEFERRED por constraint do dono — "não reabrir")
- **Estado:** Android Studio/AVD/Gradle local indisponível por decisão do dono. O preview web é o único ambiente visual.
- **Quem age (dono):** só se/quando reabrir o ambiente nativo.
- **Desbloqueia a *validação* de:** notificações locais reais (agendamento/disparo/deep link), persistência segura de sessão/reinstalação, IAP nativo, rasterização do share card (`toDataURL`) + folha de compartilhamento, e a câmera do scanner (F33). Tudo isso já está implementado com degradação honesta no web; falta **exercer no nativo**.

---

## 2. Estado técnico — o que está pronto (medido)

- **Banco DEV** provisionado: `check:remote-schema` → todas as 25 tabelas + colunas presentes (ref `ayecidupmxmirwfzwtea`).
- **Edge Functions** deployadas: `check:remote-functions` → 3 funções.
- **Auth dev + jornada real** validada de ponta a ponta a 390px.
- **Guardrails executáveis** verdes: `pnpm verify` (typecheck, lint, testes, boundaries, dep-cruise, data-model, migration-versions, security-exceptions, entitlement-parity), pgTAP de segurança, `deno test` das functions, e as proteções LEVEL 2 da `main`.

## 3. Auditoria técnica de checkpoint (2026-09-08)

Varredura repositório-inteiro em três frentes (segurança/RLS · código morto/deriva de docs · estados/navegação mobile). **Segurança: limpa** — as 25 tabelas têm RLS + FORCE, nenhum grant a `anon`, todo `SECURITY DEFINER` fixa `search_path` e valida `auth.uid()`, nenhum `@supabase/*` fora de `infrastructure`, nenhum check de entitlement fora do `EntitlementService`. Navegação e a matriz carregando/vazio/erro/retry: **completas** em todas as telas.

**Gaps reversíveis encontrados e corrigidos autonomamente:**

| Gap | Sev. | Correção |
|---|---|---|
| Pausar/retomar não travava o duplo toque **e engolia a falha** — a única escrita do app cuja falha não mostrava nada (o board recarregava calado ainda despausado) | IMPORTANT | O `PauseCard` passou a ser dono da escrita: a promessa é devolvida, ele trava o botão enquanto está no ar e nomeia a falha. Teste de duplo toque e de falha. |
| `AccountScreen` (solicitar/cancelar exclusão, sair) sem trava de duplo toque | IMPORTANT | Trava `busy` no `act`, botões `disabled` enquanto no ar. Teste de duplo toque. |
| `CLAUDE.md` §0 se contradizia sobre o motor corrente (dizia `v1` em dois lugares enquanto código+teste rodam `v2`) | IMPORTANT (doc) | As duas frases pré-virada marcadas como históricas; o estado corrente (`v2`, #144) afirmado, alinhado a `build-plan.ts`. |
| `wash_day_techniques` sem asserção pgTAP de isolamento no SELECT (as duas tabelas irmãs tinham) | OPTIONAL | Asserção acrescentada (plan 18 → 19). |

**Gaps aceitos (não corrigidos, por necessidade):**
- `catalogFullName` (core) é export sem consumidor — helper de exibição do catálogo (SPEC-054), provável consumidor no `F48`; removê-lo agora é churn. Revisitar se o `F48` de exibição não materializar.
- Rotina de óleo não tem indicador de carregando (superfície de config; leitura silenciosa é comportamento documentado e aceitável).
- `DOMAIN-MAP.md` (mapa de contextos, não inventário) não lista ~7 tabelas recentes — por design; `DATA-MODEL.md` (o inventário) está completo e é verificado no CI.

**Validação:** `pnpm verify` verde; pgTAP roda no CI (stack local de supabase indisponível nesta máquina — CI é o gate autoritativo do SQL).
