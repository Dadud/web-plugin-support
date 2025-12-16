/**
 * API client for the optional plugin management backend.
 * This service is optional and only used when VITE_MESHING_AROUND_ENABLED is true.
 */

// Use relative URL when proxied through Vite, or absolute URL if configured
const API_BASE_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_MESHING_AROUND_API_URL || "";

export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  full_description: string;
  file_path: string;
  category: string;
  functions: string[];
  config_section?: string;
  enabled_key?: string;
}

export interface PluginStatus {
  plugin_id: string;
  name: string;
  status: "enabled" | "disabled" | "error" | "unknown";
  enabled: boolean;
  config_section?: string;
  settings: Record<string, unknown>;
}

// BotStatus removed - this service only manages config, not bot process

export interface PluginConfigUpdate {
  enabled: boolean;
  settings?: Record<string, unknown>;
}

class MeshingAroundApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response,
  ) {
    super(message);
    this.name = "MeshingAroundApiError";
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new MeshingAroundApiError(
        `API request failed: ${response.statusText}`,
        response.status,
        response,
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof MeshingAroundApiError) {
      throw error;
    }
    // Network error or CORS issue
    throw new MeshingAroundApiError(
      `Failed to connect to plugin API: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export const meshingAroundApi = {
  /**
   * Get list of all available plugins.
   */
  async getPlugins(): Promise<PluginInfo[]> {
    return fetchApi<PluginInfo[]>("/api/plugins");
  },

  /**
   * Get status and configuration for a specific plugin.
   */
  async getPluginStatus(pluginId: string): Promise<PluginStatus> {
    return fetchApi<PluginStatus>(`/api/plugins/${pluginId}`);
  },

  /**
   * Update plugin configuration.
   */
  async updatePlugin(
    pluginId: string,
    config: PluginConfigUpdate,
  ): Promise<PluginStatus> {
    return fetchApi<PluginStatus>(`/api/plugins/${pluginId}`, {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },

  // Note: Bot control removed - this service only manages config files
  // Run any external service separately if needed
};

export { MeshingAroundApiError };

