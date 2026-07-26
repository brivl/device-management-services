# Device Management API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack IoT device management system with a Fastify REST API, SQLite persistence, SSE real-time updates, and a React + MUI frontend.

**Architecture:** Fastify backend with Drizzle ORM + SQLite. Auth is simulated via `X-User-Id` header validated against seeded users. Devices are scoped per user via a `User_Device` join table. Optimistic locking on PATCH (client sends current version, server returns 409 on mismatch). SSE uses an in-memory `Map<deviceId, Set<ServerResponse>>` broadcast on each successful PATCH.

**Tech Stack:** TypeScript, Fastify 5, Drizzle ORM, better-sqlite3, React 18, MUI 5, Vite, Vitest, Docker Compose

**Workflow:** Each task is one branch → one PR. Merge each PR before starting the next. PR title = branch name.

---

## File Map

### `server/`
| File | Responsibility |
|---|---|
| `src/db/schema.ts` | Drizzle table definitions |
| `src/db/index.ts` | DB connection singleton |
| `src/db/seed.ts` | Seed 3 users at startup |
| `src/errors.ts` | NotFoundError, ConflictError, UnauthorizedError |
| `src/middleware/auth.ts` | Fastify preHandler — validate X-User-Id, attach userId |
| `src/sse/device-broadcaster.ts` | In-memory SSE subscriptions + broadcast |
| `src/repositories/device.repository.ts` | Thin DB query layer, no business logic |
| `src/services/device.service.ts` | Business logic: list, get, create, update, delete |
| `src/routes/devices.ts` | Fastify handlers + JSON Schema validation |
| `src/app.ts` | Fastify factory function (used in tests + entry) |
| `src/index.ts` | Entry point: seed, start server |
| `tests/unit/device.service.test.ts` | Unit tests with mocked repository |
| `tests/integration/devices.test.ts` | Integration tests, real SQLite |
| `tests/e2e/device-flow.test.ts` | Happy-path E2E flow |

### `client/`
| File | Responsibility |
|---|---|
| `src/api/devices.ts` | Typed fetch wrapper for all endpoints |
| `src/context/UserContext.tsx` | Active userId state + seeded users list |
| `src/components/UserSwitcher.tsx` | MUI Select in AppBar |
| `src/components/DeviceTable.tsx` | MUI Table of devices |
| `src/components/CreateDeviceDialog.tsx` | MUI Dialog with create form |
| `src/pages/DeviceListPage.tsx` | List + create |
| `src/pages/DeviceDetailPage.tsx` | Detail, edit, delete, SSE listener |
| `src/App.tsx` | Router + AppBar with UserSwitcher |
| `src/main.tsx` | Root render |

### Root
| File | Responsibility |
|---|---|
| `docker-compose.yml` | Ties server + client together |
| `server/Dockerfile` | Node production image |
| `client/Dockerfile` | Nginx serving Vite build |
| `client/nginx.conf` | Proxy /devices → server (SSE-safe) |

---

## PR 1: `chore/server-scaffold`

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/drizzle.config.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout -b chore/server-scaffold
```

- [ ] **Step 2: Create `server/package.json`**

```json
{
  "name": "device-management-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.0",
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.36.0",
    "fastify": "^5.0.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/uuid": "^10.0.0",
    "drizzle-kit": "^0.28.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

- [ ] **Step 5: Create `server/drizzle.config.ts`**

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'db.sqlite',
  },
} satisfies Config
```

- [ ] **Step 6: Install dependencies**

```bash
cd server && npm install
```

- [ ] **Step 7: Commit and open PR**

```bash
git add server/
git commit -m "chore: scaffold server"
gh pr create --title "chore/server-scaffold" --body "Server project setup: package.json, tsconfig, vitest, drizzle config."
```

---

## PR 2: `feat/init-database`

**Files:**
- Create: `server/src/db/schema.ts`
- Create: `server/src/db/index.ts`
- Create: `server/src/db/seed.ts`

- [ ] **Step 1: Create branch (from main after merging PR 1)**

```bash
git checkout main && git pull && git checkout -b feat/init-database
```

- [ ] **Step 2: Create `server/src/db/schema.ts`**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
})

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status', { enum: ['enabled', 'sleep', 'off'] }).notNull(),
  configuration: text('configuration', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
  version: integer('version').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
})

export const deviceHistory = sqliteTable('device_history', {
  deviceId: text('device_id').notNull().references(() => devices.id),
  version: integer('version').notNull(),
  snapshot: text('snapshot', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull(),
})

export const userDevices = sqliteTable('user_devices', {
  userId: text('user_id').notNull().references(() => users.id),
  deviceId: text('device_id').notNull().references(() => devices.id),
})
```

- [ ] **Step 3: Create `server/src/db/index.ts`**

```typescript
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

const sqlite = new Database(process.env.DATABASE_URL ?? 'db.sqlite')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
```

- [ ] **Step 4: Create `server/src/db/seed.ts`**

```typescript
import { db } from './index.js'
import { users } from './schema.js'

export const SEEDED_USERS = [
  { id: 'user-alice-0000-0000-000000000001', name: 'Alice' },
  { id: 'user-bob-00000-0000-000000000002', name: 'Bob' },
  { id: 'user-carol-000-0000-000000000003', name: 'Carol' },
]

export async function seed() {
  for (const user of SEEDED_USERS) {
    db.insert(users)
      .values({ ...user, createdAt: new Date().toISOString() })
      .onConflictDoNothing()
      .run()
  }
  console.log('Seeded users:')
  SEEDED_USERS.forEach(u => console.log(`  ${u.name}: ${u.id}`))
}
```

- [ ] **Step 5: Push schema to SQLite**

```bash
cd server && npm run db:push
```

Expected: `db.sqlite` created with all 4 tables.

- [ ] **Step 6: Commit and open PR**

```bash
git add server/src/db/ server/drizzle/
git commit -m "feat: db schema, connection, and seed"
gh pr create --title "feat/init-database" --body "Drizzle schema for users, devices, device_history, user_devices. DB connection singleton. Seed 3 users (Alice, Bob, Carol) at startup via onConflictDoNothing."
```

---

## PR 3: `feat/error-classes`

**Files:**
- Create: `server/src/errors.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/error-classes
```

