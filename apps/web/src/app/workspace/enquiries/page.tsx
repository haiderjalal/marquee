import type { StaffEnquiryDto } from '@marquee/contracts';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ApiErrorPanel } from '@/components/ui/ApiErrorPanel';
import { EnquiriesTable } from '@/features/staff/EnquiriesTable';
import { getStaffEnquiries } from '@/lib/api/staff.server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Enquiries',
  description: 'Customer enquiries received from the website, newest first.',
};

/**
 * Staff enquiries page.
 * @returns The enquiries list, or a friendly error.
 */
export default async function EnquiriesPage(): Promise<ReactNode> {
  let rows: StaffEnquiryDto[] = [];
  let failure: unknown = null;
  try {
    rows = await getStaffEnquiries(50);
  } catch (error) {
    failure = error;
  }
  return (
    <main id="main" className="px-4 py-6 md:px-8">
      <h1 className="text-5xl">Enquiries</h1>
      <p className="mt-2 text-ink-muted">
        Requests from the website. Contacting customers and confirming dates happens outside this
        screen for now.
      </p>
      <div className="mt-6">
        {failure ? (
          <ApiErrorPanel
            title="Enquiries are not loading"
            error={failure}
            retryHref="/workspace/enquiries"
          />
        ) : (
          <EnquiriesTable
            initialRows={rows}
            canChangeStatus={process.env.NODE_ENV !== 'production'}
          />
        )}
      </div>
    </main>
  );
}
