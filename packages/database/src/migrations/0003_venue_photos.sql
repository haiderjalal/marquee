-- Venue photography. A photo reaches the public site only while its status is 'approved'.
-- Uploads start as 'pending'; approval is a deliberate status change made by staff.
-- The table stores a public URL only. It never holds file contents or credentials.
CREATE TABLE venue_photo (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  venue_id uuid NOT NULL,
  url text NOT NULL CHECK (url LIKE 'https://%' AND length(url) <= 2048),
  alt text NOT NULL CHECK (length(alt) BETWEEN 1 AND 200),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, venue_id) REFERENCES venue (tenant_id, id)
);

-- At most one approved photo per venue, so the public page has a single answer.
CREATE UNIQUE INDEX venue_photo_one_approved_per_venue
  ON venue_photo (tenant_id, venue_id)
  WHERE status = 'approved';
