import type { CareGuide } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Reveal } from '@/design/Reveal';
import { Stack, Text } from '@/design/primitives';
import { careColor, color, radius, space } from '@/design/tokens';

/**
 * SPEC-062 — "Como fazer", o **primeiro piloto da UI Intelligence** (`docs/design/UI-INTELLIGENCE.md`).
 *
 * ⚠️ **Nenhuma palavra mudou.** `CARE_GUIDES_V1` é constante do bundle e continua byte a byte o que
 * era: mesmos passos, mesmos erros comuns, mesma duração, mesmo status `candidate` atrás do gate
 * D-26/D-70/OQ-REL. O que esta rodada trocou é **como o texto se apresenta** — e essa fronteira é a
 * regra que a torna possível sem sign-off: realçar o que o conteúdo diz não altera o que ele afirma.
 *
 * **O problema, medido a 390px e não deduzido.** Tudo era o mesmo texto: objetivo, passos e erros
 * comuns saíam no mesmo tamanho, no mesmo peso e quase na mesma cor. `1.` e `2.` eram caracteres no
 * meio do parágrafo — o olho não tinha onde pousar, e **um procedimento que não se escaneia não é um
 * procedimento, é um texto sobre um**. "Erros comuns" era um `caption` cinza seguido de bullets no
 * mesmo tom, então lia como *mais passos*, que é o oposto do que ele é. E a `careColor`, que
 * identifica o tipo na Hoje e no ciclo inteiros, **sumia aqui**: a única cor era um ponto de 8px na
 * linha que abria o guia.
 *
 * **As quatro decisões, e cada uma responde a um desses.**
 *
 * 1. **A duração vira chip** (FR1), tingido com a cor do cuidado. Era texto cinza claro no canto,
 *    com o peso de um rodapé, para a informação que decide *"faço agora ou reagendo?"* (SPEC-007 US2).
 * 2. **O objetivo lidera** (FR2). É a frase que responde *"por que eu faria isso?"*, e tinha
 *    exatamente o tratamento do passo 3.
 * 3. **Cada passo ganha um marcador numerado** (FR3), no tom claro do cuidado. É o que devolve o
 *    escaneio: dá para achar o passo 4 sem ler os três antes dele.
 * 4. **"Erros comuns" vira bloco de atenção** (FR4), com superfície própria — separado dos passos
 *    por **forma**, não só por espaço.
 *
 * ⚠️ **A cor é sempre a do tipo** (BR2), nunca escolhida aqui: um cuidado tem uma cor só, em todo o
 * app. ⚠️ **E o bloco de atenção usa a família `danger`, não um tom de cuidado** (BR3) — âmbar é a
 * Nutrição, e um aviso em âmbar dentro de um guia de Hidratação leria como referência a outro
 * cuidado.
 *
 * ⛔ **Apresentação não acrescenta afirmação** (BR1): o bloco realça o que o texto já diz e não
 * introduz urgência, risco nem consequência que o conteúdo não afirme. O texto continua em `ink`,
 * não em vermelho — quem carrega o tom de atenção é o título, e a superfície é um blush claro.
 *
 * Continua sem rede e sem markdown: constante do bundle renderizada com `<Text>`, então não há
 * carregamento, erro nem retry a projetar, e nada vindo de fora é interpretado (SPEC-007 §11/§16).
 */
export function CareGuidePanel({
  guide,
  showDuration = true,
}: {
  guide: CareGuide;
  /**
   * SPEC-031 — a biblioteca já mostra a duração na linha que abre o guia, e o painel a repetia
   * logo abaixo: "~20 min" duas vezes, uma sobre a outra. Quem já disse não precisa dizer de novo.
   * Continua ligada por padrão, porque no cartão da Hoje o painel é a única coisa que a diz.
   */
  showDuration?: boolean;
}) {
  const hue = careColor[guide.careTypeCode];

  return (
    /*
      FR6 — a abertura tem ritmo. `Reveal` já existe e **começa visível**: se a leitura da
      preferência de movimento falhar, o guia aparece mesmo assim — conteúdo nunca depende de
      animação. Com redução de movimento ligada não há transição nenhuma, e não uma mais lenta.
    */
    <Reveal style={styles.panel}>
      {showDuration ? (
        <View style={[styles.durationChip, { backgroundColor: hue.bg }]}>
          <Text variant="caption" style={[styles.durationLabel, { color: hue.fg }]}>
            ~{guide.durationMin} min
          </Text>
        </View>
      ) : null}

      {/* FR2 — o objetivo lidera: é o "por quê", e vinha com o peso de um passo do meio. */}
      <Text variant="bodyStrong">{guide.whatItIs}</Text>

      <Stack gap="md">
        <Text variant="overline" tone="accent">
          Passo a passo
        </Text>
        {guide.steps.map((step, index) => (
          <View key={step} style={styles.step}>
            {/*
              FR3 — o marcador. ⚠️ **Alinhado ao TOPO do texto, não centralizado** (EC2): num passo
              de três linhas, um número centrado flutua no meio do parágrafo e deixa de marcar onde o
              passo começa.
            */}
            <View style={[styles.stepMark, { backgroundColor: hue.bg }]}>
              <Text variant="caption" style={[styles.stepNumber, { color: hue.fg }]}>
                {index + 1}
              </Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </Stack>

      {/* FR4 — o bloco de atenção. Superfície própria: forma, e não só espaço, o separa dos passos. */}
      <View style={styles.mistakes}>
        <Text variant="overline" tone="danger">
          Erros comuns
        </Text>
        <Stack gap="sm">
          {guide.commonMistakes.map((mistake) => (
            <View key={mistake} style={styles.mistake}>
              <View style={styles.mistakeDot} />
              <Text style={styles.stepText}>{mistake}</Text>
            </View>
          ))}
        </Stack>
      </View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  /**
   * O filete à esquerda continua: é o que faz o painel ler como *dentro* do cuidado a que pertence,
   * uma vez que o cartão em volta já saiu da tela (SPEC-007 §14).
   */
  panel: {
    gap: space.lg,
    paddingVertical: space.md,
    paddingLeft: space.lg,
    borderLeftWidth: 2,
    borderLeftColor: color.border,
  },
  durationChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  durationLabel: { fontWeight: '700' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  stepMark: {
    width: space.xl,
    height: space.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontWeight: '700' },
  /** `flex: 1` para o texto quebrar dentro da coluna dele em vez de empurrar o marcador. */
  stepText: { flex: 1 },
  mistakes: {
    backgroundColor: color.dangerSoft,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
  },
  mistake: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  /**
   * Um ponto, e não um `•` de texto: o bullet tipográfico herda a altura da linha e desalinha do
   * topo quando o item quebra em duas linhas.
   */
  mistakeDot: {
    /**
     * ⚠️ **Era `space.xs + 2`, e a auditoria pegou.** Os tokens dizem por escrito que as telas
     * *"nunca inventam um número no meio"* do ritmo de 4 — e somar 2 a um token é exatamente
     * inventar 6. É pequeno, e é justamente assim que a deriva começa.
     */
    width: space.xs,
    height: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.danger,
    marginTop: space.sm,
  },
});
