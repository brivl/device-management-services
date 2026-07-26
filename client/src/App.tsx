import {
  AppBar,
  Box,
  CssBaseline,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import { Route, Routes } from "react-router-dom";
import { UserSwitcher } from "./devices/components/user-switcher";
import { DeviceDetailPage } from "./devices/pages/device-detail-page";
import { DeviceListPage } from "./devices/pages/device-list-page";

const theme = createTheme();

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Device Management
          </Typography>
          <UserSwitcher />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: 3 }}>
        <Routes>
          <Route path="/" element={<DeviceListPage />} />
          <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
        </Routes>
      </Box>
    </ThemeProvider>
  );
}
