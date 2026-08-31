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
- IAP e o adapter nativo RevenueCat (SPEC-010 Parte 2, DEFERRED).
- Gestos, teclado do sistema, safe areas reais, performance e fontes do aparelho.

Bug que só aparece no web e depende de um dos itens acima **não é bug de produto** — é o adapter
web fazendo o que está na tabela do §3.

## 5. Regras

- **Nenhuma regra de negócio conhece a plataforma.** `Platform.OS` fora de um adapter de
  infraestrutura ou de um ajuste puramente visual é bug (CLAUDE.md §2).
- **Web não entra no CI nem em release.** `export:check` continua `--platform ios --platform android`;
  não há build, deploy, host, PWA ou store web.
- As dependências web (`react-native-web`, `react-dom`, `@expo/metro-runtime`) vivem em
  **`devDependencies`** de propósito: dizem, no manifesto, que o web é ferramenta de dev.
- Se uma tela precisar de trabalho só para ficar bonita no navegador, **não faça**. O preview serve
  ao desenvolvimento; não o comanda.
