import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";
import { Routes, Route } from "react-router-dom";
import { UserSwitcher } from "./components/UserSwitcher";
import { DeviceListPage } from "./pages/DeviceListPage";

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
          <Route path="/devices/:deviceId" element={<div />} />
        </Routes>
      </Box>
    </ThemeProvider>
  );
}
