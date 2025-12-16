/**
 * Lightweight plugin management service for plugins
 * Runs as a simple Express server that manages config.ini
 */

import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { resolve } from "path";
import { discoverPlugins } from "./pluginDiscovery.js";
import { readConfig, writeConfig, updatePluginConfig } from "./configManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Configuration from environment
// Default paths assume plugins live in ../plugins
const PLUGIN_PATH = process.env.PLUGIN_PATH
  ? resolve(process.env.PLUGIN_PATH)
  : resolve(__dirname, "../../../plugins");
const CONFIG_INI_PATH = process.env.CONFIG_INI_PATH
  ? resolve(process.env.CONFIG_INI_PATH)
  : resolve(PLUGIN_PATH, "config.ini");
const MODULES_PATH = process.env.MODULES_PATH
  ? resolve(process.env.MODULES_PATH)
  : resolve(PLUGIN_PATH, "modules");
const PORT = parseInt(process.env.PORT || "8000", 10);

console.log("Plugin Manager Configuration:");
console.log(`  PLUGIN_PATH: ${PLUGIN_PATH}`);
console.log(`  CONFIG_INI_PATH: ${CONFIG_INI_PATH}`);
console.log(`  MODULES_PATH: ${MODULES_PATH}`);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Plugin Manager API", version: "0.1.0" });
});

// Get all plugins
app.get("/api/plugins", async (req, res) => {
  try {
    const plugins = await discoverPlugins(MODULES_PATH);
    res.json(plugins);
  } catch (error) {
    res.status(500).json({ error: `Failed to discover plugins: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
});

// Get plugin status
app.get("/api/plugins/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const plugins = await discoverPlugins(MODULES_PATH);
    const plugin = plugins.find((p) => p.id === id);
    
    if (!plugin) {
      return res.status(404).json({ error: "Plugin not found" });
    }

    const config = readConfig(CONFIG_INI_PATH);
    const configSection = plugin.config_section || id.toLowerCase();
    const enabledKey = plugin.enabled_key || "enabled";
    const sectionConfig = config[configSection] || {};
    const enabled = sectionConfig[enabledKey] || false;

    res.json({
      plugin_id: id,
      name: plugin.name,
      status: enabled ? "enabled" : "disabled",
      enabled: Boolean(enabled),
      config_section: configSection,
      settings: sectionConfig,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to get plugin status: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
});

// Update plugin
app.put("/api/plugins/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, settings } = req.body;
    
    const plugins = await discoverPlugins(MODULES_PATH);
    const plugin = plugins.find((p) => p.id === id);
    
    if (!plugin) {
      return res.status(404).json({ error: "Plugin not found" });
    }

    const configSection = plugin.config_section || id.toLowerCase();
    const enabledKey = plugin.enabled_key || "enabled";
    
    updatePluginConfig(CONFIG_INI_PATH, id, configSection, enabledKey, enabled, settings);
    
    res.json({
      plugin_id: id,
      name: plugin.name,
      status: enabled ? "enabled" : "disabled",
      enabled: Boolean(enabled),
      config_section: configSection,
      settings: settings || {},
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to update plugin: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
});

// Get full config
app.get("/api/config", (req, res) => {
  try {
    const config = readConfig(CONFIG_INI_PATH);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: `Failed to read config: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Plugin Manager API running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  server.close(() => {
    console.log("Plugin Manager API stopped");
  });
});

