import type { FastifyInstance } from "fastify";
import type {
  Device,
  CreateDeviceInput,
  UpdateDeviceInput,
} from "@dms/common/types";
import { deviceService } from "../services/device.service.ts";
import { deviceBroadcaster } from "../sse/device-broadcaster.ts";

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
      },
    },
    async (request, reply) => {
      const device = await deviceService.create(request.body, request.userId);
      return reply.status(201).send(device);
    },
  );

  app.get<{ Reply: Device[] }>("/", async (request, reply) => {
    return reply.send(await deviceService.list(request.userId));
  });

  app.get<{ Params: { deviceId: string }; Reply: Device }>(
    "/:deviceId",
    async (request, reply) => {
      return reply.send(
        await deviceService.get(request.params.deviceId, request.userId),
      );
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
      },
    },
    async (request, reply) => {
      return reply.send(
        await deviceService.update(
          request.params.deviceId,
          request.userId,
          request.body,
        ),
      );
    },
  );

  app.delete<{ Params: { deviceId: string } }>(
    "/:deviceId",
    async (request, reply) => {
      await deviceService.delete(request.params.deviceId, request.userId);
      return reply.status(204).send();
    },
  );

  app.get<{ Params: { deviceId: string } }>(
    "/:deviceId/events",
    { sse: "only" },
    async (request, reply) => {
      const { deviceId } = request.params;
      reply.sse.keepAlive();
      const sender = (data: unknown) =>
        reply.sse.send({ event: "device-updated", data });
      deviceBroadcaster.subscribe(deviceId, sender);
      reply.sse.onClose(() => deviceBroadcaster.unsubscribe(deviceId, sender));
    },
  );
}
