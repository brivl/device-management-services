import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export const SEEDED_USERS = [
  { id: "user-alice-0000-0000-000000000001", name: "Alice" },
  { id: "user-bob-00000-0000-000000000002", name: "Bob" },
  { id: "user-carol-000-0000-000000000003", name: "Carol" },
] as const;

interface UserContextValue {
  userId: string;
  userName: string;
  setUserId: (id: string) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(SEEDED_USERS[0].id);
  const userName = SEEDED_USERS.find((u) => u.id === userId)?.name ?? "Unknown";

  return (
    <UserContext.Provider value={{ userId, userName, setUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