- [ ] **Step 2: Create `server/src/errors.ts`**

```typescript
export class NotFoundError extends Error {
  statusCode = 404
  constructor(message = 'Not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends Error {
  statusCode = 409
  constructor(message = 'Conflict') {
    super(message)
    this.name = 'ConflictError'
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
```

- [ ] **Step 3: Commit and open PR**

```bash
git add server/src/errors.ts
git commit -m "feat: custom error classes"
gh pr create --title "feat/error-classes" --body "NotFoundError (404), ConflictError (409), UnauthorizedError (401). Used by service layer; routes map these to HTTP status codes."
```

---

## PR 4: `feat/device-repository`

**Files:**
- Create: `server/src/repositories/device.repository.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/device-repository
```

- [ ] **Step 2: Create `server/src/repositories/device.repository.ts`**

```typescript
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { devices, deviceHistory, userDevices } from '../db/schema.js'

export type DeviceRow = typeof devices.$inferSelect
export type DeviceInsert = typeof devices.$inferInsert

export const deviceRepository = {
  findAllByUserId(userId: string): DeviceRow[] {
    return db
      .select({ device: devices })
      .from(devices)
      .innerJoin(userDevices, eq(userDevices.deviceId, devices.id))
      .where(and(eq(userDevices.userId, userId), isNull(devices.deletedAt)))
      .all()
      .map(r => r.device)
  },

  findById(deviceId: string): DeviceRow | undefined {
    return db.select().from(devices).where(eq(devices.id, deviceId)).get()
  },

  isOwnedByUser(deviceId: string, userId: string): boolean {
    return !!db
      .select()
      .from(userDevices)
      .where(and(eq(userDevices.deviceId, deviceId), eq(userDevices.userId, userId)))
      .get()
  },

  create(device: DeviceInsert): DeviceRow {
    return db.insert(devices).values(device).returning().get()
  },

  update(deviceId: string, data: Partial<DeviceInsert>): DeviceRow {
    return db.update(devices).set(data).where(eq(devices.id, deviceId)).returning().get()
  },

  createUserDevice(userId: string, deviceId: string): void {
    db.insert(userDevices).values({ userId, deviceId }).run()
  },

  createHistory(entry: { deviceId: string; version: number; snapshot: Record<string, unknown>; createdAt: string }): void {
    db.insert(deviceHistory).values(entry).run()
  },
}
```

- [ ] **Step 3: Commit and open PR**

```bash
git add server/src/repositories/
git commit -m "feat: device repository"
gh pr create --title "feat/device-repository" --body "Thin DB query layer wrapping Drizzle. No business logic — pure data access. Handles user-scoped queries via User_Device join table."
```

---

## PR 5: `feat/device-service`

**Files:**
- Create: `server/tests/unit/device.service.test.ts`
- Create: `server/src/services/device.service.ts`

TDD: write all failing tests first, then implement the service.

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/device-service
```

- [ ] **Step 2: Write failing unit tests**

Create `server/tests/unit/device.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/repositories/device.repository.js', () => ({
  deviceRepository: {
    findAllByUserId: vi.fn(),
    findById: vi.fn(),
    isOwnedByUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    createUserDevice: vi.fn(),
    createHistory: vi.fn(),
  },
}))

vi.mock('../../src/sse/device-broadcaster.js', () => ({
  deviceBroadcaster: { broadcast: vi.fn() },
}))

import { deviceRepository } from '../../src/repositories/device.repository.js'
import { deviceBroadcaster } from '../../src/sse/device-broadcaster.js'
import { deviceService } from '../../src/services/device.service.js'
import { NotFoundError, ConflictError } from '../../src/errors.js'

const repo = deviceRepository as Record<string, ReturnType<typeof vi.fn>>
const broadcaster = deviceBroadcaster as Record<string, ReturnType<typeof vi.fn>>

const DEVICE = {
  id: 'device-1',
  name: 'Test Light',
  status: 'enabled' as const,
  configuration: { brightness: 100 },
  version: 2,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  deletedAt: null,
}

beforeEach(() => vi.clearAllMocks())

describe('deviceService.list', () => {
  it('returns devices for user', async () => {
    repo.findAllByUserId.mockReturnValue([DEVICE])
    const result = await deviceService.list('user-1')
    expect(result).toEqual([DEVICE])
    expect(repo.findAllByUserId).toHaveBeenCalledWith('user-1')
  })
})

describe('deviceService.get', () => {
  it('returns device when found and owned', async () => {
    repo.findById.mockReturnValue(DEVICE)
    repo.isOwnedByUser.mockReturnValue(true)
    await expect(deviceService.get('device-1', 'user-1')).resolves.toEqual(DEVICE)
  })

  it('throws NotFoundError when device does not exist', async () => {
    repo.findById.mockReturnValue(undefined)
    await expect(deviceService.get('device-1', 'user-1')).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when device is soft-deleted', async () => {
    repo.findById.mockReturnValue({ ...DEVICE, deletedAt: '2024-01-02T00:00:00.000Z' })
    await expect(deviceService.get('device-1', 'user-1')).rejects.toThrow(NotFoundError)
  })

  it('throws NotFoundError when device not owned by user', async () => {
    repo.findById.mockReturnValue(DEVICE)
    repo.isOwnedByUser.mockReturnValue(false)
    await expect(deviceService.get('device-1', 'user-1')).rejects.toThrow(NotFoundError)
  })
})

describe('deviceService.create', () => {
  it('uses defaultConfiguration when none provided', async () => {
    repo.create.mockReturnValue(DEVICE)
    await deviceService.create({ name: 'Light', status: 'enabled' }, 'user-1')
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ configuration: { brightness: 100, mode: 'auto' } })
    )
  })

  it('uses provided configuration when given', async () => {
    repo.create.mockReturnValue(DEVICE)
    await deviceService.create({ name: 'Light', status: 'enabled', configuration: { brightness: 50 } }, 'user-1')
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ configuration: { brightness: 50 } })
    )
  })

  it('creates User_Device link after creating device', async () => {
    repo.create.mockReturnValue(DEVICE)
    await deviceService.create({ name: 'Light', status: 'enabled' }, 'user-1')
    expect(repo.createUserDevice).toHaveBeenCalledWith('user-1', DEVICE.id)
  })
})

