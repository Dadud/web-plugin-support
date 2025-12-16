/**
 * BBS Plugin - DM-first message board with optional UI browsing.
 * Commands (DM to host node):
 * - bbs help
 * - bbs post <subject> | <body>
 * - bbs inbox
 * - bbs read <id>
 * - bbs delete <id>
 * - bbs search <term>
 * - bbs to <nodeId> <subject> | <body> (private DM)
 */

import type { Plugin } from "../types";
import { pluginStorage } from "../storage";

type BbsMessage = {
  id: number;
  subject: string;
  body: string;
  fromNode: number;
  toNode?: number;
  ts: string;
  threadId?: string;
  deleted?: boolean;
};

type BbsConfig = {
  enabled: boolean;
  settings: {
    retention: number;
    maxBodyLength: number;
    ignoreList: string[];
    admins: string[];
    nextId: number;
  };
};

const DEFAULT_CONFIG: BbsConfig = {
  enabled: false,
  settings: {
    retention: 200,
    maxBodyLength: 500,
    ignoreList: [],
    admins: [],
    nextId: 1,
  },
};

async function ensureConfig(): Promise<BbsConfig> {
  const cfg = (await pluginStorage.get<BbsConfig>("bbs", "config")) || DEFAULT_CONFIG;
  // fill defaults if missing
  return {
    enabled: cfg.enabled ?? false,
    settings: {
      retention: cfg.settings?.retention ?? DEFAULT_CONFIG.settings.retention,
      maxBodyLength: cfg.settings?.maxBodyLength ?? DEFAULT_CONFIG.settings.maxBodyLength,
      ignoreList: cfg.settings?.ignoreList ?? [],
      admins: cfg.settings?.admins ?? [],
      nextId: cfg.settings?.nextId ?? 1,
    },
  };
}

function trimMessages(messages: BbsMessage[], retention: number): BbsMessage[] {
  return messages
    .filter((m) => !m.deleted)
    .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))
    .slice(0, retention);
}

function parseSubjectBody(input: string): { subject: string; body: string } | null {
  const parts = input.split("|");
  if (parts.length < 2) return null;
  const subject = parts[0].trim();
  const body = parts.slice(1).join("|").trim();
  if (!subject || !body) return null;
  return { subject, body };
}

