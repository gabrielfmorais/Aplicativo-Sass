import type { HairEvent, HairEventPort, HairEventType, LocalDate } from '@app/core';
import { HAIR_EVENT_TYPES } from '@app/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Chip, Loading, Row, Screen, Stack, Text } from '@/design/primitives';
import { space } from '@/design/tokens';
import { formatPlannedDate } from '@/features/plan/copy';
import { reasonOf } from '@/shared/failure-detail';

/**
 * SPEC-020 (F23) — "meu cabelo mudou".
 *
 * O Blueprint §6 nomeia o maior risco do produto: ela descolore o cabelo numa sexta e o cronograma
 * de segunda continua o mesmo, montado para um cabelo que não existe mais — e o app nem sabe. Esta
 * tela é o momento em que ela conta.
 *
 * **O Free registra; não interpreta.** Nenhuma palavra aqui diz o que fazer depois de uma química,
 * o que esperar de um corte, ou como o cabelo dela "está". Isso é conteúdo capilar substantivo e
 * exige sign-off de domínio (D-26/D-70) — e é uma linha fácil de cruzar sem perceber, então o teste
 * dela é uma barreira, não uma opinião.
 *
 * **Oferece, não impõe** (NG3, mesma regra de D-28): depois de registrar, reavaliar é uma escolha
 * com duas saídas igualmente claras. Substituir cronograma continua sendo decisão dela.
 */

/** Os nomes que ela lê. Nomeiam o que aconteceu; nenhum diz o que fazer com isso (BR2). */
const EVENT_LABEL: Record<HairEventType, string> = {
  chemical_treatment: 'Química',
  coloring: 'Coloração',
  bleaching_or_highlights: 'Descoloração ou luzes',
  haircut: 'Corte',
  intense_heat: 'Calor intenso',
  beach_or_pool: 'Praia ou piscina',
  braids_or_protective_style: 'Tranças ou penteado de proteção',
  care_pause: 'Pausa nos cuidados',
  noticed_change: 'Meu cabelo mudou e eu percebi',
};

type Loadable<T> = 'loading' | 'error' | T;

