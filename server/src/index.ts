import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { buildApp } from "./app.ts";
import { db } from "./db/index.ts";
import { seed } from "./db/seed.ts";

migrate(db, { migrationsFolder: "./drizzle" });
const app = buildApp();
await seed();
await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
console.log(`Server running on port ${process.env.PORT ?? 3000}`);
