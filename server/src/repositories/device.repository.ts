import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db/index.ts";
import { devices, deviceHistory, userDevices } from "../db/schema.ts";

export type DeviceRow = typeof devices.$inferSelect;
export type DeviceInsert = typeof devices.$inferInsert;

export const deviceRepository = {
  findAllByUserId(userId: string): DeviceRow[] {
    return db
      .select({ device: devices })
      .from(devices)
      .innerJoin(userDevices, eq(userDevices.deviceId, devices.id))
      .where(and(eq(userDevices.userId, userId), isNull(devices.deletedAt)))
      .all()
      .map((r) => r.device);
  },

  findById(deviceId: string): DeviceRow | undefined {
    return db.select().from(devices).where(eq(devices.id, deviceId)).get();
  },

  isOwnedByUser(deviceId: string, userId: string): boolean {
    return !!db
      .select()
      .from(userDevices)
      .where(
        and(eq(userDevices.deviceId, deviceId), eq(userDevices.userId, userId)),
      )
      .get();
  },

  create(device: DeviceInsert): DeviceRow {
    return db.insert(devices).values(device).returning().get();
  },

  update(deviceId: string, data: Partial<DeviceInsert>): DeviceRow {
    return db
      .update(devices)
      .set(data)
      .where(eq(devices.id, deviceId))
      .returning()
      .get();
  },

  // Atomically updates only if current version matches — returns undefined on mismatch.
  updateWithVersion(
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

  createUserDevice(userId: string, deviceId: string): void {
    db.insert(userDevices).values({ userId, deviceId }).run();
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
