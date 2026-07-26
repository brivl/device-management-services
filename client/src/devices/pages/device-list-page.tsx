import type { CreateDeviceInput, Device } from "@dms/common/types";
import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { devicesApi } from "../../api/devices";
import { CreateDeviceDialog } from "../components/create-device-dialog";
import { DeviceTable } from "../components/device-table";

export function DeviceListPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDevices(await devicesApi.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  const handleCreate = async (data: CreateDeviceInput) => {
    await devicesApi.create(data);
    setCreateOpen(false);
    void fetchDevices();
  };

  const handleDelete = async (id: string) => {
    await devicesApi.delete(id);
    void fetchDevices();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5">Devices</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Add Device
        </Button>
      </Box>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      <DeviceTable
        devices={devices}
        loading={loading}
        onDelete={handleDelete}
      />
      <CreateDeviceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </Box>
  );
}
