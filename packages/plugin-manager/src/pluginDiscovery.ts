/**
 * Discover plugins from modules directory
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, extname, resolve } from "path";

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

export async function discoverPlugins(modulesPath: string): Promise<PluginInfo[]> {
  const plugins: PluginInfo[] = [];

  try {
    const resolvedPath = resolve(modulesPath);
    
    // Check if directory exists
    try {
      await stat(resolvedPath);
    } catch {
      console.warn(`Modules directory not found: ${resolvedPath}`);
      return plugins;
    }

    // Discover modules in main directory
    const files = await readdir(resolvedPath);
    for (const file of files) {
      if (extname(file) === ".py" && !file.startsWith("_") && file !== "settings.py") {
        const pluginInfo = await getPluginInfo(join(resolvedPath, file), "modules");
        if (pluginInfo) {
          plugins.push(pluginInfo);
        }
      }
    }

    // Discover games
    const gamesPath = join(resolvedPath, "games");
    try {
      await stat(gamesPath);
      const gameFiles = await readdir(gamesPath);
      for (const file of gameFiles) {
        if (extname(file) === ".py" && !file.startsWith("_")) {
          const pluginInfo = await getPluginInfo(join(gamesPath, file), "games");
          if (pluginInfo) {
            plugins.push(pluginInfo);
          }
        }
      }
    } catch {
      // Games directory doesn't exist, skip
    }
  } catch (error) {
    console.error("Failed to discover plugins:", error);
  }

  return plugins;
}

async function getPluginInfo(filePath: string, category: string): Promise<PluginInfo | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const fileName = filePath.split(/[/\\]/).pop() || "";
    const id = fileName.replace(".py", "");

    // Extract docstring (simple approach)
    const docstringMatch = content.match(/"""(.*?)"""/s);
    const description = docstringMatch ? docstringMatch[1].split("\n")[0].trim() : "";

    // Extract function names
    const functionMatches = content.matchAll(/^def (\w+)/gm);
    const functions = Array.from(functionMatches, (m) => m[1]).slice(0, 10);

    // Infer config section
    const configSection = inferConfigSection(id, content);

    return {
      id,
      name: formatPluginName(id),
      description,
      full_description: docstringMatch ? docstringMatch[1].trim() : description,
      file_path: filePath,
      category,
      functions,
      config_section: configSection,
      enabled_key: "enabled",
    };
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    return null;
  }
}

function inferConfigSection(moduleName: string, content: string): string {
  const sectionMap: Record<string, string> = {
    bbstools: "bbs",
    checklist: "checklist",
    inventory: "inventory",
    locationdata: "location",
    smtp: "smtp",
    scheduler: "scheduler",
    radio: "radioMon",
    filemon: "fileMon",
    qrz: "qrz",
    repeater: "repeater",
  };

  if (moduleName in sectionMap) {
    return sectionMap[moduleName];
  }

  const sectionMatch = content.match(/\[(\w+)\]/);
  if (sectionMatch) {
    return sectionMatch[1];
  }

  return moduleName.toLowerCase();
}

function formatPluginName(moduleName: string): string {
  return moduleName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

