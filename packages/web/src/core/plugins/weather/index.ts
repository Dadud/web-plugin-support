/**
 * Weather Plugin (browser-only, DM-first)
 * Commands (DM to host node):
 * - weather help
 * - weather now
 * - weather forecast
 * - weather alerts
 * - weather location <lat> <lon>
 * - weather daily on | off
 * - weather alerts on | off
 * - weather senddaily   (send forecast to subscribers)
 */

import type { Plugin, PluginContext } from "../types";
import { pluginStorage } from "../storage";

type WeatherConfig = {
  enabled: boolean;
  settings: {
    latitude: number;
    longitude: number;
    units: "metric" | "imperial";
    dailyEnabled: boolean;
    alertsEnabled: boolean;
    subscribers: string[];
  };
};

type PositionEntry = {
  nodeId: number;
  latitude: number;
  longitude: number;
  timestamp: string;
};

type PlaceEntry = {
  latKey: string;
  lonKey: string;
  name: string; // town/city/county/state as available
  timestamp: string;
};

type ForecastEntry = {
  time: string;
  tempC: number;
  tempF: number;
  summary: string;
  rainChance?: number;
};

type WeatherAlert = {
  id: string;
  event: string;
  description: string;
  starts: string;
  ends: string;
};

const DEFAULT_CONFIG: WeatherConfig = {
  enabled: false,
  settings: {
    latitude: 40.0,
    longitude: -105.0,
    units: "metric",
    dailyEnabled: false,
    alertsEnabled: true,
    subscribers: [],
  },
};

async function ensureConfig(): Promise<WeatherConfig> {
  const cfg = (await pluginStorage.get<WeatherConfig>("weather", "config")) || DEFAULT_CONFIG;
  return {
    enabled: cfg.enabled ?? false,
    settings: {
      latitude: cfg.settings?.latitude ?? DEFAULT_CONFIG.settings.latitude,
      longitude: cfg.settings?.longitude ?? DEFAULT_CONFIG.settings.longitude,
      units: (cfg.settings?.units as "metric" | "imperial") ?? "metric",
      dailyEnabled: cfg.settings?.dailyEnabled ?? false,
      alertsEnabled: cfg.settings?.alertsEnabled ?? true,
      subscribers: cfg.settings?.subscribers ?? [],
    },
  };
}

function formatTemp(tempC: number, units: "metric" | "imperial") {
  if (units === "imperial") {
    const f = tempC * 9 / 5 + 32;
    return `${f.toFixed(0)}°F`;
  }
  return `${tempC.toFixed(0)}°C`;
}

