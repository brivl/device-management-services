type Sender = (data: unknown) => void;

const subscribers = new Map<string, Set<Sender>>();

export const deviceBroadcaster = {
  subscribe(deviceId: string, sender: Sender): void {
    if (!subscribers.has(deviceId)) subscribers.set(deviceId, new Set());
    subscribers.get(deviceId)!.add(sender);
  },

  unsubscribe(deviceId: string, sender: Sender): void {
    subscribers.get(deviceId)?.delete(sender);
  },

  broadcast(deviceId: string, data: unknown): void {
    const subs = subscribers.get(deviceId);
    if (!subs || subs.size === 0) return;
    for (const sender of subs) sender(data);
  },
};