describe('deviceService.update', () => {
  it('throws ConflictError on version mismatch', async () => {
    repo.findById.mockReturnValue(DEVICE)
    repo.isOwnedByUser.mockReturnValue(true)
    await expect(
      deviceService.update('device-1', 'user-1', { version: 1, status: 'off' })
    ).rejects.toThrow(ConflictError)
  })

  it('increments version on successful update', async () => {
    repo.findById.mockReturnValue(DEVICE)
    repo.isOwnedByUser.mockReturnValue(true)
    const updated = { ...DEVICE, version: 3, status: 'off' as const }
    repo.update.mockReturnValue(updated)
    await deviceService.update('device-1', 'user-1', { version: 2, status: 'off' })
    expect(repo.update).toHaveBeenCalledWith('device-1', expect.objectContaining({ version: 3 }))
  })

  it('writes DeviceHistory snapshot on success', async () => {
    repo.findById.mockReturnValue(DEVICE)
    repo.isOwnedByUser.mockReturnValue(true)
    const updated = { ...DEVICE, version: 3 }
    repo.update.mockReturnValue(updated)
    await deviceService.update('device-1', 'user-1', { version: 2, status: 'off' })
    expect(repo.createHistory).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'device-1', version: 3, snapshot: updated })
    )
  })

  it('broadcasts SSE event on success', async () => {
    repo.findById.mockReturnValue(DEVICE)
    repo.isOwnedByUser.mockReturnValue(true)
    const updated = { ...DEVICE, version: 3 }
    repo.update.mockReturnValue(updated)
    await deviceService.update('device-1', 'user-1', { version: 2, status: 'off' })
    expect(broadcaster.broadcast).toHaveBeenCalledWith('device-1', updated)
  })
})

describe('deviceService.delete', () => {
  it('soft-deletes by setting deletedAt', async () => {
    repo.findById.mockReturnValue(DEVICE)
    repo.isOwnedByUser.mockReturnValue(true)
    repo.update.mockReturnValue({ ...DEVICE, deletedAt: '2024-01-02T00:00:00.000Z' })
    await deviceService.delete('device-1', 'user-1')
    expect(repo.update).toHaveBeenCalledWith('device-1', expect.objectContaining({ deletedAt: expect.any(String) }))
  })

  it('throws NotFoundError when device not found', async () => {
    repo.findById.mockReturnValue(undefined)
    await expect(deviceService.delete('device-1', 'user-1')).rejects.toThrow(NotFoundError)
  })
})
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
cd server && npm run test:unit
```

Expected: FAIL — `Cannot find module '../../src/services/device.service.js'`

- [ ] **Step 4: Implement `server/src/services/device.service.ts`**

```typescript
import { v4 as uuidv4 } from 'uuid'
import { deviceRepository } from '../repositories/device.repository.js'
import { deviceBroadcaster } from '../sse/device-broadcaster.js'
import { NotFoundError, ConflictError } from '../errors.js'

const defaultConfiguration = { brightness: 100, mode: 'auto' }

