import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import { devices, deviceHistory } from "../db/schema.ts";

export type DeviceRow = typeof devices.$inferSelect;
export type DeviceInsert = typeof devices.$inferInsert;

export const deviceRepository = {
  findAll(): DeviceRow[] {
    return db.select().from(devices).where(isNull(devices.deletedAt)).all();
  },

  findById(deviceId: string): DeviceRow | undefined {
    return db.select().from(devices).where(eq(devices.id, deviceId)).get();
  },

  create(device: DeviceInsert): DeviceRow {
    return db.insert(devices).values(device).returning().get();
  },

  update(
    deviceId: string,
    expectedVersion: number,
    data: Partial<DeviceInsert>,
  ): DeviceRow | undefined {
    return db
      .update(devices)
      .set(data)
      .where(
        and(eq(devices.id, deviceId), eq(devices.version, expectedVersion)),
      )
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
