import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/devices/device.repository.ts", () => ({
  deviceRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createHistory: vi.fn(),
  },
}));

vi.mock("../../src/sse/device-broadcaster.ts", () => ({
  deviceBroadcaster: { broadcast: vi.fn() },
}));

import { deviceRepository } from "../../src/devices/device.repository.ts";
import { deviceBroadcaster } from "../../src/sse/device-broadcaster.ts";
import { deviceService } from "../../src/devices/device.service.ts";
import { NotFoundError } from "../../src/errors.ts";

const repo = vi.mocked(deviceRepository);
const broadcaster = vi.mocked(deviceBroadcaster);

const DEVICE_ROW = {
  id: "device-1",
  name: "Test Light",
  actual: {
    status: "enabled" as const,
    configuration: { brightness: 100 } as Record<string, unknown>,
  },
  desired: null as null,
  version: 2,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  deletedAt: null as null,
};

const DEVICE = {
  id: "device-1",
  name: "Test Light",
  status: "enabled" as const,
  configuration: { brightness: 100 } as Record<string, unknown>,
  version: 2,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());

describe("deviceService.list", () => {
  it("returns all non-deleted devices", async () => {
    repo.findAll.mockReturnValue([DEVICE_ROW]);
    const result = await deviceService.list();
    expect(result).toEqual([DEVICE]);
    expect(repo.findAll).toHaveBeenCalled();
  });
});

describe("deviceService.get", () => {
  it("returns device when found", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    await expect(deviceService.get("device-1")).resolves.toEqual(DEVICE);
  });

  it("throws NotFoundError when device does not exist", async () => {
    repo.findById.mockReturnValue(undefined);
    await expect(deviceService.get("device-1")).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when device is soft-deleted", async () => {
    repo.findById.mockReturnValue({
      ...DEVICE_ROW,
      deletedAt: "2024-01-02T00:00:00.000Z",
    });
    await expect(deviceService.get("device-1")).rejects.toThrow(NotFoundError);
  });
});

describe("deviceService.create", () => {
  it("uses defaultConfiguration when none provided", async () => {
    repo.create.mockReturnValue(DEVICE_ROW);
    await deviceService.create({ name: "Light", status: "enabled" });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actual: expect.objectContaining({
          configuration: { brightness: 100, mode: "auto" },
        }),
      }),
    );
  });

  it("uses provided configuration when given", async () => {
    repo.create.mockReturnValue(DEVICE_ROW);
    await deviceService.create({
      name: "Light",
      status: "enabled",
      configuration: { brightness: 50 },
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actual: expect.objectContaining({ configuration: { brightness: 50 } }),
      }),
    );
  });
});

describe("deviceService.update", () => {
  it("throws NotFoundError when device is soft-deleted", async () => {
    repo.findById.mockReturnValue({
      ...DEVICE_ROW,
      deletedAt: "2024-01-02T00:00:00.000Z",
    });
    await expect(
      deviceService.update("device-1", { status: "off" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("writes desired to repo without touching actual", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    const updatedRow = {
      ...DEVICE_ROW,
      version: 3,
      desired: { status: "off" as const },
    };
    repo.update.mockReturnValue(updatedRow);
    await deviceService.update("device-1", { status: "off" });
    expect(repo.update).toHaveBeenCalledWith(
      "device-1",
      expect.objectContaining({ desired: { status: "off" }, version: 3 }),
    );
    expect(repo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actual: expect.anything() }),
    );
  });

  it("writes DeviceHistory snapshot on success", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    const updatedRow = {
      ...DEVICE_ROW,
      version: 3,
      desired: { status: "off" as const },
    };
    repo.update.mockReturnValue(updatedRow);
    await deviceService.update("device-1", { status: "off" });
    expect(repo.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "device-1",
        version: 3,
        snapshot: expect.objectContaining({ id: "device-1", version: 3 }),
      }),
    );
  });

  it("does not broadcast immediately — scheduleSync broadcasts after sync", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    const updatedRow = {
      ...DEVICE_ROW,
      version: 3,
      desired: { status: "off" as const },
    };
    repo.update.mockReturnValue(updatedRow);
    await deviceService.update("device-1", { status: "off" });
    expect(broadcaster.broadcast).not.toHaveBeenCalled();
  });
});

describe("deviceService.delete", () => {
  it("soft-deletes by setting deletedAt", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    repo.delete.mockReturnValue({
      ...DEVICE_ROW,
      deletedAt: "2024-01-02T00:00:00.000Z",
    });
    await deviceService.delete("device-1");
    expect(repo.delete).toHaveBeenCalledWith("device-1", expect.any(String));
  });

  it("throws NotFoundError when device not found", async () => {
    repo.findById.mockReturnValue(undefined);
    await expect(deviceService.delete("device-1")).rejects.toThrow(
      NotFoundError,
    );
  });
});