export const deviceService = {
  async list(userId: string) {
    return deviceRepository.findAllByUserId(userId)
  },

  async get(deviceId: string, userId: string) {
    const device = deviceRepository.findById(deviceId)
    if (!device || device.deletedAt) throw new NotFoundError('Device not found')
    if (!deviceRepository.isOwnedByUser(deviceId, userId)) throw new NotFoundError('Device not found')
    return device
  },

  async create(
    data: { name: string; status: 'enabled' | 'sleep' | 'off'; configuration?: Record<string, unknown> },
    userId: string
  ) {
    const now = new Date().toISOString()
    const device = deviceRepository.create({
      id: uuidv4(),
      name: data.name,
      status: data.status,
      configuration: data.configuration ?? defaultConfiguration,
      version: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    deviceRepository.createUserDevice(userId, device.id)
    return device
  },

  async update(
    deviceId: string,
    userId: string,
    data: { status?: string; configuration?: Record<string, unknown>; version: number }
  ) {
    const device = await this.get(deviceId, userId)
    if (data.version !== device.version) throw new ConflictError('Version mismatch')

    const now = new Date().toISOString()
    const updated = deviceRepository.update(deviceId, {
      ...(data.status !== undefined && { status: data.status as 'enabled' | 'sleep' | 'off' }),
      ...(data.configuration !== undefined && { configuration: data.configuration }),
      version: device.version + 1,
      updatedAt: now,
    })

    deviceRepository.createHistory({
      deviceId,
      version: updated.version,
      snapshot: updated as unknown as Record<string, unknown>,
      createdAt: now,
    })

    deviceBroadcaster.broadcast(deviceId, updated)
    return updated
  },

  async delete(deviceId: string, userId: string) {
    await this.get(deviceId, userId)
    return deviceRepository.update(deviceId, { deletedAt: new Date().toISOString() })
  },
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
cd server && npm run test:unit
```

Expected: All PASS.

- [ ] **Step 6: Commit and open PR**

```bash
git add server/tests/unit/ server/src/services/ server/src/sse/
git commit -m "feat: device service with unit tests"
gh pr create --title "feat/device-service" --body "Business logic layer: list, get, create, update (optimistic locking + history snapshot + SSE broadcast), delete (soft). TDD — unit tests written first with mocked repository and SSE broadcaster."
```

> Note: `server/src/sse/device-broadcaster.ts` is also created in this PR since it is required by the service mock and real implementation.

Create `server/src/sse/device-broadcaster.ts` before committing:

```typescript
import type { ServerResponse } from 'http'

const subscribers = new Map<string, Set<ServerResponse>>()

export const deviceBroadcaster = {
  subscribe(deviceId: string, res: ServerResponse): void {
    if (!subscribers.has(deviceId)) subscribers.set(deviceId, new Set())
    subscribers.get(deviceId)!.add(res)
  },

  unsubscribe(deviceId: string, res: ServerResponse): void {
    subscribers.get(deviceId)?.delete(res)
  },

  broadcast(deviceId: string, data: unknown): void {
    const subs = subscribers.get(deviceId)
    if (!subs || subs.size === 0) return
    const payload = `event: device-updated\ndata: ${JSON.stringify(data)}\n\n`
    for (const res of subs) res.write(payload)
  },
}
```

---

## PR 6: `feat/app-scaffold`

Sets up the Fastify app factory, auth middleware, an empty routes plugin, and the entry point. Individual endpoints are added in subsequent PRs.

**Files:**
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/routes/devices.ts` (empty plugin)
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/app-scaffold
```

- [ ] **Step 2: Create `server/src/middleware/auth.ts`**

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.headers['x-user-id'] as string | undefined
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'X-User-Id header required' })
  }
  const user = db.select().from(users).where(eq(users.id, userId)).get()
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' })
  }
  request.userId = userId
}
```

- [ ] **Step 3: Create `server/src/routes/devices.ts` (empty plugin)**

```typescript
import type { FastifyInstance } from 'fastify'

export async function deviceRoutes(app: FastifyInstance) {
  // endpoints registered in subsequent PRs
}
```

- [ ] **Step 4: Create `server/src/app.ts`**

```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authMiddleware } from './middleware/auth.js'
import { deviceRoutes } from './routes/devices.js'

export function buildApp() {
  const app = Fastify({ logger: false })
  app.register(cors, { origin: true })
  app.addHook('preHandler', authMiddleware)
  app.register(deviceRoutes, { prefix: '/devices' })
  app.setErrorHandler((_err, _req, reply) => {
    reply.status(500).send({ error: 'InternalServerError', message: 'Something went wrong' })
  })
  return app
}
```

- [ ] **Step 5: Create `server/src/index.ts`**

```typescript
import { buildApp } from './app.js'
import { seed } from './db/seed.js'

const app = buildApp()
await seed()
await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
console.log(`Server running on port ${process.env.PORT ?? 3000}`)
```

- [ ] **Step 6: Verify server starts**

```bash
cd server && npm run dev
```

Expected: Seeded user IDs printed, `Server running on port 3000`.

- [ ] **Step 7: Commit and open PR**

```bash
git add server/src/middleware/ server/src/routes/ server/src/app.ts server/src/index.ts
git commit -m "feat: app factory, auth middleware, empty routes plugin"
gh pr create --title "feat/app-scaffold" --body "Fastify app factory (buildApp) used by both server entry and tests. Auth preHandler validates X-User-Id against seeded users. Empty device routes plugin — endpoints added per PR."
```

---

## PR 7: `feat/post-device`

**Files:**
- Modify: `server/src/routes/devices.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/post-device
```

- [ ] **Step 2: Add POST handler to `server/src/routes/devices.ts`**

```typescript
import type { FastifyInstance } from 'fastify'
import { deviceService } from '../services/device.service.js'

export async function deviceRoutes(app: FastifyInstance) {
  app.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'status'],
        properties: {
          name: { type: 'string', minLength: 1 },
          status: { type: 'string', enum: ['enabled', 'sleep', 'off'] },
          configuration: { type: 'object' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as {
        name: string
        status: 'enabled' | 'sleep' | 'off'
        configuration?: Record<string, unknown>
      }
      const device = await deviceService.create(body, request.userId)
      return reply.status(201).send(device)
    },
  })
}
```

- [ ] **Step 3: Test with curl**

```bash
curl -X POST http://localhost:3000/devices \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-alice-0000-0000-000000000001" \
  -d '{"name":"Living Room Light","status":"enabled"}'
```

Expected: `201` with device JSON, `"version": 0`.

```bash
# Missing name → 400
curl -X POST http://localhost:3000/devices \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-alice-0000-0000-000000000001" \
  -d '{"status":"enabled"}'
```

Expected: `400`.

- [ ] **Step 4: Commit and open PR**

```bash
git add server/src/routes/devices.ts
git commit -m "feat: POST /devices"
gh pr create --title "feat/post-device" --body "POST /devices — registers a new device. Fastify JSON Schema validates name (required, min 1 char) and status (enum). configuration optional, falls back to defaultConfiguration. Creates User_Device link for requesting user. Returns 201 with the created device."
```

---

## PR 8: `feat/get-devices`

**Files:**
- Modify: `server/src/routes/devices.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/get-devices
```

- [ ] **Step 2: Add GET / handler to `server/src/routes/devices.ts`**

Add inside `deviceRoutes` after the POST handler:

```typescript
  app.get('/', async (request, reply) => {
    return reply.send(await deviceService.list(request.userId))
  })
```

- [ ] **Step 3: Test with curl**

```bash
curl http://localhost:3000/devices \
  -H "X-User-Id: user-alice-0000-0000-000000000001"
```

Expected: `200` with array of Alice's non-deleted devices.

- [ ] **Step 4: Commit and open PR**

```bash
git add server/src/routes/devices.ts
git commit -m "feat: GET /devices"
gh pr create --title "feat/get-devices" --body "GET /devices — returns all non-deleted devices for the requesting user. Scoped via User_Device join table, so different users see their own devices."
```

---

## PR 9: `feat/get-device`

**Files:**
- Modify: `server/src/routes/devices.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/get-device
```

- [ ] **Step 2: Add GET /:deviceId handler**

Add inside `deviceRoutes`:

```typescript
  app.get<{ Params: { deviceId: string } }>('/:deviceId', async (request, reply) => {
    try {
      return reply.send(await deviceService.get(request.params.deviceId, request.userId))
    } catch (err) {
      if (err instanceof NotFoundError) return reply.status(404).send({ error: 'NotFound', message: err.message })
      throw err
    }
  })
```

Add to imports at top of file:
```typescript
import { NotFoundError } from '../errors.js'
```

- [ ] **Step 3: Test with curl**

```bash
DEVICE_ID=<id from POST>
curl http://localhost:3000/devices/$DEVICE_ID \
  -H "X-User-Id: user-alice-0000-0000-000000000001"
# → 200 device

curl http://localhost:3000/devices/nonexistent \
  -H "X-User-Id: user-alice-0000-0000-000000000001"
# → 404
```

- [ ] **Step 4: Commit and open PR**

```bash
git add server/src/routes/devices.ts
git commit -m "feat: GET /devices/:deviceId"
gh pr create --title "feat/get-device" --body "GET /devices/:deviceId — returns single device. Returns 404 if not found, soft-deleted, or not owned by requesting user (no device existence leakage)."
```

---

## PR 10: `feat/patch-device`

**Files:**
- Modify: `server/src/routes/devices.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/patch-device
```

- [ ] **Step 2: Add PATCH /:deviceId handler**

Add inside `deviceRoutes`:

```typescript
  app.patch<{ Params: { deviceId: string } }>('/:deviceId', {
    schema: {
      body: {
        type: 'object',
        required: ['version'],
        properties: {
          status: { type: 'string', enum: ['enabled', 'sleep', 'off'] },
          configuration: { type: 'object' },
          version: { type: 'integer', minimum: 0 },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as { status?: string; configuration?: Record<string, unknown>; version: number }
      try {
        return reply.send(await deviceService.update(request.params.deviceId, request.userId, body))
      } catch (err) {
        if (err instanceof NotFoundError) return reply.status(404).send({ error: 'NotFound', message: err.message })
        if (err instanceof ConflictError) return reply.status(409).send({ error: 'Conflict', message: err.message })
        throw err
      }
    },
  })
```

Add to imports:
```typescript
import { NotFoundError, ConflictError } from '../errors.js'
```

- [ ] **Step 3: Test with curl**

```bash
DEVICE_ID=<id from POST>

# Correct version → 200, version incremented
curl -X PATCH http://localhost:3000/devices/$DEVICE_ID \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-alice-0000-0000-000000000001" \
  -d '{"status":"off","version":0}'

# Stale version → 409
curl -X PATCH http://localhost:3000/devices/$DEVICE_ID \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-alice-0000-0000-000000000001" \
  -d '{"status":"enabled","version":0}'
```

- [ ] **Step 4: Commit and open PR**

```bash
git add server/src/routes/devices.ts
git commit -m "feat: PATCH /devices/:deviceId"
gh pr create --title "feat/patch-device" --body "PATCH /devices/:deviceId — updates status and/or configuration. Requires version field for optimistic locking; returns 409 Conflict on mismatch. On success: increments version, writes DeviceHistory snapshot, broadcasts SSE event."
```

---

## PR 11: `feat/delete-device`

**Files:**
- Modify: `server/src/routes/devices.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/delete-device
```

- [ ] **Step 2: Add DELETE /:deviceId handler**

Add inside `deviceRoutes`:

```typescript
  app.delete<{ Params: { deviceId: string } }>('/:deviceId', async (request, reply) => {
    try {
      return reply.send(await deviceService.delete(request.params.deviceId, request.userId))
    } catch (err) {
      if (err instanceof NotFoundError) return reply.status(404).send({ error: 'NotFound', message: err.message })
      throw err
    }
  })
```

- [ ] **Step 3: Test with curl**

```bash
DEVICE_ID=<id from POST>

curl -X DELETE http://localhost:3000/devices/$DEVICE_ID \
  -H "X-User-Id: user-alice-0000-0000-000000000001"
# → 200 with deleted device (deletedAt set)

curl http://localhost:3000/devices \
  -H "X-User-Id: user-alice-0000-0000-000000000001"
# → device no longer appears in list
```

- [ ] **Step 4: Commit and open PR**

```bash
git add server/src/routes/devices.ts
git commit -m "feat: DELETE /devices/:deviceId"
gh pr create --title "feat/delete-device" --body "DELETE /devices/:deviceId — soft delete (sets deleted_at). Device is excluded from GET /devices and GET /devices/:deviceId after deletion. Returns 200 with the deleted device record."
```

---

## PR 12: `feat/sse-events`

**Files:**
- Modify: `server/src/routes/devices.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/sse-events
```

- [ ] **Step 2: Add SSE handler to `server/src/routes/devices.ts`**

Add import at top:
```typescript
import { deviceBroadcaster } from '../sse/device-broadcaster.js'
```

Add inside `deviceRoutes`:

```typescript
  // reply.hijack() takes control of the raw socket — Fastify won't touch the response after this.
  // proxy_buffering off in nginx is required for SSE to work through a reverse proxy.
  app.get<{ Params: { deviceId: string } }>('/:deviceId/events', async (request, reply) => {
    const { deviceId } = request.params
    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    res.write(':\n\n') // establish connection without sending an event
    deviceBroadcaster.subscribe(deviceId, res)
    request.raw.on('close', () => deviceBroadcaster.unsubscribe(deviceId, res))
  })
```

- [ ] **Step 3: Test SSE manually**

```bash
# Terminal 1 — subscribe
curl -N http://localhost:3000/devices/$DEVICE_ID/events \
  -H "X-User-Id: user-alice-0000-0000-000000000001"

# Terminal 2 — trigger update
curl -X PATCH http://localhost:3000/devices/$DEVICE_ID \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-alice-0000-0000-000000000001" \
  -d '{"status":"sleep","version":1}'
```

Expected: Terminal 1 receives `event: device-updated` with updated device JSON.

- [ ] **Step 4: Commit and open PR**

```bash
git add server/src/routes/devices.ts
git commit -m "feat: GET /devices/:deviceId/events SSE stream"
gh pr create --title "feat/sse-events" --body "GET /devices/:deviceId/events — SSE stream per device. Uses reply.hijack() to take raw socket control. Server holds in-memory Map<deviceId, Set<Response>>; PATCH broadcasts device-updated events to all subscribers. Known limitation: single-instance only — Redis pub/sub needed for horizontal scaling."
```

---

## PR 13: `test/integration-and-e2e`

**Files:**
- Create: `server/tests/integration/devices.test.ts`
- Create: `server/tests/e2e/device-flow.test.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b test/integration-and-e2e
```

- [ ] **Step 2: Create `server/tests/integration/devices.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../../src/db/schema.js'
import { users } from '../../src/db/schema.js'

const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')
const testDb = drizzle(sqlite, { schema })

vi.mock('../../src/db/index.js', () => ({ db: testDb }))

import { buildApp } from '../../src/app.js'

const TEST_USER = { id: 'integ-user-0000-0000-000000000001', name: 'Integration User' }
const headers = { 'x-user-id': TEST_USER.id }
const app = buildApp()

beforeAll(async () => {
  migrate(testDb, { migrationsFolder: './drizzle' })
  testDb.insert(users).values({ ...TEST_USER, createdAt: new Date().toISOString() }).run()
  await app.ready()
})

afterAll(() => app.close())

describe('POST /devices', () => {
  it('creates device and returns it with version 0', async () => {
    const res = await app.inject({
      method: 'POST', url: '/devices', headers,
      payload: { name: 'Test Light', status: 'enabled', configuration: { brightness: 80 } },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.id).toBeDefined()
    expect(body.version).toBe(0)
    expect(body.name).toBe('Test Light')
  })

  it('returns 400 for missing name', async () => {
    const res = await app.inject({ method: 'POST', url: '/devices', headers, payload: { status: 'enabled' } })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 when X-User-Id header is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/devices', payload: { name: 'Light', status: 'enabled' } })
    expect(res.statusCode).toBe(401)
  })
})

describe('PATCH /devices/:deviceId', () => {
  it('returns 409 on version mismatch', async () => {
    const { id } = (await app.inject({
      method: 'POST', url: '/devices', headers,
      payload: { name: 'Conflict Light', status: 'enabled' },
    })).json()

    const res = await app.inject({
      method: 'PATCH', url: `/devices/${id}`, headers,
      payload: { status: 'off', version: 99 },
    })
    expect(res.statusCode).toBe(409)
  })

  it('increments version on success', async () => {
    const { id, version } = (await app.inject({
      method: 'POST', url: '/devices', headers,
      payload: { name: 'Version Light', status: 'enabled' },
    })).json()

    const res = await app.inject({
      method: 'PATCH', url: `/devices/${id}`, headers,
      payload: { status: 'off', version },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().version).toBe(version + 1)
  })
})

describe('DELETE /devices/:deviceId', () => {
  it('soft-deletes and excludes from GET /devices', async () => {
    const { id } = (await app.inject({
      method: 'POST', url: '/devices', headers,
      payload: { name: 'Delete Me', status: 'enabled' },
    })).json()

    expect((await app.inject({ method: 'DELETE', url: `/devices/${id}`, headers })).statusCode).toBe(200)

    const list = (await app.inject({ method: 'GET', url: '/devices', headers })).json()
    expect(list.find((d: { id: string }) => d.id === id)).toBeUndefined()
  })
})
```

- [ ] **Step 3: Create `server/tests/e2e/device-flow.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../../src/db/schema.js'
import { users, deviceHistory } from '../../src/db/schema.js'
import { eq } from 'drizzle-orm'

const sqlite = new Database(':memory:')
sqlite.pragma('foreign_keys = ON')
const testDb = drizzle(sqlite, { schema })

vi.mock('../../src/db/index.js', () => ({ db: testDb }))

import { buildApp } from '../../src/app.js'

const TEST_USER = { id: 'e2e-user-00000-0000-000000000001', name: 'E2E User' }
const headers = { 'x-user-id': TEST_USER.id }
const app = buildApp()

beforeAll(async () => {
  migrate(testDb, { migrationsFolder: './drizzle' })
  testDb.insert(users).values({ ...TEST_USER, createdAt: new Date().toISOString() }).run()
  await app.ready()
})

afterAll(() => app.close())

describe('full device lifecycle', () => {
  it('create → update → verify version incremented and history written', async () => {
    const createRes = await app.inject({
      method: 'POST', url: '/devices', headers,
      payload: { name: 'Living Room Light', status: 'enabled', configuration: { brightness: 80 } },
    })
    expect(createRes.statusCode).toBe(201)
    const device = createRes.json()
    expect(device.version).toBe(0)

    const patchRes = await app.inject({
      method: 'PATCH', url: `/devices/${device.id}`, headers,
      payload: { status: 'off', version: device.version },
    })
    expect(patchRes.statusCode).toBe(200)
    const updated = patchRes.json()
    expect(updated.version).toBe(1)
    expect(updated.status).toBe('off')

    const history = testDb.select().from(deviceHistory).where(eq(deviceHistory.deviceId, device.id)).all()
    expect(history).toHaveLength(1)
    expect(history[0].version).toBe(1)
  })
})
```

- [ ] **Step 4: Run all tests**

```bash
cd server && npm test
```

Expected: All unit, integration, and e2e tests PASS.

- [ ] **Step 5: Commit and open PR**

```bash
git add server/tests/integration/ server/tests/e2e/
git commit -m "test: integration and e2e tests"
gh pr create --title "test/integration-and-e2e" --body "Integration tests: POST (201 + version 0), PATCH (409 on version mismatch, version increment on success), DELETE (soft delete + excluded from list). E2E: full lifecycle create→patch→assert history row written. All use real in-memory SQLite via vi.mock on db module."
```

---

## PR 14: `feat/react-client-setup`

**Files:**
- Create: `client/` (Vite scaffold + MUI + react-router)
- Create: `client/src/api/devices.ts`
- Create: `client/src/context/UserContext.tsx`
- Create: `client/src/components/UserSwitcher.tsx`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/react-client-setup
```

- [ ] **Step 2: Scaffold Vite project**

```bash
npm create vite@latest client -- --template react-ts
cd client && npm install @mui/material @mui/icons-material @emotion/react @emotion/styled react-router-dom
```

- [ ] **Step 3: Update `client/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/devices': 'http://localhost:3000',
    },
  },
})
```

- [ ] **Step 4: Create `client/src/api/devices.ts`**

```typescript
export type DeviceStatus = 'enabled' | 'sleep' | 'off'

