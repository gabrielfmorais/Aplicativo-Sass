import type { FinishCatalogEntry, FinishHistoryRecord, NamedFinishTechnique } from '@app/core';
import { buildFinishCatalog } from '@app/core';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChevronIcon } from '@/design/icons';
import { Button, Card, Loading, Screen, Stack, Text } from '@/design/primitives';
import { HIT_TARGET_MIN, color, radius, space } from '@/design/tokens';
import { FINISH_TECHNIQUE_LABEL } from '@/features/care/WashDayScreen';
import { formatPlannedDate } from '@/features/plan/copy';

/**
 * SPEC-056 (fatia shell) + SPEC-070 (a biblioteca) — **Finalizações: um lugar em Cuidados.**
 *
 * O `F37` (SPEC-039) entregou a etapa e a SPEC-048 entregou **qual** finalização ela fez. A SPEC-056
 * deu o lugar; a SPEC-070 fez dele uma **biblioteca pessoal**: cada técnica com a história dela e
 * uma tela própria.
 *
 * ⚠️ **Só o que não atravessa o gate D-26/D-70.** *"Recomendadas para você"*, apresentação por
 * finalização, *"como fazer"* passo a passo e indicação por perfil são conteúdo capilar substantivo,
 * atrás do sign-off de domínio (G2). Esta tela entrega **descoberta dos nomes + história dela**.
 *
 * ⚠️ **Contagem, nunca julgamento** (mesma disciplina da Smart Shelf, SPEC-049). *"Você registrou
 * Plopping 3 vezes"* é fato; não há média, nota, "melhor" nem ordem de mérito. A lista sai **na ordem
 * do vocabulário**, jamais por contagem nem por recência — as duas seriam o ranking `P7`.
 *
 * ⚠️ **UMA lista, e a decisão é essa.** Separar em "as que você usa" e "as que você não usa" foi
 * recusado: as duas seriam grupos ordenados por presença, e a ordem do vocabulário **é** a
 * descoberta — os seis nomes ficam sempre no mesmo lugar, que é o que faz reconhecê-los com o tempo.
 * A hierarquia vem do **peso** de cada item, não de reordenar a lista.
 *
 * ⚠️ **E "Você ainda não registrou" saiu de todas as linhas.** O dono contou a repetição: seis
 * cartões dizendo a mesma frase de ausência com o mesmo peso. Agora a ausência é dita pelo **peso**
 * e pela falta da linha de fato — e o texto de abertura já explica o que a área é.
 *
 * ⛔ **Sem ícone por técnica, e isso é decisão, não omissão.** A SPEC-042 mediu a regra: *"seis
 * desenhos diferentes seriam seis chances de um sair pior que os outros"*, e o que faz um conjunto
 * parecer conjunto é variação controlada sobre **uma** geometria. Uma família com variação só de
 * inclinação seria indistinguível a 36px — marca decorativa, que a SPEC-016 AC3 chama de bug; e uma
 * forma distinguível **por técnica** começaria a ilustrar o movimento, que é o *"como fazer"* atrás
 * do gate. A identidade aqui vem do **número em ameixa**, que é a voz da Huna para um fato dela.
 *
 * **Free** (D-83): é o dado dela e o vocabulário que ela já vê ao registrar — sem gate de entitlement.
 */
