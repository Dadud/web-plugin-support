/**
 * Plugin configuration page for internal meshtastic-web plugins.
 */

import { usePlugins } from "@core/hooks/usePlugins.ts";
import { pluginStorage } from "@core/plugins";
import { useFeatureFlag } from "@core/hooks/useFeatureFlags.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@components/UI/Card.tsx";
import { Switch } from "@components/UI/Switch.tsx";
import { Badge } from "@components/UI/Badge.tsx";
import { Button } from "@components/UI/Button.tsx";
import { Label } from "@components/UI/Label.tsx";
import { Separator } from "@components/UI/Separator.tsx";
import { Spinner } from "@components/UI/Spinner.tsx";
import { PuzzleIcon, SettingsIcon } from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Plugin } from "@core/plugins";
import { useNavigate } from "@tanstack/react-router";

interface PluginConfigProps {
  onFormInit: <T extends object>(methods: UseFormReturn<T>) => void;
}

export const PluginConfig = ({ onFormInit }: PluginConfigProps) => {
  const pluginsEnabled = useFeatureFlag("pluginsEnabled");
  const { plugins, loading, error, updatePlugin, getPluginConfig } = usePlugins();
  const navigate = useNavigate();
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<
    Array<{
      id: number;
      name: string;
      timestamp: string;
      notes: string;
      nodeId?: number;
    }>
  >([]);
  const [highFlyEvents, setHighFlyEvents] = useState<
    Array<{
      nodeId: number;
      altitudeM: number;
      altitudeFt: number;
      latitude?: number;
      longitude?: number;
      timestamp: string;
    }>
  >([]);
  const [highFlyConfig, setHighFlyConfig] = useState<{
    altitudeThresholdM: number;
    throttleMinutes: number;
    ignoreList: string;
    alertSubscribers: string[];
  } | null>(null);
  const [bbsMessages, setBbsMessages] = useState<
    Array<{
      id: number;
      subject: string;
      body: string;
      fromNode: number;
      toNode?: number;
      ts: string;
    }>
  >([]);
  const [bbsSelectedId, setBbsSelectedId] = useState<number | null>(null);
  const [weatherForecasts, setWeatherForecasts] = useState<
    Array<{
      time: string;
      tempC: number;
      tempF: number;
      summary: string;
    }>
  >([]);
  const [weatherConfig, setWeatherConfig] = useState<{
    latitude: number;
    longitude: number;
    units: "metric" | "imperial";
    dailyEnabled: boolean;
    alertsEnabled: boolean;
    subscribers: string[];
  } | null>(null);
  const [alertEntries, setAlertEntries] = useState<
    Array<{
      id: string;
      title: string;
      severity?: string;
      event?: string;
      region?: string;
      magnitude?: number;
      ts: string;
    }>
  >([]);

  const loadCheckins = useCallback(async () => {
    const data =
      (await pluginStorage.get<
        Array<{
          id: number;
          name: string;
          timestamp: string;
          notes: string;
          nodeId?: number;
        }>
      >("checklist", "checkins")) || [];
    setCheckins(
      data
        .filter((c) => !c.removed)
        .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")),
    );
  }, []);

  const loadHighFlyEvents = useCallback(async () => {
    const data =
      (await pluginStorage.get<
        Array<{
          nodeId: number;
          altitudeM: number;
          altitudeFt: number;
          latitude?: number;
          longitude?: number;
          timestamp: string;
        }>
      >("highfly", "events")) || [];
    setHighFlyEvents(
      data.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")),
    );
  }, []);

  const loadBbsMessages = useCallback(async () => {
    const data =
      (await pluginStorage.get<
        Array<{
          id: number;
          subject: string;
          body: string;
          fromNode: number;
          toNode?: number;
          ts: string;
          deleted?: boolean;
        }>
      >("bbs", "messages")) || [];
    setBbsMessages(
      data
        .filter((m) => !m.deleted)
        .sort((a, b) => (b.ts || "").localeCompare(a.ts || "")),
    );
  }, []);

  const loadWeatherForecasts = useCallback(async () => {
    const data =
      (await pluginStorage.get<
        Array<{
          time: string;
          tempC: number;
          tempF: number;
          summary: string;
        }>
      >("weather", "forecasts")) || [];
    setWeatherForecasts(data);
  }, []);

  const loadWeatherConfig = useCallback(async () => {
    const cfg =
      (await pluginStorage.get<{
        enabled: boolean;
        settings: {
          latitude: number;
          longitude: number;
          units: "metric" | "imperial";
          dailyEnabled: boolean;
          alertsEnabled: boolean;
          subscribers: string[];
        };
      }>("weather", "config")) || null;
    if (cfg) {
      setWeatherConfig({
        latitude: cfg.settings.latitude,
        longitude: cfg.settings.longitude,
        units: cfg.settings.units,
        dailyEnabled: cfg.settings.dailyEnabled,
        alertsEnabled: cfg.settings.alertsEnabled,
        subscribers: cfg.settings.subscribers || [],
      });
    } else {
      setWeatherConfig(null);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    const data =
      (await pluginStorage.get<
        Array<{
          id: string;
          title: string;
          severity?: string;
          event?: string;
          region?: string;
          magnitude?: number;
          ts: string;
        }>
      >("alerts", "entries")) || [];
    setAlertEntries(data);
  }, []);

  const loadHighFlyConfig = useCallback(async () => {
    const config =
      (await pluginStorage.get<{
        enabled: boolean;
        settings: {
          altitudeThresholdM: number;
          throttleMinutes: number;
          ignoreList: string[];
          alertSubscribers: string[];
        };
      }>("highfly", "config")) || {
        enabled: false,
        settings: {
          altitudeThresholdM: 2000,
          throttleMinutes: 30,
          ignoreList: [],
          alertSubscribers: [],
        },
      };
    setHighFlyConfig({
      altitudeThresholdM: config.settings.altitudeThresholdM,
      throttleMinutes: config.settings.throttleMinutes,
      ignoreList: (config.settings.ignoreList || []).join(","),
      alertSubscribers: config.settings.alertSubscribers || [],
    });
  }, []);

  // Don't render if feature is disabled
  if (!pluginsEnabled) {
    return null;
  }

  const handlePluginToggle = async (pluginId: string, enabled: boolean) => {
    try {
      await updatePlugin(pluginId, { enabled });
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const selectedPluginData = useMemo(() => {
    if (!selectedPlugin) return null;
    return plugins.find((p) => p.metadata.id === selectedPlugin);
  }, [selectedPlugin, plugins]);

  useEffect(() => {
    void loadCheckins();
    void loadHighFlyEvents();
    void loadHighFlyConfig();
    void loadBbsMessages();
    void loadWeatherForecasts();
    void loadWeatherConfig();
    void loadAlerts();
  }, [
    loadCheckins,
    loadHighFlyEvents,
    loadHighFlyConfig,
    loadBbsMessages,
    loadWeatherForecasts,
    loadWeatherConfig,
    loadAlerts,
  ]);
  const formatTime = (timestamp: string) => {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    return d.toLocaleString();
  };

  const saveHighFlyConfig = async () => {
    if (!highFlyConfig) return;
    const ignoreList = highFlyConfig.ignoreList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = {
      enabled: true,
      settings: {
        altitudeThresholdM: Number(highFlyConfig.altitudeThresholdM) || 2000,
        throttleMinutes: Number(highFlyConfig.throttleMinutes) || 30,
        ignoreList,
        alertSubscribers: highFlyConfig.alertSubscribers,
      },
    };
    await pluginStorage.set("highfly", "config", updated);
    await loadHighFlyConfig();
  };

  const removeSubscriber = async (subId: string) => {
    if (!highFlyConfig) return;
    const updatedSubs = highFlyConfig.alertSubscribers.filter((s) => s !== subId);
    setHighFlyConfig({ ...highFlyConfig, alertSubscribers: updatedSubs });
    await pluginStorage.set("highfly", "config", {
      enabled: true,
      settings: {
        altitudeThresholdM: Number(highFlyConfig.altitudeThresholdM) || 2000,
        throttleMinutes: Number(highFlyConfig.throttleMinutes) || 30,
        ignoreList: highFlyConfig.ignoreList
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        alertSubscribers: updatedSubs,
      },
    });
  };

  const formatDuration = (timestamp: string) => {
    if (!timestamp) return "";
    const then = new Date(timestamp).getTime();
    const now = Date.now();
    const diffMs = Math.max(0, now - then);
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${minutes}m ago`;
    return `${minutes}m ago`;
  };

  const getCategoryColor = (category: Plugin["metadata"]["category"]) => {
    switch (category) {
      case "utility":
        return "default";
      case "game":
        return "secondary";
      case "communication":
        return "outline";
      case "monitoring":
        return "destructive";
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>Plugin System</strong>
            </p>
            <p>
              Enable or disable optional plugins. These plugins add functionality directly to the web UI.
            </p>
            <p className="mt-2 text-xs">
              Plugins are written in TypeScript and run entirely in the browser. No external
              services required.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plugin List and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Plugin List */}
        <Card>
          <CardHeader>
            <CardTitle>Available Plugins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {plugins.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  No plugins available
                </div>
              ) : (
                plugins.map((plugin) => {
                  const config = getPluginConfig(plugin.metadata.id);
                  const isEnabled = config?.enabled ?? false;
                  const isSelected = selectedPlugin === plugin.metadata.id;

                  return (
                    <div
                      key={plugin.metadata.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected ? "border-primary bg-muted" : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedPlugin(plugin.metadata.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <PuzzleIcon className="w-4 h-4" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{plugin.metadata.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {plugin.metadata.description}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getCategoryColor(plugin.metadata.category)}>
                            {plugin.metadata.category}
                          </Badge>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) =>
                              handlePluginToggle(plugin.metadata.id, checked)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plugin Details */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedPluginData ? selectedPluginData.metadata.name : "Plugin Details"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPluginData ? (
              <div className="space-y-4">
                {/* Active check-ins (Checklist plugin only) */}
                {selectedPluginData.metadata.id === "checklist" && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">
                          Active Check-ins
                        </Label>
                        <Badge variant="outline">
                          {checkins.length}
                        </Badge>
                      </div>
                      {checkins.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No active check-ins.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {checkins.slice(0, 5).map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between rounded border p-2"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {c.name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {c.notes || "No notes"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDuration(c.timestamp)}
                                  {c.nodeId ? ` · Node ${c.nodeId}` : ""}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigate({ to: "/map" });
                                }}
                              >
                                View on Map
                              </Button>
                            </div>
                          ))}
                          {checkins.length > 5 && (
                            <p className="text-xs text-muted-foreground">
                              Showing latest 5 check-ins.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* High-fly events & subscribers (HighFly plugin only) */}
                {selectedPluginData.metadata.id === "highfly" && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">
                          Recent High-Fly Alerts
                        </Label>
                        <Badge variant="outline">
                          {highFlyEvents.length}
                        </Badge>
                      </div>
                      {highFlyEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No high-fly alerts yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {highFlyEvents.slice(0, 5).map((e, idx) => (
                            <div
                              key={`${e.nodeId}-${e.timestamp}-${idx}`}
                              className="flex items-center justify-between rounded border p-2"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">
                                  Node {e.nodeId}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {e.altitudeFt.toLocaleString()} ft ({e.altitudeM.toLocaleString()} m)
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatTime(e.timestamp)}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigate({ to: "/map" });
                                }}
                              >
                                View on Map
                              </Button>
                            </div>
                          ))}
                          {highFlyEvents.length > 5 && (
                            <p className="text-xs text-muted-foreground">
                              Showing latest 5 alerts.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">
                          Alert Subscribers
                        </Label>
                        <Badge variant="outline">
                          {highFlyConfig?.alertSubscribers.length ?? 0}
                        </Badge>
                      </div>
                      {(highFlyConfig?.alertSubscribers.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No subscribers yet. Nodes can opt-in via DM: "highfly on"
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {highFlyConfig?.alertSubscribers.map((sub) => (
                            <div
                              key={sub}
                              className="flex items-center justify-between rounded border p-2"
                            >
                              <div className="text-sm">Node {sub}</div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void removeSubscriber(sub)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* BBS inbox (BBS plugin only) */}
                {selectedPluginData.metadata.id === "bbs" && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">
                          Recent Messages
                        </Label>
                        <Badge variant="outline">
                          {bbsMessages.length}
                        </Badge>
                      </div>
                      {bbsMessages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No messages yet. DM the host node: "bbs post &lt;subject&gt; | &lt;body&gt;"
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {bbsMessages.slice(0, 10).map((m) => {
                            const isSelected = bbsSelectedId === m.id;
                            return (
                              <div
                                key={m.id}
                                className={`rounded border p-2 cursor-pointer ${
                                  isSelected ? "border-primary bg-muted" : ""
                                }`}
                                onClick={() => setBbsSelectedId(m.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0">
                                    <div className="font-medium text-sm truncate">
                                      #{m.id} {m.subject}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      From {m.fromNode}
                                      {m.toNode ? ` -> ${m.toNode}` : ""}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatTime(m.ts)}
                                    </div>
                                  </div>
                                  <Badge variant="secondary">BBS</Badge>
                                </div>
                              </div>
                            );
                          })}
                          {bbsMessages.length > 10 && (
                            <p className="text-xs text-muted-foreground">
                              Showing latest 10 messages.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {bbsSelectedId !== null && (
                      <div className="rounded border p-3 space-y-2 bg-muted/40">
                        {(() => {
                          const msg = bbsMessages.find((m) => m.id === bbsSelectedId);
                          if (!msg) return <p className="text-sm text-muted-foreground">Message not found.</p>;
                          return (
                            <>
                              <div className="font-semibold text-sm">#{msg.id} {msg.subject}</div>
                              <div className="text-xs text-muted-foreground">
                                From {msg.fromNode}{msg.toNode ? ` -> ${msg.toNode}` : ""} · {formatTime(msg.ts)}
                              </div>
                              <Separator />
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {msg.body}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}

                {/* Weather (Weather plugin only) */}
                {selectedPluginData.metadata.id === "weather" && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">
                          Forecast (last fetched)
                        </Label>
                        <Badge variant="outline">
                          {weatherForecasts.length}
                        </Badge>
                      </div>
                      {weatherForecasts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No forecast cached. DM: "weather forecast" or "weather now".
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {weatherForecasts.slice(0, 5).map((f) => (
                            <div key={f.time} className="rounded border p-2">
                              <div className="font-medium text-sm">{f.time}</div>
                              <div className="text-xs text-muted-foreground">{f.summary}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">
                          Daily Alert Subscribers
                        </Label>
                        <Badge variant="outline">
                          {weatherConfig?.subscribers.length ?? 0}
                        </Badge>
                      </div>
                      {(weatherConfig?.subscribers.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No subscribers yet. Nodes can opt-in via DM: "weather subscribe"
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {weatherConfig?.subscribers.map((sub) => (
                            <div
                              key={sub}
                              className="flex items-center justify-between rounded border p-2"
                            >
                              <div className="text-sm">Node {sub}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Alerts (Alerts plugin only) */}
                {selectedPluginData.metadata.id === "alerts" && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground">
                          Recent Alerts
                        </Label>
                        <Badge variant="outline">
                          {alertEntries.length}
                        </Badge>
                      </div>
                      {alertEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No alerts cached. DM: "alerts quake", "alerts severe", or "alerts tsunami".
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {alertEntries.slice(0, 10).map((a) => (
                            <div key={a.id} className="rounded border p-2">
                              <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                  <div className="font-medium text-sm truncate">
                                    {a.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {a.severity || a.event || ""} {a.magnitude ? `M${a.magnitude.toFixed(1)}` : ""}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {a.region || ""} {formatTime(a.ts)}
                                  </div>
                                </div>
                                <Badge variant="secondary">Alert</Badge>
                              </div>
                            </div>
                          ))}
                          {alertEntries.length > 10 && (
                            <p className="text-xs text-muted-foreground">
                              Showing latest 10 alerts.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1">{selectedPluginData.metadata.description}</p>
                </div>

                <Separator />

                <div>
                  <Label className="text-xs text-muted-foreground">Information</Label>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Version:</span>{" "}
                      {selectedPluginData.metadata.version}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Category:</span>{" "}
                      {selectedPluginData.metadata.category}
                    </div>
                    {selectedPluginData.metadata.author && (
                      <div>
                        <span className="text-muted-foreground">Author:</span>{" "}
                        {selectedPluginData.metadata.author}
                      </div>
                    )}
                  </div>
                </div>

                {selectedPluginData.configSchema && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Configuration
                      </Label>
                      <div className="space-y-3">
                        {Object.entries(selectedPluginData.configSchema).map(
                          ([key, schema]) => {
                            const config = getPluginConfig(selectedPluginData.metadata.id);
                            const currentSettings = config?.settings ?? {};
                            const value =
                              currentSettings?.[key] ?? schema.default ?? (schema.type === "boolean" ? false : "");

                            const saveValue = async (newVal: unknown) => {
                              const currentConfig =
                                getPluginConfig(selectedPluginData.metadata.id) || {
                                  enabled: false,
                                  settings: {},
                                };
                              const newSettings = {
                                ...currentConfig.settings,
                                [key]: newVal,
                              };
                              await updatePlugin(selectedPluginData.metadata.id, {
                                settings: newSettings,
                              });

                              // Persist to pluginStorage for plugins that read directly (checklist/highfly)
                              if (selectedPluginData.metadata.id === "checklist" || selectedPluginData.metadata.id === "highfly") {
                                await pluginStorage.set(selectedPluginData.metadata.id, "config", {
                                  enabled: currentConfig.enabled ?? true,
                                  settings: newSettings,
                                });
                                if (selectedPluginData.metadata.id === "highfly") {
                                  // Refresh local state for UI
                                  await loadHighFlyConfig();
                                }
                              }
                            };

                            return (
                              <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1">
                                    <Label className="text-sm">{schema.label}</Label>
                                    {schema.description && (
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {schema.description}
                                      </p>
                                    )}
                                  </div>
                                  {schema.type === "boolean" && (
                                    <Switch
                                      checked={Boolean(value)}
                                      onCheckedChange={(checked) => void saveValue(checked)}
                                    />
                                  )}
                                  {schema.type === "string" && (
                                    <input
                                      className="w-40 rounded border px-2 py-1 text-sm bg-background"
                                      type="text"
                                      value={String(value ?? "")}
                                      onChange={(e) => void saveValue(e.target.value)}
                                    />
                                  )}
                                  {schema.type === "number" && (
                                    <input
                                      className="w-32 rounded border px-2 py-1 text-sm bg-background"
                                      type="number"
                                      value={Number(value ?? 0)}
                                      onChange={(e) => void saveValue(Number(e.target.value))}
                                    />
                                  )}
                                  {schema.type === "select" && (
                                    <select
                                      className="w-40 rounded border px-2 py-1 text-sm bg-background"
                                      value={String(value ?? "")}
                                      onChange={(e) => void saveValue(e.target.value)}
                                    >
                                      {(schema.options || []).map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </>
                )}

                {selectedPluginData.metadata.functions && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Commands</Label>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedPluginData.metadata.functions.map((func) => (
                          <Badge key={func} variant="outline" className="text-xs">
                            {func}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground p-4 text-center">
                Select a plugin to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
