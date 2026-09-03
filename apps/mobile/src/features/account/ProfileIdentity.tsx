import type { HunaAvatar, ProfilePort } from '@app/core';
import { DisplayNameSchema, HUNA_AVATARS } from '@app/core';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Field, Row, Stack, Text } from '@/design/primitives';
import { HunaAvatarMark } from '@/design/HunaAvatarMark';
import { AVATAR_LABEL } from '@/design/huna-avatars';
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
  avatar,
  onNameChanged,
  onAvatarChanged,
}: {
  profile: ProfilePort;
  /** O nome já gravado, ou `null` quando ela preferiu não dizer. */
  name: string | null;
  /** SPEC-042 (F34) — a marca que ela escolheu, ou `null` (e aí vale a inicial do nome). */
  avatar: HunaAvatar | null;
  onNameChanged: (name: string | null) => void;
  onAvatarChanged: (avatar: HunaAvatar | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

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

  /**
   * Tocar na marca já escolhida **tira** a escolha e volta à inicial do nome — a mesma mecânica do
   * couro (SPEC-025) e da finalização (SPEC-039). É dela, e desfazer é parte de escolher.
   */
  const chooseAvatar = (next: HunaAvatar) => {
    if (avatarBusy) return;
    const value = avatar === next ? null : next;
    setAvatarBusy(true);
    setAvatarFailed(false);
    profile
      .saveAvatar(value)
      .then(() => onAvatarChanged(value))
      .catch(() => setAvatarFailed(true))
      .finally(() => setAvatarBusy(false));
  };

  return (
    <Stack gap="md">
      <View style={styles.panel}>
        <Avatar name={name} size={64} avatar={avatar} />
        <View style={styles.who}>
          <Text variant="title" style={styles.name} accessibilityRole="header">
            {name ?? 'Sem nome ainda'}
          </Text>
          <Text variant="caption" style={styles.sub}>
            Sua conta na Huna
          </Text>
        </View>
      </View>

      {/*
        SPEC-042 (F34) — as marcas da Huna, no Free.
        ⚠️ **Isto não é foto.** Nenhum arquivo é enviado e nada se infere sobre ela: é uma escolha
        estética entre marcas do produto. **Foto própria é a `P24`**, atrás da base legal LGPD e da
        tabela `consents` que não existe (D-32) — e um botão que abrisse nada prometeria o que o
        produto não tem, que é a razão de "trocar foto" continuar não existindo aqui.
      */}
      <Button
        label={pickingAvatar ? 'Fechar' : avatar ? 'Trocar minha marca' : 'Escolher minha marca'}
        variant="ghost"
        size="sm"
        accessibilityState={{ expanded: pickingAvatar }}
        onPress={() => setPickingAvatar((v) => !v)}
        style={styles.inline}
      />
      {pickingAvatar ? (
        <Stack gap="sm">
          <Row>
            {HUNA_AVATARS.map((option) => (
              <Pressable
                key={option}
                onPress={() => chooseAvatar(option)}
                disabled={avatarBusy}
                accessibilityRole="radio"
                // `role="radio"` anuncia a escolha por `checked`; com `selected` a leitora de tela
                // não dizia qual marca estava escolhida, e a borda virava o único canal — medido no
                // DOM do DEV real, onde `aria-checked` vinha nulo nos seis.
                accessibilityState={{ checked: avatar === option, disabled: avatarBusy }}
                accessibilityLabel={AVATAR_LABEL[option]}
                style={[styles.option, avatar === option && styles.optionSelected]}
              >
                <HunaAvatarMark avatar={option} size={56} />
              </Pressable>
            ))}
          </Row>
          {avatarFailed ? (
            <Text tone="danger" accessibilityLiveRegion="polite">
              Não foi possível trocar sua marca agora. Tente de novo.
            </Text>
          ) : null}
        </Stack>
      ) : null}

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
  /** A moldura da escolha: a marca já traz a cor, então o que marca a seleção é a borda. */
  option: { borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  optionSelected: { borderColor: color.accent },
  inline: { alignSelf: 'flex-start' },
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
