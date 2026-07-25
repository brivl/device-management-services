import type { ServerResponse } from "http";

const subscribers = new Map<string, Set<ServerResponse>>();

export const deviceBroadcaster = {
  subscribe(deviceId: string, res: ServerResponse): void {
    if (!subscribers.has(deviceId)) subscribers.set(deviceId, new Set());
    subscribers.get(deviceId)!.add(res);
  },

  unsubscribe(deviceId: string, res: ServerResponse): void {
    subscribers.get(deviceId)?.delete(res);
  },

  broadcast(deviceId: string, data: unknown): void {
    const subs = subscribers.get(deviceId);
    if (!subs || subs.size === 0) return;
    const payload = `event: device-updated\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of subs) res.write(payload);
  },
};
