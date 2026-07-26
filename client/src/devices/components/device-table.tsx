import type { Device, DeviceStatus } from "@dms/common/types";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { Link } from "react-router-dom";

type Props = {
  devices: Device[];
  loading: boolean;
  onDelete: (id: string) => Promise<void>;
};

const statusColor = (s: DeviceStatus): "success" | "warning" | "default" =>
  s === "enabled" ? "success" : s === "sleep" ? "warning" : "default";

export function DeviceTable({ devices, loading, onDelete }: Props) {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Version</TableCell>
          <TableCell>Configuration</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {devices.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} align="center">
              No devices yet
            </TableCell>
          </TableRow>
        )}
        {devices.map((device) => (
          <TableRow key={device.id} hover>
            <TableCell>
              <Link
                to={`/devices/${device.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  fontWeight: 500,
                }}
              >
                {device.name}
              </Link>
            </TableCell>
            <TableCell>
              <Chip
                label={device.status}
                color={statusColor(device.status)}
                size="small"
              />
            </TableCell>
            <TableCell>{device.version}</TableCell>
            <TableCell
              sx={{
                fontFamily: "monospace",
                fontSize: 12,
                maxWidth: 300,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {JSON.stringify(device.configuration)}
            </TableCell>
            <TableCell align="right">
              <IconButton
                size="small"
                color="error"
                onClick={() => void onDelete(device.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
