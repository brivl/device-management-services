export type DeviceStatus = "enabled" | "sleep" | "off";

export interface Device {
  id: string;
  name: string;
  status: DeviceStatus;
  configuration: Record<string, unknown>;
  version: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeviceInput {
  name: string;
  status: DeviceStatus;
  configuration?: Record<string, unknown>;
}

export interface UpdateDeviceInput {
  status?: DeviceStatus;
  configuration?: Record<string, unknown>;
  version: number;
}

const BASE = "/api/devices";

async function request<T>(
  path: string,
  userId: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message ?? res.statusText), {
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

export const devicesApi = {
  list: (userId: string) => request<Device[]>("", userId),

  get: (userId: string, id: string) => request<Device>(`/${id}`, userId),

  create: (userId: string, data: CreateDeviceInput) =>
    request<Device>("", userId, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (userId: string, id: string, data: UpdateDeviceInput) =>
    request<Device>(`/${id}`, userId, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (userId: string, id: string) =>
    fetch(`${BASE}/${id}`, {
      method: "DELETE",
      headers: { "X-User-Id": userId },
    }),

  // EventSource doesn't support custom headers; header is now optional on the server (defaults to Alice).
  events: (id: string) => new EventSource(`${BASE}/${id}/events`),
};
