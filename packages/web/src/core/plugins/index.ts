/**
 * Plugin system entry point
 * Registers all available plugins
 */

import { pluginRegistry } from "./registry";
import { createChecklistPlugin } from "./checklist/index";
import { createHighFlyPlugin } from "./highfly/index";
import { createBbsPlugin } from "./bbs/index";
import { createWeatherPlugin } from "./weather/index";
import { createAlertsPlugin } from "./alerts/index";

// Register all plugins
pluginRegistry.register("checklist", createChecklistPlugin);
pluginRegistry.register("highfly", createHighFlyPlugin);
pluginRegistry.register("bbs", createBbsPlugin);
pluginRegistry.register("weather", createWeatherPlugin);
pluginRegistry.register("alerts", createAlertsPlugin);

// Export public API
export { pluginRegistry } from "./registry";
export { pluginManager } from "./manager";
export { pluginStorage } from "./storage";
export type { Plugin, PluginMetadata, PluginConfig, PluginContext } from "./types";

