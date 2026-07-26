import { SEEDED_USERS } from "@dms/common/users";
import { db } from "./index.ts";
import { users } from "./schema.ts";

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
