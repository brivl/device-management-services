import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema.ts";
import { users, deviceHistory } from "../../src/db/schema.ts";
import { SEEDED_USERS } from "@dms/common/users";

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

const TEST_USER = SEEDED_USERS[0];
const headers = { "x-user-id": TEST_USER.id };
const app = buildApp();

beforeAll(async () => {
  migrate(testDb, { migrationsFolder: "./drizzle" });
  const now = new Date().toISOString();
  for (const user of SEEDED_USERS) {
    testDb
      .insert(users)
      .values({ ...user, createdAt: now })
      .run();
  }
  await app.ready();
});

afterAll(() => app.close());

describe("full device lifecycle", () => {
  it("create → update → verify version incremented and history written", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/devices",
      headers,
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
      headers,
      payload: { status: "off" },
    });
    expect(patchRes.statusCode).toBe(200);
    const updated = patchRes.json();
    expect(updated.version).toBe(1);
    // Desired/actual pattern: PATCH sets desired state, actual status is unchanged until sync
    expect(updated.desired.status).toBe("off");
    expect(updated.status).toBe("enabled");

    const history = testDb
      .select()
      .from(deviceHistory)
      .where(eq(deviceHistory.deviceId, device.id))
      .all();
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(1);
  });
});
