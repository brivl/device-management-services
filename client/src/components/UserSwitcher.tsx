import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { SEEDED_USERS, useUser } from "../context/UserContext";

export function UserSwitcher() {
  const { userId, setUserId } = useUser();

  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel id="user-switcher-label">User</InputLabel>
      <Select
        labelId="user-switcher-label"
        value={userId}
        label="User"
        onChange={(e) => setUserId(e.target.value)}
      >
        {SEEDED_USERS.map((u) => (
          <MenuItem key={u.id} value={u.id}>
            {u.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
