'use client';

import {
  ArrowRight,
  Box,
  Check,
  MapPin,
  MoveHorizontal,
  MoveVertical,
  Layers,
  Tent,
  Monitor,
  Minus,
  Plus,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button, ButtonLink } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { PhotoPlaceholder, type PlaceholderTone } from '@/components/ui/PhotoPlaceholder';
import { DEMO_DATA_NOTICE } from '@/constants/labels';
import { cn } from '@/lib/cn';
import { formatMetres } from '@/lib/format';
import { formatMinor } from '@/lib/money';
import { useDraftStore } from '@/store/draftStore';

import { FloorPlanSvg } from './FloorPlanSvg';
import { useLayoutState, type StepProps } from './layoutState';
import { presetStageRect } from './planGeometry';
import { StageElevation } from './StageElevation';
import { stepHref } from './steps';
import { useSelections } from './useSelections';
import { usePlanView, ZOOM_LEVELS, zoomPercent } from './usePlanView';

/** Placeholder tones, cycled by stage position. */
const TONES: readonly PlaceholderTone[] = ['ivory', 'garden', 'royal'];

/** Preview modes for the large stage image. */
type StagePreviewMode = 'front' | 'venue';

/**
 * Stage step: preset thumbnails, a front-elevation or in-venue preview, and the
 * details panel. The in-venue preview draws the preset footprint on the hall plan.
 * Stage presets do not yet take part in server layout validation, so the panel warns
 * that a larger stage may affect seating.
 *
 * @param props Venue and the shared validation request.
 * @returns The stage step layout.
 */
