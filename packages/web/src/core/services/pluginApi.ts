/**
 * API client for an optional plugin management backend.
 * Uses feature flag VITE_MESHING_AROUND_ENABLED to stay disabled by default.
 */

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

export interface PluginConfigUpdate {
  enabled: boolean;
  settings?: Record<string, unknown>;
}

export class PluginApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response,
  ) {
    super(message);
    this.name = "PluginApiError";
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
      throw new PluginApiError(
        `API request failed: ${response.statusText}`,
        response.status,
        response,
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof PluginApiError) {
      throw error;
    }
    throw new PluginApiError(
      `Failed to connect to plugin API: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export const pluginApi = {
  async getPlugins(): Promise<PluginInfo[]> {
    return fetchApi<PluginInfo[]>("/api/plugins");
  },

  async getPluginStatus(pluginId: string): Promise<PluginStatus> {
    return fetchApi<PluginStatus>(`/api/plugins/${pluginId}`);
  },

  async updatePlugin(
    pluginId: string,
    config: PluginConfigUpdate,
  ): Promise<PluginStatus> {
    return fetchApi<PluginStatus>(`/api/plugins/${pluginId}`, {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },
};

