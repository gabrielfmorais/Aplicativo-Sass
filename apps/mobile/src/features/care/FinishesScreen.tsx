import type { FinishCatalogEntry, WashDayPort } from '@app/core';
import { buildFinishCatalog } from '@app/core';
import { useCallback, useEffect, useState } from 'react';

import { Button, Card, Loading, Screen, Stack, Text } from '@/design/primitives';
import { FINISH_TECHNIQUE_LABEL } from '@/features/care/WashDayScreen';
import { reasonOf } from '@/shared/failure-detail';

/**
 * SPEC-056 (F38, fatia shell) — **Finalizações: um lugar em Cuidados.**
 *
 * O `F37` (SPEC-039) entregou a etapa e a SPEC-048 entregou **qual** finalização ela fez. Faltava o
 * **lugar**: uma área onde as finalizações existem para ela, com nome e com o que ela já registrou.
 *
 * ⚠️ **Só o que não atravessa o gate D-26/D-70.** *"Recomendadas para você"*, apresentação por
 * finalização, *"como fazer"* passo a passo e indicação por perfil são conteúdo capilar substantivo,
 * atrás do sign-off de domínio. Esta fatia entrega **descoberta dos nomes + história pessoal** — e é
 * útil por si só (G4).
 *
 * ⚠️ **Contagem, nunca julgamento** (mesma disciplina da Smart Plateleira, SPEC-049). *"Você
 * registrou Plopping 3 vezes"* é fato; não há média, nota, "melhor" nem ordem de mérito. A lista sai
 * na ordem do vocabulário, jamais por contagem (seria o ranking `P7`).
 *
 * **Free** (D-83): é o dado dela e o vocabulário que ela já vê ao registrar — sem gate de entitlement.
 */

type Loadable = 'loading' | 'error' | readonly FinishCatalogEntry[];

const countLabel = (count: number): string =>
  count === 0 ? 'Você ainda não registrou' : `Você registrou ${count} ${count === 1 ? 'vez' : 'vezes'}`;

export function FinishesScreen({ washDays, onBack }: { washDays: WashDayPort; onBack: () => void }) {
  const [state, setState] = useState<Loadable>('loading');
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(() => {
    setState('loading');
    let active = true;
    washDays
      .finishHistory()
      .then((records) => active && setState(buildFinishCatalog(records)))
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(reasonOf(error));
        // Nunca uma lista que finge zero: erro é erro (EC3).
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [washDays]);
  useEffect(() => load(), [load]);

  const footer = <Button label="Voltar" variant="ghost" onPress={onBack} />;
  const header = (
    <Stack gap="sm">
      <Text variant="display" accessibilityRole="header">
        Finalizações
      </Text>
      {/*
        ⚠️ Descreve o que a área É — nomes e o que ela registrou. Nenhuma promessa sobre o cabelo, e
        nenhum "melhor" (D-26/D-70). "Como fazer" cada uma é o F38 gated.
      */}
      <Text tone="muted">
        As formas de finalizar que você registra nos seus cuidados. Aqui ficam os nomes e o que você já fez.
      </Text>
    </Stack>
  );

  if (state === 'loading') return <Loading label="Lendo seus registros…" />;

  if (state === 'error') {
    return (
      <Screen footer={footer}>
        {header}
        <Card tone="muted">
          <Stack gap="lg">
            <Text accessibilityLiveRegion="polite">Não foi possível abrir suas finalizações agora.</Text>
            <Button label="Tentar novamente" variant="secondary" onPress={load} />
            {__DEV__ && failure ? (
              <Text variant="caption" tone="faint">
                {failure}
              </Text>
            ) : null}
          </Stack>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen footer={footer}>
      {header}

      {/*
        SPEC-056 FR3/FR5 — as seis nomeadas, SEMPRE, na ordem do vocabulário. Não há estado vazio de
        tela: mesmo com zero registros, os nomes são a descoberta (G4). A contagem é fato por item,
        nunca critério de ordem (NG2).
      */}
      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Todas as finalizações
        </Text>
        {state.map((entry) => (
          <Card key={entry.technique}>
            <Stack gap="sm">
              <Text variant="heading" accessibilityRole="header">
                {FINISH_TECHNIQUE_LABEL[entry.technique]}
              </Text>
              <Text tone="muted">{countLabel(entry.count)}</Text>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Screen>
  );
}
