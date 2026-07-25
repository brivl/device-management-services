# Device Management API

Overview:

Welcome to the future of home automation! Your mission is to build a backend system acting as the central hub for managing IoT devices in a smart home environment. These IoT devices might include anything from smart lights to thermostats or security cameras. Your task is to create a **RESTful web API** that allows users to manage these devices, monitor their status, and control them remotely.
This task is designed to test your ability to design and implement a backend system with a focus on RESTful APIs, managing state, **handling real-time data in an IoT context**, and demonstrating how this system may be deployed.

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

Requirements:
• Use any backend technology stack you are comfortable with (e.g., Node.js, Python, Ruby, etc.).
• Use any form of data storage (in-memory database, relational database, file storage, etc.) to manage device state and **history**.
• Write clean, maintainable code with appropriate documentation and QA.
• Include error handling for common edge cases (e.g., invalid device IDs, bad input data).
• Stretch Goal: Add a front-end to display a list of IoT devices
• We do not necessarily discourage the use of AI, but you must be able to talk in depth about your decisions and technical implementation.

---

## Tech Stack

| Layer      | Technology              |
| ---------- | ----------------------- |
| Backend    | TypeScript + Fastify    |
| ORM        | Drizzle ORM             |
| Database   | SQLite                  |
| Frontend   | React + MUI             |
| Testing    | Vitest                  |
| Deployment | Docker + Docker Compose |

---

## Architecture & Key Design Decisions

**Auth simulation** — User creation and auth are out of scope. At startup, 2–3 users are seeded into the DB. All requests require an `X-User-Id` header; a Fastify `preHandler` validates it against seeded users and attaches the user to the request context. The React UI provides a user-switcher in the top bar — open two browser windows with different users to observe SSE updates live.

**Soft deletes** — Devices are never hard-deleted. `DELETE /devices/:deviceId` sets `deleted_at`; all list and detail endpoints filter `WHERE deleted_at IS NULL`.

**Optimistic locking** — `PATCH` requires a `version` field in the body matching the current DB version. On mismatch the server returns `409 Conflict`. On success, version is incremented and a `DeviceHistory` snapshot is written.

**Device History** — Every successful `PATCH` writes a full JSON snapshot of the device state to `DeviceHistory`. Reading history is out of scope (no GET endpoint), but the audit trail is persisted for future use.

**Real-time updates (SSE)** — The server holds an in-memory `Map<deviceId, Set<Response>>`. On successful PATCH, all subscribers of that device receive a `device-updated` event.

**Configuration** — Stored as a JSON column, making it flexible across device types (lights, thermostats, cameras) without schema migrations. Defaults to `defaultConfiguration` if not provided on create.

---

## API Endpoints

| Method | Path                        | Description                              |
| ------ | --------------------------- | ---------------------------------------- |
| POST   | `/devices`                  | Register a new device                    |
| GET    | `/devices`                  | List all devices for the requesting user |
| GET    | `/devices/:deviceId`        | Get a specific device by ID              |
| PATCH  | `/devices/:deviceId`        | Update device status or configuration    |
| DELETE | `/devices/:deviceId`        | Soft-delete a device                     |
| GET    | `/devices/:deviceId/events` | SSE stream for real-time device updates  |

### Request / Response shapes

**POST /devices**

```json
// Request
{ "name": "Living Room Light", "status": "enabled", "configuration": { "brightness": 80 } }

// Response 201
{ "id": "uuid", "name": "Living Room Light", "status": "enabled", "configuration": { "brightness": 80 }, "version": 0, "createdAt": "..." }
```

**PATCH /devices/:deviceId**

```json
// Request — version is required for optimistic locking
{ "status": "off", "version": 2 }

// Response 200
{ "id": "uuid", ..., "version": 3 }

// Response 409 — version mismatch
{ "error": "Conflict", "message": "Device was updated by someone else, please refresh." }
```

---

## Core Entities

```
Device
  id              uuid (PK)
  name            string
  status          'enabled' | 'sleep' | 'off'
  configuration   JSON
  version         integer (starts at 0, incremented on each PATCH)
  created_at      timestamp
  updated_at      timestamp
  deleted_at      timestamp (null until soft-deleted)

DeviceHistory
  device_id       uuid (FK → Device)
  version         integer
  snapshot        JSON  ← full device state at this version
  created_at      timestamp

User
  id              uuid (PK)
  name            string
  created_at      timestamp

User_Device
  user_id         uuid (FK → User)
  device_id       uuid (FK → Device)
```

**Out of scope (assumed to exist)**

- User creation & authentication
- User–device connection management
- Reading device history

https://excalidraw.com/#json=4nrLcnWo0jYhfGh7Xc7xv,cdptIrjryoad1Ov_3QaAqA
![alt text](image.png)

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

The database file (`db.sqlite`) is created automatically on first run. Seeded user IDs are printed to the console on startup — use them in the UI user-switcher.

**Testing multi-user SSE:** Open `http://localhost:5173` in two browser windows. Select different users in the top bar. Make a change in one window and watch it update live in the other.

---

## Running in Docker

**Prerequisites:** Docker + Docker Compose

```bash
# Build and start all services
docker compose up --build

# Frontend → http://localhost:5173
# Backend  → http://localhost:3000
```

```bash
# Stop and remove containers
docker compose down
```

The SQLite database is persisted in a Docker volume so data survives container restarts.

---

## Test Cases

Tests are written with Vitest, scoped to showcase different testing layers rather than achieve exhaustive coverage.

### Unit Tests — service layer with mocked dependencies

```bash
npm run test:unit
```

Each service function is tested in isolation with a mocked repository:

- `createDevice` — uses `defaultConfiguration` when none provided
- `updateDevice` — returns conflict error on version mismatch; increments version and calls SSE broadcaster on success
- `deleteDevice` — sets `deleted_at`; returns 404 for unknown or unowned device
- `listDevices` — excludes soft-deleted devices

### Integration Tests — full request/response against real SQLite

```bash
npm run test:integration
```

- `POST /devices` → returns device with generated uuid and `version: 0`
- `PATCH /devices/:deviceId` with stale version → `409 Conflict`
- `DELETE /devices/:deviceId` → subsequent `GET /devices` excludes the device

### E2E — single happy-path flow

```bash
npm run test:e2e
```

Register device → update status → assert version incremented → assert `DeviceHistory` row written.

### Run all tests

```bash
npm test
```
