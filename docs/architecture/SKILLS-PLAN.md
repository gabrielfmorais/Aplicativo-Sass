# SKILLS PLAN — Workflows repetíveis para o agente

| Campo | Valor |
|---|---|
| Status | Draft v0.1 |
| Princípio | Skill encapsula **procedimento**; nunca substitui arquitetura, SPEC ou revisão humana. Cada skill tem guardrails e limites. |

Skills vivem em `.claude/skills/<nome>/SKILL.md` (criadas na fase Foundation, **não agora**). Skills built-in já disponíveis e reaproveitadas: `/security-review`, `/code-review`, `/simplify`.

## Skills recomendadas para o MVP (5)

### 1. `/spec-create <contexto> <título>`
- **Responsabilidade:** criar `SPEC-NNN` a partir do template, com número sequencial, preenchendo Context/ADRs relacionados a partir do DOMAIN-MAP.
- **Inputs:** contexto, título, descrição informal.
- **Outputs:** arquivo em `docs/specs/`, entrada no índice, lista de Open Questions classificadas.
- **Passos:** ler DOMAIN-MAP e ADR index → próximo número → gerar rascunho → marcar seções não respondidas como `TODO` → checklist de DoR.
- **Guardrails:** status sempre `Draft`; não implementa nada; não inventa regras de negócio (marca como OQ).

### 2. `/spec-review SPEC-NNN`
- **Responsabilidade:** validar Definition of Ready; checar consistência com ADRs, DATA-MODEL, RLS strategy, catálogo de eventos.
- **Outputs:** relatório com bloqueios / sugestões; não edita a SPEC sem pedido.
- **Guardrails:** read-only.

### 3. `/rls-review [migration-file | tabela]`
- **Responsabilidade:** para cada tabela tocada: RLS ON + FORCE? grants mínimos? policies por verbo com ownership? `SECURITY DEFINER` na allowlist? teste pgTAP positivo/negativo existe? `(select auth.uid())`? índice em `user_id`?
- **Outputs:** matriz tabela × verbo × status + lista de gaps.
- **Guardrails:** read-only; nunca "corrige" policy sozinha; sugere diff.

### 4. `/migration-review <arquivo>`
- **Responsabilidade:** classificar migration (aditiva/destrutiva), verificar pequenez, idempotência (`if not exists` quando cabível), seção `-- ROLLBACK`, impacto em app antigo, necessidade de backfill, lock em tabelas grandes.
- **Outputs:** veredito `SAFE / NEEDS-HUMAN / BLOCKED` + razões.
- **Guardrails:** read-only; migrations destrutivas sempre `NEEDS-HUMAN`.

### 5. `/pre-commit-review`
- **Responsabilidade:** revisar o diff atual contra `CLAUDE.md`: escopo vs SPEC, fronteiras de camada (imports proibidos), regra em UI, `new Date()`, PII em logs/eventos, segredos, testes removidos, dependências novas.
- **Outputs:** lista de violações + arquivos fora de escopo.
- **Guardrails:** read-only; não commita.

## Skills adiadas (criar quando houver necessidade real)
| Skill | Quando |
|---|---|
| `/adr-create` | Baixa frequência; template manual basta por ora |
| `/module-create` | Após 2 contextos implementados manualmente (para copiar o padrão real, não um hipotético) |
| `/test-feature` | Quando E2E (Maestro) existir |
| `/release-check` | Fase Release (checklist stores/LGPD/observabilidade) |
| `/engine-version-bump` | Quando existir v2 de algum engine |

## Regras gerais
- Skills read-only por padrão; skills que editam arquivos declaram exatamente quais.
- Skill nunca executa migration, deploy, instalação de dependência ou push.
- Skill que falha em obter contexto (SPEC ausente) para e reporta em vez de assumir.
