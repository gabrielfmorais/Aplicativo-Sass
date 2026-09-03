import type { ProfilePort } from '@app/core';
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
  ({ get: async () => ({ displayName: null }), save }) as unknown as ProfilePort;

describe('ProfileIdentity — quem ela é, no topo da tela', () => {
  it('sem nome gravado, convida em vez de inventar uma saudação', async () => {
    const screen = await render(
      <ProfileIdentity profile={portWith(async () => undefined)} name={null} onNameChanged={jest.fn()} />,
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
      <ProfileIdentity profile={portWith(save)} name={null} onNameChanged={onNameChanged} />,
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
      <ProfileIdentity profile={portWith(save)} name="Ana" onNameChanged={onNameChanged} />,
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
        onNameChanged={jest.fn()}
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
      <ProfileIdentity profile={portWith(save)} name="Ana" onNameChanged={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText('Editar nome'));
    await fireEvent.changeText(screen.getByLabelText('Seu nome'), '   ');
    await fireEvent.press(screen.getByText('Salvar'));

    expect(save).not.toHaveBeenCalled();
  });

  it('cancelar sai da edição sem escrever nada', async () => {
    const save = jest.fn(async () => undefined);
    const screen = await render(
      <ProfileIdentity profile={portWith(save)} name="Ana" onNameChanged={jest.fn()} />,
    );

    await fireEvent.press(screen.getByText('Editar nome'));
    await fireEvent.changeText(screen.getByLabelText('Seu nome'), 'Bia');
    await fireEvent.press(screen.getByText('Cancelar'));

    expect(save).not.toHaveBeenCalled();
    screen.getByText('Editar nome');
  });
});
