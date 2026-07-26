import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import { deviceHistory, devices } from "../db/schema.ts";

export type DeviceRow = typeof devices.$inferSelect;
export type DeviceInsert = typeof devices.$inferInsert;

export const deviceRepository = {
  findAll(): DeviceRow[] {
    return db.select().from(devices).where(isNull(devices.deletedAt)).all();
  },

  findById(deviceId: string): DeviceRow | undefined {
    return db
      .select()
      .from(devices)
      .where(and(eq(devices.id, deviceId), isNull(devices.deletedAt)))
      .get();
  },

  create(device: DeviceInsert): DeviceRow {
    return db.insert(devices).values(device).returning().get();
  },

  update(deviceId: string, data: Partial<DeviceInsert>): DeviceRow | undefined {
    return db
      .update(devices)
      .set(data)
      .where(eq(devices.id, deviceId))
      .returning()
      .get();
  },

  delete(deviceId: string, deletedAt: string): DeviceRow {
    return db
      .update(devices)
      .set({ deletedAt })
      .where(eq(devices.id, deviceId))
      .returning()
      .get();
  },

  createHistory(entry: {
    deviceId: string;
    version: number;
    snapshot: Record<string, unknown>;
    createdAt: string;
  }): void {
    db.insert(deviceHistory).values(entry).run();
  },
};
