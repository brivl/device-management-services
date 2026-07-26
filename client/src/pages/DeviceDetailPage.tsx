import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import type { Device, DeviceStatus } from "@dms/common/types";
import { devicesApi } from "../api/devices";
import { useUser } from "../context/UserContext";

const statusColor = (s: DeviceStatus): "success" | "warning" | "default" =>
  s === "enabled" ? "success" : s === "sleep" ? "warning" : "default";

export function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { userId } = useUser();
  const navigate = useNavigate();

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // SSE
  const [sseConnected, setSseConnected] = useState(false);

  // Edit form — initialised from device on first load; SSE updates don't reset it
  const [editStatus, setEditStatus] = useState<DeviceStatus>("enabled");
  const [editConfig, setEditConfig] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch on mount / userId change
  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    setFetchError(null);
    devicesApi
      .get(userId, deviceId)
      .then((d) => {
        setDevice(d);
        setEditStatus(d.status);
        setEditConfig(JSON.stringify(d.configuration, null, 2));
      })
      .catch((e: unknown) =>
        setFetchError(e instanceof Error ? e.message : "Failed to load device"),
      )
      .finally(() => setLoading(false));
  }, [userId, deviceId]);

  // SSE subscription — updates device state only, preserving form edits
  useEffect(() => {
    if (!deviceId) return;
    const es = devicesApi.events(deviceId);
    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);
    es.addEventListener("device-updated", (e) => {
      const updated = JSON.parse((e as MessageEvent<string>).data) as Device;
      setDevice(updated);
    });
    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [deviceId]);

  const handleSave = async () => {
    if (!device || !deviceId) return;

    let configuration: Record<string, unknown>;
    try {
      configuration = JSON.parse(editConfig) as Record<string, unknown>;
    } catch {
      setConfigError("Invalid JSON");
      return;
    }
    setConfigError(null);
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await devicesApi.update(userId, deviceId, {
        status: editStatus,
        configuration,
        version: device.version,
      });
      setDevice(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (fetchError) return <Alert severity="error">{fetchError}</Alert>;
  if (!device) return null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate("/")}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {device.name}
        </Typography>
        <Tooltip
          title={
            sseConnected ? "Live updates active" : "Live updates disconnected"
          }
        >
          {sseConnected ? (
            <WifiIcon color="success" />
          ) : (
            <WifiOffIcon color="disabled" />
          )}
        </Tooltip>
      </Box>

      {/* Info */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Box mt={0.5}>
              <Chip
                label={device.status}
                color={statusColor(device.status)}
                size="small"
              />
            </Box>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Version
            </Typography>
            <Typography fontWeight={500}>{device.version}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Created
            </Typography>
            <Typography variant="body2">
              {new Date(device.createdAt).toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Last updated
            </Typography>
            <Typography variant="body2">
              {new Date(device.updatedAt).toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Edit form */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Edit
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={editStatus}
              label="Status"
              onChange={(e) => setEditStatus(e.target.value as DeviceStatus)}
            >
              <MenuItem value="enabled">Enabled</MenuItem>
              <MenuItem value="sleep">Sleep</MenuItem>
              <MenuItem value="off">Off</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Configuration (JSON)"
            value={editConfig}
            onChange={(e) => {
              setEditConfig(e.target.value);
              setConfigError(null);
            }}
            multiline
            rows={6}
            fullWidth
            error={!!configError}
            helperText={configError}
            slotProps={{
              input: { sx: { fontFamily: "monospace", fontSize: 13 } },
            }}
          />
          {saveError && <Alert severity="error">{saveError}</Alert>}
          {saveSuccess && <Alert severity="success">Saved successfully</Alert>}
          <Box>
            <Button
              variant="contained"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
