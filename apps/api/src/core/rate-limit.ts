import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@marquee/domain';

import { type Clock, RATE_LIMITER } from './tokens';

/** Upper bound on tracked keys; expired entries are pruned when it is exceeded. */
const MAX_TRACKED_KEYS = 10_000;

/**
 * Fixed-window counter per key. The counter lives in process memory, so it protects one
 * API instance. Multiple instances need a shared store before public launch (see ADR-0006).
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { count: number; startedAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;

  /**
   * @param limit Requests allowed per window.
   * @param windowMs Window length in milliseconds.
   * @param clock Time source.
   */
  constructor(limit: number, windowMs: number, clock: Clock) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
  }

  /**
   * Records one request for a key and reports whether it is within the limit.
   * @param key Client identity, for example an IP address.
   * @returns False when the request must be refused.
   */
  consume(key: string): boolean {
    const now = this.clock.now().getTime();
    if (this.windows.size > MAX_TRACKED_KEYS) {
      this.prune(now);
    }
    const current = this.windows.get(key);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.windows.set(key, { count: 1, startedAt: now });
      return true;
    }
    if (current.count >= this.limit) {
      return false;
    }
    current.count += 1;
    return true;
  }

  /**
   * Removes windows that have already ended.
   * @param now Current epoch milliseconds.
   */
  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.startedAt >= this.windowMs) {
        this.windows.delete(key);
      }
    }
  }
}

/** Guard applied to public, unauthenticated submission endpoints. */
@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly limiter: FixedWindowRateLimiter;

  /**
   * @param limiter Shared limiter provided by the core module.
   */
  constructor(@Inject(RATE_LIMITER) limiter: FixedWindowRateLimiter) {
    this.limiter = limiter;
  }

  /**
   * Refuses the request when the caller has exhausted the window.
   * @param context Nest execution context.
   * @returns True when the request may proceed.
   * @throws DomainError RATE_LIMITED when the limit is reached.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ ip?: string }>();
    if (!this.limiter.consume(request.ip ?? 'unknown')) {
      throw new DomainError(
        'RATE_LIMITED',
        'Too many requests. Please wait a few minutes and try again.',
      );
    }
    return true;
  }
}
