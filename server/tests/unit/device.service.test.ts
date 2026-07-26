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

const DEVICE = {
  id: "device-1",
  name: "Test Light",
  status: "enabled" as const,
  configuration: { brightness: 100 },
  version: 2,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  deletedAt: null,
};

beforeEach(() => vi.clearAllMocks());

describe("deviceService.list", () => {
  it("returns devices for user", async () => {
    repo.findAllByUserId.mockReturnValue([DEVICE]);
    const result = await deviceService.list("user-1");
    expect(result).toEqual([DEVICE]);
    expect(repo.findAllByUserId).toHaveBeenCalledWith("user-1");
  });
});

describe("deviceService.get", () => {
  it("returns device when found and owned", async () => {
    repo.findById.mockReturnValue(DEVICE);
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
      ...DEVICE,
      deletedAt: "2024-01-02T00:00:00.000Z",
    });
    await expect(deviceService.get("device-1", "user-1")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("throws NotFoundError when device not owned by user", async () => {
    repo.findById.mockReturnValue(DEVICE);
    repo.isOwnedByUser.mockReturnValue(false);
    await expect(deviceService.get("device-1", "user-1")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("deviceService.create", () => {
  it("uses defaultConfiguration when none provided", async () => {
    repo.create.mockReturnValue(DEVICE);
    await deviceService.create({ name: "Light", status: "enabled" }, "user-1");
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: { brightness: 100, mode: "auto" },
      }),
    );
  });

  it("uses provided configuration when given", async () => {
    repo.create.mockReturnValue(DEVICE);
    await deviceService.create(
      { name: "Light", status: "enabled", configuration: { brightness: 50 } },
      "user-1",
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ configuration: { brightness: 50 } }),
    );
  });

  it("creates User_Device link for all seeded users", async () => {
    repo.create.mockReturnValue(DEVICE);
    await deviceService.create({ name: "Light", status: "enabled" }, "user-1");
    // Simulation mode: device is shared with all seeded users so any user can demo SSE
    const { SEEDED_USERS } = await import("@dms/common/users");
    expect(repo.createUserDevice).toHaveBeenCalledTimes(SEEDED_USERS.length);
    for (const user of SEEDED_USERS) {
      expect(repo.createUserDevice).toHaveBeenCalledWith(user.id, DEVICE.id);
    }
  });
});

describe("deviceService.update", () => {
  it("throws ConflictError on version mismatch", async () => {
    repo.findById.mockReturnValue(DEVICE);
    repo.isOwnedByUser.mockReturnValue(true);
    repo.update.mockReturnValue(undefined); // simulates DB version mismatch
    await expect(
      deviceService.update("device-1", "user-1", { version: 1, status: "off" }),
    ).rejects.toThrow(ConflictError);
  });

  it("increments version on successful update", async () => {
    repo.findById.mockReturnValue(DEVICE);
    repo.isOwnedByUser.mockReturnValue(true);
    const updated = { ...DEVICE, version: 3, status: "off" as const };
    repo.update.mockReturnValue(updated);
    await deviceService.update("device-1", "user-1", {
      version: 2,
      status: "off",
    });
    expect(repo.update).toHaveBeenCalledWith(
      "device-1",
      2,
      expect.objectContaining({ version: 3 }),
    );
  });

  it("writes DeviceHistory snapshot on success", async () => {
    repo.findById.mockReturnValue(DEVICE);
    repo.isOwnedByUser.mockReturnValue(true);
    const updated = { ...DEVICE, version: 3 };
    repo.update.mockReturnValue(updated);
    await deviceService.update("device-1", "user-1", {
      version: 2,
      status: "off",
    });
    expect(repo.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "device-1",
        version: 3,
        snapshot: updated,
      }),
    );
  });

  it("broadcasts SSE event on success", async () => {
    repo.findById.mockReturnValue(DEVICE);
    repo.isOwnedByUser.mockReturnValue(true);
    const updated = { ...DEVICE, version: 3 };
    repo.update.mockReturnValue(updated);
    await deviceService.update("device-1", "user-1", {
      version: 2,
      status: "off",
    });
    expect(broadcaster.broadcast).toHaveBeenCalledWith("device-1", updated);
  });
});

describe("deviceService.delete", () => {
  it("soft-deletes by setting deletedAt", async () => {
    repo.findById.mockReturnValue(DEVICE);
    repo.isOwnedByUser.mockReturnValue(true);
    repo.delete.mockReturnValue({
      ...DEVICE,
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
