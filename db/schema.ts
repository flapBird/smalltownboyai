import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  role: text("role").notNull().default("user"),
});
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user").on(t.userId)],
);
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("account_user").on(t.userId),
    uniqueIndex("account_provider").on(t.providerId, t.accountId),
  ],
);
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
export const wallets = sqliteTable("user_wallets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  balance: integer("balance").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  tier: integer("tier").notNull().default(0),
});
export const transactions = sqliteTable(
  "credit_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    businessKey: text("business_key").notNull().unique(),
    kind: text("kind").notNull(),
    delta: integer("delta").notNull(),
    reservedDelta: integer("reserved_delta").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("ledger_user_date").on(t.userId, t.createdAt)],
);
export const packages = sqliteTable("credit_packages", {
  id: text("id").primaryKey(),
  cents: integer("cents").notNull(),
  credits: integer("credits").notNull(),
  tier: integer("tier").notNull(),
});
export const orders = sqliteTable(
  "payment_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    packageId: text("package_id").notNull(),
    productId: text("product_id").notNull(),
    cents: integer("cents").notNull(),
    credits: integer("credits").notNull(),
    tier: integer("tier").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().default("pending"),
    providerId: text("provider_id").unique(),
    checkoutUrl: text("checkout_url"),
    mode: text("mode").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("orders_user_date").on(t.userId, t.createdAt)],
);
export const events = sqliteTable("payment_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  type: text("type").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const tasks = sqliteTable(
  "video_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    requestKey: text("request_key").notNull(),
    status: text("status").notNull(),
    resolution: text("resolution").notNull(),
    credits: integer("credits").notNull(),
    assetA: text("asset_a").notNull(),
    assetB: text("asset_b").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    providerTaskId: text("provider_task_id").unique(),
    inputDuration: real("input_duration").notNull(),
    outputDuration: real("output_duration"),
    estimatedCost: integer("estimated_cost").notNull(),
    actualCost: integer("actual_cost"),
    outputKey: text("output_key"),
    deletedAt: integer("deleted_at"),
    errorCode: text("error_code"),
    leaseUntil: integer("lease_until").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("task_request").on(t.userId, t.requestKey),
    index("tasks_user_date").on(t.userId, t.createdAt),
    index("task_status").on(t.status, t.updatedAt),
  ],
);
export const assets = sqliteTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    objectKey: text("object_key").notNull().unique(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    moderation: text("moderation").notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("assets_user").on(t.userId)],
);
export const audit = sqliteTable("admin_audit_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const limits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  window: integer("window").notNull(),
});
export const mockSessions = sqliteTable("mock_sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
