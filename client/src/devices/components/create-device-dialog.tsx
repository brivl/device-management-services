import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
} from "@mui/material";
import type { CreateDeviceInput, DeviceStatus } from "@dms/common/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateDeviceInput) => Promise<void>;
};

const MODES = ["auto", "manual", "scheduled"] as const;
type Mode = (typeof MODES)[number];

export function CreateDeviceDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<DeviceStatus>("enabled");
  const [brightness, setBrightness] = useState(100);
  const [mode, setMode] = useState<Mode>("auto");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        status,
        configuration: { brightness, mode },
      });
      setName("");
      setStatus("enabled");
      setBrightness(100);
      setMode("auto");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Device</DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          pt: "16px !important",
        }}
      >
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          autoFocus
        />
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            value={status}
            label="Status"
            onChange={(e) => setStatus(e.target.value as DeviceStatus)}
          >
            <MenuItem value="enabled">Enabled</MenuItem>
            <MenuItem value="sleep">Sleep</MenuItem>
            <MenuItem value="off">Off</MenuItem>
          </Select>
        </FormControl>
        <Box>
          <Typography gutterBottom>Brightness: {brightness}%</Typography>
          <Slider
            value={brightness}
            onChange={(_, v) => setBrightness(v as number)}
            min={0}
            max={100}
            valueLabelDisplay="auto"
          />
        </Box>
        <FormControl fullWidth>
          <InputLabel>Mode</InputLabel>
          <Select
            value={mode}
            label="Mode"
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            {MODES.map((m) => (
              <MenuItem key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={!name.trim() || submitting}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