export function StageStep({ venue, validation }: StepProps): ReactNode {
  const guests = useDraftStore((state) => state.guests);
  const setStage = useDraftStore((state) => state.setStage);
  const selections = useSelections(venue);
  const { view, actions } = usePlanView();
  const [mode, setMode] = useState<StagePreviewMode>('front');
  const layout = useLayoutState(venue, validation);
  const stage = selections.stage;
  const percent = zoomPercent(view);
  const previewStage = stage ? presetStageRect(layout.shell, stage.widthMm, stage.depthMm) : null;
  const stageCheck = layout.layout?.stage ?? null;
  const stageConflict = stageCheck && !stageCheck.fits ? stageCheck : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="stage-heading" className="min-w-0">
        <h1 id="stage-heading" className="text-4xl md:text-6xl">
          Set the scene.
        </h1>
        <p className="mt-2 text-lg text-ink-muted">Find the backdrop for your celebration.</p>

        {venue.stages.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
            <p className="font-serif text-2xl">
              No stage presets are published for this venue yet.
            </p>
            <p className="mt-2 text-ink-muted">
              You can continue without one and discuss options with our team.
            </p>
          </div>
        ) : (
          <>
            <div className="relative mt-6 rounded-2xl border border-line bg-surface p-2 shadow-card">
              <p className="absolute left-5 top-5 z-10 inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm font-medium shadow-card">
                <Box className="size-4" aria-hidden="true" /> Stage preview
              </p>
              {stage ? (
                mode === 'front' ? (
                  <StageElevation
                    widthMm={stage.widthMm}
                    heightMm={stage.heightMm}
                    name={stage.name}
                    zoomPercent={percent}
                  />
                ) : (
                  <FloorPlanSvg
                    shell={layout.shell}
                    geometry={layout.geometry}
                    quarter={0}
                    zoomPercent={percent}
                    stageOverride={previewStage}
                    emphasiseStage
                    ariaLabel={`${stage.name} stage placed in ${venue.name}.`}
                  />
                )
              ) : (
                <PhotoPlaceholder
                  label="Stage preview"
                  className="aspect-[16/9] w-full rounded-xl"
                />
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 px-2 pb-1">
                <div
                  role="group"
                  aria-label="Preview type"
                  className="inline-flex rounded-lg bg-cream-deep p-1"
                >
                  {(
                    [
                      { id: 'front', label: 'Front view', Icon: Monitor },
                      { id: 'venue', label: 'In venue', Icon: Box },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={mode === id}
                      onClick={() => {
                        setMode(id);
                      }}
                      className={cn(
                        'inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium',
                        mode === id ? 'bg-accent text-surface' : 'text-ink hover:bg-surface',
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" /> {label}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-1" role="group" aria-label="Zoom">
                  <Button
                    variant="secondary"
                    aria-label="Zoom out"
                    onClick={actions.zoomOut}
                    disabled={view.zoomIndex === 0}
                    className="px-3"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </Button>
                  <span className="min-w-12 text-center text-sm">{percent}%</span>
                  <Button
                    variant="secondary"
                    aria-label="Zoom in"
                    onClick={actions.zoomIn}
                    disabled={view.zoomIndex === ZOOM_LEVELS.length - 1}
                    className="px-3"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <p className="px-2 pb-2 text-xs text-ink-muted">
                Illustrative preview. Approved 3D presets and photography are pending.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Stage preset"
              className="mt-5 grid gap-4 sm:grid-cols-3"
            >
              {venue.stages.map((entry, index) => {
                const selected = stage?.id === entry.id;
                return (
                  <label
                    key={entry.id}
                    className={cn(
                      'relative block cursor-pointer overflow-hidden rounded-2xl border bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
                      selected ? 'border-2 border-terracotta' : 'border-line hover:shadow-card',
                    )}
                  >
                    <input
                      type="radio"
                      name="stage-preset"
                      value={entry.id}
                      checked={selected}
                      onChange={() => {
                        setStage(entry.id);
                      }}
                      className="sr-only"
                    />
                    <PhotoPlaceholder
                      label={entry.name}
                      tone={TONES[index % TONES.length] ?? 'ivory'}
                      caption={false}
                      className="aspect-[16/7] w-full"
                    />
                    <span className="block px-3 py-2 font-serif text-2xl">{entry.name}</span>
                    {selected ? (
                      <span className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-accent text-surface">
                        <Check className="size-4" aria-hidden="true" />
                        <span className="sr-only">Selected</span>
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-muted">{DEMO_DATA_NOTICE}</p>
          </>
        )}
      </section>

      <aside
        aria-labelledby="stage-details-heading"
        className="space-y-4 lg:border-l lg:border-line lg:pl-6"
      >
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <h2 id="stage-details-heading" className="sr-only">
            Stage details
          </h2>
          {stage ? (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                Stage collection
              </p>
              <p className="mt-2 font-serif text-5xl leading-none">{stage.name}</p>
              {stage.collection && stage.collection !== stage.name ? (
                <p className="mt-2 text-sm text-ink-muted">{stage.collection}</p>
              ) : null}
              <span className="mt-4 block h-0.5 w-10 bg-terracotta" aria-hidden="true" />
              <p className="mt-5 font-serif text-4xl">{formatMinor(stage.price)}</p>
              <p className="text-ink-muted">One-time stage fee</p>
              <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
                <DetailRow
                  Icon={MoveHorizontal}
                  label="Width"
                  value={formatMetres(stage.widthMm)}
                />
                <DetailRow Icon={MoveVertical} label="Depth" value={formatMetres(stage.depthMm)} />
                <DetailRow Icon={Layers} label="Height" value={formatMetres(stage.heightMm)} />
                <DetailRow Icon={MapPin} label={`Preview in`} value={venue.name} />
              </dl>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                Stage collection
              </p>
              <p className="mt-2 font-serif text-4xl leading-none">No preset selected</p>
              <p className="mt-3 text-sm text-ink-muted">
                Choose a preset to see its size and fee. The stage is optional; you can continue
                without one.
              </p>
            </>
          )}
          {stageConflict ? (
            <Notice tone="warning" className="mt-5">
              {stageConflict.outsideFloor
                ? `The ${stageConflict.name} runs past the usable floor. Choose a smaller stage.`
                : `The ${stageConflict.name} would collide with ${stageConflict.conflictingPlacementIds.length} table${stageConflict.conflictingPlacementIds.length === 1 ? '' : 's'}. Choose a smaller stage or another guest count.`}
            </Notice>
          ) : (
            <Notice tone="info" className="mt-5">
              Stage changes may affect your seating layout.
            </Notice>
          )}
        </div>

        <p className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium">
          <Tent className="size-5 text-ink-muted" aria-hidden="true" />
          {venue.name} · {guests} guests
        </p>
        {stageConflict ? (
          <Button size="lg" className="w-full" disabled>
            Continue to extras <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <ButtonLink href={stepHref(venue.slug, 'extras')} size="lg" className="w-full">
            Continue to extras <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        )}
        {stage ? (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStage(null);
            }}
          >
            Clear stage selection
          </Button>
        ) : null}
      </aside>
    </div>
  );
}

/** Props for {@link DetailRow}. */
interface DetailRowProps {
  readonly Icon: typeof MoveHorizontal;
  readonly label: string;
  readonly value: string;
}

/**
 * One row in the stage details list.
 * @param props Icon, label and value.
 * @returns A definition-list row.
 */
function DetailRow({ Icon, label, value }: DetailRowProps): ReactNode {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="size-4 text-ink-muted" aria-hidden="true" />
      <dt className="text-ink-muted">{label}</dt>
      <dd className="ml-auto font-medium">{value}</dd>
    </div>
  );
}
