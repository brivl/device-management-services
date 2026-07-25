import { db } from "./index.js";
import { users } from "./schema.js";

export const SEEDED_USERS = [
  { id: "user-alice-0000-0000-000000000001", name: "Alice" },
  { id: "user-bob-00000-0000-000000000002", name: "Bob" },
  { id: "user-carol-000-0000-000000000003", name: "Carol" },
];

export async function seed() {
  for (const user of SEEDED_USERS) {
    db.insert(users)
      .values({ ...user, createdAt: new Date().toISOString() })
      .onConflictDoNothing()
      .run();
  }
  console.log("Seeded users:");
  SEEDED_USERS.forEach((u) => console.log(`  ${u.name}: ${u.id}`));
}
