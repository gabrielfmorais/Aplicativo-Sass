# Runbook — Web dev preview (Expo Web)

> **Web is not a product platform.** It is a *development* viewer: a way to watch the screens,
> components, onboarding, Hoje, Progresso, conta e paywall render and behave while they are being
> built, without a device or a native build. iOS/Android remain the only shipping targets
> (`export:check` in CI still builds only those two). Nothing here changes business rules, and
> nothing here is allowed to become a reason to design for a browser.

## 1. Rodar

```
pnpm --filter mobile run web
```

Abre o Metro em `http://localhost:8081` e o navegador. **Fast Refresh funciona**: salvar um
`.tsx` reflete na aba sem recarregar a página.

Pré-requisitos: os mesmos do `pnpm start` — Node pinado (`.node-version`, D-43) e
`apps/mobile/.env.local` com `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. O
preview fala com o **mesmo Supabase de desenvolvimento** que o app no device: é o app real, não uma
maquete.

## 2. Viewport de celular

Chrome/Edge: `F12` → ícone *Toggle device toolbar* (`Ctrl+Shift+M`) → escolher um aparelho
(iPhone 15 Pro / Pixel 8). O layout do app é `react-native-web` sobre flexbox, então o que aparece
nessa largura é o que aparece no aparelho **para layout e fluxo** — ver §4 para o que não é fiel.

## 3. O que muda no web, e por quê

Três adapters têm build `.web.ts` (resolução por plataforma do Metro — o bundle nativo não muda
nem uma linha). Cada um é uma *degradação honesta*, nunca um mock que finge:

| Arquivo | Nativo | Web (dev) | Racional |
|---|---|---|---|
| `secure-session-storage.web.ts` | Keychain/Keystore via `expo-secure-store` | **memória** | O navegador não tem keychain. `localStorage` deixaria o refresh token ao alcance de qualquer XSS — a regra do adapter nativo (nunca cair para armazenamento inseguro, SPEC-001 §10 / D-53 / D-59) vale igual aqui. **Consequência:** recarregar a página desloga; Fast Refresh não. |
| `fresh-install.web.ts` | Marca `.installed` no document directory | **no-op** | Uma aba não tem ciclo de instalação, e a sessão web já é só memória: todo load *é* uma instalação nova. Não há sessão residual a descartar. |
| `local-notification-adapter.web.ts` | `expo-notifications` (agendamento local por data) | `ensurePermission() → false`, `reconcile()` no-op | Uma aba não agenda lembrete local por data. Reportar "sem permissão" mostra exatamente o estado que o device mostra quando a usuária recusa (SPEC-008 EC2) — um caminho real e útil de observar — em vez de prometer um lembrete que nunca dispararia. Fail closed. |

## 4. O que **não** dá para validar no web

Nada disso é bug do preview; é o limite dele. Continua exigindo device/simulador:

- Notificações locais de verdade (agendamento, disparo, deep link).
- Persistência segura de sessão / reinstalação.
- **Login por email** — não funciona em lugar nenhum hoje (D-84, §6), não só no preview.
- IAP e o adapter nativo RevenueCat (SPEC-010 Parte 2, DEFERRED).
- Gestos, teclado do sistema, safe areas reais, performance e fontes do aparelho.

Bug que só aparece no web e depende de um dos itens acima **não é bug de produto** — é o adapter
web fazendo o que está na tabela do §3.

## 5. Entrar no preview (D-85)

### Setup, uma vez (30 segundos, no painel do Supabase)

1. **Authentication → Users → Add user**
2. Email: o valor de `EXPO_PUBLIC_DEV_LOGIN_EMAIL` do seu `.env.local`
3. Senha: o valor de `EXPO_PUBLIC_DEV_LOGIN_PASSWORD`
4. **Marque "Auto Confirm User"** — é o passo que importa; sem ele o usuário nasce inconfirmado e
   não entra.

### Depois disso

Abra `http://localhost:8081` e clique em **"Entrar como usuária de desenvolvimento"**, no rodapé da
tela de login. Uma sessão real do Supabase Auth, com `auth.uid()` de verdade e **todas as policies de
RLS valendo exatamente como em produção**. Como a sessão web é memória-only (§3), recarregar a página
desloga — clique de novo e você volta para a **mesma** usuária, com o mesmo perfil, plano e histórico.

