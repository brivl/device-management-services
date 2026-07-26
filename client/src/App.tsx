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
import { DeviceDetailPage } from "./devices/pages/device-detail-page";
import { DeviceListPage } from "./devices/pages/device-list-page";

const theme = createTheme();

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">Device Management</Typography>
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
