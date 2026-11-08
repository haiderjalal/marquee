'use client';

import type {
  ConfigurationValidationDto,
  PublicVenueDetailDto,
  PublicVenueSummaryDto,
} from '@marquee/contracts';
import type { VenueShell } from '@marquee/spatial';
import { useMemo } from 'react';

import type { RequestState } from '@/hooks/useDebouncedRequest';

import { buildPlanGeometry, resolveShell, type PlanGeometry } from './planGeometry';

/** The accepted branch of a validation result. */
export type ValidLayout = Extract<ConfigurationValidationDto, { ok: true }>;

/** The refused branch of a validation result. */
export type RefusedLayout = Extract<ConfigurationValidationDto, { ok: false }>;

/** Props shared by every configurator step. */
export interface StepProps {
  readonly venue: PublicVenueDetailDto;
  readonly venues: readonly PublicVenueSummaryDto[];
  readonly validation: RequestState<ConfigurationValidationDto>;
}

/** Derived view of the validation request used by several steps. */
export interface LayoutState {
  /** The accepted layout for the current inputs, or the previous one while a new one loads. */
  readonly layout: ValidLayout | null;
  /** True when {@link layout} belongs to the current inputs. */
  readonly layoutIsCurrent: boolean;
  /** The server's refusal for the current inputs, if any. */
  readonly refusal: RefusedLayout | null;
  readonly loading: boolean;
  readonly error: unknown;
  readonly geometry: PlanGeometry | null;
  readonly shell: VenueShell;
  readonly shellIsExact: boolean;
}

/**
 * Derives layout, refusal, loading and drawing data from the validation request.
 * @param venue Venue being planned; supplies the shell version before a result exists.
 * @param validation Debounced validation request state.
 * @returns A {@link LayoutState}.
 */
export function useLayoutState(
  venue: PublicVenueDetailDto,
  validation: RequestState<ConfigurationValidationDto>,
): LayoutState {
  const current = validation.status === 'ready' ? validation.data : null;
  const stale = validation.status === 'loading' ? validation.stale : null;
  const shown = current ?? stale;
  const layout = shown?.ok ? shown : null;
  const refusal = current && !current.ok ? current : null;

  const geometry = useMemo(() => buildPlanGeometry(layout), [layout]);
  const resolved = useMemo(
    () => resolveShell(venue.spaces[0]?.shell ?? null, layout?.placements ?? []),
    [layout, venue.spaces],
  );

  return {
    layout,
    layoutIsCurrent: current?.ok === true,
    refusal,
    loading: validation.status === 'loading',
    error: validation.status === 'error' ? validation.error : null,
    geometry,
    shell: resolved.shell,
    shellIsExact: resolved.exact,
  };
}
