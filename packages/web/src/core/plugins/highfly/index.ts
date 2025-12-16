/**
 * High-Fly Alert Plugin
 * Alerts when nodes report high altitude positions.
 */

import type { Plugin, PluginContext } from "../types";
import { pluginStorage } from "../storage";

type HighFlyEvent = {
  nodeId: number;
  altitudeM: number;
  altitudeFt: number;
  latitude?: number;
  longitude?: number;
  timestamp: string;
};

type HighFlyConfig = {
  enabled: boolean;
  settings: {
    altitudeThresholdM: number;
    ignoreList: string[];
    throttleMinutes: number;
    alertSubscribers: string[]; // node IDs (as strings) that want DM alerts
  };
};

export function createHighFlyPlugin(): Plugin {
  return {
    metadata: {
      id: "highfly",
      name: "High-Fly Alert",
      description: "Alerts when nodes report high altitude positions.",
      version: "1.0.0",
      category: "monitoring",
      functions: ["highfly on", "highfly off", "highfly recent"],
    },
    config: {
      enabled: false,
      settings: {
        altitudeThresholdM: 2000, // default 2000m
        ignoreList: [],
        throttleMinutes: 30,
        alertSubscribers: [],
      },
    },
    configSchema: {
      altitudeThresholdM: {
        type: "number",
        label: "Altitude Threshold (m)",
        description: "Altitude in meters to trigger high-fly alert.",
        default: 2000,
      },
      throttleMinutes: {
        type: "number",
        label: "Alert Throttle (minutes)",
        description: "Minimum minutes between alerts per node.",
        default: 30,
      },
      ignoreList: {
        type: "string",
        label: "Ignore List (comma-separated node IDs)",
        description: "Node IDs to ignore for high-fly alerts.",
        default: "",
      },
    },
    async initialize() {
      // Ensure storage buckets exist
      const events = await pluginStorage.get<HighFlyEvent[]>("highfly", "events");
      if (!events) {
        await pluginStorage.set("highfly", "events", []);
      }
      const config = await pluginStorage.get<HighFlyConfig>("highfly", "config");
      if (!config) {
        await pluginStorage.set("highfly", "config", {
          enabled: false,
          settings: {
            altitudeThresholdM: 2000,
            ignoreList: [],
            throttleMinutes: 30,
            alertSubscribers: [],
          },
        });
      }
    },
    async handleMessage(message: string, fromNodeId: number) {
      const lower = message.toLowerCase().trim();

      // Opt-in for DM alerts
      if (lower === "highfly on" || lower === "highfly alerts on") {
        const config =
          (await pluginStorage.get<HighFlyConfig>("highfly", "config")) || {
            enabled: true,
            settings: {
              altitudeThresholdM: 2000,
              ignoreList: [],
              throttleMinutes: 30,
              alertSubscribers: [],
            },
          };
        const subscribers = new Set(config.settings.alertSubscribers || []);
        subscribers.add(String(fromNodeId));
        config.settings.alertSubscribers = Array.from(subscribers);
        await pluginStorage.set("highfly", "config", config);
        return "High-fly alerts: enabled for this node.";
      }

      // Opt-out for DM alerts
      if (lower === "highfly off" || lower === "highfly alerts off") {
        const config =
          (await pluginStorage.get<HighFlyConfig>("highfly", "config")) || {
            enabled: true,
            settings: {
              altitudeThresholdM: 2000,
              ignoreList: [],
              throttleMinutes: 30,
              alertSubscribers: [],
            },
          };
        config.settings.alertSubscribers = (config.settings.alertSubscribers || []).filter(
          (id) => id !== String(fromNodeId),
        );
        await pluginStorage.set("highfly", "config", config);
        return "High-fly alerts: disabled for this node.";
      }

      // Show recent high-fly nodes
      if (lower === "highfly recent") {
        const events =
          (await pluginStorage.get<HighFlyEvent[]>("highfly", "events")) || [];
        if (events.length === 0) {
          return "No high-fly alerts yet.";
        }
        const latest = events.slice(0, 5);
        const lines = latest.map(
          (e) =>
            `Node ${e.nodeId}: ${e.altitudeFt.toLocaleString()}ft (${e.altitudeM.toLocaleString()}m) @ ${new Date(e.timestamp).toLocaleString()}`,
        );
        return `Recent high-fly alerts (${latest.length}):\n${lines.join("\n")}`;
      }

      return null;
    },
    async handlePosition(position: unknown, fromNodeId: number, context: PluginContext) {
      const pos: any = position;
      const nodeId = fromNodeId || pos?.from || pos?.num || 0;
      const altitudeM = pos?.data?.altitude ?? pos?.altitude ?? 0;
      const latitude = pos?.data?.latitude ?? pos?.latitude;
      const longitude = pos?.data?.longitude ?? pos?.longitude;

      if (!nodeId || !altitudeM) return;

      const storedConfig =
        (await pluginStorage.get<HighFlyConfig>("highfly", "config")) || {
          enabled: true,
          settings: {
            altitudeThresholdM: 2000,
            ignoreList: [],
            throttleMinutes: 30,
            alertSubscribers: [],
          },
        };
      const { altitudeThresholdM, ignoreList, throttleMinutes } = storedConfig.settings;

      // Ignore list
      if (ignoreList.includes(String(nodeId))) return;

      // Threshold check
      if (altitudeM <= altitudeThresholdM) return;

      // Throttle
      const events = (await pluginStorage.get<HighFlyEvent[]>("highfly", "events")) || [];
      const lastEvent = events.find((e) => e.nodeId === nodeId);
      if (lastEvent) {
        const lastTs = new Date(lastEvent.timestamp).getTime();
        const now = Date.now();
        if (now - lastTs < throttleMinutes * 60_000) {
          return;
        }
      }

      const altitudeFt = Math.round(altitudeM * 3.28084);
      const event: HighFlyEvent = {
        nodeId,
        altitudeM,
        altitudeFt,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      };

      // Persist event
      const updatedEvents = [event, ...events].slice(0, 50); // keep last 50
      await pluginStorage.set("highfly", "events", updatedEvents);

      // Notify via broadcast
      const msg = `🚀 High-fly alert: Node ${nodeId} at ${altitudeFt.toLocaleString()}ft (${altitudeM.toLocaleString()}m)`;
      try {
        await context.device.sendText(msg);
      } catch (error) {
        console.error("[HighFly] Failed to send alert message:", error);
      }

      // Notify subscribers via DM
      const subscribers = storedConfig.settings.alertSubscribers || [];
      for (const sub of subscribers) {
        const subId = Number(sub);
        if (!Number.isFinite(subId) || subId <= 0) continue;
        try {
          await context.device.sendText(
            `🚀 High-fly alert: Node ${nodeId} at ${altitudeFt.toLocaleString()}ft (${altitudeM.toLocaleString()}m)`,
            subId,
          );
        } catch (error) {
          console.error("[HighFly] Failed to DM subscriber:", error);
        }
      }
    },
  };
}

