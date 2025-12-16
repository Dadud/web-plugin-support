/**
 * Alerts Plugin - Earthquakes (global via USGS) + NOAA severe/tsunami (US-only, CORS-friendly).
 * Commands (DM to host node):
 * - alerts help
 * - alerts quake [minMag]
 * - alerts severe
 * - alerts tsunami
 * - alerts subscribe
 * - alerts unsubscribe
 *
 * Notes:
 * - Earthquakes: USGS global feed (CORS OK)
 * - Severe/Tsunami: NOAA api.weather.gov (US-centric, CORS OK)
 * - Volcano/global alerts not added due to CORS/provider limits
 */

import type { Plugin } from "../types";
import { pluginStorage } from "../storage";

type AlertEntry = {
  id: string;
  title: string;
  summary: string;
  severity?: string;
  event?: string;
  region?: string;
  magnitude?: number;
  url?: string;
  ts: string;
};

type AlertsConfig = {
  enabled: boolean;
  settings: {
    minMag: number;
    subscribers: string[];
  };
};

const DEFAULT_CONFIG: AlertsConfig = {
  enabled: false,
  settings: {
    minMag: 4.5,
    subscribers: [],
  },
};

async function ensureConfig(): Promise<AlertsConfig> {
  const cfg = (await pluginStorage.get<AlertsConfig>("alerts", "config")) || DEFAULT_CONFIG;
  return {
    enabled: cfg.enabled ?? false,
    settings: {
      minMag: cfg.settings?.minMag ?? DEFAULT_CONFIG.settings.minMag,
      subscribers: cfg.settings?.subscribers ?? [],
    },
  };
}