export function FinishesScreen({
  records,
  failed,
  reason,
  onRetry,
  onOpen,
  onBack,
}: {
  /** `null` é *ainda não se sabe*, e nunca zero — o estado de carga sai daqui (ver abaixo). */
  records: readonly FinishHistoryRecord[] | null;
  failed: boolean;
  reason: string | null;
  onRetry: () => void;
  onOpen: (technique: NamedFinishTechnique) => void;
  onBack: () => void;
}) {
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
        As formas de finalizar que você registra nos seus cuidados. Toque em uma para ver a sua história com
        ela.
      </Text>
    </Stack>
  );

  /**
   * ⚠️ **Sem registros e sem erro é SEMPRE carregando**, e não só quando `loading` está ligado. Entre
   * a área abrir e o efeito do hook rodar existe um quadro em que nada foi lido ainda — mostrar a
   * lista em zero ali seria piscar uma resposta que ninguém deu.
   */
  if (records === null && !failed) return <Loading label="Lendo seus registros…" />;

  if (failed) {
    return (
      <Screen footer={footer}>
        {header}
        <Card tone="muted">
          <Stack gap="lg">
            <Text accessibilityLiveRegion="polite">Não foi possível abrir suas finalizações agora.</Text>
            <Button label="Tentar novamente" variant="secondary" onPress={onRetry} />
            {__DEV__ && reason ? (
              <Text variant="caption" tone="faint">
                {reason}
              </Text>
            ) : null}
          </Stack>
        </Card>
      </Screen>
    );
  }

  const catalog = buildFinishCatalog(records ?? []);

  return (
    <Screen footer={footer}>
      {header}

      {/*
        SPEC-056 FR3/FR5 — as seis nomeadas, SEMPRE, na ordem do vocabulário. Não há estado vazio de
        tela: mesmo com zero registros, os nomes são a descoberta. A contagem é fato por item, nunca
        critério de ordem (NG2).
      */}
      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Todas as finalizações
        </Text>
        {catalog.map((entry) => (
          <FinishRow key={entry.technique} entry={entry} onPress={() => onOpen(entry.technique)} />
        ))}
      </Stack>
    </Screen>
  );
}

/**
 * Uma técnica na lista. **Dois pesos, uma linha só.**
 *
 * Com história: o número em ameixa lidera, e a última vez fica ao lado — é o fato dela, e é o que a
 * tira da aparência administrativa. Sem história: a mesma linha, mais leve e sem inventar uma frase
 * de ausência. ⚠️ A afordância existe nos dois casos, porque a tela de detalhe existe nos dois: sem
 * registro ela ainda mostra o nome e o que falta para haver observação.
 */
function FinishRow({ entry, onPress }: { entry: FinishCatalogEntry; onPress: () => void }) {
  const used = entry.count > 0;
  const label = FINISH_TECHNIQUE_LABEL[entry.technique];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        used
          ? `${label}. Você registrou ${entry.count} ${entry.count === 1 ? 'vez' : 'vezes'}.`
          : `${label}. Sem registro ainda.`
      }
      style={({ pressed }) => [
        styles.row,
        used ? styles.rowUsed : styles.rowPlain,
        pressed && styles.rowPressed,
      ]}
    >
      {/*
        ⚠️ O número é o herói quando existe — a voz da Huna para um fato dela (SPEC-068/069). Sem
        registro não há número: um "0" em destaque leria como cobrança, e ausência não é falta.
      */}
      {used ? (
        <View style={styles.count}>
          <Text variant="heading" tone="accent">
            {entry.count}
          </Text>
          <Text variant="caption" tone="faint">
            {entry.count === 1 ? 'vez' : 'vezes'}
          </Text>
        </View>
      ) : (
        <View style={styles.count} />
      )}
      <Stack gap="xs" style={styles.body}>
        <Text variant={used ? 'bodyStrong' : 'body'} tone={used ? 'default' : 'muted'}>
          {label}
        </Text>
        {/* ⚠️ A contagem já está no número: repeti-la aqui seria dizer o mesmo fato duas vezes. */}
        {used && entry.lastUsedOn ? (
          <Text variant="caption" tone="muted">
            última em {formatPlannedDate(entry.lastUsedOn)}
          </Text>
        ) : null}
      </Stack>
      <ChevronIcon color={used ? color.inkMuted : color.inkFaint} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: HIT_TARGET_MIN,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  /** Com história: superfície própria, para o item pesar mais que os vizinhos vazios. */
  rowUsed: { backgroundColor: color.surface, borderColor: color.border },
  /** Sem história: sem superfície e com borda quase ausente — leve, mas ainda tocável. */
  rowPlain: { backgroundColor: 'transparent', borderColor: color.surfaceMuted },
  rowPressed: { backgroundColor: color.surfacePressed },
  /** Largura fixa para os nomes começarem alinhados, com e sem número. */
  count: { width: 28, alignItems: 'center' },
  body: { flex: 1 },
});
