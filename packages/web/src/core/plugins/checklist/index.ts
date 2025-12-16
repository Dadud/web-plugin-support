/**
 * Checklist Plugin
 * Provides checkin/checkout functionality for tracking people/assets
 */

import type { Plugin, PluginContext } from "../types";
import { pluginStorage } from "../storage";

interface CheckinEntry {
  id: number;
  name: string;
  date: string;
  time: string;
  timestamp: string;
  nodeId?: number;
  location: string;
  notes: string;
  approved: boolean;
  expectedCheckinInterval: number;
  removed: boolean;
}

interface CheckoutEntry {
  id: number;
  name: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  checkinId: number;
  removed: boolean;
}

export function createChecklistPlugin(): Plugin {
  return {
    metadata: {
      id: "checklist",
      name: "Checklist",
      description: "Check-in/check-out system for tracking people and assets",
      version: "1.0.0",
      category: "utility",
    },
    config: {
      enabled: false,
      settings: {
        autoApprove: true,
        reverseInOut: false,
      },
    },
    configSchema: {
      autoApprove: {
        type: "boolean",
        label: "Auto-approve check-ins",
        description: "Automatically approve check-ins without requiring manual approval",
        default: true,
      },
      reverseInOut: {
        type: "boolean",
        label: "Reverse in/out",
        description: "Reverse the meaning of check-in and check-out",
        default: false,
      },
    },
    async initialize(_context: PluginContext) {
      // Initialize database structure
      const checkins = await pluginStorage.get<CheckinEntry[]>("checklist", "checkins");
      if (!checkins) {
        await pluginStorage.set("checklist", "checkins", []);
      }
      const checkouts = await pluginStorage.get<CheckoutEntry[]>("checklist", "checkouts");
      if (!checkouts) {
        await pluginStorage.set("checklist", "checkouts", []);
      }
    },
    async handleMessage(message: string, fromNodeId: number, context: PluginContext) {
      const lowerMessage = message.toLowerCase().trim();
      
      // Check-in command
      if (lowerMessage.startsWith("checkin") || lowerMessage.startsWith("check-in")) {
        return await handleCheckin(message, fromNodeId, context);
      }
      
      // Check-out command
      if (lowerMessage.startsWith("checkout") || lowerMessage.startsWith("check-out")) {
        return await handleCheckout(message, fromNodeId, context);
      }
      
      // List check-ins
      if (lowerMessage === "checklist" || lowerMessage === "list checkins") {
        return await listCheckins();
      }
      
      return null;
    },
  };
}

async function handleCheckin(
  message: string,
  fromNodeId: number,
  context: PluginContext,
): Promise<string> {
  const parts = message.split(/\s+/).slice(1);
  const name = parts[0] || `Node ${fromNodeId}`;
  const notes = parts.slice(1).join(" ") || "";
  
  const now = new Date();
  const date = now.toISOString().split("T")[0] ?? "";
  const time = now.toTimeString().split(" ")[0] ?? "";
  const timestamp = now.toISOString();
  
  const checkins = await pluginStorage.get<CheckinEntry[]>("checklist", "checkins") || [];
  // Get auto-approve setting from plugin config
  const pluginConfig = await pluginStorage.get<{ settings?: { autoApprove?: boolean } }>("checklist", "config");
  const autoApprove = pluginConfig?.settings?.autoApprove ?? true;
  
  const newCheckin: CheckinEntry = {
    id: checkins.length + 1,
    name,
    date,
    time,
    timestamp,
    nodeId: fromNodeId || undefined,
    location: "", // Could get from device location if available
    notes,
    approved: autoApprove,
    expectedCheckinInterval: 0,
    removed: false,
  };
  
  checkins.push(newCheckin);
  await pluginStorage.set("checklist", "checkins", checkins);
  
  context.notify(`Check-in recorded for ${name}`, "success");
  
  return `✓ Check-in recorded for ${name} at ${date} ${time}${notes ? ` - ${notes}` : ""}`;
}

async function handleCheckout(
  message: string,
  fromNodeId: number,
  context: PluginContext,
): Promise<string> {
  const parts = message.split(/\s+/).slice(1);
  const name = parts[0] || `Node ${fromNodeId}`;
  const notes = parts.slice(1).join(" ") || "";
  
  const now = new Date();
  const date = now.toISOString().split("T")[0] ?? "";
  const time = now.toTimeString().split(" ")[0] ?? "";
  
  const checkins = await pluginStorage.get<CheckinEntry[]>("checklist", "checkins") || [];
  const checkouts = await pluginStorage.get<CheckoutEntry[]>("checklist", "checkouts") || [];
  
  // Find most recent check-in for this name
  const lastCheckin = checkins
    .filter((c) => c.name === name && !c.removed)
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))[0];
  
  const newCheckout: CheckoutEntry = {
    id: checkouts.length + 1,
    name,
    date,
    time,
    location: "",
    notes,
    checkinId: lastCheckin?.id || 0,
    removed: false,
  };
  
  checkouts.push(newCheckout);
  await pluginStorage.set("checklist", "checkouts", checkouts);
  
  context.notify(`Check-out recorded for ${name}`, "success");
  
  return `✓ Check-out recorded for ${name} at ${date} ${time}${notes ? ` - ${notes}` : ""}`;
}

async function listCheckins(): Promise<string> {
  const checkins = await pluginStorage.get<CheckinEntry[]>("checklist", "checkins") || [];
  const activeCheckins = checkins.filter((c) => !c.removed);
  
  if (activeCheckins.length === 0) {
    return "No active check-ins.";
  }
  
  const lines = activeCheckins
    .slice(-10) // Last 10
    .map((c) => `${c.name} - ${c.date} ${c.time}${c.notes ? ` (${c.notes})` : ""}`)
    .join("\n");
  
  return `Active Check-ins (${activeCheckins.length}):\n${lines}`;
}

