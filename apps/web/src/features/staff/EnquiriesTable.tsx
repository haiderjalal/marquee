'use client';

import type { EnquiryStatusDto, StaffEnquiryDto } from '@marquee/contracts';
import { canTransitionEnquiry, ENQUIRY_STATUSES, type EnquiryStatus } from '@marquee/domain';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { friendlyErrorMessage, ApiRequestError } from '@/lib/api/errors';
import { isEnquiryStatus } from '@/lib/api/guards';
import { requestJson } from '@/lib/api/http';
import { formatInstant, formatLocalDate, humaniseCode } from '@/lib/format';

/** Props for {@link EnquiriesTable}. */
interface EnquiriesTableProps {
  readonly initialRows: readonly StaffEnquiryDto[];
  /** False where the development write route is disabled (production). */
  readonly canChangeStatus: boolean;
}

/**
 * Narrows a string to a known enquiry status.
 * @param value Status text from the API or a select.
 * @returns The status, or null when unknown.
 */
function toStatus(value: string): EnquiryStatus | null {
  return ENQUIRY_STATUSES.find((status) => status === value) ?? null;
}

/**
 * Lists the statuses a lead may move to from its current one.
 * @param current Current status text.
 * @returns Allowed next statuses (empty for terminal or unknown states).
 */
function nextStatuses(current: string): EnquiryStatus[] {
  const from = toStatus(current);
  return from ? ENQUIRY_STATUSES.filter((status) => canTransitionEnquiry(from, status)) : [];
}

/**
 * Enquiries list with status changes. Writes go through the web app's own route
 * handler, which adds the staff identity on the server. Each change sends the
 * revision the row was read at; a conflict asks the user to reload.
 *
 * @param props Rows loaded on the server.
 * @returns A table with per-row status controls.
 */
export function EnquiriesTable({ initialRows, canChangeStatus }: EnquiriesTableProps): ReactNode {
  const [rows, setRows] = useState<readonly StaffEnquiryDto[]>(initialRows);
  const [choices, setChoices] = useState<Readonly<Record<string, string>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    readonly tone: 'success' | 'error';
    readonly text: string;
  } | null>(null);

  /**
   * Sends one status change and updates the row from the server's answer.
   * @param row Enquiry being changed.
   * @param status Requested status.
   */
  async function changeStatus(row: StaffEnquiryDto, status: EnquiryStatus): Promise<void> {
    setBusyId(row.id);
    setMessage(null);
    try {
      const updated: EnquiryStatusDto = await requestJson(`/api/staff/enquiries/${row.id}/status`, {
        method: 'PATCH',
        body: { status, expectedRevision: row.revision },
        guard: isEnquiryStatus,
      });
      setRows((current) =>
        current.map((entry) =>
          entry.id === row.id
            ? { ...entry, status: updated.status, revision: updated.revision }
            : entry,
        ),
      );
      setMessage({
        tone: 'success',
        text: `${row.reference} moved to ${humaniseCode(updated.status)}.`,
      });
    } catch (error) {
      setMessage({ tone: 'error', text: friendlyErrorMessage(error) });
      if (error instanceof ApiRequestError && error.correlationId) {
        setMessage({
          tone: 'error',
          text: `${friendlyErrorMessage(error)} (Support reference: ${error.correlationId})`,
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
        <p className="font-serif text-2xl">No enquiries yet.</p>
        <p className="mt-2 text-ink-muted">New requests from the website will appear here.</p>
      </div>
    );
  }

  return (
    <div>
      <div aria-live="polite">
        {message ? (
          <Notice tone={message.tone === 'success' ? 'success' : 'error'} className="mb-4">
            {message.text}
          </Notice>
        ) : null}
      </div>
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <caption className="sr-only">Enquiries, newest first</caption>
          <thead className="bg-cream-deep text-ink-muted">
            <tr>
              <th scope="col" className="p-3 font-medium">
                Reference
              </th>
              <th scope="col" className="p-3 font-medium">
                Customer
              </th>
              <th scope="col" className="p-3 font-medium">
                Event
              </th>
              <th scope="col" className="p-3 font-medium">
                Guests
              </th>
              <th scope="col" className="p-3 font-medium">
                Received
              </th>
              <th scope="col" className="p-3 font-medium">
                Status
              </th>
              <th scope="col" className="p-3 font-medium">
                Change status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const options = nextStatuses(row.status);
              const choice = choices[row.id] ?? options[0] ?? '';
              const target = toStatus(choice);
              return (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <th scope="row" className="p-3 font-mono text-xs font-medium">
                    {row.reference}
                  </th>
                  <td className="p-3">
                    <p className="font-medium">{row.fullName}</p>
                    <p className="text-ink-muted">{row.mobile}</p>
                  </td>
                  <td className="p-3">
                    <p>
                      {humaniseCode(row.eventType)} · {row.venueName}
                    </p>
                    <p className="text-ink-muted">{formatLocalDate(row.preferredDate)}</p>
                  </td>
                  <td className="p-3">{row.guestsExpected}</td>
                  <td className="p-3">{formatInstant(row.createdAt)}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-cream-deep px-3 py-1">
                      {humaniseCode(row.status)}
                    </span>
                  </td>
                  <td className="p-3">
                    {!canChangeStatus ? (
                      <span className="text-ink-muted">
                        Status changes are not available in this environment.
                      </span>
                    ) : options.length === 0 ? (
                      <span className="text-ink-muted">No further changes</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label className="sr-only" htmlFor={`status-${row.id}`}>
                          New status for {row.reference}
                        </label>
                        <select
                          id={`status-${row.id}`}
                          value={choice}
                          onChange={(event) => {
                            setChoices((current) => ({ ...current, [row.id]: event.target.value }));
                          }}
                          className="min-h-11 rounded-lg border border-line bg-surface px-2"
                        >
                          {options.map((status) => (
                            <option key={status} value={status}>
                              {humaniseCode(status)}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant="secondary"
                          disabled={busyId === row.id || target === null}
                          onClick={() => {
                            if (target) {
                              void changeStatus(row, target);
                            }
                          }}
                        >
                          {busyId === row.id ? 'Updating…' : 'Update'}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
