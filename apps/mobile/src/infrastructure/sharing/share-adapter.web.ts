import type { SharePort } from '@app/core';

/**
 * Build web do share — **preview de desenvolvimento apenas**. Uma aba de navegador não tem a folha
 * de compartilhamento do sistema em que a SPEC-044 se apoia, então isto reporta indisponível em vez
 * de fingir: a tela então mostra exatamente o estado que mostraria num aparelho sem folha (EC2), que
 * é um caminho real e vale a pena olhar.
 *
 * Fail closed, como o adapter de notificações: nunca prometer uma capacidade que a plataforma não
 * pode honrar — e nunca dizer "compartilhado" quando nada foi.
 */
export const createShareAdapter = (): SharePort => ({
  async isAvailable(): Promise<boolean> {
    return false;
  },
  async share(): Promise<void> {
    throw new Error('share.unavailable_on_web');
  },
});
