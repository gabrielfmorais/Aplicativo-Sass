import type { SharePort } from '@app/core';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * SPEC-044 §9 — o share nativo.
 *
 * ⚠️ **Nenhuma rede, nenhum servidor, nenhum registro.** O PNG nasce do próprio card
 * (`Svg.toDataURL`), vai para um arquivo **no cache do app** e de lá para a folha do sistema. Ele
 * não passa por lugar nenhum nosso, e não guardamos que ela compartilhou — contar shares é
 * analytics, e o provider de analytics não existe (D-31).
 *
 * ⚠️ **O nome do arquivo não carrega nada dela** (BR1): ele fica visível no momento em que a folha
 * abre, e é o tipo de vazamento que ninguém procura porque não parece um dado.
 */
export const createShareAdapter = (): SharePort => ({
  async isAvailable(): Promise<boolean> {
    return Sharing.isAvailableAsync();
  },

  async share({ pngBase64, fileName }): Promise<void> {
    // `toDataURL` devolve base64 puro em algumas plataformas e um data URI em outras.
    const base64 = pngBase64.includes(',') ? (pngBase64.split(',')[1] ?? '') : pngBase64;
    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
  },
});
