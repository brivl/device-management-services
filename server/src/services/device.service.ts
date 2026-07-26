import { v4 as uuidv4 } from "uuid";
import type {
  Device,
  CreateDeviceInput,
  UpdateDeviceInput,
  DesiredState,
} from "@dms/common/types";
import { SEEDED_USERS } from "@dms/common/users";
import {
  deviceRepository,
  type DeviceRow,
} from "../repositories/device.repository.ts";
import { deviceBroadcaster } from "../sse/device-broadcaster.ts";
import { NotFoundError, ConflictError } from "../errors.ts";

const defaultConfiguration = { brightness: 100, mode: "auto" };

function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    configuration: row.configuration,
    desired: row.desired ?? null,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Simulates the device reading the desired state and applying it (~1.5s latency).
// In production a real device would acknowledge the command and report back its new state.
async function scheduleSync(
  deviceId: string,
  pendingVersion: number,
): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 1500));

  const row = deviceRepository.findById(deviceId);
  if (!row?.desired || row.version !== pendingVersion) return;

  const { desired } = row;
  const now = new Date().toISOString();
  const synced = deviceRepository.update(deviceId, pendingVersion, {
    ...(desired.status !== undefined && { status: desired.status }),
    ...(desired.configuration !== undefined && {
      configuration: desired.configuration,
    }),
    desired: null,
    version: pendingVersion + 1,
    updatedAt: now,
  });
  if (!synced) return;

  deviceBroadcaster.broadcast(deviceId, toDevice(synced));
}

export const deviceService = {
  async list(userId: string): Promise<Device[]> {
    return deviceRepository.findAllByUserId(userId).map(toDevice);
  },

  async get(deviceId: string, userId: string): Promise<Device> {
    const row = deviceRepository.findById(deviceId);
    if (!row || row.deletedAt) throw new NotFoundError("Device not found");
    if (!deviceRepository.isOwnedByUser(deviceId, userId))
      throw new NotFoundError("Device not found");
    return toDevice(row);
  },

  async create(data: CreateDeviceInput, userId: string): Promise<Device> {
    const now = new Date().toISOString();
    const row = deviceRepository.create({
      id: uuidv4(),
      name: data.name,
      status: data.status,
      configuration: data.configuration ?? defaultConfiguration,
      desired: null,
      version: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    // Simulation: associate with all seeded users so any user can see and edit
    // any device — makes SSE demo testable via the UserSwitcher without extra setup.
    // In production this would only associate the creator (userId).
    for (const user of SEEDED_USERS) {
      deviceRepository.createUserDevice(user.id, row.id);
    }
    return toDevice(row);
  },

  async update(
    deviceId: string,
    userId: string,
    data: UpdateDeviceInput,
  ): Promise<Device> {
    await this.get(deviceId, userId);

    // IoT desired/actual pattern: PATCH sets what the device *should* become.
    // scheduleSync applies the desired state ~1.5s later and broadcasts via SSE,
    // mirroring how a real device acknowledges and applies a command.
    const desired: DesiredState = {};
    if (data.status !== undefined) desired.status = data.status;
    if (data.configuration !== undefined)
      desired.configuration = data.configuration;

    const now = new Date().toISOString();
    const updated = deviceRepository.update(deviceId, data.version, {
      desired,
      version: data.version + 1,
      updatedAt: now,
    });
    if (!updated) throw new ConflictError("Version mismatch");

    const device = toDevice(updated);
    deviceRepository.createHistory({
      deviceId,
      version: device.version,
      snapshot: device as unknown as Record<string, unknown>,
      createdAt: now,
    });

    deviceBroadcaster.broadcast(deviceId, device);
    void scheduleSync(deviceId, device.version);
    return device;
  },

  async delete(deviceId: string, userId: string): Promise<void> {
    await this.get(deviceId, userId);
    deviceRepository.delete(deviceId, new Date().toISOString());
  },
};
