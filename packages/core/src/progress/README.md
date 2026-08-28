# progress (bounded context)

Implementado na **SPEC-009** (Progress v1). Ver `docs/architecture/DOMAIN-MAP.md` §3.6.

Responsabilidade: transformar fatos já registrados em um resumo que ela entende — **sem inventar nada**.

## Layout

- `domain/progress.ts` — `buildProgress(view)` e `MIN_CHECKINS_FOR_AVERAGE`.
- `index.ts` — superfície pública.

## Invariantes

- **Nada persistido.** Tudo deriva do `TodayView` que a tela já construiu. Não há tabela, view,
  agregado nem cache — seria segunda fonte de verdade para um fato já derivável (D-69).
- **Entrada é o read model, não linhas cruas.** Desfecho, "reagendado não conta" e "execução
  anulada leva o check-in junto" já foram decididos em Care Tracking. Recalcular aqui criaria duas
  cópias da mesma regra, que divergiriam na primeira mudança.
- **Reagendado nunca conta** — nem como feito, nem como falha: a linha que o substituiu é que conta.
- **Cuidado futuro nunca conta como falha.** Só entram `done`, `skipped` e `overdue`.
- **Sem número inferido** (D-26/BR5): tudo é contagem ou média aritmética do que ela registrou.
  Nada de score, porcentagem, projeção, causalidade ou comparação entre períodos.
- **Média é auto-relato**, retida abaixo de `MIN_CHECKINS_FOR_AVERAGE = 3` — uma guarda de
  exibição, não uma afirmação estatística.
- **Divisão por zero impossível por construção:** a fração só é renderizada com `elapsed > 0` e a
  média só a partir do mínimo.
