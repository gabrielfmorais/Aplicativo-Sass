# Summary
<!-- O que muda e por quê, em 2–4 linhas. -->

## Related SPEC
<!-- SPEC-NNN (link). Se não há SPEC: por que esta mudança é pequena o bastante para não precisar? -->

## Related ADR
<!-- ADR-NNN ou "nenhuma decisão arquitetural" -->

## Changes
- 

## Security Impact
<!-- RLS/policies/grants tocados? SECURITY DEFINER? Edge Function? Inputs novos validados? Entitlement verificado no servidor? Marque "nenhum" explicitamente. -->

## Database Impact
<!-- Tabelas/colunas/índices/constraints; migration aditiva ou destrutiva; backfill; tipos regenerados? -->

## Screenshots
<!-- se UI -->

## Tests
- [ ] Unit
- [ ] Integration / RLS (pgTAP)
- [ ] Component
- [ ] Golden fixtures (engines)
<!-- Cole o resumo real da execução. -->

## Manual Validation
<!-- Passos executados e resultado. -->

## Migration
<!-- Arquivo(s); ordem; compatibilidade com app antigo. "N/A" se não há. -->

## Rollback
<!-- Como reverter código e dados. -->

## Risks
<!-- O que pode dar errado; o que ficou fora do escopo. -->

## Checklist
- [ ] Sem segredos no diff
- [ ] Sem PII em logs/eventos
- [ ] Escopo limitado à SPEC (sem refactor não relacionado)
- [ ] Docs atualizadas (DATA-MODEL / DOMAIN-MAP / README do contexto)
- [ ] Labels aplicadas (`security`, `db`, `engine`, `deps`, `docs`)
