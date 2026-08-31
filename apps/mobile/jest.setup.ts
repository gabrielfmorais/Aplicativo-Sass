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
