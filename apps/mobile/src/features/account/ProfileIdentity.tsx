import type { ProfilePort } from '@app/core';
import { DisplayNameSchema } from '@app/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Button, Field, Stack, Text } from '@/design/primitives';
import { color, radius, space } from '@/design/tokens';

/**
 * SPEC-035 — o topo da tela Você: **quem ela é**, antes de qualquer configuração.
 *
 * ⚠️ **A tela inteira tinha o mesmo peso, e essa era a falha.** Reavaliação, assinatura, dias
 * preferidos, lembretes, exclusão e sair chegavam como seis cartões brancos idênticos, um embaixo do
 * outro. Uma tela em que tudo grita não hierarquiza nada — e, pior, punha cobrança e exclusão no
 * mesmo plano do cabelo dela. Aqui a identidade abre a tela, numa superfície de marca que nenhuma
 * das outras seções tem.
 *
 * ⚠️ **"Trocar foto" NÃO existe ainda, e o botão também não.** Foto real depende de infraestrutura
 * de mídia (armazenamento, permissão, base legal) que esta rodada não vai criar. Um botão que abre
 * nada é pior que a ausência dele: promete uma capacidade que o produto não tem. O que fica pronto é
 * a **estrutura** — o avatar é um componente próprio (`Avatar`), recebe só `name` e `size`, e no dia
 * em que a foto existir é ele que muda, sem esta tela saber.
 */
export function ProfileIdentity({
  profile,
  name,
  onNameChanged,
}: {
  profile: ProfilePort;
  /** O nome já gravado, ou `null` quando ela preferiu não dizer. */
  name: string | null;
  onNameChanged: (name: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const parsed = DisplayNameSchema.safeParse(draft);
  const valid = parsed.success ? parsed.data : null;

  const save = () => {
    if (saving || !valid) return; // duas batidas no mesmo botão gravam uma vez
    setSaving(true);
    setFailed(false);
    profile
      .save(valid)
      .then(() => {
        onNameChanged(valid);
        setEditing(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setSaving(false));
  };

  return (
    <Stack gap="md">
      <View style={styles.panel}>
        <Avatar name={name} size={64} />
        <View style={styles.who}>
          <Text variant="title" style={styles.name} accessibilityRole="header">
            {name ?? 'Sem nome ainda'}
          </Text>
          <Text variant="caption" style={styles.sub}>
            Sua conta na Huna
          </Text>
        </View>
      </View>

      {editing ? (
        <Stack gap="sm">
          <Field
            value={draft}
            onChangeText={setDraft}
            placeholder="Como a Huna deve chamar você?"
            accessibilityLabel="Seu nome"
            editable={!saving}
          />
          {/*
            Duas ações lado a lado, e a de sair sem gravar é a secundária: cancelar uma edição é
            reversível, então não precisa do peso do botão cheio.
          */}
          <Button label={saving ? 'Salvando…' : 'Salvar'} disabled={!valid || saving} onPress={save} />
          <Button
            label="Cancelar"
            variant="ghost"
            disabled={saving}
            onPress={() => {
              setDraft(name ?? '');
              setFailed(false);
              setEditing(false);
            }}
          />
          {failed ? (
            <Text tone="danger" accessibilityLiveRegion="polite">
              Não foi possível salvar seu nome. Tente de novo.
            </Text>
          ) : null}
        </Stack>
      ) : (
        /*
          ⚠️ **Fantasma, e não um botão de borda.** Um retângulo branco de largura inteira logo
          abaixo do painel de identidade competia com ele e somava mais um bloco claro a uma tela que
          já é uma pilha de cartões. Editar o nome é uma ação de manutenção, não a ação da tela.
        */
        <Button
          label={name ? 'Editar nome' : 'Dizer meu nome'}
          variant="ghost"
          onPress={() => {
            setDraft(name ?? '');
            setEditing(true);
          }}
        />
      )}
    </Stack>
  );
}

const styles = StyleSheet.create({
  /**
   * ⚠️ **Uma superfície de marca, e não mais um cartão branco.** É a única seção da tela com fundo
   * tingido, e é isso que a põe acima das outras sem precisar de tamanho de fonte maior nem de
   * borda mais grossa. Hierarquia por superfície custa menos ruído que hierarquia por peso.
   */
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: color.brandTint,
    borderWidth: 1,
    borderColor: color.accentBorder,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  who: { flex: 1, gap: space.xs },
  name: { color: color.wine },
  sub: { color: color.inkMuted },
});
