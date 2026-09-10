import type { FinishHistoryRecord, NamedFinishTechnique } from '@app/core';
import { buildFinishDetail } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Row, Screen, Stack, Text } from '@/design/primitives';
import { color, radius, space } from '@/design/tokens';
import { CHECKIN_MARK_LABEL } from '@/features/care/TodayScreen';
import { FINISH_TECHNIQUE_LABEL } from '@/features/care/WashDayScreen';
import { formatPlannedDate } from '@/features/plan/copy';

/**
 * SPEC-070 (F38, a biblioteca) — **a sua história com uma finalização.**
 *
 * A SPEC-056 dava os nomes e uma contagem; tocar num nome não levava a lugar nenhum. Esta é a tela
 * que faltava: quantas vezes, quando foi a última, as últimas ocorrências, e o que ela **notou**
 * naqueles cuidados.
 *
 * 🔒 **A fronteira de domínio, e ela é o que torna esta tela possível sem sign-off.**
 *
 * ⛔ **NÃO está aqui, e continua atrás do gate D-26/D-70 (G2):** *"melhor para o seu cabelo"*,
 * *"recomendada para você"*, indicação por curvatura ou perfil, eficácia, efeito, promessa de
 * resultado, **passo a passo substantivo**, qualquer descrição que ensine ou caracterize a técnica,
 * e ranking entre finalizações (que é a `P7`).
 *
 * ✅ **Está aqui:** contagem, datas, e **observação sustentada pelos registros dela**.
 *
 * ⚠️ **Observação, nunca causa** (BR5). *"Você notou definição em 3 dos 4 cuidados com Plopping que
 * você avaliou"* é contagem no histórico dela. *"Plopping melhora sua definição"* seria alegação
 * capilar — e a frase inteira vem **pronta do core** justamente para que não haja um lugar na tela
 * onde a causa possa entrar por redação.
 */
export function FinishDetailScreen({
  technique,
  records,
  onBack,
}: {
  technique: NamedFinishTechnique;
  records: readonly FinishHistoryRecord[];
  onBack: () => void;
}) {
  const detail = buildFinishDetail(
    technique,
    records,
    (t) => FINISH_TECHNIQUE_LABEL[t],
    (m) => CHECKIN_MARK_LABEL[m],
  );
  const label = FINISH_TECHNIQUE_LABEL[technique];

  return (
    <Screen footer={<Button label="Voltar" variant="ghost" onPress={onBack} />}>
      <Stack gap="sm">
        <Text variant="overline" tone="accent">
          Finalização
        </Text>
        <Text variant="display" accessibilityRole="header">
          {label}
        </Text>
      </Stack>

      {/*
        O fato de abertura. ⚠️ Sem registro **não há número em destaque**: um "0" grande leria como
        cobrança, e nunca ter usado uma finalização não é uma falta dela.
      */}
      {detail.count > 0 ? (
        <Card>
          <Row gap="lg" style={styles.heroRow}>
            <View style={styles.hero}>
              <Text variant="display" tone="accent">
                {detail.count}
              </Text>
              <Text variant="caption" tone="muted">
                {detail.count === 1 ? 'vez' : 'vezes'}
              </Text>
            </View>
            <Stack gap="xs" style={styles.heroBody}>
              <Text variant="bodyStrong">Você já registrou</Text>
              {detail.lastUsedOn ? (
                <Text tone="muted">Última vez em {formatPlannedDate(detail.lastUsedOn)}</Text>
              ) : null}
            </Stack>
          </Row>
        </Card>
      ) : (
        <Card tone="muted">
          <Stack gap="xs">
            <Text variant="bodyStrong">Você ainda não registrou esta finalização</Text>
            {/* Convite, não cobrança: diz onde ela aparece, sem sugerir que deveria usá-la. */}
            <Text tone="muted">
              Quando você marcar {label} ao contar um cuidado, a sua história com ela aparece aqui.
            </Text>
          </Stack>
        </Card>
      )}

      {/*
        SPEC-070 FR7 — o histórico dela. ⚠️ **As datas, e só elas.** A nota de cada cuidado não entra:
        uma coluna de números de 1 a 5 ao lado de uma técnica vira placar, e a Huna não pontua nem o
        cabelo nem o cuidado (SPEC-009/019/021).
      */}
      {detail.recent.length > 0 ? (
        <Stack gap="md">
          <Text variant="overline" tone="accent" accessibilityRole="header">
            Suas últimas vezes
          </Text>
          <Card>
            <Stack gap="sm">
              {detail.recent.map((day) => (
                <Text key={day} tone="muted">
                  {formatPlannedDate(day)}
                </Text>
              ))}
            </Stack>
          </Card>
        </Stack>
      ) : null}

      {/*
        SPEC-070 §5 — **o que ela notou**, e o estado honesto quando ainda não dá para dizer nada.
        ⚠️ Nada é inventado para preencher a tela: abaixo da amostra a resposta é o que **falta**, que
        é conteúdo e não placeholder — é a maior parte da vida útil desta área para quem começou agora.
      */}
      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          O que você notou
        </Text>
        {detail.noticed.length > 0 ? (
          <Stack gap="sm">
            {detail.noticed.map((n) => (
              <Card key={n.mark}>
                <Stack gap="xs">
                  <Text variant="bodyStrong">{n.subject}</Text>
                  {/* A frase inteira vem do core — a tela não compõe nada (BR5). */}
                  <Text tone="muted">{n.detail}</Text>
                </Stack>
              </Card>
            ))}
          </Stack>
        ) : (
          <Card tone="muted">
            <Text tone="muted">
              {detail.ratedMissing !== null && detail.count > 0
                ? `Avalie mais ${detail.ratedMissing} ${
                    detail.ratedMissing === 1 ? 'cuidado' : 'cuidados'
                  } com ${label} para a Huna começar a mostrar o que você tem notado.`
                : `Ao avaliar os cuidados em que usar ${label}, o que você notar aparece aqui.`}
            </Text>
          </Card>
        )}
      </Stack>

      {/*
        SPEC-070 §3 — **a superfície de "Como fazer", preparada e honesta.**
        ⚠️ Não existe conteúdo aprovado de finalização para reutilizar: `CARE_GUIDES_V1` (SPEC-007)
        cobre os **tipos de cuidado**, não as finalizações, e a SPEC-039 §8 já registrou que o
        conteúdo de finalização é conteúdo capilar substantivo. Inventar um passo a passo para
        preencher este espaço é exatamente o que a D-26 existe para impedir.
        O que destrava: o sign-off do **G2** sobre um texto por finalização, versionado como
        `CARE_GUIDES_V1` foi. Uma frase, sem promessa de data e sem fingir que há conteúdo.
      */}
      <View style={styles.gated}>
        <Text variant="caption" tone="faint">
          O passo a passo de cada finalização está em revisão profissional e ainda não faz parte do app. O que
          está aqui é o seu registro.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { alignItems: 'center' },
  hero: { alignItems: 'center', minWidth: 56 },
  heroBody: { flex: 1 },
  gated: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: 'dashed',
  },
});
