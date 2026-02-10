import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// --- Enums ---

export const platformEnum = pgEnum('platform', ['facebook', 'instagram']);

export const connectionStatusEnum = pgEnum('connection_status', ['active', 'expired', 'revoked']);

export const showStatusEnum = pgEnum('show_status', ['draft', 'active', 'paused', 'ended']);

export const itemStatusEnum = pgEnum('item_status', [
  'unclaimed',
  'partial',
  'claimed',
  'sold_out',
]);

export const claimTypeEnum = pgEnum('claim_type', ['claim', 'pass']);

export const claimStatusEnum = pgEnum('claim_status', [
  'winner',
  'waitlist',
  'released',
  'passed',
]);

// --- Tables ---

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const socialConnections = pgTable('social_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  platform: platformEnum('platform').notNull(),
  externalAccountId: varchar('external_account_id', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  tokenExpiresAt: timestamp('token_expires_at'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  scopes: text('scopes').array(),
  status: connectionStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const shows = pgTable(
  'shows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: varchar('name', { length: 255 }).notNull(),
    status: showStatusEnum('status').default('draft').notNull(),
    platform: platformEnum('platform'),
    connectionId: uuid('connection_id').references(() => socialConnections.id),
    liveId: varchar('live_id', { length: 255 }),
    liveUrl: text('live_url'),
    claimWord: varchar('claim_word', { length: 50 }).default('sold').notNull(),
    passWord: varchar('pass_word', { length: 50 }).default('pass').notNull(),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    workspaceStatusIdx: index('shows_workspace_status_idx').on(table.workspaceId, table.status),
  }),
);

export const showItems = pgTable(
  'show_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    showId: uuid('show_id')
      .notNull()
      .references(() => shows.id),
    itemNumber: varchar('item_number', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    totalQuantity: integer('total_quantity').default(1).notNull(),
    claimedCount: integer('claimed_count').default(0).notNull(),
    status: itemStatusEnum('status').default('unclaimed').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    showItemNumberIdx: uniqueIndex('show_items_show_item_number_idx').on(
      table.showId,
      table.itemNumber,
    ),
  }),
);

export const claims = pgTable(
  'claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    showId: uuid('show_id')
      .notNull()
      .references(() => shows.id),
    showItemId: uuid('show_item_id')
      .notNull()
      .references(() => showItems.id),
    itemNumber: varchar('item_number', { length: 50 }).notNull(),
    platform: platformEnum('platform').notNull(),
    liveId: varchar('live_id', { length: 255 }),
    platformUserId: varchar('platform_user_id', { length: 255 }).notNull(),
    userHandle: varchar('user_handle', { length: 255 }),
    userDisplayName: varchar('user_display_name', { length: 255 }),
    commentId: varchar('comment_id', { length: 255 }),
    rawText: text('raw_text'),
    normalizedText: text('normalized_text'),
    claimType: claimTypeEnum('claim_type').notNull(),
    claimStatus: claimStatusEnum('claim_status').notNull(),
    waitlistPosition: integer('waitlist_position'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
    operatorAction: boolean('operator_action').default(false),
    operatorNotes: text('operator_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    showItemStatusIdx: index('claims_show_item_status_idx').on(
      table.showId,
      table.itemNumber,
      table.claimStatus,
    ),
    showUserItemIdx: index('claims_show_user_item_idx').on(
      table.showId,
      table.platformUserId,
      table.itemNumber,
    ),
  }),
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    showId: uuid('show_id')
      .notNull()
      .references(() => shows.id),
    liveId: varchar('live_id', { length: 255 }),
    platform: platformEnum('platform').notNull(),
    platformUserId: varchar('platform_user_id', { length: 255 }).notNull(),
    userHandle: varchar('user_handle', { length: 255 }),
    commentId: varchar('comment_id', { length: 255 }),
    rawText: text('raw_text').notNull(),
    normalizedText: text('normalized_text'),
    parsed: boolean('parsed').default(false).notNull(),
    claimId: uuid('claim_id').references(() => claims.id),
    receivedAt: timestamp('received_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    showReceivedAtIdx: index('comments_show_received_at_idx').on(table.showId, table.receivedAt),
  }),
);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  showId: uuid('show_id').references(() => shows.id),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Type exports ---

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SocialConnection = typeof socialConnections.$inferSelect;
export type NewSocialConnection = typeof socialConnections.$inferInsert;
export type Show = typeof shows.$inferSelect;
export type NewShow = typeof shows.$inferInsert;
export type ShowItem = typeof showItems.$inferSelect;
export type NewShowItem = typeof showItems.$inferInsert;
export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
