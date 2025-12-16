import PacketToMessageDTO from "@core/dto/PacketToMessageDTO.ts";
import { useNewNodeNum } from "@core/hooks/useNewNodeNum";
import {
  type Device,
  type MessageStore,
  MessageType,
  type NodeDB,
} from "@core/stores";
import { type MeshDevice, Protobuf, Types } from "@meshtastic/core";
export const subscribeAll = (
  device: Device,
  connection: MeshDevice,
  messageStore: MessageStore,
  nodeDB: NodeDB,
) => {
  let myNodeNum = 0;

  connection.events.onDeviceMetadataPacket.subscribe((metadataPacket) => {
    device.addMetadata(metadataPacket.from, metadataPacket.data);
  });

  connection.events.onRoutingPacket.subscribe((routingPacket) => {
    switch (routingPacket.data.variant.case) {
      case "errorReason": {
        if (
          routingPacket.data.variant.value === Protobuf.Mesh.Routing_Error.NONE
        ) {
          return;
        }
        console.info(`Routing Error: ${routingPacket.data.variant.value}`);
        break;
      }
      case "routeReply": {
        console.info(`Route Reply: ${routingPacket.data.variant.value}`);
        break;
      }
      case "routeRequest": {
        console.info(`Route Request: ${routingPacket.data.variant.value}`);
        break;
      }
    }
  });

  connection.events.onTelemetryPacket.subscribe(() => {
    // device.setMetrics(telemetryPacket);
  });

  connection.events.onDeviceStatus.subscribe((status) => {
    device.setStatus(status);
  });

  connection.events.onWaypointPacket.subscribe((waypoint) => {
    const { data, channel, from, rxTime } = waypoint;
    device.addWaypoint(data, channel, from, rxTime);
  });

  connection.events.onMyNodeInfo.subscribe((nodeInfo) => {
    useNewNodeNum(device.id, nodeInfo);
    myNodeNum = nodeInfo.myNodeNum;
  });

  connection.events.onUserPacket.subscribe((user) => {
    nodeDB.addUser(user);
  });

  connection.events.onPositionPacket.subscribe(async (position) => {
    nodeDB.addPosition(position);

    // If plugins are enabled, pass position to plugin handler
    const pluginEnabled =
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env as { VITE_PLUGINS_ENABLED?: string }).VITE_PLUGINS_ENABLED === "true";

    if (pluginEnabled) {
      try {
        const { handlePluginPosition } = await import("@core/plugins/messageHandler");
        const fromNodeId = (position as any)?.from ?? (position as any)?.num ?? 0;
        await handlePluginPosition(position, fromNodeId, myNodeNum, device, connection, nodeDB);
      } catch (error) {
        if (error instanceof Error && !error.message.includes("Cannot find module")) {
          console.error("[Subscriptions] Error handling plugin position:", error);
        }
      }
    }
  });

  // NOTE: Node handling is managed by the nodeDB
  // Nodes are added via subscriptions.ts and stored in nodeDB
  // Configuration is handled directly by meshDevice.configure() in useConnections
  connection.events.onNodeInfoPacket.subscribe((nodeInfo) => {
    nodeDB.addNode(nodeInfo);
  });

  connection.events.onChannelPacket.subscribe((channel) => {
    device.addChannel(channel);
  });
  connection.events.onConfigPacket.subscribe((config) => {
    device.setConfig(config);
  });
  connection.events.onModuleConfigPacket.subscribe((moduleConfig) => {
    device.setModuleConfig(moduleConfig);
  });

  connection.events.onMessagePacket.subscribe(async (messagePacket) => {
    // incoming and outgoing messages are handled by this event listener
    const dto = new PacketToMessageDTO(messagePacket, myNodeNum);
    const message = dto.toMessage();
    messageStore.saveMessage(message);

    // Handle plugin messages for incoming messages only (if feature is enabled)
    // Use dynamic import to avoid loading plugin code when feature is disabled
    if (message.from !== myNodeNum && message.message) {
      // Check if feature is enabled via environment variable
    const pluginEnabled =
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env as { VITE_PLUGINS_ENABLED?: string }).VITE_PLUGINS_ENABLED === "true";
      
      if (pluginEnabled) {
        try {
          const { handlePluginMessage } = await import("@core/plugins/messageHandler");
          await handlePluginMessage(
            message.message,
            message.from,
            message.to,
            myNodeNum,
            device,
            connection,
            nodeDB,
          );
        } catch (error) {
          // Silently fail if plugin system isn't available
          // This allows core functionality to work without plugins
          if (error instanceof Error && !error.message.includes("Cannot find module")) {
            console.error("[Subscriptions] Error handling plugin message:", error);
          }
        }
      }
    }

    if (message.type === MessageType.Direct) {
      if (message.to === myNodeNum) {
        device.incrementUnread(messagePacket.from);
      }
    } else if (message.type === MessageType.Broadcast) {
      if (message.from !== myNodeNum) {
        device.incrementUnread(message.channel);
      }
    }
  });

  connection.events.onTraceRoutePacket.subscribe((traceRoutePacket) => {
    device.addTraceRoute({
      ...traceRoutePacket,
    });
  });

  connection.events.onPendingSettingsChange.subscribe((state) => {
    device.setPendingSettingsChanges(state);
  });

  connection.events.onMeshPacket.subscribe((meshPacket) => {
    nodeDB.processPacket({
      from: meshPacket.from,
      snr: meshPacket.rxSnr,
      time: meshPacket.rxTime,
    });
  });

  connection.events.onClientNotificationPacket.subscribe(
    (clientNotificationPacket) => {
      device.addClientNotification(clientNotificationPacket);
      device.setDialogOpen("clientNotification", true);
    },
  );

  connection.events.onNeighborInfoPacket.subscribe((neighborInfo) => {
    device.addNeighborInfo(neighborInfo.from, neighborInfo.data);
  });

  connection.events.onRoutingPacket.subscribe((routingPacket) => {
    if (routingPacket.data.variant.case === "errorReason") {
      switch (routingPacket.data.variant.value) {
        case Protobuf.Mesh.Routing_Error.MAX_RETRANSMIT:
          console.error(`Routing Error: ${routingPacket.data.variant.value}`);
          break;
        case Protobuf.Mesh.Routing_Error.NO_CHANNEL:
          console.error(`Routing Error: ${routingPacket.data.variant.value}`);
          nodeDB.setNodeError(
            routingPacket.from,
            routingPacket?.data?.variant?.value,
          );
          device.setDialogOpen("refreshKeys", true);
          break;
        case Protobuf.Mesh.Routing_Error.PKI_UNKNOWN_PUBKEY:
          console.error(`Routing Error: ${routingPacket.data.variant.value}`);
          nodeDB.setNodeError(
            routingPacket.from,
            routingPacket?.data?.variant?.value,
          );
          device.setDialogOpen("refreshKeys", true);
          break;
        default: {
          break;
        }
      }
    }
  });
};
