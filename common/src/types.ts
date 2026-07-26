export type DeviceStatus = "enabled" | "sleep" | "off";

export type DesiredState = {
  status?: DeviceStatus;
  configuration?: Record<string, unknown>;
};

export type Device = {
  id: string;
  name: string;
  status: DeviceStatus;
  configuration: Record<string, unknown>;
  desired: DesiredState | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateDeviceInput = {
  name: string;
  status: DeviceStatus;
  configuration?: Record<string, unknown>;
};

export type UpdateDeviceInput = {
  status?: DeviceStatus;
  configuration?: Record<string, unknown>;
  version: number;
};
