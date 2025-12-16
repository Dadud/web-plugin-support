/**
 * Config.ini file management
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import ini from "ini";

export function readConfig(configPath: string): Record<string, Record<string, string | boolean | number>> {
  const resolvedPath = resolve(configPath);
  
  if (!existsSync(resolvedPath)) {
    console.warn(`Config file not found: ${resolvedPath}`);
    return {};
  }

  try {
    const content = readFileSync(resolvedPath, "utf-8");
    const parsed = ini.parse(content);

    // Convert values to appropriate types
    const result: Record<string, Record<string, string | boolean | number>> = {};
    for (const [section, values] of Object.entries(parsed)) {
      result[section] = {};
      if (typeof values === "object" && values !== null) {
        for (const [key, value] of Object.entries(values)) {
          if (typeof value === "string") {
            const lower = value.toLowerCase();
            if (lower === "true" || lower === "yes" || lower === "1") {
              result[section][key] = true;
            } else if (lower === "false" || lower === "no" || lower === "0" || value === "") {
              result[section][key] = false;
            } else {
              // Try to parse as number
              const num = Number(value);
              if (!isNaN(num) && value.trim() !== "") {
                result[section][key] = num;
              } else {
                result[section][key] = value;
              }
            }
          } else {
            result[section][key] = value as string | boolean | number;
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Failed to read config:", error);
    return {};
  }
}

export function writeConfig(
  configPath: string,
  config: Record<string, Record<string, string | boolean | number>>,
): void {
  try {
    const resolvedPath = resolve(configPath);
    
    // Ensure directory exists
    mkdirSync(dirname(resolvedPath), { recursive: true });

    // Convert back to ini format
    const iniData: Record<string, Record<string, string>> = {};
    for (const [section, values] of Object.entries(config)) {
      iniData[section] = {};
      for (const [key, value] of Object.entries(values)) {
        iniData[section][key] = String(value);
      }
    }

    const content = ini.stringify(iniData);
    writeFileSync(resolvedPath, content, "utf-8");
  } catch (error) {
    console.error("Failed to write config:", error);
    throw error;
  }
}

export function updatePluginConfig(
  configPath: string,
  pluginId: string,
  configSection: string,
  enabledKey: string,
  enabled: boolean,
  additionalSettings?: Record<string, unknown>,
): void {
  const config = readConfig(configPath);

  if (!config[configSection]) {
    config[configSection] = {};
  }

  config[configSection][enabledKey] = enabled;

  if (additionalSettings) {
    for (const [key, value] of Object.entries(additionalSettings)) {
      config[configSection][key] = value as string | boolean | number;
    }
  }

  writeConfig(configPath, config);
}
