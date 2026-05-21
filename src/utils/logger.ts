/**
 * Tiny namespaced logger. Debug output is compiled away in production builds
 * via the `__DEV__` define in vite.config.ts, keeping release bundles quiet
 * and slightly smaller.
 */
declare const __DEV__: boolean;

const PREFIX = '[FloatTube]';

export const log = {
  debug: (...args: unknown[]): void => {
    if (__DEV__) console.debug(PREFIX, ...args);
  },
  info: (...args: unknown[]): void => {
    if (__DEV__) console.info(PREFIX, ...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(PREFIX, ...args);
  },
  error: (...args: unknown[]): void => {
    console.error(PREFIX, ...args);
  },
};