### Por que não dá para entrar de outro jeito hoje

Verificado em 2026-08-31 contra `/auth/v1/settings` do projeto DEV, não deduzido:

| Caminho | Estado real | Por quê |
|---|---|---|
| **Google** | `"google": false` | O provider **não está habilitado** no projeto DEV. É isto que fazia a tela ficar presa em "Aguarde…" — não era popup bloqueado, como se suspeitou antes |
| **Código de 6 dígitos por email** | Não chega | O template padrão manda **Magic Link** (`{{ .ConfirmationURL }}`), e a tela pede `{{ .Token }}`. Custom SMTP não configurado, por decisão |
| **Magic Link no navegador** | Não fecha | O link abre uma navegação nova e mata o *code verifier* do PKCE, que vive só em memória (§3). Persistir o verifier no browser seria trocar segurança por conveniência — recusado (D-84) |
| **Auto-cadastro pelo botão** | Não funciona | `mailer_autoconfirm: false` (confirmação obrigatória) **e** o email embutido responde `429 over_email_send_rate_limit`. Por isso o botão **só faz sign-in**, nunca `signUp` |

### ⛔ O que esse acesso NÃO resolve (D-86)

Ele desbloqueia **a sua visualização**, e só. **Auth de produção não pode ser dado como concluído porque isto funciona.** Continuam obrigatórios antes de beta/release, funcionando de verdade e testados nos fluxos reais: **Google OAuth** · **Apple Sign In** · **Email OTP entregando o código que a UI espera** · **redirects/callbacks corretos por plataforma**. As partes externas (console do Google, Apple Developer, custom SMTP, allowlists) são TRUE HUMAN GATE.

### O que esse acesso é, e o que não é

**É** um `signInWithPassword` normal com a **anon key**, contra o Supabase Auth real. Nada é mockado,
nada é contornado: RLS, `auth.uid()`, entitlements e todas as RPCs se comportam como em produção.

**Não é** uma porta dos fundos. Quatro travas independentes, cada uma suficiente sozinha
(`apps/mobile/src/infrastructure/supabase/dev-sign-in.ts`, testadas em
`apps/mobile/__tests__/dev-sign-in.test.ts`):

1. `__DEV__` — falso em release, e o bundler elimina o ramo inteiro;
2. `Platform.OS === 'web'` — nunca num aparelho, e web não é plataforma de produto (D-80);
3. `EXPO_PUBLIC_APP_ENV === 'development'` — preview e production valem outra coisa;
4. **as duas variáveis de credencial precisam existir** — elas vivem só no `.env.local`, que é
   gitignored e não existe em nenhum runner de CI nem em build EAS.

A quarta é a que segura mesmo se alguém derrubasse as outras três: sem valor no ambiente, não há
como quem entrar. E `service_role` não aparece em lugar nenhum disso.

Os fluxos oficiais (Apple / Google / email) **não foram tocados**: o botão de dev é um componente
separado, renderizado **ao lado** de `SignInScreen`, nunca dentro dela.

## 6. Regras

- **Nenhuma regra de negócio conhece a plataforma.** `Platform.OS` fora de um adapter de
  infraestrutura ou de um ajuste puramente visual é bug (CLAUDE.md §2).
- **Web não entra no CI nem em release.** `export:check` continua `--platform ios --platform android`;
  não há build, deploy, host, PWA ou store web.
- As dependências web (`react-native-web`, `react-dom`, `@expo/metro-runtime`) vivem em
  **`devDependencies`** de propósito: dizem, no manifesto, que o web é ferramenta de dev.
- Se uma tela precisar de trabalho só para ficar bonita no navegador, **não faça**. O preview serve
  ao desenvolvimento; não o comanda.