export function HairEventsScreen({
  events,
  today,
  timeZone,
  newEventId,
  onReassess,
  onBack,
}: {
  events: HairEventPort;
  today: LocalDate;
  timeZone: () => string;
  newEventId: () => string;
  /** Presente quando existe cronograma a substituir; ausente, a oferta não aparece. */
  onReassess?: () => void;
  onBack: () => void;
}) {
  const [list, setList] = useState<Loadable<readonly HairEvent[]>>('loading');
  const [chosen, setChosen] = useState<HairEventType | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  /** Presente logo depois de registrar: é o momento em que o app oferece reavaliar (FR4). */
  const [justRecorded, setJustRecorded] = useState<HairEventType | null>(null);
  /**
   * Uma chave por **intenção**, não por toque — reusada em toda tentativa até dar certo (EC4).
   * Gerar uma nova a cada retry desfaria a idempotência exatamente quando ela importa: se a primeira
   * chamada chegou ao servidor e a resposta se perdeu, uma chave nova cria o segundo evento.
   */
  const clientEventId = useRef<string | null>(null);

  const load = useCallback(() => {
    setList('loading');
    let active = true;
    events
      .list()
      .then((rows) => active && setList(rows))
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(reasonOf(error));
        // Nunca uma lista vazia que finge que ela não registrou nada (§16).
        setList('error');
      });
    return () => {
      active = false;
    };
  }, [events]);
  useEffect(() => load(), [load]);

  const record = () => {
    if (busy || !chosen) return; // dois toques registram um evento (FR7), e o servidor confirma
    clientEventId.current ??= newEventId();
    setBusy(true);
    setMessage(null);
    setFailure(null);
    events
      // A data é hoje: registrar um evento passado é valor real, e é OQ do escopo — não improvisar
      // um seletor de data agora seria pior do que a alternativa honesta de deixá-lo para quando
      // houver desenho. Hoje cobre o caso que o Blueprint descreve: ela conta quando acontece.
      .record({
        eventType: chosen,
        occurredOn: today,
        clientEventId: clientEventId.current,
        timeZone: timeZone(),
      })
      .then(() => {
        // A intenção terminou: a próxima é outra, e merece a própria chave.
        clientEventId.current = null;
        setJustRecorded(chosen);
        setChosen(null);
        load();
      })
      .catch((error: unknown) => {
        setMessage('Não foi possível registrar agora. Tente novamente.');
        setFailure(reasonOf(error));
      })
      .finally(() => setBusy(false));
  };

  const voidEvent = (id: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    events
      .void(id)
      .then(load)
      .catch((error: unknown) => {
        // O evento continua lá, e a tela diz isso (§16).
        setMessage('Não foi possível remover agora. Tente novamente.');
        setFailure(reasonOf(error));
      })
      .finally(() => setBusy(false));
  };

  if (justRecorded !== null) {
    return (
      <Screen
        style={styles.page}
        footer={
          <Stack gap="sm">
            {onReassess ? <Button label="Reavaliar meu cabelo" onPress={onReassess} /> : null}
            <Button
              label={onReassess ? 'Agora não' : 'Voltar'}
              variant={onReassess ? 'ghost' : 'primary'}
              onPress={() => setJustRecorded(null)}
            />
          </Stack>
        }
      >
        <Stack gap="sm">
          <Text variant="overline" tone="accent">
            Registrado
          </Text>
          <Text variant="display" accessibilityRole="header" accessibilityLiveRegion="polite">
            {`${EVENT_LABEL[justRecorded]}, ${formatPlannedDate(today)}.`}
          </Text>
          {/*
           * O que esta frase **não** faz: dizer o que a mudança significa para o cabelo dela, ou o
           * que ela deveria fazer a respeito. Diz o que o app pode fazer, e devolve a decisão.
           */}
          <Text tone="muted">
            {onReassess
              ? 'Seu cronograma atual foi montado antes disso. Se quiser, refazemos a avaliação agora — o que você já registrou continua salvo.'
              : 'Ficou no seu histórico.'}
          </Text>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Stack gap="sm">
          <Button label="Registrar" onPress={record} disabled={!chosen} busy={busy} />
          <Button label="Voltar" variant="ghost" onPress={onBack} disabled={busy} />
        </Stack>
      }
    >
      <Stack gap="sm">
        <Text variant="overline" tone="faint">
          Seu cabelo
        </Text>
        <Text variant="display" accessibilityRole="header">
          O que mudou?
        </Text>
        <Text tone="muted">
          Contar o que aconteceu ajuda o app a não seguir com um cronograma feito para antes.
        </Text>
      </Stack>

      <Row>
        {HAIR_EVENT_TYPES.map((type) => (
          <Chip
            key={type}
            label={EVENT_LABEL[type]}
            selected={chosen === type}
            onPress={() => setChosen(chosen === type ? null : type)}
            disabled={busy}
          />
        ))}
      </Row>

      {message ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      {__DEV__ && failure ? (
        <Text variant="caption" tone="faint">
          {failure}
        </Text>
      ) : null}

      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          O que você já registrou
        </Text>
        {list === 'loading' ? (
          <Loading label="Carregando seus registros…" />
        ) : list === 'error' ? (
          <Card tone="muted">
            <Text>Não foi possível carregar seus registros.</Text>
            <Button label="Tentar novamente" variant="secondary" onPress={load} />
          </Card>
        ) : list.length === 0 ? (
          // Vazio por não ter acontecido nada, não por falha — e sem tom de cobrança (EC1).
          <Text tone="muted">Nada registrado ainda.</Text>
        ) : (
          list.map((event) => (
            <Card key={event.id}>
              <Row gap="sm" style={styles.line}>
                <Text variant="bodyStrong">{EVENT_LABEL[event.eventType]}</Text>
                <Text variant="caption" tone="muted">
                  {formatPlannedDate(event.occurredOn)}
                </Text>
              </Row>
              <Button
                label="Remover"
                variant="ghost"
                size="sm"
                disabled={busy}
                accessibilityLabel={`Remover ${EVENT_LABEL[event.eventType]} de ${formatPlannedDate(event.occurredOn)}`}
                onPress={() => voidEvent(event.id)}
                style={styles.remove}
              />
            </Card>
          ))
        )}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', gap: space.xl },
  line: { alignItems: 'center', justifyContent: 'space-between', flexWrap: 'nowrap' },
  remove: { alignSelf: 'flex-start' },
});
