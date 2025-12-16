/**
 * Plugin storage - handles persistence of plugin data and configuration
 */

const STORAGE_PREFIX = "meshtastic_plugin_";

export class PluginStorage {
  /**
   * Get plugin data from localStorage
   */
  async get<T>(pluginId: string, key: string): Promise<T | null> {
    try {
      const storageKey = `${STORAGE_PREFIX}${pluginId}_${key}`;
      const item = localStorage.getItem(storageKey);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Failed to get storage for ${pluginId}/${key}:`, error);
      return null;
    }
  }

  /**
   * Set plugin data in localStorage
   */
  async set<T>(pluginId: string, key: string, value: T): Promise<void> {
    try {
      const storageKey = `${STORAGE_PREFIX}${pluginId}_${key}`;
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to set storage for ${pluginId}/${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove plugin data from localStorage
   */
  async remove(pluginId: string, key: string): Promise<void> {
    try {
      const storageKey = `${STORAGE_PREFIX}${pluginId}_${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`Failed to remove storage for ${pluginId}/${key}:`, error);
    }
  }

  /**
   * Get all keys for a plugin
   */
  getKeys(pluginId: string): string[] {
    const keys: string[] = [];
    const prefix = `${STORAGE_PREFIX}${pluginId}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keys.push(key.replace(prefix, ""));
      }
    }
    return keys;
  }

  /**
   * Clear all data for a plugin
   */
  async clear(pluginId: string): Promise<void> {
    const keys = this.getKeys(pluginId);
    for (const key of keys) {
      await this.remove(pluginId, key);
    }
  }
}

export const pluginStorage = new PluginStorage();