async function fetchUSGSEarthquakes(minMag: number): Promise<AlertEntry[]> {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USGS fetch failed: ${res.status}`);
  const data = await res.json();
  const feats = Array.isArray(data.features) ? data.features : [];
  return feats
    .map((f: any) => {
      const mag = f?.properties?.mag ?? 0;
      if (!Number.isFinite(mag) || mag < minMag) return null;
      return {
        id: String(f?.id ?? crypto.randomUUID()),
        title: f?.properties?.title ?? "Earthquake",
        summary: f?.properties?.place ?? "",
        severity: "earthquake",
        event: "earthquake",
        magnitude: mag,
        url: f?.properties?.url,
        ts: new Date(f?.properties?.time ?? Date.now()).toISOString(),
      } as AlertEntry;
    })
    .filter(Boolean) as AlertEntry[];
}

async function fetchNOAAAlerts(eventFilter?: string): Promise<AlertEntry[]> {
  const base = "https://api.weather.gov/alerts/active?status=actual&message_type=alert";
  const url = eventFilter ? `${base}&event=${encodeURIComponent(eventFilter)}` : base;
  const res = await fetch(url, {
    headers: { "User-Agent": "meshtastic-web-alerts" },
  });
  if (!res.ok) throw new Error(`NOAA fetch failed: ${res.status}`);
  const data = await res.json();
  const feats = Array.isArray(data.features) ? data.features : [];
  return feats.slice(0, 20).map((f: any) => {
    const props = f?.properties || {};
    return {
      id: props.id || props.guid || crypto.randomUUID(),
      title: props.headline || props.event || "Weather Alert",
      summary: props.description || props.instruction || "",
      severity: props.severity,
      event: props.event,
      region: props.areaDesc,
      url: props.uri,
      ts: props.effective || props.onset || new Date().toISOString(),
    } as AlertEntry;
  });
}

async function saveAlerts(entries: AlertEntry[]) {
  const sorted = entries
    .filter((e) => !!e.id)
    .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))
    .slice(0, 100);
  await pluginStorage.set("alerts", "entries", sorted);
}

function shortAlertLine(a: AlertEntry): string {
  const sev = a.severity ? `${a.severity}: ` : "";
  const mag = a.magnitude ? `M${a.magnitude.toFixed(1)} ` : "";
  const loc = a.region || a.summary || "";
  return `${sev}${mag}${a.title}${loc ? ` - ${loc}` : ""}`;
}

export function createAlertsPlugin(): Plugin {
  return {
    metadata: {
      id: "alerts",
      name: "Alerts",
      description: "Earthquakes (global) + NOAA severe/tsunami (US).",
      version: "1.0.0",
      category: "monitoring",
      functions: [
        "alerts help",
        "alerts quake [minMag]",
        "alerts severe",
        "alerts tsunami",
        "alerts subscribe",
        "alerts unsubscribe",
      ],
    },
    config: DEFAULT_CONFIG,
    configSchema: {
      minMag: {
        type: "number",
        label: "Min Magnitude (quakes)",
        description: "Minimum magnitude to include in quake alerts.",
        default: 4.5,
      },
    },
    async initialize() {
      const cfg = await ensureConfig();
      await pluginStorage.set("alerts", "config", cfg);
      const entries = await pluginStorage.get<AlertEntry[]>("alerts", "entries");
      if (!entries) {
        await pluginStorage.set("alerts", "entries", []);
      }
    },
    async handleMessage(message: string, fromNodeId: number, context: PluginContext) {
      const lower = message.toLowerCase().trim();
      if (!lower.startsWith("alerts")) return null;
      const parts = message.trim().split(/\s+/).slice(1);
      const cmd = (parts[0] || "").toLowerCase();
      const args = parts.slice(1);

      const cfg = await ensureConfig();

      const reply = async (text: string) => {
        try {
          await context.device.sendText(text, fromNodeId);
        } catch (e) {
          console.error("[Alerts] Failed to DM:", e);
        }
      };

      // HELP
      if (!cmd || cmd === "help") {
        return [
          "alerts quake [minMag]",
          "alerts severe",
          "alerts tsunami",
          "alerts subscribe",
          "alerts unsubscribe",
        ].join("\n");
      }

      // SUBSCRIBE
      if (cmd === "subscribe") {
        const subs = new Set(cfg.settings.subscribers || []);
        subs.add(String(fromNodeId));
        cfg.settings.subscribers = Array.from(subs);
        await pluginStorage.set("alerts", "config", cfg);
        return "Subscribed to alerts.";
      }
      // UNSUBSCRIBE
      if (cmd === "unsubscribe") {
        cfg.settings.subscribers = (cfg.settings.subscribers || []).filter(
          (s) => s !== String(fromNodeId),
        );
        await pluginStorage.set("alerts", "config", cfg);
        return "Unsubscribed from alerts.";
      }

      // QUAKES
      if (cmd === "quake") {
        const minMag = args.length ? Number(args[0]) : cfg.settings.minMag;
        const effectiveMag = Number.isFinite(minMag) ? minMag : cfg.settings.minMag;
        try {
          const quakes = await fetchUSGSEarthquakes(effectiveMag);
          await saveAlerts(quakes);
          if (quakes.length === 0) return `No recent quakes >= M${effectiveMag}`;
          const lines = quakes.slice(0, 5).map(shortAlertLine);
          return [`Quakes (>=M${effectiveMag}):`, ...lines].join("\n");
        } catch (e) {
          return `Quake error: ${(e as Error).message}`;
        }
      }

      // SEVERE (NOAA)
      if (cmd === "severe") {
        try {
          const alerts = await fetchNOAAAlerts();
          await saveAlerts(alerts);
          if (alerts.length === 0) return "No active severe alerts (NOAA).";
          const lines = alerts.slice(0, 5).map(shortAlertLine);
          return ["Severe alerts (NOAA):", ...lines].join("\n");
        } catch (e) {
          return `Severe error: ${(e as Error).message}`;
        }
      }

      // TSUNAMI (NOAA event filter)
      if (cmd === "tsunami") {
        try {
          const alerts = await fetchNOAAAlerts("Tsunami");
          await saveAlerts(alerts);
          if (alerts.length === 0) return "No active tsunami alerts (NOAA).";
          const lines = alerts.slice(0, 5).map(shortAlertLine);
          return ["Tsunami alerts (NOAA):", ...lines].join("\n");
        } catch (e) {
          return `Tsunami error: ${(e as Error).message}`;
        }
      }

      return "Unknown command. Try: alerts help";
    },
  };
}

