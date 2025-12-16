/**
 * Message handler integration for plugins
 * Connects incoming messages to the plugin system
 */

import { pluginManager } from "./manager";
import type { PluginContext } from "./types";
import { type MeshDevice, Types } from "@meshtastic/core";
import type { Device } from "@core/stores";
import { MessageType } from "@core/stores";
import type { NodeDB } from "@core/stores";

/**
 * Create plugin context from device connection
 */
export function createPluginContext(
  _device: Device,
  connection: MeshDevice,
  nodeDB: NodeDB,
  _myNodeNum: number,
): PluginContext {
  return {
    device: {
      sendText: async (text: string, toNodeId?: number, channel?: number) => {
        const channelValue = channel ?? Types.ChannelNumber.Primary;
        const destination = toNodeId ?? MessageType.Broadcast;
        await connection.sendText(
          text,
          destination,
          true,
          channelValue,
        );
      },
      getNodes: async () => {
        return nodeDB.getNodes();
      },
      getNodeInfo: async (nodeId: number) => {
        return nodeDB.getNode(nodeId) ?? null;
      },
    },
    storage: {
      get: async () => null,
      set: async () => {},
      remove: async () => {},
    },
    notify: () => {
      // silent notify placeholder to avoid noisy logs
    },
  };
}

/**
 * Handle incoming message through plugins
 */
export async function handlePluginMessage(
  message: string,
  fromNodeId: number,
  toNodeId: number,
  myNodeNum: number,
  device: Device,
  connection: MeshDevice,
  nodeDB: NodeDB,
): Promise<string | null> {
  // Only process messages addressed to this node (direct messages)
  // or broadcast messages
  if (toNodeId !== myNodeNum && toNodeId !== 0) {
    return null;
  }

  // Create plugin context
  const context = createPluginContext(device, connection, nodeDB, myNodeNum);

  // Let plugins handle the message
  const response = await pluginManager.handleMessage(
    message,
    fromNodeId,
    context,
  );

  // If plugin returned a response, send it back
  if (response) {
    // Send response as direct message to the sender
    try {
      await connection.sendText(
        response,
        fromNodeId,
        true,
        Types.ChannelNumber.Primary,
      );
    } catch (error) {
      console.error("[PluginHandler] Failed to send plugin response:", error);
    }
  } else {
    // No response is fine; avoid noisy logging
  }

  return response;
}

/**
 * Handle a position update through plugins (dynamic hook)
 */
export async function handlePluginPosition(
  position: unknown,
  fromNodeId: number,
  myNodeNum: number,
  device: Device,
  connection: MeshDevice,
  nodeDB: NodeDB,
): Promise<string | null> {
  const context = createPluginContext(device, connection, nodeDB, myNodeNum);
  return pluginManager.handlePosition(position, fromNodeId, context);
}

