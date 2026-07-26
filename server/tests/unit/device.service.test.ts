import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/repositories/device.repository.ts", () => ({
  deviceRepository: {
    findAllByUserId: vi.fn(),
    findById: vi.fn(),
    isOwnedByUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createUserDevice: vi.fn(),
    createHistory: vi.fn(),
  },
}));

vi.mock("../../src/sse/device-broadcaster.ts", () => ({
  deviceBroadcaster: { broadcast: vi.fn() },
}));

import { deviceRepository } from "../../src/repositories/device.repository.ts";
import { deviceBroadcaster } from "../../src/sse/device-broadcaster.ts";
import { deviceService } from "../../src/services/device.service.ts";
import { NotFoundError, ConflictError } from "../../src/errors.ts";

const repo = vi.mocked(deviceRepository);
const broadcaster = vi.mocked(deviceBroadcaster);

// Repository row shape: uses actual/desired JSON columns
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

// Service output shape: actual is flattened, deletedAt stripped
const DEVICE = {
  id: "device-1",
  name: "Test Light",
  status: "enabled" as const,
  configuration: { brightness: 100 } as Record<string, unknown>,
  desired: null as null,
  version: 2,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());

describe("deviceService.list", () => {
  it("returns mapped devices for user", async () => {
    repo.findAllByUserId.mockReturnValue([DEVICE_ROW]);
    const result = await deviceService.list("user-1");
    expect(result).toEqual([DEVICE]);
    expect(repo.findAllByUserId).toHaveBeenCalledWith("user-1");
  });
});

describe("deviceService.get", () => {
  it("returns device when found and owned", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    repo.isOwnedByUser.mockReturnValue(true);
    await expect(deviceService.get("device-1", "user-1")).resolves.toEqual(
      DEVICE,
    );
  });

  it("throws NotFoundError when device does not exist", async () => {
    repo.findById.mockReturnValue(undefined);
    await expect(deviceService.get("device-1", "user-1")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("throws NotFoundError when device is soft-deleted", async () => {
    repo.findById.mockReturnValue({
      ...DEVICE_ROW,
      deletedAt: "2024-01-02T00:00:00.000Z",
    });
    await expect(deviceService.get("device-1", "user-1")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("throws NotFoundError when device not owned by user", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    repo.isOwnedByUser.mockReturnValue(false);
    await expect(deviceService.get("device-1", "user-1")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("deviceService.create", () => {
  it("uses defaultConfiguration when none provided", async () => {
    repo.create.mockReturnValue(DEVICE_ROW);
    await deviceService.create({ name: "Light", status: "enabled" }, "user-1");
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
    await deviceService.create(
      { name: "Light", status: "enabled", configuration: { brightness: 50 } },
      "user-1",
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actual: expect.objectContaining({ configuration: { brightness: 50 } }),
      }),
    );
  });

  it("creates User_Device link for all seeded users", async () => {
    repo.create.mockReturnValue(DEVICE_ROW);
    await deviceService.create({ name: "Light", status: "enabled" }, "user-1");
    // Simulation mode: device is shared with all seeded users so any user can demo SSE
    const { SEEDED_USERS } = await import("@dms/common/users");
    expect(repo.createUserDevice).toHaveBeenCalledTimes(SEEDED_USERS.length);
    for (const user of SEEDED_USERS) {
      expect(repo.createUserDevice).toHaveBeenCalledWith(
        user.id,
        DEVICE_ROW.id,
      );
    }
  });
});

describe("deviceService.update", () => {
  it("throws ConflictError on version mismatch", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    repo.isOwnedByUser.mockReturnValue(true);
    repo.update.mockReturnValue(undefined); // simulates DB version mismatch
    await expect(
      deviceService.update("device-1", "user-1", { status: "off" }),
    ).rejects.toThrow(ConflictError);
  });

  it("sets desired state — does not update actual directly", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    repo.isOwnedByUser.mockReturnValue(true);
    const updatedRow = {
      ...DEVICE_ROW,
      version: 3,
      desired: { status: "off" as const },
    };
    repo.update.mockReturnValue(updatedRow);
    await deviceService.update("device-1", "user-1", { status: "off" });
    expect(repo.update).toHaveBeenCalledWith(
      "device-1",
      2, // current.version from DEVICE_ROW
      expect.objectContaining({ desired: { status: "off" }, version: 3 }),
    );
    // actual is NOT written — only desired
    expect(repo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ actual: expect.anything() }),
    );
  });

  it("writes DeviceHistory snapshot on success", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    repo.isOwnedByUser.mockReturnValue(true);
    const updatedRow = {
      ...DEVICE_ROW,
      version: 3,
      desired: { status: "off" as const },
    };
    repo.update.mockReturnValue(updatedRow);
    await deviceService.update("device-1", "user-1", { status: "off" });
    expect(repo.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "device-1",
        version: 3,
        snapshot: expect.objectContaining({ id: "device-1", version: 3 }),
      }),
    );
  });

  it("broadcasts SSE event on success", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    repo.isOwnedByUser.mockReturnValue(true);
    const updatedRow = {
      ...DEVICE_ROW,
      version: 3,
      desired: { status: "off" as const },
    };
    repo.update.mockReturnValue(updatedRow);
    await deviceService.update("device-1", "user-1", { status: "off" });
    expect(broadcaster.broadcast).toHaveBeenCalledWith(
      "device-1",
      expect.objectContaining({ version: 3, desired: { status: "off" } }),
    );
  });
});

describe("deviceService.delete", () => {
  it("soft-deletes by setting deletedAt", async () => {
    repo.findById.mockReturnValue(DEVICE_ROW);
    repo.isOwnedByUser.mockReturnValue(true);
    repo.delete.mockReturnValue({
      ...DEVICE_ROW,
      deletedAt: "2024-01-02T00:00:00.000Z",
    });
    await deviceService.delete("device-1", "user-1");
    expect(repo.delete).toHaveBeenCalledWith("device-1", expect.any(String));
  });

  it("throws NotFoundError when device not found", async () => {
    repo.findById.mockReturnValue(undefined);
    await expect(deviceService.delete("device-1", "user-1")).rejects.toThrow(
      NotFoundError,
    );
  });
});
