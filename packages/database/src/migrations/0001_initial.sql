-- 0001_initial.sql
-- Reviewed initial schema for the venue platform slice.
--
-- Integrity rules enforced here (not only in application code):
--   * Every tenant-owned row carries tenant_id; cross-record references use
--     composite foreign keys that include tenant_id, so a valid identifier from
--     another tenant cannot be attached.
--   * No two active claims (held or confirmed) may overlap on the same atomic
--     resource within a tenant. The exclusion constraint is the final guard
--     against concurrent writers; application locks are the first line.
--   * Claim intervals are half-open [start, end) so back-to-back use is allowed.
--   * Shell versions and audit events are immutable (triggers reject updates
--     and deletes).
--   * Money is stored as integer paisa (bigint). Never a float.
--
-- This migration is applied inside one transaction by the migration runner.
-- Down-migration: forward-fix only. Financial and audit history is never dropped by script.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Generic guard used by append-only and immutable tables.
CREATE FUNCTION reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'record is immutable or append-only (%)', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TABLE tenant (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Global identity. Authentication credentials live with the chosen identity
-- provider, never in this table.
CREATE TABLE app_user (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE membership (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  user_id uuid NOT NULL REFERENCES app_user (id),
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'sales', 'coordinator', 'accounts', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, id)
);

CREATE TABLE venue (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  tagline text NOT NULL,
  indoor boolean NOT NULL,
  published_capacity_guests integer NOT NULL CHECK (published_capacity_guests > 0),
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  facilities text[] NOT NULL DEFAULT '{}',
  publication_status text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE TABLE venue_policy (
  tenant_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  min_billable_guests integer CHECK (min_billable_guests IS NULL OR min_billable_guests > 0),
  rent_waiver_food_threshold_minor bigint CHECK (rent_waiver_food_threshold_minor IS NULL OR rent_waiver_food_threshold_minor >= 0),
  minimum_spend_minor bigint CHECK (minimum_spend_minor IS NULL OR minimum_spend_minor >= 0),
  advance_basis_points integer NOT NULL DEFAULT 2500 CHECK (advance_basis_points BETWEEN 0 AND 10000),
  partial_tables_allowed boolean NOT NULL DEFAULT true,
  PRIMARY KEY (venue_id),
  FOREIGN KEY (tenant_id, venue_id) REFERENCES venue (tenant_id, id)
);

-- A measured shell is immutable once approved. A new measurement creates a new version.
CREATE TABLE shell_version (
  id text NOT NULL CHECK (id ~ '^[a-z0-9][a-z0-9-]*$'),
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  venue_id uuid NOT NULL,
  label text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, venue_id) REFERENCES venue (tenant_id, id)
);

CREATE TRIGGER shell_version_immutable
  BEFORE UPDATE OR DELETE ON shell_version
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TABLE space (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  venue_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  rent_minor bigint NOT NULL CHECK (rent_minor >= 0),
  shell_version_id text NOT NULL,
  published_capacity_guests integer NOT NULL CHECK (published_capacity_guests > 0),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, venue_id) REFERENCES venue (tenant_id, id),
  FOREIGN KEY (tenant_id, shell_version_id) REFERENCES shell_version (tenant_id, id)
);

-- Physical resources that claims reserve. A bookable space maps to one or more of these.
CREATE TABLE atomic_resource (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  venue_id uuid NOT NULL,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('hall', 'lawn', 'equipment')),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, venue_id) REFERENCES venue (tenant_id, id)
);

-- A combined product (for example Hall A plus Hall B) maps to every affected resource.
CREATE TABLE space_resource (
  tenant_id uuid NOT NULL,
  space_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  PRIMARY KEY (space_id, resource_id),
  FOREIGN KEY (tenant_id, space_id) REFERENCES space (tenant_id, id),
  FOREIGN KEY (tenant_id, resource_id) REFERENCES atomic_resource (tenant_id, id)
);

-- Approved catalogue versions. A quote references the exact version id it priced.
CREATE TABLE catalogue_item (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  venue_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('menu_package', 'stage', 'extra')),
  code text NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9-]*$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  demo boolean NOT NULL DEFAULT false,
  publication_status text NOT NULL DEFAULT 'published' CHECK (publication_status IN ('draft', 'published', 'withdrawn')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (tenant_id, venue_id, kind, code, version),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, venue_id) REFERENCES venue (tenant_id, id)
);

