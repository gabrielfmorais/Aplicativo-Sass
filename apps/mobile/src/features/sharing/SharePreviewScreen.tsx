import type { HunaAvatar, JourneyView, ShareCardContent, SharePort, ShareFormatKey } from '@app/core';
import { DEFAULT_SHARE_OPTIONS, SHARE_FORMATS, buildShareCard, captureSizeOf } from '@app/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type Svg from 'react-native-svg';

import { Button, Chip, Row, Screen, Stack, Text } from '@/design/primitives';
import { space } from '@/design/tokens';

import { ShareCard } from './ShareCard';

/** A largura em que o card é mostrado na tela. O card real sai em 1080 de largura. */
const PREVIEW_WIDTH = 210;

/** Quanto se espera pela rasterização antes de desistir e devolver a tela para ela. */
const CAPTURE_TIMEOUT = 8000;

/**
 * SPEC-044 (F45) — **o preview é o consentimento** (BR2).
 *
 * ⚠️ Isto não é uma cortesia antes de compartilhar: é **o mecanismo pelo qual ela consente**. Não há
 * caminho de código que compartilhe sem passar por aqui, e o padrão é privado — nome e avatar
 * começam **desligados** (BR6). Um padrão que já trouxesse o nome dela transformaria esta tela numa
 * confirmação do que já foi decidido por ela, que é a inversão que a D-103 proíbe.
 *
 * ⚠️ **Nada é publicado por nós.** O botão abre a folha do sistema e o trabalho acaba ali: quem
 * escolhe o destino é ela, no app dela.
 *
 * ⚠️ **Free** (D-83/D-103): não há uma única consulta de entitlement neste fluxo. Crescimento
 * orgânico atrás de paywall é um contrassenso, e o card de insight Premium (`P25`) será Premium pelo
 * **conteúdo**, nunca pelo botão.
 */
