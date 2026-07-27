import type {
  CreateDeviceInput,
  Device,
  UpdateDeviceInput,
} from "@dms/common/types";
import type { FastifyInstance } from "fastify";
import { deviceService } from "./device.service.ts";
import { deviceBroadcaster } from "../sse/device-broadcaster.ts";

const deviceSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    status: { type: "string", enum: ["enabled", "sleep", "off"] },
    configuration: { type: "object" },
    version: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
};

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
  },
};

export async function deviceRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateDeviceInput; Reply: Device }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "status"],
          properties: {
            name: { type: "string", minLength: 1 },
            status: { type: "string", enum: ["enabled", "sleep", "off"] },
            configuration: { type: "object" },
          },
        },
        response: {
          201: deviceSchema,
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const device = await deviceService.create(request.body);
      return reply.status(201).send(device);
    },
  );

  app.get<{ Reply: Device[] }>(
    "/",
    {
      schema: {
        response: {
          200: { type: "array", items: deviceSchema },
        },
      },
    },
    async (_request, reply) => {
      return reply.send(await deviceService.list());
    },
  );

  app.get<{ Params: { deviceId: string }; Reply: Device }>(
    "/:deviceId",
    {
      schema: {
        response: {
          200: deviceSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      return reply.send(await deviceService.get(request.params.deviceId));
    },
  );

  app.patch<{
    Params: { deviceId: string };
    Body: UpdateDeviceInput;
    Reply: Device;
  }>(
    "/:deviceId",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["enabled", "sleep", "off"] },
            configuration: { type: "object" },
          },
        },
        response: {
          200: deviceSchema,
          400: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      return reply.send(
        await deviceService.update(request.params.deviceId, request.body),
      );
    },
  );

  app.delete<{ Params: { deviceId: string } }>(
    "/:deviceId",
    {
      schema: {
        response: {
          204: { type: "null" },
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      await deviceService.delete(request.params.deviceId);
      return reply.status(204).send();
    },
  );

  app.get<{ Params: { deviceId: string } }>(
    "/:deviceId/events",
    { sse: "only" },
    async (request, reply) => {
      const { deviceId } = request.params;
      reply.sse.keepAlive();
      reply.sse.sendHeaders(); // commit SSE headers so EventSource.onopen fires
      const sender = (data: unknown) =>
        void reply.sse.send({ event: "device-updated", data });
      deviceBroadcaster.subscribe(deviceId, sender);
      reply.sse.onClose(() => deviceBroadcaster.unsubscribe(deviceId, sender));
    },
  );
}
