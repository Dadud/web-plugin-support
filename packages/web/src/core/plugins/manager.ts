/**
 * Plugin manager - handles plugin lifecycle and state
 */

import { pluginRegistry } from "./registry";
import { pluginStorage } from "./storage";
import type { Plugin, PluginContext, PluginConfig } from "./types";

class PluginManager {
  private activePlugins = new Map<string, Plugin>();
  private pluginConfigs = new Map<string, PluginConfig>();

  /**
   * Initialize plugin manager - load saved configurations
   */
  async initialize(): Promise<void> {
    // Load saved plugin configurations
    const savedConfigs = await pluginStorage.get<Record<string, PluginConfig>>(
      "system",
      "plugin_configs",
    );
    if (savedConfigs) {
      for (const [id, config] of Object.entries(savedConfigs)) {
        this.pluginConfigs.set(id, config);
      }
    }

    // Initialize enabled plugins
    for (const [id, config] of this.pluginConfigs.entries()) {
      if (config.enabled) {
        await this.enablePlugin(id);
      }
    }
  }

  /**
   * Get plugin configuration
   */
  getConfig(pluginId: string): PluginConfig | null {
    return this.pluginConfigs.get(pluginId) || null;
  }

  /**
   * Update plugin configuration
   */
  async updateConfig(pluginId: string, config: Partial<PluginConfig>): Promise<void> {
    const current = this.pluginConfigs.get(pluginId) || {
      enabled: false,
      settings: {},
    };
    const updated = { ...current, ...config };
    this.pluginConfigs.set(pluginId, updated);

    // Persist configuration
    const allConfigs: Record<string, PluginConfig> = {};
    for (const [id, cfg] of this.pluginConfigs.entries()) {
      allConfigs[id] = cfg;
    }
    await pluginStorage.set("system", "plugin_configs", allConfigs);

    // Update plugin instance config
    const plugin = this.activePlugins.get(pluginId);
    if (plugin) {
      plugin.config = updated;
    }

    // Enable/disable plugin if needed
    if (updated.enabled && !this.activePlugins.has(pluginId)) {
      await this.enablePlugin(pluginId);
    } else if (!updated.enabled && this.activePlugins.has(pluginId)) {
      await this.disablePlugin(pluginId);
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string, context?: PluginContext): Promise<void> {
    if (this.activePlugins.has(pluginId)) {
      return; // Already enabled
    }

    const plugin = pluginRegistry.create(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Get or create config
    const config = this.pluginConfigs.get(pluginId) || {
      enabled: true,
      settings: {},
    };
    plugin.config = config;

    // Create default context if not provided
    const defaultContext: PluginContext = context || {
      device: {
        sendText: async () => {},
        getNodes: async () => [],
        getNodeInfo: async () => ({}),
      },
      storage: {
        get: async () => null,
        set: async () => {},
        remove: async () => {},
      },
      notify: () => {},
    };

    // Initialize plugin
    if (plugin.initialize) {
      await plugin.initialize(defaultContext);
    }

    this.activePlugins.set(pluginId, plugin);
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.activePlugins.get(pluginId);
    if (!plugin) {
      return; // Already disabled
    }

    if (plugin.cleanup) {
      await plugin.cleanup();
    }

    this.activePlugins.delete(pluginId);
  }

  /**
   * Get all available plugins
   */
  getAllPlugins(): Plugin[] {
    return pluginRegistry.getAll();
  }

  /**
   * Get active (enabled) plugins
   */
  getActivePlugins(): Plugin[] {
    return Array.from(this.activePlugins.values());
  }

  /**
   * Check if a plugin is enabled
   */
  isEnabled(pluginId: string): boolean {
    return this.activePlugins.has(pluginId);
  }

  /**
   * Handle a message through plugins
   */
  async handleMessage(
    message: string,
    fromNodeId: number,
    context: PluginContext,
  ): Promise<string | null> {
    if (this.activePlugins.size === 0) return null;

    for (const plugin of this.activePlugins.values()) {
      if (plugin.handleMessage) {
        try {
          const response = await plugin.handleMessage(message, fromNodeId, context);
          if (response) {
            return response;
          }
        } catch (error) {
          console.error(`[PluginManager] Error in plugin ${plugin.metadata.id}:`, error);
        }
      }
    }
    return null;
  }

  /**
   * Handle a position update through plugins
   */
  async handlePosition(
    position: unknown,
    fromNodeId: number,
    context: PluginContext,
  ): Promise<string | null> {
    if (this.activePlugins.size === 0) {
      return null;
    }

    for (const plugin of this.activePlugins.values()) {
      if (plugin.handlePosition) {
        try {
          const response = await plugin.handlePosition(position, fromNodeId, context);
          if (typeof response === "string") {
            return response;
          }
        } catch (error) {
          console.error(`[PluginManager] Error in handlePosition for ${plugin.metadata.id}:`, error);
        }
      }
    }
    return null;
  }

}

// Singleton instance
export const pluginManager = new PluginManager();