export interface Device {
  id: string
  name: string
  status: DeviceStatus
  configuration: Record<string, unknown>
  version: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': localStorage.getItem('userId') ?? '',
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...getHeaders(), ...options?.headers } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw Object.assign(new Error(err.message ?? 'Request failed'), { status: res.status })
  }
  return res.json()
}

export const devicesApi = {
  list: () => request<Device[]>('/devices'),
  get: (id: string) => request<Device>(`/devices/${id}`),
  create: (data: { name: string; status: DeviceStatus; configuration?: Record<string, unknown> }) =>
    request<Device>('/devices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { status?: DeviceStatus; configuration?: Record<string, unknown>; version: number }) =>
    request<Device>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<Device>(`/devices/${id}`, { method: 'DELETE' }),
}
```

- [ ] **Step 5: Create `client/src/context/UserContext.tsx`**

> User IDs must match `server/src/db/seed.ts` exactly.

```tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export const SEEDED_USERS = [
  { id: 'user-alice-0000-0000-000000000001', name: 'Alice' },
  { id: 'user-bob-00000-0000-000000000002', name: 'Bob' },
  { id: 'user-carol-000-0000-000000000003', name: 'Carol' },
]

interface UserContextValue {
  userId: string
  setUserId: (id: string) => void
  users: typeof SEEDED_USERS
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState(
    () => localStorage.getItem('userId') ?? SEEDED_USERS[0].id
  )

  useEffect(() => { localStorage.setItem('userId', userId) }, [userId])

  function setUserId(id: string) {
    localStorage.setItem('userId', id)
    setUserIdState(id)
  }

  return (
    <UserContext.Provider value={{ userId, setUserId, users: SEEDED_USERS }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be inside UserProvider')
  return ctx
}
```

- [ ] **Step 6: Create `client/src/components/UserSwitcher.tsx`**

```tsx
import { Select, MenuItem, type SelectChangeEvent } from '@mui/material'
import { useUser } from '../context/UserContext'

export function UserSwitcher() {
  const { userId, setUserId, users } = useUser()

  function handleChange(e: SelectChangeEvent) {
    setUserId(e.target.value)
    window.location.reload()
  }

  return (
    <Select
      value={userId}
      onChange={handleChange}
      size="small"
      sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { border: 0 } }}
    >
      {users.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
    </Select>
  )
}
```

- [ ] **Step 7: Commit and open PR**

```bash
git add client/
git commit -m "feat: react client setup with MUI, API client, UserContext"
gh pr create --title "feat/react-client-setup" --body "React + Vite + MUI + react-router scaffold. Typed API client reads X-User-Id from localStorage. UserContext holds the active user; UserSwitcher lets you switch between seeded users in the AppBar. Vite dev proxy forwards /devices to localhost:3000."
```

---

## PR 15: `feat/device-list-ui`

**Files:**
- Create: `client/src/components/DeviceTable.tsx`
- Create: `client/src/components/CreateDeviceDialog.tsx`
- Create: `client/src/pages/DeviceListPage.tsx`
- Create: `client/src/App.tsx`
- Modify: `client/src/main.tsx`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/device-list-ui
```

- [ ] **Step 2: Create `client/src/components/DeviceTable.tsx`**

```tsx
import { Table, TableBody, TableCell, TableHead, TableRow, Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import type { Device } from '../api/devices'

const statusColor: Record<string, 'success' | 'warning' | 'default'> = {
  enabled: 'success', sleep: 'warning', off: 'default',
}

export function DeviceTable({ devices }: { devices: Device[] }) {
  const navigate = useNavigate()
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Version</TableCell>
          <TableCell>Created</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {devices.map(d => (
          <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/devices/${d.id}`)}>
            <TableCell>{d.name}</TableCell>
            <TableCell><Chip label={d.status} color={statusColor[d.status]} size="small" /></TableCell>
            <TableCell>{d.version}</TableCell>
            <TableCell>{new Date(d.createdAt).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 3: Create `client/src/components/CreateDeviceDialog.tsx`**

```tsx
import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material'
import { devicesApi, type DeviceStatus } from '../api/devices'

interface Props { open: boolean; onClose: () => void; onCreated: () => void }

export function CreateDeviceDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<DeviceStatus>('enabled')
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required'); return }
    try {
      await devicesApi.create({ name, status })
      setName(''); setStatus('enabled'); setError('')
      onCreated(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create device')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Register New Device</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField label="Name" value={name} onChange={e => setName(e.target.value)} error={!!error} helperText={error} fullWidth />
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={e => setStatus(e.target.value as DeviceStatus)}>
            <MenuItem value="enabled">Enabled</MenuItem>
            <MenuItem value="sleep">Sleep</MenuItem>
            <MenuItem value="off">Off</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>Register</Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 4: Create `client/src/pages/DeviceListPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material'
import { DeviceTable } from '../components/DeviceTable'
import { CreateDeviceDialog } from '../components/CreateDeviceDialog'
import { devicesApi, type Device } from '../api/devices'

export function DeviceListPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  async function load() {
    try {
      setDevices(await devicesApi.list())
    } catch {
      setError('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <CircularProgress />
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Devices</Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>Add Device</Button>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      <DeviceTable devices={devices} />
      <CreateDeviceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={load} />
    </Box>
  )
}
```

- [ ] **Step 5: Create `client/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Container, Box } from '@mui/material'
import { UserProvider } from './context/UserContext'
import { UserSwitcher } from './components/UserSwitcher'
import { DeviceListPage } from './pages/DeviceListPage'
import { DeviceDetailPage } from './pages/DeviceDetailPage'

export function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Device Management</Typography>
            <UserSwitcher />
          </Toolbar>
        </AppBar>
        <Container maxWidth="lg">
          <Box sx={{ mt: 4 }}>
            <Routes>
              <Route path="/" element={<DeviceListPage />} />
              <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
            </Routes>
          </Box>
        </Container>
      </BrowserRouter>
    </UserProvider>
  )
}
```

- [ ] **Step 6: Update `client/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline } from '@mui/material'
import { App } from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CssBaseline />
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Verify in browser**

