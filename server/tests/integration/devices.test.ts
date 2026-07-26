import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../../src/db/schema.ts";

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

describe("POST /devices", () => {
  it("creates device and returns it with version 0", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/devices",
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
      payload: { status: "enabled" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /devices/:deviceId", () => {
  it("sets desired state and increments version", async () => {
    const { id, version } = (
      await app.inject({
        method: "POST",
        url: "/devices",
        payload: { name: "Version Light", status: "enabled" },
      })
    ).json();

    const res = await app.inject({
      method: "PATCH",
      url: `/devices/${id}`,
      payload: { status: "off" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(version + 1);
    expect(body.desired.status).toBe("off");
    expect(body.status).toBe("enabled");
  });
});

describe("DELETE /devices/:deviceId", () => {
  it("soft-deletes and excludes from GET /devices", async () => {
    const { id } = (
      await app.inject({
        method: "POST",
        url: "/devices",
        payload: { name: "Delete Me", status: "enabled" },
      })
    ).json();

    expect(
      (await app.inject({ method: "DELETE", url: `/devices/${id}` }))
        .statusCode,
    ).toBe(204);

    const list = (await app.inject({ method: "GET", url: "/devices" })).json();
    expect(list.find((d: { id: string }) => d.id === id)).toBeUndefined();
  });
});
