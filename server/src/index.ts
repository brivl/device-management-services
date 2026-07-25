import { buildApp } from "./app.ts";
import { seed } from "./db/seed.ts";

const app = buildApp();
await seed();
await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
console.log(`Server running on port ${process.env.PORT ?? 3000}`);
