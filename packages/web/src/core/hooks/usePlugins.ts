/**
 * React hook for managing internal plugins
 */

import { useEffect, useState, useCallback } from "react";
import { pluginManager } from "@core/plugins";
import type { Plugin, PluginConfig } from "@core/plugins";
import { useToast } from "@core/hooks/useToast.ts";

export function usePlugins() {
  const { toast } = useToast();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
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
        await pluginManager.updateConfig(pluginId, config);
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
    loading,
    error,
    updatePlugin,
    getPluginConfig,
    refreshPlugins: loadPlugins,
  };
}

