import type { ProfilePort } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { NameScreen } from '@/features/onboarding/NameScreen';

const makeProfile = () =>
  ({
    get: jest.fn(async () => null),
    save: jest.fn(async () => undefined),
  }) as unknown as jest.Mocked<ProfilePort>;

/**
 * SPEC-018 FR5. O que importa nesta tela não é o texto: é que ela nunca prende ninguém. Pular
 * grava, falhar oferece saída, e o cumprimento só acontece quando existe um nome para cumprimentar.
 */
describe('NameScreen (SPEC-018 FR5)', () => {
  it('faz uma pergunta e mantém a ação principal indisponível até haver um nome', async () => {
    const profile = makeProfile();
    const s = await render(<NameScreen profile={profile} onDone={jest.fn()} />);

    s.getByText('Como a Huna deve chamar você?');
    expect(s.getByText('Continuar').parent?.props.accessibilityState?.disabled).toBe(true);

    // Só espaço parece preenchido e não é nome nenhum — o mesmo que o banco recusa.
    await fireEvent.changeText(s.getByLabelText('Seu nome ou apelido'), '   ');
    await fireEvent.press(s.getByText('Continuar'));
    expect(profile.save).not.toHaveBeenCalled();
  });

  it('grava o nome normalizado e só então cumprimenta', async () => {
    const profile = makeProfile();
    const onDone = jest.fn();
    const s = await render(<NameScreen profile={profile} onDone={onDone} />);

    await fireEvent.changeText(s.getByLabelText('Seu nome ou apelido'), '  Gabriela  ');
    await fireEvent.press(s.getByText('Continuar'));

    await waitFor(() => expect(profile.save).toHaveBeenCalledWith('Gabriela'));
    expect(await s.findByText('É um prazer conhecer você, Gabriela.')).toBeTruthy();
    // O cumprimento é um passo, não uma saída: ela ainda decide quando seguir.
    expect(onDone).not.toHaveBeenCalled();
    await fireEvent.press(s.getByText('Continuar'));
    expect(onDone).toHaveBeenCalled();
  });

  /**
   * Linha ausente = ainda não perguntamos; nulo = perguntamos e ela preferiu não dizer. Sem gravar
   * o "não", o app perguntaria de novo exatamente a quem já disse não.
   */
  it('grava a recusa como nulo e segue sem cumprimentar o vazio', async () => {
    const profile = makeProfile();
    const onDone = jest.fn();
    const s = await render(<NameScreen profile={profile} onDone={onDone} />);

    await fireEvent.press(s.getByText('Prefiro não dizer'));

    await waitFor(() => expect(profile.save).toHaveBeenCalledWith(null));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(s.queryByText(/É um prazer conhecer você/)).toBeNull();
  });

  it('quando a gravação falha, explica e oferece seguir — um campo opcional não tranca o app', async () => {
    const profile = makeProfile();
    profile.save.mockRejectedValueOnce(new Error('identity.profile_write_failed'));
    const onDone = jest.fn();
    const s = await render(<NameScreen profile={profile} onDone={onDone} />);

    await fireEvent.changeText(s.getByLabelText('Seu nome ou apelido'), 'Gabriela');
    await fireEvent.press(s.getByText('Continuar'));

    expect(await s.findByText(/Não foi possível salvar agora/)).toBeTruthy();
    // Continua sendo a pergunta: um erro de gravação não pode fabricar um cumprimento.
    expect(s.queryByText(/É um prazer conhecer você/)).toBeNull();

    await fireEvent.press(s.getByText('Seguir sem salvar'));
    expect(onDone).toHaveBeenCalled();
  });

  it('enquanto grava, nenhuma segunda gravação é possível pela tela', async () => {
    const profile = makeProfile();
    let release: (() => void) | undefined;
    profile.save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const s = await render(<NameScreen profile={profile} onDone={jest.fn()} />);

    await fireEvent.changeText(s.getByLabelText('Seu nome ou apelido'), 'Gabriela');
    await fireEvent.press(s.getByText('Continuar'));

    expect(profile.save).toHaveBeenCalledTimes(1);
    // As duas saídas ficam indisponíveis durante a escrita — não há segundo toque a dar, e o
    // guarda em `persist` cobre o caso em que um toque escapa entre o estado e o render.
    for (const button of s.getAllByRole('button')) {
      expect(button.props.accessibilityState?.disabled).toBe(true);
    }
    expect(s.getByLabelText('Seu nome ou apelido').props.editable).toBe(false);

    release?.();
    await waitFor(() => expect(s.getByText('É um prazer conhecer você, Gabriela.')).toBeTruthy());
    expect(profile.save).toHaveBeenCalledTimes(1);
  });
});
