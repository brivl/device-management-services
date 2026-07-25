import { v4 as uuidv4 } from "uuid";
import { deviceRepository } from "../repositories/device.repository.ts";
import { deviceBroadcaster } from "../sse/device-broadcaster.ts";
import { NotFoundError, ConflictError } from "../errors.ts";

const defaultConfiguration = { brightness: 100, mode: "auto" };

export const deviceService = {
  async list(userId: string) {
    return deviceRepository.findAllByUserId(userId);
  },

  async get(deviceId: string, userId: string) {
    const device = deviceRepository.findById(deviceId);
    if (!device || device.deletedAt)
      throw new NotFoundError("Device not found");
    if (!deviceRepository.isOwnedByUser(deviceId, userId))
      throw new NotFoundError("Device not found");
    return device;
  },

  async create(
    data: {
      name: string;
      status: "enabled" | "sleep" | "off";
      configuration?: Record<string, unknown>;
    },
    userId: string,
  ) {
    const now = new Date().toISOString();
    const device = deviceRepository.create({
      id: uuidv4(),
      name: data.name,
      status: data.status,
      configuration: data.configuration ?? defaultConfiguration,
      version: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    deviceRepository.createUserDevice(userId, device.id);
    return device;
  },

  async update(
    deviceId: string,
    userId: string,
    data: {
      status?: string;
      configuration?: Record<string, unknown>;
      version: number;
    },
  ) {
    await this.get(deviceId, userId);

    const now = new Date().toISOString();
    const updated = deviceRepository.updateWithVersion(deviceId, data.version, {
      ...(data.status !== undefined && {
        status: data.status as "enabled" | "sleep" | "off",
      }),
      ...(data.configuration !== undefined && {
        configuration: data.configuration,
      }),
      version: data.version + 1,
      updatedAt: now,
    });
    if (!updated) throw new ConflictError("Version mismatch");

    deviceRepository.createHistory({
      deviceId,
      version: updated.version,
      snapshot: updated as unknown as Record<string, unknown>,
      createdAt: now,
    });

    deviceBroadcaster.broadcast(deviceId, updated);
    return updated;
  },

  async delete(deviceId: string, userId: string) {
    await this.get(deviceId, userId);
    return deviceRepository.update(deviceId, {
      deletedAt: new Date().toISOString(),
    });
  },
};
