import type { FastifyInstance } from "fastify";
import { deviceService } from "../services/device.service.ts";
import { deviceBroadcaster } from "../sse/device-broadcaster.ts";

export async function deviceRoutes(app: FastifyInstance) {
  app.post("/", {
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
    handler: async (request, reply) => {
      const body = request.body as {
        name: string;
        status: "enabled" | "sleep" | "off";
        configuration?: Record<string, unknown>;
      };
      const device = await deviceService.create(body, request.userId);
      return reply.status(201).send(device);
    },
  });

  app.get("/", async (request, reply) => {
    return reply.send(await deviceService.list(request.userId));
  });

  app.get<{ Params: { deviceId: string } }>(
    "/:deviceId",
    async (request, reply) => {
      return reply.send(
        await deviceService.get(request.params.deviceId, request.userId),
      );
    },
  );

  app.patch<{ Params: { deviceId: string } }>("/:deviceId", {
    schema: {
      body: {
        type: "object",
        required: ["version"],
        properties: {
          status: { type: "string", enum: ["enabled", "sleep", "off"] },
          configuration: { type: "object" },
          version: { type: "integer", minimum: 0 },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as {
        status?: "enabled" | "sleep" | "off";
        configuration?: Record<string, unknown>;
        version: number;
      };
      return reply.send(
        await deviceService.update(
          request.params.deviceId,
          request.userId,
          body,
        ),
      );
    },
  });

  app.delete<{ Params: { deviceId: string } }>(
    "/:deviceId",
    async (request, reply) => {
      await deviceService.delete(request.params.deviceId, request.userId);
      return reply.status(204).send();
    },
  );

  // reply.hijack() takes control of the raw socket — Fastify won't touch the response after this.
  // proxy_buffering off in nginx is required for SSE to work through a reverse proxy.
  app.get<{ Params: { deviceId: string } }>(
    "/:deviceId/events",
    async (request, reply) => {
      const { deviceId } = request.params;
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(":\n\n");
      deviceBroadcaster.subscribe(deviceId, res);
      request.raw.on("close", () =>
        deviceBroadcaster.unsubscribe(deviceId, res),
      );
    },
  );
}