async function fetchWeather(lat: number, lon: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation_probability` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max` +
    `&current_weather=true&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  return res.json();
}

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "meshtastic-web-weather-plugin",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const addr = data?.address || {};
  // Prefer town/city/village, then county, then state
  const place =
    addr.town ||
    addr.city ||
    addr.village ||
    addr.hamlet ||
    addr.county ||
    addr.state ||
    null;
  return place;
}

async function getPlaceName(lat: number, lon: number): Promise<string> {
  const latKey = lat.toFixed(3);
  const lonKey = lon.toFixed(3);
  const key = `${latKey},${lonKey}`;
  const cache = (await pluginStorage.get<PlaceEntry[]>("weather", "places")) || [];
  const found = cache.find((p) => p.latKey === latKey && p.lonKey === lonKey);
  if (found && isFresh(found.timestamp, 24 * 60)) {
    return found.name;
  }
  const place = (await reverseGeocode(lat, lon)) || key;
  const updated = [{ latKey, lonKey, name: place, timestamp: new Date().toISOString() }, ...cache].slice(
    0,
    200,
  );
  await pluginStorage.set("weather", "places", updated);
  return place;
}

function weatherCodeToSummary(code: number): string {
  const map: Record<number, string> = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Heavy freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Showers",
    82: "Heavy showers",
    85: "Light snow showers",
    86: "Snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm w/ hail",
    99: "Severe thunderstorm w/ hail",
  };
  return map[code] ?? `Code ${code}`;
}

async function getForecast(config: WeatherConfig): Promise<{
  current: string;
  daily: ForecastEntry[];
  rainChance: number;
  locationLabel: string;
}> {
  const data = await fetchWeather(config.settings.latitude, config.settings.longitude);
  const units = config.settings.units;
  const currentTempC = data.current_weather?.temperature ?? 0;
  const currentSummary = weatherCodeToSummary(data.current_weather?.weathercode ?? 0);
  const hourlyRain = Array.isArray(data.hourly?.precipitation_probability)
    ? data.hourly.precipitation_probability[0] ?? 0
    : 0;
  const dailyRain = Array.isArray(data.daily?.precipitation_probability_max)
    ? data.daily.precipitation_probability_max[0] ?? 0
    : 0;
  const rainChance = Math.max(
    Number.isFinite(hourlyRain) ? hourlyRain : 0,
    Number.isFinite(dailyRain) ? dailyRain : 0,
  );
  const current = `${currentSummary}, ${formatTemp(currentTempC, units)}, rain ${rainChance.toFixed(0)}%`;
  const placeName = await getPlaceName(config.settings.latitude, config.settings.longitude);
  const locationLabel = placeName || `${config.settings.latitude.toFixed(3)},${config.settings.longitude.toFixed(3)}`;

  const daily: ForecastEntry[] = [];
  const days = data.daily?.time?.length ?? 0;
  for (let i = 0; i < Math.min(days, 3); i++) {
    const maxC = data.daily.temperature_2m_max[i];
    const minC = data.daily.temperature_2m_min[i];
    const code = data.daily.weathercode[i];
    const dayRain = data.daily.precipitation_probability_max?.[i] ?? 0;
    daily.push({
      time: data.daily.time[i],
      tempC: maxC,
      tempF: maxC * 9 / 5 + 32,
      summary: `${weatherCodeToSummary(code)} (H ${formatTemp(maxC, units)}, L ${formatTemp(minC, units)})`,
      rainChance: Number.isFinite(dayRain) ? dayRain : undefined,
    });
  }
  return { current, daily, rainChance, locationLabel };
}

function buildDailyMessage(
  daily: ForecastEntry[],
  units: "metric" | "imperial",
  locationLabel: string,
) {
  const lines = daily.map((d) => {
    const rain = d.rainChance !== undefined ? `, rain ${d.rainChance.toFixed(0)}%` : "";
    return `${d.time}: ${d.summary}${rain}`;
  });
  return `Forecast @ ${locationLabel}:\n${lines.join("\n")}`;
}

function isFresh(ts: string, maxMinutes = 60): boolean {
  if (!ts) return false;
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return false;
  const diff = Date.now() - then;
  return diff < maxMinutes * 60_000;
}

async function cachePosition(nodeId: number, lat: number, lon: number) {
  const positions = (await pluginStorage.get<PositionEntry[]>("weather", "positions")) || [];
  const now = new Date().toISOString();
  const updated = [{ nodeId, latitude: lat, longitude: lon, timestamp: now }, ...positions].reduce<
    PositionEntry[]
  >((acc, cur) => {
    if (acc.find((p) => p.nodeId === cur.nodeId)) return acc;
    acc.push(cur);
    return acc;
  }, []);
  // keep last 200 entries
  await pluginStorage.set("weather", "positions", updated.slice(0, 200));
}

async function getNodePosition(nodeId: number): Promise<PositionEntry | null> {
  const positions = (await pluginStorage.get<PositionEntry[]>("weather", "positions")) || [];
  const found = positions.find((p) => p.nodeId === nodeId);
  if (!found) return null;
  if (!isFresh(found.timestamp)) return null;
  return found;
}

function parseLatLon(args: string[]): { lat: number; lon: number } | null {
  if (args.length < 2) return null;
  const lat = Number(args[0]);
  const lon = Number(args[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function createWeatherPlugin(): Plugin {
  return {
    metadata: {
      id: "weather",
      name: "Weather",
      description: "Weather lookup and daily alerts.",
      version: "1.0.0",
      category: "utility",
      functions: [
        "weather help",
        "weather now",
        "weather forecast",
        "weather alerts",
        "weather location <lat> <lon>",
        "weather here",
        "weather node <id>",
        "weather daily on/off",
        "weather alerts on/off",
        "weather senddaily",
        "weather subscribe",
        "weather unsubscribe",
      ],
    },
    config: DEFAULT_CONFIG,
    configSchema: {
      latitude: {
        type: "number",
        label: "Latitude",
        description: "Latitude for weather.",
        default: 40.0,
      },
      longitude: {
        type: "number",
        label: "Longitude",
        description: "Longitude for weather.",
        default: -105.0,
      },
      units: {
        type: "select",
        label: "Units",
        description: "metric or imperial.",
        default: "metric",
        options: [
          { label: "Metric (°C)", value: "metric" },
          { label: "Imperial (°F)", value: "imperial" },
        ],
      },
      dailyEnabled: {
        type: "boolean",
        label: "Daily alerts enabled",
        description: "Whether daily alerts are enabled (manual send).",
        default: false,
      },
      alertsEnabled: {
        type: "boolean",
        label: "Weather alerts enabled",
        description: "If available from provider (not guaranteed).",
        default: true,
      },
    },
    async initialize() {
      const cfg = await ensureConfig();
      await pluginStorage.set("weather", "config", cfg);
      const forecasts = await pluginStorage.get<ForecastEntry[]>("weather", "forecasts");
      if (!forecasts) {
        await pluginStorage.set("weather", "forecasts", []);
      }
      const alerts = await pluginStorage.get<WeatherAlert[]>("weather", "alerts");
      if (!alerts) {
        await pluginStorage.set("weather", "alerts", []);
      }
      const positions = await pluginStorage.get<PositionEntry[]>("weather", "positions");
      if (!positions) {
        await pluginStorage.set("weather", "positions", []);
      }
    const places = await pluginStorage.get<PlaceEntry[]>("weather", "places");
    if (!places) {
      await pluginStorage.set("weather", "places", []);
    }
    },
    async handleMessage(message: string, fromNodeId: number, context: PluginContext) {
      const lower = message.toLowerCase().trim();
      if (!lower.startsWith("weather")) return null;
      const parts = message.trim().split(/\s+/).slice(1);
      const cmd = (parts[0] || "").toLowerCase();
      const args = parts.slice(1);

      const cfg = await ensureConfig();

      const reply = async (text: string) => {
        try {
          await context.device.sendText(text, fromNodeId);
        } catch (e) {
          console.error("[Weather] Failed to DM:", e);
        }
      };

      // HELP
      if (!cmd || cmd === "help") {
        return [
          "weather help",
          "weather now",
          "weather forecast",
          "weather alerts",
          "weather location <lat> <lon>",
          "weather daily on/off",
          "weather alerts on/off",
          "weather senddaily",
        ].join("\n");
      }

      // LOCATION
      if (cmd === "location") {
        if (args.length < 2) return "Usage: weather location <lat> <lon>";
        const lat = Number(args[0]);
        const lon = Number(args[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "Invalid lat/lon";
        cfg.settings.latitude = lat;
        cfg.settings.longitude = lon;
        await pluginStorage.set("weather", "config", cfg);
        return `Location set to ${lat.toFixed(3)}, ${lon.toFixed(3)}`;
      }

      // DAILY ON/OFF
      if (cmd === "daily") {
        const val = (args[0] || "").toLowerCase();
        if (val !== "on" && val !== "off") return "Usage: weather daily on|off";
        cfg.settings.dailyEnabled = val === "on";
        await pluginStorage.set("weather", "config", cfg);
        return `Daily alerts ${val}`;
      }

      // ALERTS ON/OFF
      if (cmd === "alerts") {
        const val = (args[0] || "").toLowerCase();
        if (!val) {
          // If just "weather alerts" show cached alerts
          const alerts = (await pluginStorage.get<WeatherAlert[]>("weather", "alerts")) || [];
          if (alerts.length === 0) return "No weather alerts.";
          const lines = alerts.slice(0, 5).map((a) => `${a.event} (${a.starts} - ${a.ends})`);
          return `Weather alerts:\n${lines.join("\n")}`;
        }
        if (val !== "on" && val !== "off") return "Usage: weather alerts on|off";
        cfg.settings.alertsEnabled = val === "on";
        await pluginStorage.set("weather", "config", cfg);
        return `Weather alerts ${val}`;
      }

      // HERE (use sender's last known position)
      if (cmd === "here") {
        const pos = await getNodePosition(fromNodeId);
        if (!pos) return "No recent position for your node. Send a position first.";
        cfg.settings.latitude = pos.latitude;
        cfg.settings.longitude = pos.longitude;
        await pluginStorage.set("weather", "config", cfg);
        try {
          const { current, daily, locationLabel } = await getForecast(cfg);
          await pluginStorage.set("weather", "forecasts", daily);
          return `Weather @ ${locationLabel}: ${current}`;
        } catch (e) {
          return `Weather error: ${(e as Error).message}`;
        }
      }

      // NODE <id>
      if (cmd === "node") {
        const nodeStr = args[0];
        const nodeId = Number(nodeStr);
        if (!Number.isFinite(nodeId) || nodeId <= 0) return "Usage: weather node <id>";
        const pos = await getNodePosition(nodeId);
        if (!pos) return "No recent position for that node.";
        cfg.settings.latitude = pos.latitude;
        cfg.settings.longitude = pos.longitude;
        await pluginStorage.set("weather", "config", cfg);
        try {
          const { current, daily, locationLabel } = await getForecast(cfg);
          await pluginStorage.set("weather", "forecasts", daily);
          return `Weather @ ${locationLabel}: ${current}`;
        } catch (e) {
          return `Weather error: ${(e as Error).message}`;
        }
      }

      // NOW
      if (cmd === "now") {
        try {
          const { current, daily, locationLabel } = await getForecast(cfg);
          await pluginStorage.set("weather", "forecasts", daily);
          return `Weather @ ${locationLabel}: ${current}`;
        } catch (e) {
          return `Weather error: ${(e as Error).message}`;
        }
      }

      // FORECAST
      if (cmd === "forecast") {
        try {
          const { daily, locationLabel } = await getForecast(cfg);
          await pluginStorage.set("weather", "forecasts", daily);
          return buildDailyMessage(daily, cfg.settings.units, locationLabel);
        } catch (e) {
          return `Weather error: ${(e as Error).message}`;
        }
      }

      // SEND DAILY (manual broadcast to subscribers)
      if (cmd === "senddaily") {
        if (!cfg.settings.dailyEnabled) return "Daily alerts are off. Enable with: weather daily on";
        try {
          const { daily, locationLabel } = await getForecast(cfg);
          const msg = buildDailyMessage(daily, cfg.settings.units, locationLabel);
          const subs = cfg.settings.subscribers || [];
          for (const sub of subs) {
            const subId = Number(sub);
            if (!Number.isFinite(subId) || subId <= 0) continue;
            try {
              await context.device.sendText(msg, subId);
            } catch (err) {
              console.error("[Weather] Failed to DM subscriber:", err);
            }
          }
          return `Sent daily forecast to ${subs.length} subscriber(s).`;
        } catch (e) {
          return `Weather error: ${(e as Error).message}`;
        }
      }

      // SUBSCRIBE / UNSUBSCRIBE
      if (cmd === "subscribe") {
        const subs = new Set(cfg.settings.subscribers || []);
        subs.add(String(fromNodeId));
        cfg.settings.subscribers = Array.from(subs);
        await pluginStorage.set("weather", "config", cfg);
        return "Subscribed to daily weather alerts.";
      }
      if (cmd === "unsubscribe") {
        cfg.settings.subscribers = (cfg.settings.subscribers || []).filter(
          (s) => s !== String(fromNodeId),
        );
        await pluginStorage.set("weather", "config", cfg);
        return "Unsubscribed from daily weather alerts.";
      }

      return "Unknown command. Try: weather help";
    },
    async handlePosition(position: unknown, fromNodeId: number) {
      const pos: any = position;
      const lat = pos?.data?.latitude ?? pos?.latitude;
      const lon = pos?.data?.longitude ?? pos?.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      await cachePosition(fromNodeId, lat, lon);
    },
  };
}

