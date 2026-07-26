export const SEEDED_USERS = [
  { id: "user-alice-0000-0000-000000000001", name: "Alice" },
  { id: "user-bob-00000-0000-000000000002", name: "Bob" },
  { id: "user-carol-000-0000-000000000003", name: "Carol" },
] as const;

export type SeededUser = (typeof SEEDED_USERS)[number];