```bash
cd server && npm run dev &
cd client && npm run dev
```

Open `http://localhost:5173`. Device list loads. "Add Device" opens dialog. Created device appears in table. Clicking a row navigates to `/devices/:id`.

- [ ] **Step 8: Commit and open PR**

```bash
git add client/src/
git commit -m "feat: device list page with create dialog"
gh pr create --title "feat/device-list-ui" --body "Device list page: MUI Table with status chip + version. Add Device button opens a Dialog form. UserSwitcher in AppBar lets you switch between Alice, Bob, Carol. App.tsx wires up react-router with two routes."
```

---

## PR 16: `feat/device-detail-ui`

**Files:**
- Create: `client/src/pages/DeviceDetailPage.tsx`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b feat/device-detail-ui
```

- [ ] **Step 2: Create `client/src/pages/DeviceDetailPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Chip, Divider, TextField,
} from '@mui/material'
import { devicesApi, type Device, type DeviceStatus } from '../api/devices'

export function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>()
  const navigate = useNavigate()
  const [device, setDevice] = useState<Device | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editStatus, setEditStatus] = useState<DeviceStatus>('enabled')
  const [editConfig, setEditConfig] = useState('')
  const [saving, setSaving] = useState(false)

  function applyDevice(d: Device) {
    setDevice(d)
    setEditStatus(d.status)
    setEditConfig(JSON.stringify(d.configuration, null, 2))
  }

  useEffect(() => {
    devicesApi.get(deviceId!)
      .then(applyDevice)
      .catch(() => setError('Device not found'))
      .finally(() => setLoading(false))

    const es = new EventSource(`/devices/${deviceId}/events`)
    es.addEventListener('device-updated', e => applyDevice(JSON.parse(e.data)))
    return () => es.close()
  }, [deviceId])

  async function handleUpdate() {
    if (!device) return
    setSaving(true); setError('')
    try {
      let configuration: Record<string, unknown>
      try { configuration = JSON.parse(editConfig) }
      catch { setError('Invalid JSON configuration'); setSaving(false); return }
      applyDevice(await devicesApi.update(device.id, { status: editStatus, configuration, version: device.version }))
    } catch (err: unknown) {
      const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : 0
      setError(status === 409
        ? 'Device was updated by someone else — please refresh.'
        : err instanceof Error ? err.message : 'Update failed'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!device || !confirm('Delete this device?')) return
    try { await devicesApi.delete(device.id); navigate('/') }
    catch { setError('Failed to delete device') }
  }

  if (loading) return <CircularProgress />
  if (!device) return <Alert severity="error">{error || 'Device not found'}</Alert>

  return (
    <Box sx={{ maxWidth: 600 }}>
      <Button onClick={() => navigate('/')} sx={{ mb: 2 }}>← Back</Button>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h5">{device.name}</Typography>
        <Chip label={`v${device.version}`} size="small" />
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Divider sx={{ mb: 3 }} />
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Status</InputLabel>
        <Select value={editStatus} label="Status" onChange={e => setEditStatus(e.target.value as DeviceStatus)}>
          <MenuItem value="enabled">Enabled</MenuItem>
          <MenuItem value="sleep">Sleep</MenuItem>
          <MenuItem value="off">Off</MenuItem>
        </Select>
      </FormControl>
      <TextField
        label="Configuration (JSON)"
        value={editConfig}
        onChange={e => setEditConfig(e.target.value)}
        multiline rows={6} fullWidth sx={{ mb: 2, fontFamily: 'monospace' }}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="contained" onClick={handleUpdate} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button variant="outlined" color="error" onClick={handleDelete}>Delete</Button>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 3: Test SSE multi-user demo**

1. Open `http://localhost:5173` in two browser windows
2. Both windows: select Alice (same user shares the same devices)
3. Window 1: open a device detail page
4. Window 2: open the same device detail page
5. Change status in Window 1 → Window 2 updates live without refresh

- [ ] **Step 4: Commit and open PR**

```bash
git add client/src/pages/DeviceDetailPage.tsx
git commit -m "feat: device detail page with SSE live updates"
gh pr create --title "feat/device-detail-ui" --body "Device detail page: status dropdown, JSON config textarea (editable), version chip. PATCH sends current version; shows friendly message on 409. Delete soft-deletes and redirects. EventSource subscribes on mount, updates state live on device-updated SSE events."
```

---

## PR 17: `chore/docker`

**Files:**
- Create: `server/Dockerfile`
- Create: `client/Dockerfile`
- Create: `client/nginx.conf`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull && git checkout -b chore/docker
```

- [ ] **Step 2: Create `server/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/drizzle ./drizzle
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 3: Create `client/nginx.conf`**

```nginx
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # proxy_buffering off is critical for SSE — without it nginx buffers
    # the stream and events never reach the client
    location /devices {
        proxy_pass http://server:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
    }
}
```

- [ ] **Step 4: Create `client/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 5: Create `docker-compose.yml`**

```yaml
services:
  server:
    build: ./server
    environment:
      DATABASE_URL: /data/db.sqlite
      PORT: 3000
    volumes:
      - db-data:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/devices"]
      interval: 5s
      timeout: 3s
      retries: 10

  client:
    build: ./client
    ports:
      - "5173:80"
    depends_on:
      server:
        condition: service_healthy

volumes:
  db-data:
```

- [ ] **Step 6: Build and verify**

```bash
docker compose up --build
```

Open `http://localhost:5173` — app loads, all endpoints work, SSE updates work across tabs.

- [ ] **Step 7: Commit and open PR**

```bash
git add server/Dockerfile client/Dockerfile client/nginx.conf docker-compose.yml
git commit -m "chore: Docker and Docker Compose"
gh pr create --title "chore/docker" --body "Multi-stage Dockerfiles for server (Node 20) and client (Vite build → nginx). docker-compose.yml with health check on server before starting client. SQLite persisted in named volume. nginx proxy_buffering off for SSE support."
```

---

## PR Summary

| # | Branch | What it adds |
|---|---|---|
| 1 | `chore/server-scaffold` | package.json, tsconfig, vitest, drizzle config |
| 2 | `feat/init-database` | Drizzle schema + DB connection + seed |
| 3 | `feat/error-classes` | NotFoundError, ConflictError, UnauthorizedError |
| 4 | `feat/device-repository` | Thin DB query layer |
| 5 | `feat/device-service` | Service + SSE broadcaster + unit tests (TDD) |
| 6 | `feat/app-scaffold` | Auth middleware + Fastify factory + empty routes |
| 7 | `feat/post-device` | POST /devices |
| 8 | `feat/get-devices` | GET /devices |
| 9 | `feat/get-device` | GET /devices/:deviceId |
| 10 | `feat/patch-device` | PATCH /devices/:deviceId (optimistic locking) |
| 11 | `feat/delete-device` | DELETE /devices/:deviceId (soft delete) |
| 12 | `feat/sse-events` | GET /devices/:deviceId/events (SSE) |
| 13 | `test/integration-and-e2e` | Integration + E2E tests |
| 14 | `feat/react-client-setup` | Vite scaffold + API client + UserContext |
| 15 | `feat/device-list-ui` | List page + create dialog |
| 16 | `feat/device-detail-ui` | Detail page + SSE live updates |
| 17 | `chore/docker` | Dockerfiles + docker-compose |

> **Cleanup reminder:** Delete `docs/superpowers/` before submitting the interview task.