export function createBbsPlugin(): Plugin {
  return {
    metadata: {
      id: "bbs",
      name: "BBS",
      description: "DM-first bulletin board. Post, read, search via DM.",
      version: "1.0.0",
      category: "communication",
      functions: [
        "bbs help",
        "bbs post <subject> | <body>",
        "bbs inbox",
        "bbs read <id>",
        "bbs delete <id>",
        "bbs search <term>",
        "bbs to <nodeId> <subject> | <body>",
      ],
    },
    config: {
      enabled: false,
      settings: {
        retention: 200,
        maxBodyLength: 500,
        ignoreList: [],
        admins: [],
        nextId: 1,
      },
    },
    configSchema: {
      retention: {
        type: "number",
        label: "Retention (messages)",
        description: "How many messages to keep (oldest dropped).",
        default: 200,
      },
      maxBodyLength: {
        type: "number",
        label: "Max body length",
        description: "Maximum characters allowed in message body.",
        default: 500,
      },
      ignoreList: {
        type: "string",
        label: "Ignore list (comma IDs)",
        description: "Node IDs to ignore.",
        default: "",
      },
      admins: {
        type: "string",
        label: "Admins (comma IDs)",
        description: "Node IDs allowed to delete any message.",
        default: "",
      },
    },
    async initialize() {
      const cfg = await ensureConfig();
      await pluginStorage.set("bbs", "config", cfg);
      const existing = await pluginStorage.get<BbsMessage[]>("bbs", "messages");
      if (!existing) {
        await pluginStorage.set("bbs", "messages", []);
      }
    },
    async handleMessage(message: string, fromNodeId: number) {
      const lower = message.toLowerCase().trim();
      if (!lower.startsWith("bbs")) return null;

      const cfg = await ensureConfig();
      const ignore = (cfg.settings.ignoreList || []).map((x) => x.trim()).filter(Boolean);
      if (ignore.includes(String(fromNodeId))) {
        return null;
      }

      const parts = message.trim().split(/\s+/).slice(1); // drop "bbs"
      const cmd = (parts[0] || "").toLowerCase();
      const args = parts.slice(1).join(" ").trim();

      const messages = (await pluginStorage.get<BbsMessage[]>("bbs", "messages")) || [];

      // HELP
      if (!cmd || cmd === "help") {
        return [
          "BBS commands:",
          "bbs post <subject> | <body>",
          "bbs inbox",
          "bbs read <id>",
          "bbs delete <id>",
          "bbs search <term>",
          "bbs to <nodeId> <subject> | <body>",
        ].join("\n");
      }

      // POST
      if (cmd === "post") {
        const parsed = parseSubjectBody(args);
        if (!parsed) return "Usage: bbs post <subject> | <body>";

        if (parsed.body.length > cfg.settings.maxBodyLength) {
          return `Message too long (max ${cfg.settings.maxBodyLength} chars).`;
        }

        const id = cfg.settings.nextId;
        const msg: BbsMessage = {
          id,
          subject: parsed.subject,
          body: parsed.body,
          fromNode: fromNodeId,
          ts: new Date().toISOString(),
        };
        const updated = trimMessages([msg, ...messages], cfg.settings.retention);
        await pluginStorage.set("bbs", "messages", updated);
        await pluginStorage.set("bbs", "config", {
          ...cfg,
          settings: { ...cfg.settings, nextId: id + 1 },
        });
        return `Posted #${id}: ${parsed.subject}`;
      }

      // TO (private)
      if (cmd === "to") {
        const firstSpace = args.indexOf(" ");
        if (firstSpace <= 0) return "Usage: bbs to <nodeId> <subject> | <body>";
        const destStr = args.slice(0, firstSpace).trim();
        const rest = args.slice(firstSpace + 1).trim();
        const dest = Number(destStr);
        if (!Number.isFinite(dest) || dest <= 0) return "Invalid nodeId";
        const parsed = parseSubjectBody(rest);
        if (!parsed) return "Usage: bbs to <nodeId> <subject> | <body>";

        if (parsed.body.length > cfg.settings.maxBodyLength) {
          return `Message too long (max ${cfg.settings.maxBodyLength} chars).`;
        }

        const id = cfg.settings.nextId;
        const msg: BbsMessage = {
          id,
          subject: parsed.subject,
          body: parsed.body,
          fromNode: fromNodeId,
          toNode: dest,
          ts: new Date().toISOString(),
        };
        const updated = trimMessages([msg, ...messages], cfg.settings.retention);
        await pluginStorage.set("bbs", "messages", updated);
        await pluginStorage.set("bbs", "config", {
          ...cfg,
          settings: { ...cfg.settings, nextId: id + 1 },
        });
        return `DM queued #${id} to ${dest}: ${parsed.subject}`;
      }

      // INBOX
      if (cmd === "inbox") {
        const list = messages
          .filter((m) => !m.deleted)
          .slice(0, 10)
          .map((m) => `#${m.id} ${m.subject} (from ${m.fromNode}${m.toNode ? ` -> ${m.toNode}` : ""})`);
        if (list.length === 0) return "Inbox empty.";
        return `Inbox (${list.length}):\n${list.join("\n")}`;
      }

      // READ
      if (cmd === "read") {
        const id = Number(args);
        if (!Number.isFinite(id)) return "Usage: bbs read <id>";
        const msg = messages.find((m) => m.id === id && !m.deleted);
        if (!msg) return "Not found.";
        return [
          `#${msg.id} ${msg.subject}`,
          `From ${msg.fromNode}${msg.toNode ? ` -> ${msg.toNode}` : ""}`,
          new Date(msg.ts).toLocaleString(),
          "",
          msg.body,
        ].join("\n");
      }

      // DELETE
      if (cmd === "delete") {
        const id = Number(args);
        if (!Number.isFinite(id)) return "Usage: bbs delete <id>";
        const msgIndex = messages.findIndex((m) => m.id === id && !m.deleted);
        if (msgIndex === -1) return "Not found.";
        const msg = messages[msgIndex];
        const admins = cfg.settings.admins;
        const isAdmin = admins.includes(String(fromNodeId));
        if (!isAdmin && msg.fromNode !== fromNodeId) {
          return "Not authorized to delete.";
        }
        messages[msgIndex] = { ...msg, deleted: true, id: msg.id };
        await pluginStorage.set("bbs", "messages", messages as BbsMessage[]);
        return `Deleted #${id}`;
      }

      // SEARCH
      if (cmd === "search") {
        const term = args.toLowerCase();
        if (!term) return "Usage: bbs search <term>";
        const found = messages
          .filter(
            (m) =>
              !m.deleted &&
              (m.subject.toLowerCase().includes(term) ||
                m.body.toLowerCase().includes(term)),
          )
          .slice(0, 10);
        if (found.length === 0) return "No matches.";
        return [
          `Found ${found.length}:`,
          ...found.map((m) => `#${m.id} ${m.subject} (from ${m.fromNode})`),
        ].join("\n");
      }

      return "Unknown command. Try: bbs help";
    },
  };
}

