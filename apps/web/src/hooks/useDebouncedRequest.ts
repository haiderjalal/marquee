'use client';

import { useEffect, useRef, useState } from 'react';

import { isAbortError } from '@/lib/api/http';

/** Lifecycle of a debounced request, derived from the latest input. */
export type RequestState<O> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly stale: O | null }
  | { readonly status: 'ready'; readonly data: O }
  | { readonly status: 'error'; readonly error: unknown };

/** Settled outcome stored together with the input key it answers. */
interface Settled<O> {
  readonly key: string;
  readonly outcome:
    | { readonly status: 'ready'; readonly data: O }
    | { readonly status: 'error'; readonly error: unknown };
}

/**
 * Runs an async call whenever its input changes, after a debounce delay, aborting
 * superseded calls. Results for an older input are never shown for a newer one.
 *
 * @param input Request input, or null to stay idle.
 * @param fetcher Async call; receives the input and an AbortSignal.
 * @param delayMs Debounce delay in milliseconds.
 * @returns Current state: idle, loading (with the last good result for display), ready or error.
 */
export function useDebouncedRequest<I, O>(
  input: I | null,
  fetcher: (input: I, signal: AbortSignal) => Promise<O>,
  delayMs: number,
): RequestState<O> {
  const key = input === null ? null : JSON.stringify(input);
  const [settled, setSettled] = useState<Settled<O> | null>(null);
  const inputRef = useRef(input);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    inputRef.current = input;
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (key === null) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const current = inputRef.current;
      if (current === null) {
        return;
      }
      fetcherRef
        .current(current, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setSettled({ key, outcome: { status: 'ready', data } });
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted && !isAbortError(error)) {
            setSettled({ key, outcome: { status: 'error', error } });
          }
        });
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, delayMs]);

  if (key === null) {
    return { status: 'idle' };
  }
  if (settled && settled.key === key) {
    return settled.outcome;
  }
  return {
    status: 'loading',
    stale: settled && settled.outcome.status === 'ready' ? settled.outcome.data : null,
  };
}
