'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { useDraftStore } from '@/store/draftStore';

/**
 * Subscribes to the end of draft hydration.
 * @param onChange Callback invoked when hydration finishes.
 * @returns Unsubscribe function.
 */
function subscribeToHydration(onChange: () => void): () => void {
  return useDraftStore.persist.onFinishHydration(onChange);
}

/**
 * Reports whether the browser draft has been loaded from localStorage.
 * Server render and the first client render both return false, so markup matches.
 * @returns True once the persisted draft has been merged into the store.
 */
export function useDraftHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    () => useDraftStore.persist.hasHydrated(),
    () => false,
  );
}

/**
 * Mounted once in the root layout. Loads the persisted draft after the first
 * client render so server and client markup agree.
 * @returns Nothing; this component renders no markup.
 */
export function DraftHydrator(): null {
  useEffect(() => {
    void useDraftStore.persist.rehydrate();
  }, []);
  return null;
}
