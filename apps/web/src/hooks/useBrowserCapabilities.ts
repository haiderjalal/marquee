'use client';

import { useSyncExternalStore } from 'react';

/** Cached WebGL probe result; probing creates a GL context so it runs once. */
let webGlSupport: boolean | null = null;

/**
 * Probes for a usable WebGL context once and caches the answer.
 * @returns True when a WebGL (1 or 2) context can be created.
 */
function detectWebGl(): boolean {
  if (webGlSupport !== null) {
    return webGlSupport;
  }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    webGlSupport = context !== null;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webGlSupport = false;
  }
  return webGlSupport;
}

/**
 * Subscription stub: WebGL support does not change during a session.
 * @returns A no-op unsubscribe function.
 */
function subscribeNever(): () => void {
  return () => undefined;
}

/**
 * Reports WebGL availability.
 * @returns null during server render and hydration, then true or false.
 */
export function useWebGlSupport(): boolean | null {
  return useSyncExternalStore(subscribeNever, detectWebGl, () => null);
}

/** Media query for reduced motion. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Subscribes to reduced-motion preference changes.
 * @param onChange Callback invoked when the preference changes.
 * @returns Unsubscribe function.
 */
function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/**
 * Reports whether the visitor asked the system to reduce motion.
 * @returns True when animation and camera tweens should be skipped.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}
