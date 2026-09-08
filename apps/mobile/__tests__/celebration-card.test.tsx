import type { Celebration } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { CelebrationCard } from '@/features/journey/CelebrationCard';

/**
 * SPEC-043 OQ1 — a celebração no lugar dela.
 *
 * ⚠️ O que estes testes guardam: a celebração fala de **aderência**, nunca de cabelo (D-26) nem de
 * fazer mais (D-103), e os dois caminhos (compartilhar / fechar) funcionam.
 */

const milestone: Celebration = { kind: 'milestone', key: 'cares_5', label: '5 cuidados do seu plano' };
const level: Celebration = { kind: 'level', level: 3, name: 'Constante' };

describe('CelebrationCard (SPEC-043 OQ1)', () => {
  it('um marco: nomeia a conquista e a enquadra como constância com o plano', async () => {
    const s = await render(
      <CelebrationCard celebration={milestone} onShare={jest.fn()} onDismiss={jest.fn()} />,
    );
    s.getByText('Conquista');
    s.getByText('5 cuidados do seu plano');
    s.getByText('Você chegou aqui mantendo o seu plano.');
  });

  it('subir de nível: nomeia o nível e fala de constância, não de cabelo', async () => {
    const s = await render(<CelebrationCard celebration={level} onShare={jest.fn()} onDismiss={jest.fn()} />);
    s.getByText('Novo nível');
    s.getByText('Constante');
    s.getByText('Sua constância na jornada subiu de nível.');
  });

  it('compartilhar e fechar chamam os dois caminhos', async () => {
    const onShare = jest.fn();
    const onDismiss = jest.fn();
    const s = await render(
      <CelebrationCard celebration={milestone} onShare={onShare} onDismiss={onDismiss} />,
    );
    await fireEvent.press(s.getByText('Compartilhar'));
    expect(onShare).toHaveBeenCalled();
    await fireEvent.press(s.getByText('Fechar'));
    expect(onDismiss).toHaveBeenCalled();
  });

  /**
   * ⚠️ **A barreira D-26/D-103.** Nada na celebração pode afirmar efeito capilar, "melhor", nota, %,
   * nem pedir mais cuidados/frequência — a Jornada mede aderência, e a celebração é a Jornada falando.
   */
  it('não afirma nada sobre cabelo, nota, nem pede mais cuidados', async () => {
    const proibido =
      /cabelo|fio|saud|bonit|brilho|frizz|macie|recuper|melhor|nota|score|%|lave mais|faça mais|mais cuidados|mais vezes|toda semana|todo dia/i;
    for (const c of [milestone, level]) {
      const s = await render(<CelebrationCard celebration={c} onShare={jest.fn()} onDismiss={jest.fn()} />);
      for (const node of s.queryAllByText(proibido)) {
        throw new Error(`texto proibido na celebração: "${node.props.children}"`);
      }
    }
  });
});
