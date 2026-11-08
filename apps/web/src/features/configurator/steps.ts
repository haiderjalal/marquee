/** Configurator steps that live in the URL as ?step=. The Venue step is the home page. */
export const STEP_IDS = ['seating', 'menu', 'stage', 'extras', 'review'] as const;

/** One configurator step identifier. */
export type StepId = (typeof STEP_IDS)[number];

/** Display labels for each step. */
export const STEP_LABELS: Readonly<Record<StepId, string>> = {
  seating: 'Seating',
  menu: 'Menu',
  stage: 'Stage',
  extras: 'Extras',
  review: 'Review',
};

/**
 * Reads the step from a query-string value, defaulting to seating.
 * @param value Raw `step` parameter, or null when absent.
 * @returns A valid step id.
 */
export function parseStep(value: string | null): StepId {
  return STEP_IDS.find((id) => id === value) ?? 'seating';
}

/**
 * Builds the URL of a step for a venue.
 * @param slug Venue slug.
 * @param step Target step.
 * @returns A relative URL such as /plan/marquee-a?step=menu.
 */
export function stepHref(slug: string, step: StepId): string {
  return `/plan/${slug}?step=${step}`;
}

/**
 * Returns the step that follows another, or null at the end.
 * @param step Current step.
 * @returns Next step id or null.
 */
export function nextStep(step: StepId): StepId | null {
  const index = STEP_IDS.indexOf(step);
  return STEP_IDS[index + 1] ?? null;
}
