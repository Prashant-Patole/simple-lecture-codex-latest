import { lazy, ComponentType } from 'react';
import { safeSessionStorage } from './safeStorage';

const RETRY_KEY = 'lazy-import-retry';

export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const hasRetried = safeSessionStorage.getItem(RETRY_KEY) === 'true';

    try {
      safeSessionStorage.removeItem(RETRY_KEY);
      return await componentImport();
    } catch (error) {
      if (!hasRetried) {
        safeSessionStorage.setItem(RETRY_KEY, 'true');
        window.location.reload();
        // Return a never-resolving promise to prevent error flash before reload
        return new Promise(() => {});
      }
      throw error;
    }
  });
}
