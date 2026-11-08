import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  primaryKey,
} from 'drizzle-orm/pg-core';

/**
 * Drizzle mirror of the reviewed SQL in migrations/. The SQL is authoritative:
 * constraints, the btree_gist exclusion and immutability triggers live there.
 * Columns here exist for typed queries; keep them in step with each migration.
 */

export const tenants = pgTable('tenant', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appUsers = pgTable('app_user', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
});

export const memberships = pgTable('membership', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: text('role', {
    enum: ['owner', 'manager', 'sales', 'coordinator', 'accounts', 'viewer'],
  }).notNull(),
  status: text('status', { enum: ['active', 'suspended'] }).notNull(),
});

export const venues = pgTable('venue', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  indoor: boolean('indoor').notNull(),
  publishedCapacityGuests: integer('published_capacity_guests').notNull(),
  timezone: text('timezone').notNull(),
  facilities: text('facilities').array().notNull(),
  publicationStatus: text('publication_status', { enum: ['draft', 'published'] }).notNull(),
});

export const venuePolicies = pgTable('venue_policy', {
  tenantId: uuid('tenant_id').notNull(),
  venueId: uuid('venue_id').primaryKey(),
  minBillableGuests: integer('min_billable_guests'),
  rentWaiverFoodThresholdMinor: bigint('rent_waiver_food_threshold_minor', { mode: 'bigint' }),
  minimumSpendMinor: bigint('minimum_spend_minor', { mode: 'bigint' }),
  advanceBasisPoints: integer('advance_basis_points').notNull(),
  partialTablesAllowed: boolean('partial_tables_allowed').notNull(),
});

export const shellVersions = pgTable(
  'shell_version',
  {
    id: text('id').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    venueId: uuid('venue_id').notNull(),
    label: text('label').notNull(),
    payload: jsonb('payload').notNull(),
    contentHash: text('content_hash').notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);

export const spaces = pgTable('space', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  venueId: uuid('venue_id').notNull(),
  name: text('name').notNull(),
  rentMinor: bigint('rent_minor', { mode: 'bigint' }).notNull(),
  shellVersionId: text('shell_version_id').notNull(),
  publishedCapacityGuests: integer('published_capacity_guests').notNull(),
});

export const atomicResources = pgTable('atomic_resource', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  venueId: uuid('venue_id').notNull(),
  label: text('label').notNull(),
  kind: text('kind', { enum: ['hall', 'lawn', 'equipment'] }).notNull(),
});

export const spaceResources = pgTable(
  'space_resource',
  {
    tenantId: uuid('tenant_id').notNull(),
    spaceId: uuid('space_id').notNull(),
    resourceId: uuid('resource_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.spaceId, table.resourceId] })],
);

export const catalogueItems = pgTable('catalogue_item', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  venueId: uuid('venue_id').notNull(),
  kind: text('kind', { enum: ['menu_package', 'stage', 'extra'] }).notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  unitPriceMinor: bigint('unit_price_minor', { mode: 'bigint' }).notNull(),
  payload: jsonb('payload').notNull(),
  demo: boolean('demo').notNull(),
  publicationStatus: text('publication_status', {
    enum: ['draft', 'published', 'withdrawn'],
  }).notNull(),
  version: integer('version').notNull(),
});

export const enquiries = pgTable('enquiry', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  venueId: uuid('venue_id').notNull(),
  reference: text('reference').notNull(),
  fullName: text('full_name').notNull(),
  mobileE164: text('mobile_e164').notNull(),
  email: text('email'),
  eventType: text('event_type', {
    enum: ['walima', 'barat', 'nikah', 'mehndi', 'valima', 'corporate', 'other'],
  }).notNull(),
  preferredDate: date('preferred_date', { mode: 'string' }).notNull(),
  guestsExpected: integer('guests_expected').notNull(),
  message: text('message'),
  source: text('source', { enum: ['website', 'walk_in', 'phone', 'referral', 'demo'] }).notNull(),
  status: text('status', {
    enum: ['new', 'contacted', 'visit_scheduled', 'qualified', 'lost'],
  }).notNull(),
  consentToContact: boolean('consent_to_contact').notNull(),
  revision: integer('revision').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const holds = pgTable('hold', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  spaceId: uuid('space_id').notNull(),
  enquiryId: uuid('enquiry_id'),
  status: text('status', { enum: ['held', 'confirmed', 'released', 'expired'] }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdBy: uuid('created_by').notNull(),
  revision: integer('revision').notNull(),
});

export const auditEvents = pgTable('audit_event', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  actorUserId: uuid('actor_user_id'),
  actorKind: text('actor_kind', { enum: ['staff', 'public', 'system'] }).notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  correlationId: uuid('correlation_id').notNull(),
  summary: jsonb('summary').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});

export const outboxMessages = pgTable('outbox_message', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  topic: text('topic').notNull(),
  dedupKey: text('dedup_key').notNull().unique(),
  payload: jsonb('payload').notNull(),
  status: text('status', { enum: ['pending', 'delivered', 'dead'] }).notNull(),
  attempts: integer('attempts').notNull(),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull(),
  lastError: text('last_error'),
});

export const idempotencyRecords = pgTable(
  'idempotency_record',
  {
    tenantId: uuid('tenant_id').notNull(),
    principalKey: text('principal_key').notNull(),
    command: text('command').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: jsonb('response_body').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.principalKey, table.command, table.idempotencyKey],
    }),
  ],
);
