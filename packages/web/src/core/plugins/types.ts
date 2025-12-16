/**
 * Plugin system types for meshtastic-web
 * Allows adding optional JavaScript/TypeScript plugins
 */

import type React from "react";

export interface PluginMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  category: "utility" | "game" | "communication" | "monitoring" | "other";
  icon?: string;
  functions?: string[];
}

export interface PluginConfig {
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface PluginContext {
  // Meshtastic device connection
  device: {
    sendText: (text: string, channel?: number) => Promise<void>;
    getNodes: () => Promise<unknown[]>;
    getNodeInfo: (nodeId: number) => Promise<unknown>;
  };
  // Storage for plugin data
  storage: {
    get: <T>(key: string) => Promise<T | null>;
    set: <T>(key: string, value: T) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };
  // UI notifications
  notify: (message: string, type?: "info" | "success" | "error" | "warning") => void;
}

export interface Plugin {
  metadata: PluginMetadata;
  config: PluginConfig;
  
  // Initialize plugin (called when enabled)
  initialize?: (context: PluginContext) => Promise<void>;
  
  // Cleanup (called when disabled)
  cleanup?: () => Promise<void>;
  
  // Handle messages/commands
  handleMessage?: (message: string, fromNodeId: number, context: PluginContext) => Promise<string | null>;
  
  // Handle UI actions
  handleAction?: (action: string, params: Record<string, unknown>, context: PluginContext) => Promise<unknown>;
  
  // Handle position updates (optional)
  handlePosition?: (
    position: unknown,
    fromNodeId: number,
    context: PluginContext,
  ) => Promise<void | string>;

  // Handle position/telemetry updates (optional)
  handlePosition?: (position: {
    nodeId: number;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    time?: number;
  }, context: PluginContext) => Promise<void>;
  
  // Get plugin UI component (optional)
  getUIComponent?: () => React.ComponentType<{ plugin: Plugin; context: PluginContext }> | null;
  
  // Configuration schema for settings
  configSchema?: {
    [key: string]: {
      type: "string" | "number" | "boolean" | "select";
      label: string;
      description?: string;
      default?: unknown;
      options?: { label: string; value: string | number }[];
      required?: boolean;
    };
  };
}

export type PluginFactory = () => Plugin;

