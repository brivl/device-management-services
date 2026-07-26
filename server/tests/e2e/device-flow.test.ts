import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.ts";
import { deviceHistory } from "../../src/db/schema.ts";

// eslint-disable-next-line prefer-const
let testDb: ReturnType<typeof drizzle>;

vi.mock("../../src/db/index.ts", () => ({
  get db() {
    return testDb;
  },
}));

const sqlite = new Database(":memory:");
sqlite.pragma("foreign_keys = ON");
testDb = drizzle(sqlite, { schema });

import { buildApp } from "../../src/app.ts";

const app = buildApp();

beforeAll(async () => {
  migrate(testDb, { migrationsFolder: "./drizzle" });
  await app.ready();
});

afterAll(() => app.close());

describe("full device lifecycle", () => {
  it("create → update → verify version incremented and history written", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/devices",
      payload: {
        name: "Living Room Light",
        status: "enabled",
        configuration: { brightness: 80 },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const device = createRes.json();
    expect(device.version).toBe(0);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/devices/${device.id}`,
      payload: { status: "off" },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = patchRes.json();
    expect(updated.version).toBe(1);
    expect(updated.status).toBe("enabled"); // actual unchanged until device acknowledges

    const history = testDb
      .select()
      .from(deviceHistory)
      .where(eq(deviceHistory.deviceId, device.id))
      .all();
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(1);
  });
});
