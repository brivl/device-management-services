import type {
  ActualState,
  CreateDeviceInput,
  DesiredState,
  Device,
  UpdateDeviceInput,
} from "@dms/common/types";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../errors.ts";
import { deviceBroadcaster } from "../sse/device-broadcaster.ts";
import { deviceRepository, type DeviceRow } from "./device.repository.ts";

const defaultConfiguration = { brightness: 100, mode: "auto" };

export const deviceService = {
  async list(): Promise<Device[]> {
    return deviceRepository.findAll().map(toDevice);
  },

  async get(deviceId: string): Promise<Device> {
    const row = deviceRepository.findById(deviceId);
    if (!row || row.deletedAt) throw new NotFoundError("Device not found");
    return toDevice(row);
  },

  async create(data: CreateDeviceInput): Promise<Device> {
    const now = new Date().toISOString();
    const row = deviceRepository.create({
      id: uuidv4(),
      name: data.name,
      actual: {
        status: data.status,
        configuration: data.configuration ?? defaultConfiguration,
      },
      desired: null,
      version: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    return toDevice(row);
  },

  async update(deviceId: string, data: UpdateDeviceInput): Promise<Device> {
    const current = await this.get(deviceId);

    // IoT desired/actual pattern: PATCH sets what the device *should* become.
    // scheduleSync applies the desired state ~1.5s later and broadcasts via SSE,
    // mirroring how a real device acknowledges and applies a command.
    const desired: DesiredState = {};
    if (data.status !== undefined) desired.status = data.status;
    if (data.configuration !== undefined)
      desired.configuration = data.configuration;

    const now = new Date().toISOString();
    const updated = deviceRepository.update(deviceId, {
      desired,
      version: current.version + 1,
      updatedAt: now,
    });

    const device = toDevice(updated!);
    deviceRepository.createHistory({
      deviceId,
      version: device.version,
      snapshot: device as unknown as Record<string, unknown>,
      createdAt: now,
    });

    void scheduleSync(deviceId, device.version);
    return device;
  },

  async delete(deviceId: string): Promise<void> {
    await this.get(deviceId);
    deviceRepository.delete(deviceId, new Date().toISOString());
  },
};

function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    name: row.name,
    status: row.actual.status,
    configuration: row.actual.configuration,
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
  const actual: ActualState = {
    status: desired.status ?? row.actual.status,
    configuration: desired.configuration ?? row.actual.configuration,
  };
  const now = new Date().toISOString();
  const synced = deviceRepository.update(deviceId, {
    actual,
    desired: null,
    updatedAt: now,
  });
  if (!synced) return;

  deviceBroadcaster.broadcast(deviceId, toDevice(synced));
}
