import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { DesiredState } from "@dms/common/types";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["enabled", "sleep", "off"] }).notNull(),
  configuration: text("configuration", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  desired: text("desired", { mode: "json" }).$type<DesiredState | null>(),
  version: integer("version").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const deviceHistory = sqliteTable("device_history", {
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id),
  version: integer("version").notNull(),
  snapshot: text("snapshot", { mode: "json" })
    .notNull()
    .$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull(),
});

export const userDevices = sqliteTable("user_devices", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id),
});
