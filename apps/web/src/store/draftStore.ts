import {
  EVENT_TYPES,
  isSupportedSeatsPerTable,
  MAX_REQUESTED_GUESTS,
  type EventType,
  type SeatsPerTable,
} from '@marquee/domain';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

/** localStorage key for the browser-only event draft. */
const STORAGE_KEY = 'event-studio:draft:v1';

/** Maximum number of undo steps kept in memory. */
const MAX_HISTORY = 20;

/** Starting guest count for a new draft. */
export const DEFAULT_GUESTS = 200;

/** Starting table size for a new draft. */
export const DEFAULT_SEATS_PER_TABLE: SeatsPerTable = 5;

/** Snapshot of the seating inputs, used by Undo. */
interface SeatingSnapshot {
  readonly guests: number;
  readonly seatsPerTable: SeatsPerTable;
}

/** Data held in the draft. Lives only in this browser; nothing here is saved on a server. */
interface DraftData {
  readonly venueSlug: string | null;
  readonly eventDate: string | null;
  readonly eventType: EventType;
  readonly guests: number;
  readonly seatsPerTable: SeatsPerTable;
  readonly packageId: string | null;
  readonly stageId: string | null;
  /** Extra service code to quantity. Only entries with quantity above zero are kept. */
  readonly extras: Readonly<Record<string, number>>;
  /** In-memory undo stack for guests and seats per table (not persisted). */
  readonly history: readonly SeatingSnapshot[];
}

/** Actions that change the draft. */
interface DraftActions {
  setVenue: (slug: string) => void;
  setEventDate: (isoDate: string | null) => void;
  setEventType: (eventType: EventType) => void;
  setGuests: (guests: number) => void;
  setSeatsPerTable: (seatsPerTable: SeatsPerTable) => void;
  undoSeating: () => void;
  setPackage: (packageId: string | null) => void;
  setStage: (stageId: string | null) => void;
  setExtraQuantity: (code: string, quantity: number) => void;
  resetDraft: () => void;
}

/** Full store shape. */
export type DraftState = DraftData & DraftActions;

/** Initial values for a new draft. */
const INITIAL_DATA: DraftData = {
  venueSlug: null,
  eventDate: null,
  eventType: 'walima',
  guests: DEFAULT_GUESTS,
  seatsPerTable: DEFAULT_SEATS_PER_TABLE,
  packageId: null,
  stageId: null,
  extras: {},
  history: [],
};

/**
 * localStorage wrapper that never throws. Private windows, blocked storage and
 * quota errors simply make the draft memory-only for the session.
 */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Storage is unavailable; the draft stays in memory for this session.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Nothing to remove when storage is unavailable.
    }
  },
};

/**
 * Pushes the current seating inputs onto the undo stack, capped at MAX_HISTORY.
 * @param state Current draft data.
 * @returns The next history array.
 */
function pushHistory(state: DraftData): readonly SeatingSnapshot[] {
  const next = [...state.history, { guests: state.guests, seatsPerTable: state.seatsPerTable }];
  return next.slice(-MAX_HISTORY);
}

/**
 * Clamps a guest count into the supported range as a whole number.
 * @param guests Requested count.
 * @returns A whole number between 1 and the platform maximum.
 */
function clampGuests(guests: number): number {
  return Math.min(MAX_REQUESTED_GUESTS, Math.max(1, Math.round(guests)));
}

/**
 * Narrows a persisted value to a supported event type.
 * @param value Persisted candidate.
 * @returns The event type, or the default when unrecognised.
 */
function readEventType(value: unknown): EventType {
  return EVENT_TYPES.find((type) => type === value) ?? INITIAL_DATA.eventType;
}

/**
 * Browser-only draft of the customer's event. Persisted to localStorage inside
 * try/catch and rehydrated after mount (see DraftHydrator) to avoid hydration mismatches.
 */
export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      ...INITIAL_DATA,
      setVenue: (slug) =>
        set((state) =>
          state.venueSlug === slug
            ? state
            : { venueSlug: slug, packageId: null, stageId: null, extras: {} },
        ),
      setEventDate: (isoDate) => set({ eventDate: isoDate }),
      setEventType: (eventType) => set({ eventType }),
      setGuests: (guests) =>
        set((state) => {
          const next = clampGuests(guests);
          return next === state.guests ? state : { guests: next, history: pushHistory(state) };
        }),
      setSeatsPerTable: (seatsPerTable) =>
        set((state) =>
          seatsPerTable === state.seatsPerTable
            ? state
            : { seatsPerTable, history: pushHistory(state) },
        ),
      undoSeating: () =>
        set((state) => {
          const previous = state.history.at(-1);
          if (!previous) {
            return state;
          }
          return { ...previous, history: state.history.slice(0, -1) };
        }),
      setPackage: (packageId) => set({ packageId }),
      setStage: (stageId) => set({ stageId }),
      setExtraQuantity: (code, quantity) =>
        set((state) => {
          const rest = Object.fromEntries(
            Object.entries(state.extras).filter(([key]) => key !== code),
          );
          return { extras: quantity > 0 ? { ...rest, [code]: quantity } : rest };
        }),
      resetDraft: () => set({ ...INITIAL_DATA }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (state) => ({
        venueSlug: state.venueSlug,
        eventDate: state.eventDate,
        eventType: state.eventType,
        guests: state.guests,
        seatsPerTable: state.seatsPerTable,
        packageId: state.packageId,
        stageId: state.stageId,
        extras: state.extras,
      }),
      merge: (persisted, current) => {
        if (typeof persisted !== 'object' || persisted === null) {
          return current;
        }
        const record: Record<string, unknown> = { ...persisted };
        const guests =
          typeof record.guests === 'number' ? clampGuests(record.guests) : current.guests;
        const extras: Record<string, number> = {};
        if (typeof record.extras === 'object' && record.extras !== null) {
          for (const [code, quantity] of Object.entries(record.extras)) {
            if (typeof quantity === 'number' && quantity > 0) {
              extras[code] = quantity;
            }
          }
        }
        return {
          ...current,
          venueSlug: typeof record.venueSlug === 'string' ? record.venueSlug : null,
          eventDate: typeof record.eventDate === 'string' ? record.eventDate : null,
          eventType: readEventType(record.eventType),
          guests,
          seatsPerTable:
            typeof record.seatsPerTable === 'number' &&
            isSupportedSeatsPerTable(record.seatsPerTable)
              ? record.seatsPerTable
              : current.seatsPerTable,
          packageId: typeof record.packageId === 'string' ? record.packageId : null,
          stageId: typeof record.stageId === 'string' ? record.stageId : null,
          extras,
        };
      },
    },
  ),
);
