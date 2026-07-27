# Device Management API

Objectives:

- Register a New Device:
  Create an endpoint to register a new IoT device. The API should accept the necessary details to uniquely identify and describe the device.
  The response should return the details of the registered device, including a unique identifier.
- List All Devices:
  Implement an endpoint to retrieve a list of all registered devices. This endpoint should return a summary of each device's details.
- Get Device Details:
  Create an endpoint to retrieve the details of a specific device by its unique identifier.
- Update Device Status:
  Provide an endpoint to update the status or configuration of a specific device. This could be used, for example, to turn a light on or off, adjust a thermostat, etc.
  The response should confirm the updated status or configuration.
- Delete a Device:
  Implement an endpoint to delete a specific device from the system. The response should confirm the deletion.
- Device History
- Frontend UI for all operations
- Real time updates
---

## Tech Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Backend  | TypeScript + Fastify + Drizzle ORM + SQLite |
| Frontend | React + MUI                                 |
| Testing  | Vitest                                      |

---

## Approach & Challenges

The backend is split into vertical slices (routes → service → repository), keeping each layer independently testable. Devices support full CRUD with soft deletes, server-managed versioning, and a history table that snapshots every change for audit. Followed TDD approach.

Real-time updates are delivered over SSE — the server keeps an in-memory subscriber map per device and pushes events when state changes.

The main design challenge was the update flow. Optimistic locking was the obvious first choice, but IoT devices don't fit that model — state can change from either side (API or directly from device), so treating both as competing writes creates unnecessary conflicts. The solution is the **desired / actual state pattern** (the same model AWS IoT Device Shadow uses): `PATCH` stores the command in a `desired` column and returns immediately without waiting for the hardware. A simulated acknowledgement fires ~1.5 s later, applies `desired` into `actual`, and broadcasts the confirmed state over SSE. The client only ever sees confirmed state.

Claude Code was used mainly for boilerplate writing and research purposes; all decisions were made by myself.

---

## API Endpoints

| Method | Path                        | Description                             |
| ------ | --------------------------- | --------------------------------------- |
| POST   | `/devices`                  | Register a new device                   |
| GET    | `/devices`                  | List all devices                        |
| GET    | `/devices/:deviceId`        | Get a specific device by ID             |
| PATCH  | `/devices/:deviceId`        | Send a command to the device            |
| DELETE | `/devices/:deviceId`        | Soft-delete a device                    |
| GET    | `/devices/:deviceId/events` | SSE stream for real-time device updates |

---

## Core Entities

```
Device
  id              uuid (PK)
  name            string
  actual          JSON  ← confirmed device state { status, configuration }
  desired         JSON  ← pending command { status?, configuration? } | null
  version         integer (incremented on every write)
  created_at      timestamp
  updated_at      timestamp
  deleted_at      timestamp (null until soft-deleted)

DeviceHistory
  device_id       uuid (FK → Device)
  version         integer
  snapshot        JSON  ← full device state at this version
  created_at      timestamp
```

**Out of scope**

- Authentication / user management — in a production system each request would carry a token validated server-side, and devices would be associated to users via a `user_devices` junction table. The API surface would be unchanged; the service layer would add ownership checks using the resolved user identity.
- Reading device history — the audit trail is written on every PATCH but there is no GET endpoint for it.

https://excalidraw.com/#json=SUIotB1Ym92ZAdviCewtB,1RlTdL2UTF_ZvRc4xrMQwg
![alt text](image.png)

---

## Running with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:8080
- API: http://localhost:3000

The SQLite database is persisted in a named Docker volume (`sqlite_data`).

---

## Running Locally

**Prerequisites:** Node.js 20+, npm

```bash
# Install dependencies
npm install

# Start backend (http://localhost:3000)
npm run dev:server

# Start frontend in a separate terminal (http://localhost:5173)
npm run dev:client
```

The database file (`db.sqlite`) is created automatically on first run.

**Testing SSE:** Open `http://localhost:5173` in two browser tabs, navigate to the same device, then save a change in one tab. Both tabs receive the live update ~1.5 s later when the simulated device acknowledges the command.

---

## Test Cases

Tests are written with Vitest, scoped to showcase different testing layers rather than achieve exhaustive coverage.

### Unit Tests — service layer with mocked dependencies

```bash
npm run test:unit
```

Each service function is tested in isolation with a mocked repository:

- `createDevice` — uses `defaultConfiguration` when none provided
- `updateDevice` — writes desired state without touching actual; increments version; defers SSE broadcast to async scheduleSync
- `deleteDevice` — sets `deleted_at`; returns 404 for unknown device
- `listDevices` — returns only non-deleted devices

### Integration Tests — full request/response against real SQLite

```bash
npm run test:integration
```

- `POST /devices` → returns device with generated uuid and `version: 0`
- `PATCH /devices/:deviceId` → accepts command, returns device with incremented version; status unchanged until device acknowledges (~1.5 s)
- `DELETE /devices/:deviceId` → subsequent `GET /devices` excludes the device

### E2E — single happy-path flow

```bash
npm run test:e2e
```

Register device → send PATCH command → assert `status` still reflects actual (unchanged) → assert version incremented → assert `DeviceHistory` row written.

### Run all tests

```bash
npm test
```
