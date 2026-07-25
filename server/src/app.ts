import Fastify from "fastify";
import cors from "@fastify/cors";
import { authMiddleware } from "./middleware/auth.ts";
import { deviceRoutes } from "./routes/devices.ts";

export function buildApp() {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });
  app.addHook("preHandler", authMiddleware);
  app.register(deviceRoutes, { prefix: "/devices" });
  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number };
    const statusCode = e.statusCode ?? 500;
    if (statusCode >= 500) {
      reply.status(statusCode).send({
        error: "InternalServerError",
        message: "Something went wrong",
      });
    } else {
      reply.status(statusCode).send({ error: e.name, message: e.message });
    }
  });
  return app;
}
