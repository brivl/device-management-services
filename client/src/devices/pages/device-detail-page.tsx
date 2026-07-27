import type { Device, DeviceStatus } from "@dms/common/types";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { devicesApi } from "../../api/devices";

const MODES = ["auto", "manual", "scheduled"] as const;
type Mode = (typeof MODES)[number];

type FormState = { status: DeviceStatus; brightness: number; mode: Mode };

function readBrightness(config: Record<string, unknown>): number {
  const v = config.brightness;
  return typeof v === "number" ? v : 100;
}

function readMode(config: Record<string, unknown>): Mode {
  const v = config.mode;
  return MODES.includes(v as Mode) ? (v as Mode) : "auto";
}

function formFromDevice(d: Device): FormState {
  return {
    status: d.status,
    brightness: readBrightness(d.configuration),
    mode: readMode(d.configuration),
  };
}

export function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  const [form, setForm] = useState<FormState>({
    status: "enabled",
    brightness: 100,
    mode: "auto",
  });
  const setField =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value }));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    setLoading(true);
    setFetchError(null);

    devicesApi
      .get(deviceId)
      .then((d) => {
        setDevice(d);
        setForm(formFromDevice(d));
      })
      .catch((e: unknown) =>
        setFetchError(e instanceof Error ? e.message : "Failed to load device"),
      )
      .finally(() => setLoading(false));
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;

    const es = devicesApi.events(deviceId);

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);
    es.addEventListener("device-updated", (e) => {
      const updated = JSON.parse((e as MessageEvent<string>).data) as Device;
      setDevice(updated);
      setForm(formFromDevice(updated));
    });

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, [deviceId]);

  const handleSave = async () => {
    if (!device || !deviceId) return;

    setSaving(true);
    setSaveError(null);

    try {
      await devicesApi.update(deviceId, {
        status: form.status,
        configuration: { brightness: form.brightness, mode: form.mode },
      });
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

      <Paper sx={{ p: 3 }}>
        <Box
          sx={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 2 }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              Version
            </Typography>
            <Typography>{device.version}</Typography>
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={form.status}
              label="Status"
              onChange={(e) =>
                setField("status")(e.target.value as DeviceStatus)
              }
            >
              <MenuItem value="enabled">Enabled</MenuItem>
              <MenuItem value="sleep">Sleep</MenuItem>
              <MenuItem value="off">Off</MenuItem>
            </Select>
          </FormControl>
          <Box>
            <Typography gutterBottom>Brightness: {form.brightness}%</Typography>
            <Slider
              value={form.brightness}
              onChange={(_, v) => setField("brightness")(v as number)}
              min={0}
              max={100}
              valueLabelDisplay="auto"
            />
          </Box>
          <FormControl fullWidth>
            <InputLabel>Mode</InputLabel>
            <Select
              value={form.mode}
              label="Mode"
              onChange={(e) => setField("mode")(e.target.value as Mode)}
            >
              {MODES.map((m) => (
                <MenuItem key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {saveError && <Alert severity="error">{saveError}</Alert>}
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
