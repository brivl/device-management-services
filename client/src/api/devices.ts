import type {
  Device,
  CreateDeviceInput,
  UpdateDeviceInput,
} from "@dms/common/types";

export type { Device, CreateDeviceInput, UpdateDeviceInput };

const BASE = "/api/devices";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
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
  list: () => request<Device[]>(""),

  get: (id: string) => request<Device>(`/${id}`),

  create: (data: CreateDeviceInput) =>
    request<Device>("", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateDeviceInput) =>
    request<Device>(`/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: async (id: string) => {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok)
      throw Object.assign(new Error(res.statusText), { status: res.status });
  },

  events: (id: string) => new EventSource(`${BASE}/${id}/events`),
};
