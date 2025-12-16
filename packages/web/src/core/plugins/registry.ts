/**
 * Plugin registry - manages all available plugins
 */

import type { Plugin, PluginFactory } from "./types";

class PluginRegistry {
  private plugins = new Map<string, PluginFactory>();

  /**
   * Register a plugin factory
   */
  register(id: string, factory: PluginFactory): void {
    if (this.plugins.has(id)) {
      console.warn(`Plugin ${id} is already registered, overwriting...`);
    }
    this.plugins.set(id, factory);
  }

  /**
   * Get all registered plugin factories
   */
  getAllFactories(): Map<string, PluginFactory> {
    return new Map(this.plugins);
  }

  /**
   * Get a plugin instance by ID
   */
  create(id: string): Plugin | null {
    const factory = this.plugins.get(id);
    if (!factory) {
      return null;
    }
    return factory();
  }

  /**
   * Get all plugin instances
   */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values()).map((factory) => factory());
  }

  /**
   * Check if a plugin is registered
   */
  has(id: string): boolean {
    return this.plugins.has(id);
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();