CREATE TABLE enquiry (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  venue_id uuid NOT NULL,
  reference text NOT NULL CHECK (reference ~ '^ENQ-[A-Z0-9]{8}$'),
  full_name text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  mobile_e164 text NOT NULL CHECK (mobile_e164 ~ '^\+923[0-9]{9}$'),
  email text CHECK (email IS NULL OR length(email) <= 254),
  event_type text NOT NULL CHECK (event_type IN ('walima', 'barat', 'nikah', 'mehndi', 'valima', 'corporate', 'other')),
  preferred_date date NOT NULL,
  guests_expected integer NOT NULL CHECK (guests_expected BETWEEN 1 AND 5000),
  message text CHECK (message IS NULL OR length(message) <= 1000),
  source text NOT NULL CHECK (source IN ('website', 'walk_in', 'phone', 'referral', 'demo')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'visit_scheduled', 'qualified', 'lost')),
  consent_to_contact boolean NOT NULL CHECK (consent_to_contact),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, venue_id) REFERENCES venue (tenant_id, id)
);

CREATE INDEX enquiry_tenant_status_created_idx ON enquiry (tenant_id, status, created_at DESC);

-- A hold is a temporary, expiring occupation of one space for one interval.
CREATE TABLE hold (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  space_id uuid NOT NULL,
  enquiry_id uuid,
  status text NOT NULL CHECK (status IN ('held', 'confirmed', 'released', 'expired')),
  occupied_at tstzrange NOT NULL,
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES app_user (id),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    NOT isempty(occupied_at)
    AND NOT lower_inf(occupied_at)
    AND NOT upper_inf(occupied_at)
    AND lower_inc(occupied_at)
    AND NOT upper_inc(occupied_at)
  ),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, space_id) REFERENCES space (tenant_id, id),
  FOREIGN KEY (tenant_id, enquiry_id) REFERENCES enquiry (tenant_id, id)
);

-- One row per physical resource a hold occupies. The exclusion constraint makes
-- double-booking impossible even if an application path forgets its lock.
-- Expiry is applied by explicit UPDATE under the same resource locks, never by a
-- time-dependent predicate, because now() is not immutable.
CREATE TABLE resource_claim (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  hold_id uuid NOT NULL,
  occupied_at tstzrange NOT NULL,
  claim_state text NOT NULL CHECK (claim_state IN ('held', 'confirmed', 'released', 'expired')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    NOT isempty(occupied_at)
    AND NOT lower_inf(occupied_at)
    AND NOT upper_inf(occupied_at)
    AND lower_inc(occupied_at)
    AND NOT upper_inc(occupied_at)
  ),
  CHECK (claim_state <> 'held' OR expires_at IS NOT NULL),
  FOREIGN KEY (tenant_id, resource_id) REFERENCES atomic_resource (tenant_id, id),
  FOREIGN KEY (tenant_id, hold_id) REFERENCES hold (tenant_id, id),
  EXCLUDE USING gist (
    tenant_id WITH =,
    resource_id WITH =,
    occupied_at WITH &&
  ) WHERE (claim_state IN ('held', 'confirmed'))
);

CREATE INDEX resource_claim_hold_idx ON resource_claim (tenant_id, hold_id);
CREATE INDEX resource_claim_resource_state_idx ON resource_claim (tenant_id, resource_id, claim_state);

-- Append-only record of every committed mutation with its correlation identifier.
CREATE TABLE audit_event (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  actor_user_id uuid REFERENCES app_user (id),
  actor_kind text NOT NULL CHECK (actor_kind IN ('staff', 'public', 'system')),
  action text NOT NULL CHECK (action ~ '^[a-z]+(\.[a-z_]+)+$'),
  entity_type text NOT NULL,
  entity_id uuid,
  correlation_id uuid NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER audit_event_append_only
  BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE INDEX audit_event_tenant_time_idx ON audit_event (tenant_id, occurred_at DESC);

-- Transactional outbox. Written in the same transaction as the state change it describes.
CREATE TABLE outbox_message (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  topic text NOT NULL,
  dedup_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outbox_pending_idx ON outbox_message (available_at) WHERE status = 'pending';

-- Replay protection for retried commands. Scoped by tenant, principal and command.
CREATE TABLE idempotency_record (
  tenant_id uuid NOT NULL REFERENCES tenant (id),
  principal_key text NOT NULL CHECK (length(principal_key) BETWEEN 1 AND 80),
  command text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, principal_key, command, idempotency_key)
);
