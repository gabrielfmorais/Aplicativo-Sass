import { configure } from '@testing-library/react-native';

/**
 * RNTL's async helpers default to a 1s budget, which is independent of Jest's `testTimeout`. With
 * 18 suites running in parallel on a loaded machine, a single render + resolved promise can lose
 * that race and fail a test that is perfectly correct — observed once here on a full run that
 * passed on the very next one.
 *
 * This is a wall-clock budget, not an assertion: nothing waits this long when things work, every
 * `waitFor` still has to see the same thing it always had to see, and a genuine hang still fails.
 * Same reasoning as the `testTimeout` above it in jest.config.js.
 */
configure({ asyncUtilTimeout: 5000 });

/**
 * SPEC-060 — `Screen` e `TabBar` passaram a ler a área segura, então **toda** suíte que renderiza
 * uma tela atravessa `useSafeAreaInsets`. O mock oficial devolve insets **zerados** quando não há
 * provider, que é exatamente o aparelho sem entalhe (AC5): as 51 suítes anteriores continuam
 * medindo o mesmo layout de sempre. Quem quiser um iPhone com Dynamic Island envolve o que renderiza
 * num `SafeAreaProvider` com `initialMetrics`.
 */
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
