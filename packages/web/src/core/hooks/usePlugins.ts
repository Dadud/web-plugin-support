/**
 * React hook for managing internal plugins
 */

import { useEffect, useState, useCallback } from "react";
import { pluginManager } from "@core/plugins";
import type { Plugin, PluginConfig } from "@core/plugins";
import { useToast } from "@core/hooks/useToast.ts";
import {
  fetchManifest,
  loadRemotePlugin,
  loadEnabledRemotePlugins,
  setEnabledRemote,
  type ManifestPlugin,
} from "@core/services/pluginCatalog.ts";

export function usePlugins() {
  const { toast } = useToast();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [manifest, setManifest] = useState<ManifestPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const manifestUrl =
    (import.meta as { env?: Record<string, string> }).env?.VITE_PLUGINS_MANIFEST_URL || "";

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // If manifest URL provided, fetch and load enabled remote plugins first
      if (manifestUrl) {
        const remote = await fetchManifest(manifestUrl);
        setManifest(remote);
        await loadEnabledRemotePlugins(remote);
      }
      const allPlugins = pluginManager.getAllPlugins();
      setPlugins(allPlugins);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load plugins";
      setError(message);
      console.error("Failed to load plugins:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePlugin = useCallback(
    async (pluginId: string, config: Partial<PluginConfig>) => {
      try {
        // If enabling a remote plugin not yet loaded, load and register it
        if (config.enabled) {
          const alreadyLoaded = pluginManager.getConfig(pluginId) !== null || pluginManager.isEnabled(pluginId);
          const isInManifest = manifest.some((m) => m.id === pluginId);
          if (!alreadyLoaded && isInManifest) {
            const entry = manifest.find((m) => m.id === pluginId);
            if (entry) {
              await loadRemotePlugin(entry);
            }
          }
        }

        await pluginManager.updateConfig(pluginId, config);

        // Track enabled remote plugins
        const enabledRemote = (await pluginManager.getConfig(pluginId))?.enabled;
        if (manifest.some((m) => m.id === pluginId)) {
          const enabledList = new Set(await (await import("@core/services/pluginCatalog.ts")).getEnabledRemote());
          if (config.enabled) {
            enabledList.add(pluginId);
          } else {
            enabledList.delete(pluginId);
          }
          await setEnabledRemote(Array.from(enabledList));
        }

        const updated = pluginManager.getAllPlugins().find((p) => p.metadata.id === pluginId);
        if (updated) {
          toast({
            title: "Plugin Updated",
            description: `${updated.metadata.name} has been ${config.enabled ? "enabled" : "disabled"}.`,
          });
        }
        await loadPlugins();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update plugin";
        toast({
          title: "Error",
          description: message,
        });
        throw err;
      }
    },
    [toast, loadPlugins],
  );

  const getPluginConfig = useCallback(
    (pluginId: string): PluginConfig | null => {
      return pluginManager.getConfig(pluginId);
    },
    [],
  );

  useEffect(() => {
    loadPlugins();
    // Initialize plugin manager if not already done
    pluginManager.initialize().catch(console.error);
  }, [loadPlugins]);

  return {
    plugins,
    manifest,
    loading,
    error,
    updatePlugin,
    getPluginConfig,
    refreshPlugins: loadPlugins,
    manifestUrl,
  };
}

