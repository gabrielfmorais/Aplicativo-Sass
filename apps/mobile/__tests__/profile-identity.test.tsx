import type { HunaAvatar, ProfilePort } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ProfileIdentity } from '@/features/account/ProfileIdentity';

/**
 * SPEC-035 FR5/EC2/EC3 — o nome dela ganhou uma porta depois do onboarding, e essa porta **escreve**.
 *
 * ⚠️ **É o único caminho de escrita da rodada, e chegou sem teste nenhum.** Um painel de leitura que
 * quebra mostra a coisa errada; um caminho de escrita que quebra pode dizer que gravou sem ter
 * gravado — e o custo dos dois não é o mesmo. O que está travado aqui é o comportamento que não pode
 * regredir: gravar uma vez por intenção, e nunca afirmar sucesso que não houve.
 */
const portWith = (save: ProfilePort['save']): ProfilePort =>
  ({ get: async () => ({ displayName: null, avatar: null }), save }) as unknown as ProfilePort;

describe('ProfileIdentity — quem ela é, no topo da tela', () => {
  it('sem nome gravado, convida em vez de inventar uma saudação', async () => {
    const screen = await render(
      <ProfileIdentity
        profile={portWith(async () => undefined)}
        name={null}
        avatar={null}
        onNameChanged={jest.fn()}
        onAvatarChanged={jest.fn()}
      />,
    );
    // EC1: quem preferiu não dizer não recebe apelido escolhido por ela.
    screen.getByText('Sem nome ainda');
    screen.getByText('Dizer meu nome');
    expect(screen.queryByText('Editar nome')).toBeNull();
  });

  it('grava o nome e avisa quem é dono do estado', async () => {
    const save = jest.fn(async () => undefined);
    const onNameChanged = jest.fn();
    const screen = await render(
      <ProfileIdentity
        profile={portWith(save)}
        name={null}
        avatar={null}
        onNameChanged={onNameChanged}
        onAvatarChanged={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByText('Dizer meu nome'));
    // O schema normaliza antes de gravar: o que vai ao servidor é o nome aparado.
    await fireEvent.changeText(screen.getByLabelText('Seu nome'), '  Ana  ');
    await fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => expect(save).toHaveBeenCalledWith('Ana'));
    expect(onNameChanged).toHaveBeenCalledWith('Ana');
  });

  /** FM2/EC3 — a falha é dita, o estado anterior fica, e ninguém afirma que gravou. */
  it('quando a escrita falha, não mente e deixa tentar de novo', async () => {
    const save = jest.fn(async () => {
      throw new Error('offline');
    });
    const onNameChanged = jest.fn();
    const screen = await render(
      <ProfileIdentity
        profile={portWith(save)}
        name="Ana"
        avatar={null}
        onNameChanged={onNameChanged}
        onAvatarChanged={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByText('Editar nome'));
    await fireEvent.changeText(screen.getByLabelText('Seu nome'), 'Bia');
    await fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => screen.getByText('Não foi possível salvar seu nome. Tente de novo.'));
    expect(onNameChanged).not.toHaveBeenCalled();
    // Continua editável: uma falha de rede não pode ser um beco sem saída.
    screen.getByLabelText('Seu nome');
  });

  /** BR4 — duas batidas no mesmo botão são uma intenção, não duas escritas. */
  it('dois toques no salvar gravam uma vez', async () => {
    let release: () => void = () => undefined;
    const save = jest.fn(() => new Promise<void>((resolve) => (release = () => resolve())));
    const screen = await render(
      <ProfileIdentity
        profile={portWith(save as unknown as ProfilePort['save'])}
        name="Ana"
        avatar={null}
        onNameChanged={jest.fn()}
        onAvatarChanged={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByText('Editar nome'));
    await fireEvent.changeText(screen.getByLabelText('Seu nome'), 'Bia');
    const button = screen.getByText('Salvar');
    await fireEvent.press(button);
    await fireEvent.press(button);

    expect(save).toHaveBeenCalledTimes(1);
    // Solta a escrita e espera a tela assentar: sair do teste com um `setState` a caminho é o que
    // gera o aviso de `act` — e um aviso que se ignora hoje esconde um de verdade amanhã.
    release();
    await waitFor(() => screen.getByText('Editar nome'));
  });

  /** EC2 — nome só com espaços não é nome, e o botão não age. */
  it('não grava um nome vazio', async () => {
    const save = jest.fn(async () => undefined);
    const screen = await render(
      <ProfileIdentity
        profile={portWith(save)}
        name="Ana"
        avatar={null}
        onNameChanged={jest.fn()}
        onAvatarChanged={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByText('Editar nome'));
    await fireEvent.changeText(screen.getByLabelText('Seu nome'), '   ');
    await fireEvent.press(screen.getByText('Salvar'));

    expect(save).not.toHaveBeenCalled();
  });

  it('cancelar sai da edição sem escrever nada', async () => {
    const save = jest.fn(async () => undefined);
    const screen = await render(
      <ProfileIdentity
        profile={portWith(save)}
        name="Ana"
        avatar={null}
        onNameChanged={jest.fn()}
        onAvatarChanged={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByText('Editar nome'));
    await fireEvent.changeText(screen.getByLabelText('Seu nome'), 'Bia');
    await fireEvent.press(screen.getByText('Cancelar'));

    expect(save).not.toHaveBeenCalled();
    screen.getByText('Editar nome');
  });
});

/**
 * SPEC-042 (F34) — as marcas da Huna, no Free.
 *
 * ⚠️ **A barreira aqui é o D-32 e a direção do hero.** Isto **não é foto**: nenhum arquivo é
 * enviado, e nada se infere sobre ela. Foto própria é a `P24`, atrás da base legal LGPD — e um
 * botão que abrisse nada prometeria o que o produto não tem.
 */
describe('ProfileIdentity — a marca da Huna (SPEC-042)', () => {
  const port = (over: Partial<ProfilePort> = {}): ProfilePort =>
    ({
      get: async () => ({ displayName: 'Ana', avatar: null }),
      save: async () => undefined,
      saveAvatar: jest.fn(async () => undefined),
      ...over,
    }) as unknown as ProfilePort;

  const renderIt = async (avatar: HunaAvatar | null, profile = port(), onAvatarChanged = jest.fn()) =>
    await render(
      <ProfileIdentity
        profile={profile}
        name="Ana"
        avatar={avatar}
        onNameChanged={jest.fn()}
        onAvatarChanged={onAvatarChanged}
      />,
    );

  it('sem marca escolhida, convida a escolher — e o seletor começa fechado', async () => {
    const s = await renderIt(null);
    s.getByText('Escolher minha marca');
    expect(s.queryByLabelText('Mechas em ameixa')).toBeNull();
  });

  it('com marca escolhida, o rótulo vira trocar', async () => {
    const s = await renderIt('flow_berry');
    s.getByText('Trocar minha marca');
  });

  it('abrir mostra as seis marcas', async () => {
    const s = await renderIt(null);
    await fireEvent.press(s.getByText('Escolher minha marca'));
    for (const label of [
      'Mechas em ameixa',
      'Mechas em vinho',
      'Mechas em berry',
      'Mechas em roxo',
      'Mechas em âmbar',
      'Mechas em verde',
    ]) {
      s.getByLabelText(label);
    }
  });

  it('escolher grava pela porta e avisa a rota', async () => {
    const profile = port();
    const onAvatarChanged = jest.fn();
    const s = await renderIt(null, profile, onAvatarChanged);
    await fireEvent.press(s.getByText('Escolher minha marca'));
    await fireEvent.press(s.getByLabelText('Mechas em berry'));
    await waitFor(() => expect(profile.saveAvatar).toHaveBeenCalledWith('flow_berry'));
    await waitFor(() => expect(onAvatarChanged).toHaveBeenCalledWith('flow_berry'));
  });

  /** Tocar na marca já escolhida tira a escolha — a mesma mecânica do couro e da finalização. */
  it('tocar na marca marcada volta à inicial do nome', async () => {
    const profile = port();
    const s = await renderIt('flow_berry', profile);
    await fireEvent.press(s.getByText('Trocar minha marca'));
    await fireEvent.press(s.getByLabelText('Mechas em berry'));
    await waitFor(() => expect(profile.saveAvatar).toHaveBeenCalledWith(null));
  });

  it('uma escrita que falha avisa, sem inventar que entrou', async () => {
    const profile = port({
      saveAvatar: jest.fn(async () => {
        throw new Error('offline');
      }),
    });
    const s = await renderIt(null, profile);
    await fireEvent.press(s.getByText('Escolher minha marca'));
    await fireEvent.press(s.getByLabelText('Mechas em vinho'));
    await waitFor(() => s.getByText(/Não foi possível trocar sua marca/));
  });

  /**
   * ⚠️ **Achado no DOM do DEV real:** os seis rádios vinham com `aria-checked` nulo, porque o estado
   * ia em `selected` — que `role="radio"` não anuncia. Sem isto, a leitora de tela não diz qual
   * marca está escolhida e a **borda vira o único canal**, que é exatamente o que o design system
   * proíbe (cor nunca é o único canal).
   */
  it('a marca escolhida é anunciada como marcada', async () => {
    const s = await renderIt('flow_berry');
    await fireEvent.press(s.getByText('Trocar minha marca'));
    expect(s.getByLabelText('Mechas em berry').props.accessibilityState).toMatchObject({ checked: true });
    expect(s.getByLabelText('Mechas em ameixa').props.accessibilityState).toMatchObject({ checked: false });
  });

  /** ⚠️ D-32 — foto continua não existindo, e nenhum rótulo promete que existe. */
  it('não oferece foto, e não promete o que o produto não tem', async () => {
    const s = await renderIt(null);
    expect(s.queryByText(/foto|câmera|galeria|imagem|upload/i)).toBeNull();
  });
});
