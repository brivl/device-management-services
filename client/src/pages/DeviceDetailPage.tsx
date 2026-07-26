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
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import type { Device, DeviceStatus } from "@dms/common/types";
import { devicesApi } from "../api/devices";
import { useUser } from "../context/UserContext";

type ConfigEntry = { key: string; value: string };

function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  const n = Number(value);
  if (value.trim() !== "" && !isNaN(n)) return n;
  return value;
}

function toEntries(config: Record<string, unknown>): ConfigEntry[] {
  return Object.entries(config).map(([key, value]) => ({
    key,
    value: String(value),
  }));
}

function fromEntries(entries: ConfigEntry[]): Record<string, unknown> {
  return Object.fromEntries(
    entries
      .filter((e) => e.key.trim())
      .map(({ key, value }) => [key, coerce(value)]),
  );
}

const statusColor = (s: DeviceStatus): "success" | "warning" | "default" =>
  s === "enabled" ? "success" : s === "sleep" ? "warning" : "default";

export function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { userId } = useUser();
  const navigate = useNavigate();

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  const [editStatus, setEditStatus] = useState<DeviceStatus>("enabled");
  const [configEntries, setConfigEntries] = useState<ConfigEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!deviceId) return;
    setLoading(true);
    setFetchError(null);
    devicesApi
      .get(userId, deviceId)
      .then((d) => {
        setDevice(d);
        setEditStatus(d.status);
        setConfigEntries(toEntries(d.configuration));
      })
      .catch((e: unknown) =>
        setFetchError(e instanceof Error ? e.message : "Failed to load device"),
      )
      .finally(() => setLoading(false));
  }, [userId, deviceId]);

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

  const updateEntry = (i: number, field: keyof ConfigEntry, val: string) =>
    setConfigEntries((prev) =>
      prev.map((entry, idx) =>
        idx === i ? { ...entry, [field]: val } : entry,
      ),
    );

  const handleSave = async () => {
    if (!device || !deviceId) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await devicesApi.update(userId, deviceId, {
        status: editStatus,
        configuration: fromEntries(configEntries),
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

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Configuration
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {configEntries.map((entry, i) => (
                <Box
                  key={i}
                  sx={{ display: "flex", gap: 1, alignItems: "center" }}
                >
                  <TextField
                    size="small"
                    label="Key"
                    value={entry.key}
                    onChange={(e) => updateEntry(i, "key", e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Value"
                    value={entry.value}
                    onChange={(e) => updateEntry(i, "value", e.target.value)}
                    sx={{ flex: 2 }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() =>
                      setConfigEntries((prev) =>
                        prev.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  setConfigEntries((prev) => [...prev, { key: "", value: "" }])
                }
                sx={{ alignSelf: "flex-start" }}
              >
                Add field
              </Button>
            </Box>
          </Box>

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
