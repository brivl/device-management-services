import { SEEDED_USERS } from "@dms/common/users";
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

type UserContextValue = {
  userId: string;
  userName: string;
  setUserId: (id: string) => void;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string>(SEEDED_USERS[0].id);
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
