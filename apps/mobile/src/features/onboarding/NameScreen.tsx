import type { ProfilePort } from '@app/core';
import { DISPLAY_NAME_MAX_LENGTH, DisplayNameSchema } from '@app/core';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { HairFlow } from '@/design/HairFlow';
import { Button, Field, Screen, Stack, Text } from '@/design/primitives';
import { space } from '@/design/tokens';

/**
 * SPEC-018 FR5 — "Vamos nos conhecer".
 *
 * A primeira pergunta do produto não é sobre cabelo. É sobre ela. Antes desta tela, a primeira
 * coisa que o app pedia depois do login era o comprimento do fio — correto e frio. Perguntar o nome
 * primeiro custa uma tela e muda quem está falando com quem.
 *
 * **Uma ideia por tela.** Uma pergunta, um campo, uma ação — e uma saída sem custo. Pular é um
 * botão de verdade, não um link cinza escondido: um nome que ela não quis dar não vale o
 * constrangimento de pedir duas vezes.
 *
 * **Por que a linha é gravada mesmo quando ela pula.** Linha ausente = ainda não perguntamos;
 * `display_name` nulo = perguntamos e ela preferiu não dizer. Sem gravar o "não", o app perguntaria
 * de novo a cada abertura exatamente para quem já disse não.
 *
 * **A pergunta nunca tranca o app.** Se a gravação falhar, ela vê o erro, pode tentar de novo e
 * pode seguir sem salvar — e a pergunta volta numa próxima abertura, que é honesto. Um campo
 * opcional que impede alguém de usar o produto é um defeito, não um cuidado.
 */
export function NameScreen({ profile, onDone }: { profile: ProfilePort; onDone: () => void }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  /** O nome já gravado. Presente = estamos no momento de cumprimento, não mais na pergunta. */
  const [greeting, setGreeting] = useState<string | null>(null);

  const parsed = DisplayNameSchema.safeParse(draft);
  const name = parsed.success ? parsed.data : null;

  const persist = (value: string | null) => {
    if (saving) return; // duas batidas no mesmo botão gravam uma vez
    setSaving(true);
    setFailed(false);
    profile
      .save(value)
      .then(() => {
        // Só quem tem nome recebe cumprimento: saudar o vazio é pior do que não saudar.
        if (value === null) onDone();
        else setGreeting(value);
      })
      .catch(() => setFailed(true))
      .finally(() => setSaving(false));
  };

  if (greeting !== null) {
    return (
      // Rola de propósito (EC1/EC5). Um nome de 60 caracteres em `display`, com a fonte grande do
      // sistema numa tela de 320pt, passa da altura visível — e sem scroll a saudação seria cortada
      // exatamente na parte que tem o nome dela.
      <Screen style={styles.page} footer={<Button label="Continuar" onPress={onDone} />}>
        <HairFlow style={styles.hero} />
        <Stack gap="sm">
          {/* O momento inteiro é esta linha. Ela é anunciada por leitor de tela porque é o que
              mudou na tela — e porque o nome dela é a informação, não a decoração. */}
          <Text variant="display" accessibilityRole="header" accessibilityLiveRegion="polite">
            É um prazer conhecer você, {greeting}.
          </Text>
          <Text tone="muted">
            Agora me conta sobre o seu cabelo. São poucas perguntas, e cada uma muda o cronograma que você vai
            receber no fim.
          </Text>
        </Stack>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      // Sem isto, o teclado cobre o botão que a tela inteira existe para oferecer (EC/teclado).
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        style={styles.page}
        footer={
          <Stack gap="sm">
            <Button label="Continuar" onPress={() => name && persist(name)} disabled={!name} busy={saving} />
            <Button
              label="Prefiro não dizer"
              variant="ghost"
              onPress={() => persist(null)}
              disabled={saving}
            />
          </Stack>
        }
      >
        <Stack gap="sm">
          <Text variant="overline" tone="accent">
            Vamos nos conhecer
          </Text>
          <Text variant="display" accessibilityRole="header">
            Como a Huna deve chamar você?
          </Text>
          <Text tone="muted">
            É só para o app falar com você pelo nome. Fica no seu perfil e não aparece para mais ninguém.
          </Text>
        </Stack>

        <Field
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setFailed(false);
          }}
          accessibilityLabel="Seu nome ou apelido"
          placeholder="Seu nome ou apelido"
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => name && persist(name)}
          editable={!saving}
        />

        {failed ? (
          <Stack gap="sm">
            <Text tone="danger" accessibilityLiveRegion="polite">
              Não foi possível salvar agora. Você pode tentar de novo ou seguir — a gente pergunta outra hora.
            </Text>
            <Button label="Seguir sem salvar" variant="secondary" onPress={onDone} />
          </Stack>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingTop: space.xxl, gap: space.xl },
  /**
   * Presente só no cumprimento, e menor que na abertura: aqui o protagonista é o nome dela. Altura
   * fixa, não `flex`, porque a tela rola — dentro de um scroll `flex: 1` não tem contra o que
   * crescer, e o hero passaria a depender do acaso do conteúdo.
   */
  hero: { height: 140, marginHorizontal: -space.xl },
});
