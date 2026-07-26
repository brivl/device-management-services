export type DeviceStatus = "enabled" | "sleep" | "off";

export type Device = {
  id: string;
  name: string;
  status: DeviceStatus;
  configuration: Record<string, unknown>;
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
