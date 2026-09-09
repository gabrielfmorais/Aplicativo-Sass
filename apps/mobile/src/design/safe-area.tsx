import { createContext, useContext, type ReactNode } from 'react';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * SPEC-060 — a área segura do iPhone, num lugar só.
 *
 * **O problema que ela resolve.** `react-native-safe-area-context` era dependência do app desde
 * sempre e tinha **zero importações** — medido. O `Screen` fixava `paddingTop: 32` contra um topo
 * seguro que num iPhone com Dynamic Island começa em **59pt**, e a `TabBar` fixava
 * `paddingBottom: 16` contra um indicador de home de **34pt**. O conteúdo ficava debaixo do
 * hardware.
 *
 * ⚠️ **E o repositório afirmava por escrito que isso já estava resolvido:** o comentário da
 * `TabBar` dizia *"a área segura de verdade é do `Screen`, que já a trata"*. O `Screen` não tratava.
 * É a mesma forma de defeito que a SPEC-041 mediu na `Section` que declarava `shelf` e não repassava,
 * e que a SPEC-053 mediu no `oilDueOn` que o app nunca passava: a peça existe, a ligação não, e a
 * prosa afirma que sim. Por isso o mecanismo mora **aqui**, atravessado por toda tela, e não numa
 * decisão por tela.
 *
 * ⚠️ **Isto é invisível no preview web** (o navegador reporta inset 0, EC2). A validação a 390px
 * prova ausência de regressão; o mecanismo se prova com inset injetado em teste.
 */

// ------------------------------------------------------------------------------------- Provider

/**
 * `initialWindowMetrics` faz o **primeiro** frame já sair com o inset certo. Sem ele a árvore
 * renderiza uma vez com 0 e outra com 59, e o que se vê ao abrir o app é o cabeçalho pulando.
 */
export function SafeAreaRoot({ children }: { children: ReactNode }) {
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}>{children}</SafeAreaProvider>;
}

// ------------------------------------------------------------------------- Quem é o dono do pé

/**
 * BR2 — **um só dono do pé por janela.**
 *
 * O `Screen` aparece nos dois mundos: sozinho (login, onboarding, os momentos) e dentro da casca
 * autenticada, onde a `TabBar` já está encostada no rodapé do aparelho. Se os dois somassem o inset
 * inferior, o conteúdo subiria 34pt acima da barra por nenhuma razão visível — e um `Screen` que
 * nunca somasse deixaria o rodapé fixo do login debaixo do indicador de home.
 *
 * A casca declara a posse; o `Screen` pergunta. Um prop atravessando toda tela até o `Screen` teria
 * a forma exata do defeito que abriu esta SPEC: alguém esqueceria de repassar.
 */
const BottomOwnedContext = createContext(false);

/** Envolve o que tem uma barra própria encostada no rodapé (hoje: a casca com a `TabBar`). */
export function BottomInsetOwnedByChrome({ children }: { children: ReactNode }) {
  return <BottomOwnedContext.Provider value={true}>{children}</BottomOwnedContext.Provider>;
}

// ----------------------------------------------------------------------------------------- Hooks

/**
 * BR1 — **o inset SOMA, nunca SUBSTITUI o espaçamento de design.**
 *
 * Substituir daria, num iPhone com indicador de home, exatamente 34pt de nada; e num iPhone SE
 * (inset 0) daria respiro **zero**. Espaçamento é legibilidade, inset é hardware — duas coisas,
 * somadas.
 */
export function useSafeTop(designPadding: number): number {
  return designPadding + useSafeAreaInsets().top;
}

/**
 * O inset do pé, já resolvido pela posse: `0` quando algo abaixo (a `TabBar`) o assume.
 * Continua somando o espaçamento de design de quem chama.
 */
export function useSafeBottom(designPadding: number): number {
  const inset = useSafeAreaInsets().bottom;
  const owned = useContext(BottomOwnedContext);
  return designPadding + (owned ? 0 : inset);
}

/** O inset do pé sem a regra de posse — para quem **é** o dono (a `TabBar`). */
export function useChromeBottom(designPadding: number): number {
  return designPadding + useSafeAreaInsets().bottom;
}
