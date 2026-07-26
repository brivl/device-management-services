import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../../src/db/schema.ts";
import { users } from "../../src/db/schema.ts";
import { SEEDED_USERS } from "@dms/common/users";

// Must be let so the getter closes over it after assignment
// eslint-disable-next-line prefer-const
let testDb: ReturnType<typeof drizzle>;

// Factory is hoisted — use getter so testDb is read at access time, not hoist time
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

describe("POST /devices", () => {
  it("creates device and returns it with version 0", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/devices",
      headers,
      payload: {
        name: "Test Light",
        status: "enabled",
        configuration: { brightness: 80 },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.version).toBe(0);
    expect(body.name).toBe("Test Light");
  });

  it("returns 400 for missing name", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/devices",
      headers,
      payload: { status: "enabled" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 when X-User-Id is an unknown user", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { "x-user-id": "unknown-user-id" },
      payload: { name: "Light", status: "enabled" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("PATCH /devices/:deviceId", () => {
  it("sets desired state and increments version", async () => {
    const { id, version } = (
      await app.inject({
        method: "POST",
        url: "/devices",
        headers,
        payload: { name: "Version Light", status: "enabled" },
      })
    ).json();

    const res = await app.inject({
      method: "PATCH",
      url: `/devices/${id}`,
      headers,
      payload: { status: "off" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(version + 1);
    expect(body.desired.status).toBe("off");
    expect(body.status).toBe("enabled"); // actual unchanged until device syncs
  });
});

describe("DELETE /devices/:deviceId", () => {
  it("soft-deletes and excludes from GET /devices", async () => {
    const { id } = (
      await app.inject({
        method: "POST",
        url: "/devices",
        headers,
        payload: { name: "Delete Me", status: "enabled" },
      })
    ).json();

    expect(
      (await app.inject({ method: "DELETE", url: `/devices/${id}`, headers }))
        .statusCode,
    ).toBe(204);

    const list = (
      await app.inject({ method: "GET", url: "/devices", headers })
    ).json();
    expect(list.find((d: { id: string }) => d.id === id)).toBeUndefined();
  });
});
