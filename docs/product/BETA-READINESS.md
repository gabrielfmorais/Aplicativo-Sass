# Beta readiness — o que falta, e de quem depende

**Atualizado:** 2026-09-08 (checkpoint após SPEC-057/058 catálogo populado e SPEC-059 Jornada; auditoria `--full` re-executada — limpa).
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

### G4 — Catálogo de produtos reais (SPEC-057/058) — **o gate ENCOLHEU; a ingestão deixou de ser gate**
- **Estado:** ✅ **o catálogo está POPULADO.** SPEC-057/058 ingeriram **~3.901 produtos de cabelo** do **Open Beauty Facts** (dados ODbL/DbCL, imagens CC BY-SA — **uso comercial permitido, sem contrato/pagamento/aceite**), com busca por **autocomplete** (RPC + trigram), EAN, foto (~90%) e cobertura BR (Eudora incluída). A ingestão OBF foi **resolvida autonomamente** e **não é mais gate** — conformidade cláusula a cláusula em `docs/legal/OPEN-BEAUTY-FACTS-COMPLIANCE.md`. A prateleira manual continua inteira por baixo.
- **O que resta (dono, opcional para beta — qualidade, não bloqueio):** **fotos oficiais e profundidade** das marcas BR (esp. Grupo Boticário / Eudora / Siàge) exigem **GS1 Brasil / CNP** ou **autorização direta por marca**. Identidade real **sem** foto oficial já existe hoje, então isso é refinamento. **F33 scanner** soma dependência nativa de câmera (ver G7). Ampliar OBF para **produção** é decisão de release.
- **Desbloqueia:** fotos oficiais BR e a qualidade máxima de **P18** — mas o **F32 em si já está utilizável** em dev/beta.

### G5 — IAP / assinaturas (SPEC-010 Parte 2, DEFERRED) — contas de loja + custo
- **Estado:** toda a cadeia de entitlements é provider-agnóstica e testada; falta o **adapter nativo RevenueCat** (`react-native-purchases`), a conta RevenueCat e os produtos nas lojas. **Sem isso ninguém consegue virar premium** → a hipótese de monetização (H5) não é mensurável.
- **Quem age (dono):** conta RevenueCat, App Store Connect + Google Play Console, produtos/preços configurados (preço e período vêm da loja em runtime, nunca hard-coded — D-83).
- **Desbloqueia:** o fluxo de compra premium e a medição de conversão.

### G6 — Provider de analytics (D-31) — custo real
- **Estado:** não há provider de analytics escolhido.
- **Quem age (dono):** decisão de custo/provider.
- **Desbloqueia:** medição de ativação/retenção/conversão e a Fase 10 (release).

### G7 — Build nativo (DEFERRED por constraint do dono — "não reabrir") — ⚠️ **o peso deste gate MUDOU com a decisão iPhone-first**
- **Estado:** Android Studio/AVD/Gradle local indisponível por decisão do dono. O preview web é o único ambiente visual.
- **Quem age (dono):** só se/quando reabrir o ambiente nativo. Para **iOS** especificamente: simulador do Xcode (Mac) ou EAS build, o que também toca o G5 (conta Apple Developer).
- **Desbloqueia a *validação* de:** notificações locais reais (agendamento/disparo/deep link), persistência segura de sessão/reinstalação, IAP nativo, rasterização do share card (`toDataURL`) + folha de compartilhamento, e a câmera do scanner (F33). Tudo isso já está implementado com degradação honesta no web; falta **exercer no nativo**.
- ⚠️ **E agora, a área segura, o teclado e os gestos do iPhone (SPEC-060).** O navegador reporta inset **0** e não tem teclado do iOS, então **a classe inteira de defeito iPhone-first é invisível no preview web** — foi por isso que ela sobreviveu a 59 SPECs com o CI verde. A SPEC-060 corrigiu o que era corrigível e provou o mecanismo com **inset injetado em teste**, que é a prova disponível sem aparelho; o que **falta medir num iPhone real** é: o inset num aparelho com Dynamic Island, o `KeyboardAvoidingView` com o teclado do sistema aberto, o descarte por arrasto, o lembrete disparando em primeiro plano, e a `StatusBar`.

---

## 2. Estado técnico — o que está pronto (medido)

- **Banco DEV** provisionado: `check:remote-schema` → todas as 25 tabelas + colunas presentes (ref `ayecidupmxmirwfzwtea`).
- **Edge Functions** deployadas: `check:remote-functions` → 3 funções.
- **Auth dev + jornada real** validada de ponta a ponta a 390px.
- **Guardrails executáveis** verdes: `pnpm verify` (typecheck, lint, testes, boundaries, dep-cruise, data-model, migration-versions, security-exceptions, entitlement-parity, **safe-area**), pgTAP de segurança, `deno test` das functions, e as proteções LEVEL 2 da `main`.

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

## 4. Auditoria `--full` de re-checkpoint (2026-09-08, após SPEC-057/058/059)

Segunda varredura repositório-inteiro, focada na integração das três frentes recém-merged (catálogo real + Jornada visual) com o resto. **Resultado: zero BLOCKER, zero IMPORTANT.** Pressão-testados e limpos: `catalog_search` não vaza rascunho (`SECURITY INVOKER` + RLS + `published_at not null`, pgTAP prova); ingestão idempotente (`on conflict (ean)` casa o índice único parcial, `sqlLit` escapa aspas); matemática da Jornada sem divisão por zero nem valor negativo (`ProgressBar` guarda `total>0`, `levelSpan` sempre `>0` ou `null` no topo). Sem alegação capilar no catálogo/Jornada (D-26); sem cobrança/multiplicador na Jornada (D-103).

**Corrigido autonomamente:**
- **Deriva de doc** — `DATA-MODEL.md §3.21` dizia "catálogo vazio / TRUE HUMAN GATE" e omitia as colunas de SPEC-057/058 (`open_licensed`, `source_url`, `data_license`, `image_license`, `search_text`) e a RPC `catalog_search`. Atualizado para o estado medido (#163).
- **Consistência de identidade** — o chip de marcação do Wash Day mostrava o nome solto enquanto a prateleira e a execução já mostravam a marca do catálogo; alinhado ao padrão da `CareProductsPanel` (SPEC-054 FR6/G4), validado a 390px (#164).

**Aceito (follow-up, fora de blast radius):** nomes muito longos de OBF transbordam o `Chip` (primitiva compartilhada) — pré-existente, o prefixo de marca deixa a visão cortada mais identificável; rodada própria de `numberOfLines`/`maxWidth` quando valer.
