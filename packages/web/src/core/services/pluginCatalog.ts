/**
 * Remote plugin catalog loader.
 * Reads manifest from VITE_PLUGINS_MANIFEST_URL (JSON array).
 */

import type { PluginMetadata } from "@core/plugins";

export interface RemotePluginManifestEntry {
  id: string;
  name: string;
  description?: string;
  version?: string;
  category?: PluginMetadata["category"];
  bundleUrl: string;
  functions?: string[];
  enabledByDefault?: boolean;
}

export async function fetchRemoteManifest(): Promise<RemotePluginManifestEntry[]> {
  const url = (import.meta as { env?: Record<string, string> }).env?.VITE_PLUGINS_MANIFEST_URL;
  if (!url) return [];
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "meshtastic-web-plugin-catalog",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch plugin manifest: ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => {
      if (!entry?.id || !entry?.bundleUrl || !entry?.name) return null;
      return {
        id: String(entry.id),
        name: String(entry.name),
        description: entry.description ? String(entry.description) : "",
        version: entry.version ? String(entry.version) : "0.0.0",
        category: entry.category ?? "other",
        bundleUrl: String(entry.bundleUrl),
        functions: Array.isArray(entry.functions) ? entry.functions.map(String) : [],
        enabledByDefault: Boolean(entry.enabledByDefault),
      } as RemotePluginManifestEntry;
    })
    .filter(Boolean) as RemotePluginManifestEntry[];
}
/**
 * Remote plugin catalog loader
 * Allows fetching a manifest and dynamically importing plugin bundles.
 */

import { pluginRegistry } from "@core/plugins";
import { pluginManager } from "@core/plugins";
import { pluginStorage } from "@core/plugins/storage";
import type { Plugin, PluginFactory } from "@core/plugins";

export interface ManifestPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  bundleUrl: string;
  enabledByDefault?: boolean;
}

const ENABLED_KEY = "enabled_remote_plugins";

function isValidPlugin(entry: Partial<ManifestPlugin>): entry is ManifestPlugin {
  return Boolean(entry.id && entry.name && entry.bundleUrl && entry.version);
}

export async function fetchManifest(
  manifestUrl?: string,
): Promise<ManifestPlugin[]> {
  if (!manifestUrl) return [];
  try {
    const res = await fetch(manifestUrl, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Manifest fetch failed: ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter(isValidPlugin);
  } catch (error) {
    console.error("[pluginCatalog] Failed to fetch manifest:", error);
    return [];
  }
}

export async function loadRemotePlugin(manifest: ManifestPlugin): Promise<Plugin | null> {
  // Prevent duplicate registration
  if (pluginRegistry.has(manifest.id)) {
    return pluginRegistry.create(manifest.id);
  }

  try {
    const mod = await import(/* @vite-ignore */ manifest.bundleUrl);
    const factory: PluginFactory | undefined = mod?.default || mod?.createPlugin;
    if (typeof factory !== "function") {
      console.error(`[pluginCatalog] Plugin bundle missing factory for ${manifest.id}`);
      return null;
    }
    pluginRegistry.register(manifest.id, factory);
    const plugin = factory();
    // Ensure config exists/enabled if marked default
    if (manifest.enabledByDefault) {
      await pluginManager.updateConfig(manifest.id, { enabled: true });
    }
    return plugin;
  } catch (error) {
    console.error(`[pluginCatalog] Failed to load remote plugin ${manifest.id}:`, error);
    return null;
  }
}

export async function getEnabledRemote(): Promise<string[]> {
  return (await pluginStorage.get<string[]>("remoteCatalog", ENABLED_KEY)) || [];
}

export async function setEnabledRemote(ids: string[]): Promise<void> {
  await pluginStorage.set("remoteCatalog", ENABLED_KEY, ids);
}

export async function loadEnabledRemotePlugins(
  manifest: ManifestPlugin[],
): Promise<void> {
  const enabled = await getEnabledRemote();
  for (const id of enabled) {
    const entry = manifest.find((m) => m.id === id);
    if (!entry) continue;
    await loadRemotePlugin(entry);
    await pluginManager.updateConfig(entry.id, { enabled: true });
  }
}

