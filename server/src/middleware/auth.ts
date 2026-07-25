import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

// Auth simulation: validates X-User-Id against seeded users in the DB.
// In a real system this would verify a JWT or session token.
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = request.headers["x-user-id"] as string | undefined;
  if (!userId) {
    return reply
      .status(401)
      .send({ error: "Unauthorized", message: "X-User-Id header required" });
  }
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    return reply
      .status(401)
      .send({ error: "Unauthorized", message: "User not found" });
  }
  request.userId = userId;
}
