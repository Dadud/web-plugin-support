/**
 * React hook for external plugin management.
 * Only use this when VITE_MESHING_AROUND_ENABLED is true.
 */

import { meshingAroundApi, MeshingAroundApiError } from "@core/services/meshingAroundApi.ts";
import type {
  PluginInfo,
  PluginStatus,
  PluginConfigUpdate,
} from "@core/services/meshingAroundApi.ts";
import { useToast } from "@core/hooks/useToast.ts";
import { useCallback, useEffect, useState } from "react";

export function useMeshingAround() {
  const { toast } = useToast();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [pluginStatuses, setPluginStatuses] = useState<
    Record<string, PluginStatus>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const pluginList = await meshingAroundApi.getPlugins();
      setPlugins(pluginList);

      // Load status for all plugins
      const statuses: Record<string, PluginStatus> = {};
      for (const plugin of pluginList) {
        try {
          const status = await meshingAroundApi.getPluginStatus(plugin.id);
          statuses[plugin.id] = status;
        } catch (err) {
          console.error(`Failed to load status for ${plugin.id}:`, err);
        }
      }
      setPluginStatuses(statuses);
    } catch (err) {
      const message =
        err instanceof MeshingAroundApiError
          ? err.message
          : "Failed to load plugins";
      setError(message);
      console.error("Failed to load plugins:", err);
    } finally {
      setLoading(false);
    }
  }, []);


  const updatePlugin = useCallback(
    async (pluginId: string, config: PluginConfigUpdate) => {
      try {
        const updated = await meshingAroundApi.updatePlugin(pluginId, config);
        setPluginStatuses((prev) => ({
          ...prev,
          [pluginId]: updated,
        }));
        toast({
          title: "Plugin Updated",
          description: `${updated.name} has been ${config.enabled ? "enabled" : "disabled"}.`,
        });
        return updated;
      } catch (err) {
        const message =
          err instanceof MeshingAroundApiError
            ? err.message
            : "Failed to update plugin";
        toast({
          title: "Error",
          description: message,
        });
        throw err;
      }
    },
    [toast, loadBotStatus],
  );

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  return {
    plugins,
    pluginStatuses,
    loading,
    error,
    updatePlugin,
    refreshPlugins: loadPlugins,
  };
}

