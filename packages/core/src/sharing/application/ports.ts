/**
 * SPEC-044 §9 — a única porta de plataforma do share.
 *
 * ⚠️ **Nenhum servidor, nenhuma rede, nenhum registro.** O card não sai do aparelho a não ser pela
 * mão dela, na folha de compartilhamento do próprio sistema. Guardar "ela compartilhou" seria
 * analytics, e o provider de analytics não existe (D-31).
 *
 * ⚠️ **`fileName` nunca carrega dado dela** (BR1): nem nome, nem id, nem e-mail. O arquivo é
 * temporário e o nome dele é público no momento em que a folha do SO abre.
 */
export type SharePort = {
  /** `false` onde a plataforma não tem folha de compartilhamento — e aí a tela **diz isso** (FR6). */
  isAvailable(): Promise<boolean>;
  share(input: { pngBase64: string; fileName: string }): Promise<void>;
};
