import type { CreateDeviceInput, DeviceStatus } from "@dms/common/types";
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
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateDeviceInput) => Promise<void>;
};

const MODES = ["auto", "manual", "scheduled"] as const;
type Mode = (typeof MODES)[number];

type FormState = {
  name: string;
  status: DeviceStatus;
  brightness: number;
  mode: Mode;
};
const DEFAULT_FORM: FormState = {
  name: "",
  status: "enabled",
  brightness: 100,
  mode: "auto",
};

export function CreateDeviceDialog({ open, onClose, onCreate }: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: form.name.trim(),
        status: form.status,
        configuration: { brightness: form.brightness, mode: form.mode },
      });
      setForm(DEFAULT_FORM);
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
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          fullWidth
          autoFocus
        />
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            value={form.status}
            label="Status"
            onChange={(e) => set("status")(e.target.value)}
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
            onChange={(_, v) => set("brightness")(v)}
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
            onChange={(e) => set("mode")(e.target.value)}
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
          onClick={handleSubmit}
          variant="contained"
          disabled={!form.name.trim() || submitting}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