export function SharePreviewScreen({
  journey,
  displayName,
  avatar,
  share,
  onBack,
}: {
  journey: JourneyView;
  displayName: string | null;
  avatar: HunaAvatar | null;
  share: SharePort;
  onBack: () => void;
}) {
  const [options, setOptions] = useState(DEFAULT_SHARE_OPTIONS);
  const [format, setFormat] = useState<ShareFormatKey>('story');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const cardRef = useRef<Svg>(null);

  useEffect(() => {
    let active = true;
    share
      .isAvailable()
      .then((v) => active && setAvailable(v))
      // Fail closed: uma checagem que não voltou não vira "pode compartilhar".
      .catch(() => active && setAvailable(false));
    return () => {
      active = false;
    };
  }, [share]);

  const content = buildShareCard({ journey, displayName, avatar, options });

  const onShare = useCallback(() => {
    // EC4 — toque duplo não abre duas folhas.
    if (busy) return;
    const svg = cardRef.current;
    if (!svg?.toDataURL) {
      setFailure('Não foi possível gerar seu card agora.');
      return;
    }
    setBusy(true);
    setFailure(null);

    /**
     * ⚠️ **`toDataURL` pode voltar sem NUNCA chamar o callback** — no web ele desiste em silêncio
     * quando a ref ainda não existe. Sem este guarda, `busy` ficava `true` para sempre e o botão
     * travava em *"Preparando…"*: uma tela que não volta mais, sem erro e sem saída.
     */
    let settled = false;
    const finish = (message?: string) => {
      if (settled) return;
      settled = true;
      if (message) setFailure(message);
      setBusy(false);
    };
    const timer = setTimeout(() => finish('Não foi possível gerar seu card agora.'), CAPTURE_TIMEOUT);

    try {
      svg.toDataURL(
        (base64) => {
          clearTimeout(timer);
          if (settled) return;
          void share
            // ⚠️ O nome do arquivo não carrega nada dela (BR1): ele fica visível na folha do sistema.
            .share({ pngBase64: base64, fileName: 'huna-card.png' })
            .then(() => finish())
            .catch(() => finish('Não foi possível compartilhar agora.'));
        },
        // ⚠️ Sem medidas, o PNG sairia do tamanho do PREVIEW. A regra mora em `captureSizeOf`.
        captureSizeOf(format),
      );
    } catch {
      clearTimeout(timer);
      finish('Não foi possível gerar seu card agora.');
    }
  }, [busy, share, format]);

  /**
   * ⚠️ **A ação primária mora no rodapé fixo, e isso é conserto de um defeito visto a 390px.** Com
   * o card de 9:16 no corpo rolável, *"Compartilhar"* caía abaixo da dobra enquanto *"Voltar"*
   * ficava fixo — a tela pedia rolagem para chegar à única coisa que ela veio fazer, e destacava a
   * saída acima da ação. Fixar o par resolve os dois de uma vez.
   */
  const footer = (
    <Stack gap="sm">
      {available === false ? (
        /*
          FR6 — onde a plataforma não tem folha de compartilhamento (o preview web), a tela **diz
          isso**. Um botão que não faz nada seria pior que um botão ausente, e fingir sucesso seria a
          mentira que a disciplina fail-closed dos adapters existe para evitar.
        */
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          Compartilhar não está disponível aqui — no aplicativo, este card vai para o WhatsApp, o Instagram e
          o que mais você tiver instalado.
        </Text>
      ) : (
        <Button
          label={busy ? 'Preparando…' : 'Compartilhar'}
          onPress={onShare}
          disabled={busy || available === null}
        />
      )}
      {failure ? (
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {failure}
        </Text>
      ) : null}
      <Button label="Voltar" variant="ghost" onPress={onBack} />
    </Stack>
  );

  return (
    <Screen footer={footer}>
      <Stack gap="sm">
        <Text variant="display" accessibilityRole="header">
          Compartilhar
        </Text>
        <Text tone="muted">Este é o card. Nada sai daqui sem você escolher.</Text>
      </Stack>

      {/*
        ⚠️ **O card é SVG, e leitor de tela não lê texto dentro de SVG.** Como o preview **é** o
        consentimento (BR2), quem usa leitor de tela ficaria consentindo com algo que não consegue
        perceber — o único caminho da capability que dependeria de enxergar. O rótulo descreve o card
        **a partir do mesmo `content` que o desenha**, então ele não pode divergir do que vai sair.
      */}
      <View style={styles.stage} accessible accessibilityLabel={describe(content)}>
        <ShareCard ref={cardRef} content={content} format={format} width={PREVIEW_WIDTH} />
      </View>

      <Stack gap="sm">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Formato
        </Text>
        <Row>
          {(Object.keys(SHARE_FORMATS) as ShareFormatKey[]).map((key) => (
            <Chip
              key={key}
              label={SHARE_FORMATS[key].label}
              selected={format === key}
              onPress={() => setFormat(key)}
            />
          ))}
        </Row>
      </Stack>

      <Stack gap="sm">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          O que aparece
        </Text>
        <Row>
          {/*
            ⚠️ Os dois começam **desligados**. E um controle de nome para quem nunca deu o nome
            seria um botão que não faz nada — por isso ele só existe quando há nome (EC6).
          */}
          {displayName ? (
            <Chip
              label="Meu nome"
              multi
              selected={options.showName}
              onPress={() => setOptions((o) => ({ ...o, showName: !o.showName }))}
            />
          ) : null}
          {avatar ? (
            <Chip
              label="Minha marca"
              multi
              selected={options.showAvatar}
              onPress={() => setOptions((o) => ({ ...o, showAvatar: !o.showAvatar }))}
            />
          ) : null}
        </Row>
        {!displayName && !avatar ? (
          <Text variant="caption" tone="muted">
            Seu card sai sem nome e sem marca. Você pode escolher os dois em Você.
          </Text>
        ) : null}
      </Stack>
    </Screen>
  );
}

/**
 * O card, em palavras. Deriva do **mesmo** `ShareCardContent` que o desenho consome, então não há
 * como a descrição e o card discordarem — e a descrição respeita as escolhas dela pela mesma razão:
 * o que ela não ligou não está no `content`, e portanto não é dito aqui.
 */
const describe = (content: ShareCardContent): string =>
  [
    'Card da Huna.',
    content.displayName ? `Com o seu nome, ${content.displayName}.` : 'Sem o seu nome.',
    content.avatar ? 'Com a sua marca.' : 'Sem a sua marca.',
    `${content.headline}. ${content.value} ${content.valueLabel}.`,
    content.footnote ? `${content.footnote}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

const styles = StyleSheet.create({
  /** O palco do card: fundo neutro para o card não se confundir com a tela. */
  stage: { alignItems: 'center', paddingVertical: space.md },
});
