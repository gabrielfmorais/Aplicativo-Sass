import type { EvidenceCode, HairProfilePort, LocalDate } from '@app/core';
import { CURRENT_ASSESSMENT_VERSION, CURRENT_SCHEDULE_VERSION, buildPlan } from '@app/core';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Stack, Text } from '@/design/primitives';
import { color, space } from '@/design/tokens';
import { EVIDENCE_LABEL } from '@/features/plan/copy';

/**
 * SPEC-017 (F21) — "por que isso está no meu plano?".
 *
 * O cronograma já sabia se explicar: `buildPlan` devolve `evidenceCodes` e ela os lê **uma vez**, no
 * preview, antes de confirmar. No dia seguinte abre a Hoje, vê "Hidratação", e nada na tela liga
 * aquele cuidado à conversa de oito perguntas que ela teve com o app.
 *
 * **A evidência é do plano, não do cuidado** (BR1). A engine produz ênfase e evidência no nível do
 * cronograma; dizer "este cuidado está aqui porque..." seria inventar causalidade por cuidado, que
 * é precisamente o que o produto se proíbe.
 *
 * **De onde ela vem, e por que isso importa.** Do snapshot que **gerou** o plano ativo, nunca do
 * perfil de hoje (FR3). Reavaliar e desistir no meio deixa um perfil novo salvo e o plano antigo
 * ativo (SPEC-014 G3) — recalcular do perfil corrente explicaria, com toda a confiança, um plano
 * que ela não tem.
 *
 * **E quando não dá para explicar, não explica** (FR4). Snapshot ausente, leitura falha ou plano
 * gerado por uma versão de engine que não é a atual: a seção some. Uma explicação plausível e errada
 * é pior que nenhuma.
 */

type State = 'loading' | 'unavailable' | readonly EvidenceCode[];

export function PlanRationale({
  hairProfile,
  hairProfileId,
  startsOn,
  assessmentAlgorithmVersion,
  scheduleAlgorithmVersion,
}: {
  hairProfile: HairProfilePort;
  hairProfileId: string;
  /** A data de início do plano — a mesma que o gerou, para reproduzir a evidência idêntica. */
  startsOn: LocalDate;
  assessmentAlgorithmVersion: string;
  scheduleAlgorithmVersion: string;
}) {
  const [state, setState] = useState<State>('loading');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    /**
     * A versão é conferida **antes** da leitura: reproduzir a avaliação com a engine de hoje um
     * plano gerado por outra daria uma explicação coerente e falsa. Hoje só existe a v1, então isto
     * nunca dispara — e é exatamente por isso que precisa estar escrito agora, enquanto é barato.
     */
    if (
      assessmentAlgorithmVersion !== CURRENT_ASSESSMENT_VERSION ||
      scheduleAlgorithmVersion !== CURRENT_SCHEDULE_VERSION
    ) {
      setState('unavailable');
      return;
    }
    hairProfile
      .getById(hairProfileId)
      .then((snapshot) => {
        if (!active) return;
        /**
         * `buildPlan`, não `assess`: a evidência que ela leu no preview é a soma das duas engines
         * — a avaliação diz o que ela quer e tem, o cronograma diz como isso virou frequência.
         * Usar só a avaliação daria **outra** explicação para o mesmo plano, numa segunda tela.
         * Foi assim que este defeito apareceu: a Hoje mostrando uma linha onde o preview mostrou duas.
         *
         * Sem preferências: elas mudam **onde** os cuidados caem (SPEC-015), nunca a evidência.
         */
        setState(snapshot ? buildPlan(snapshot, startsOn).evidenceCodes : 'unavailable');
      })
      // Falhar em explicar não é falhar em nada que ela precise para agir: a seção some, e a Hoje
      // continua inteira. Nenhum "tentar novamente" para algo que ninguém pediu.
      .catch(() => active && setState('unavailable'));
    return () => {
      active = false;
    };
  }, [hairProfile, hairProfileId, startsOn, assessmentAlgorithmVersion, scheduleAlgorithmVersion]);

  // Carregando também não aparece: é uma leitura de fundo para uma seção opcional, e um esqueleto
  // piscando no fim da Hoje custaria mais atenção do que a informação vale.
  if (state === 'loading' || state === 'unavailable' || state.length === 0) return null;

  return (
    <Card tone="muted">
      <Button
        label="Por que este cronograma?"
        variant="ghost"
        size="sm"
        onPress={() => setOpen(!open)}
        accessibilityState={{ expanded: open }}
        style={styles.toggle}
      />
      {open ? (
        <View style={styles.panel}>
          <Stack gap="xs">
            {state.map((code) => (
              <Text key={code}>{`• ${EVIDENCE_LABEL[code] ?? code}`}</Text>
            ))}
          </Stack>
          {/* O mesmo aviso do preview, colado à leitura que ele qualifica (D-26/BR2). */}
          <Text variant="caption" tone="muted">
            Uma leitura cosmética das suas respostas para montar o cronograma — não é diagnóstico médico.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  toggle: { alignSelf: 'flex-start' },
  /** A régua na borda diz que isto abriu **dentro** da seção, e não é mais um bloco na página. */
  panel: {
    borderLeftWidth: 2,
    borderLeftColor: color.accentBorder,
    paddingLeft: space.md,
    gap: space.sm,
  },
});
