import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import type { CreateDeviceInput, DeviceStatus } from "@dms/common/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateDeviceInput) => Promise<void>;
};

export function CreateDeviceDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<DeviceStatus>("enabled");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({ name: name.trim(), status });
      setName("");
      setStatus("enabled");
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
