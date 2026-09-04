import type { Email, OtpCode } from '../domain/email.ts';
import type { AuthState } from '../domain/session.ts';

export type OAuthProvider = 'apple' | 'google';

/** Implemented by apps/mobile infrastructure over Supabase Auth (SPEC-001 §9). */
export interface AuthPort {
  /** Resolves identically whether or not an account exists for the email (BR8). */
  requestOtp(email: Email): Promise<void>;
  verifyOtp(email: Email, code: OtpCode): Promise<void>;
  /** Returns false when the user cancelled the provider flow (§15). */
  signInWithProvider(provider: OAuthProvider): Promise<boolean>;
  /** Local logout: revokes this refresh token server-side and clears local persistence (FR5). */
  signOut(): Promise<void>;
  getState(): Promise<AuthState>;
  onStateChange(listener: (state: AuthState) => void): () => void;
}

/** account_deletion_requests (SPEC-001 §8): a row = active request; cancel = delete own row. */
export interface DeletionRequestPort {
  current(): Promise<{ requestedAt: string } | null>;
  request(): Promise<void>;
  cancel(): Promise<void>;
}

/**
 * SPEC-018 — `profiles`: o nome que ela escolheu, e nada mais.
 *
 * Duas ausências diferentes, e a diferença é o produto inteiro: **linha ausente** significa que
 * ainda não perguntamos, e **`displayName` nulo** significa que perguntamos e ela preferiu não
 * dizer. Sem essa distinção o app volta a perguntar o nome a cada abertura para quem escolheu não
 * responder — que é a definição de não ouvir.
 *
 * Sem RPC: a linha não guarda invariante de servidor, é a declaração dela sobre ela mesma. RLS mais
 * `with check` é toda a autorização (§10).
 */
/**
 * SPEC-042 (F34) — as marcas autorais da Huna que ela pode escolher.
 *
 * 🔒 **Abstratas, pela mesma decisão do hero (SPEC-036):** fluxo, mechas, movimento. **Sem
 * personagem, sem rosto, sem cabeça, sem corpo, sem silhueta humana** — e um avatar é ainda menor
 * que o hero, onde um rosto erra por definição.
 *
 * ⚠️ **Isto não é mídia e não é PII nova.** É uma escolha estética entre marcas do produto: nenhum
 * arquivo é enviado e nada se infere sobre ela. **Foto própria é a `P24`**, atrás da base legal
 * LGPD e da tabela `consents` que não existe (D-32).
 *
 * A lista espelha o `CHECK` de `profiles.avatar_key`: duas listas para o mesmo enum é o preço de
 * validar nos dois lados da fronteira, e a de lá é a que importa.
 */
export const HUNA_AVATARS = [
  'flow_plum',
  'flow_wine',
  'flow_berry',
  'flow_violet',
  'flow_amber',
  'flow_teal',
] as const;

export type HunaAvatar = (typeof HUNA_AVATARS)[number];

export const isHunaAvatar = (value: string): value is HunaAvatar =>
  (HUNA_AVATARS as readonly string[]).includes(value);

export type UserProfile = {
  readonly displayName: string | null;
  /**
   * A marca que ela escolheu, ou `null` quando ela não escolheu — e aí o app usa a inicial do nome,
   * que é o comportamento de sempre e continua válido. Escolher **por ela** seria decidir estética
   * em nome de alguém que não pediu.
   */
  readonly avatar: HunaAvatar | null;
};

export interface ProfilePort {
  /** O perfil dela, ou `null` quando a pergunta nunca foi feita. */
  get(): Promise<UserProfile | null>;
  /** Registra a resposta. `null` grava "prefiro não dizer" — que também é ter respondido. */
  save(displayName: string | null): Promise<void>;
  /**
   * SPEC-042 — grava a marca escolhida, ou `null` para voltar à inicial do nome.
   *
   * Método próprio, e não um segundo parâmetro em `save`: são duas declarações independentes, e
   * juntá-las faria trocar o avatar reescrever o nome (ou o contrário) toda vez.
   */
  saveAvatar(avatar: HunaAvatar | null): Promise<void>;
}
