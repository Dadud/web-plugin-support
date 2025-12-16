# Plugin Support (Preview) for meshtastic-web

This branch adds an optional, feature-flagged plugin system to meshtastic-web. When disabled, no plugin code loads and core behavior is unchanged.

## Enable
Create or update `packages/web/.env`:
```
VITE_PLUGINS_ENABLED=true
# Optional: backend API for external plugin mgmt
VITE_PLUGINS_API_URL=http://localhost:8000
# Optional: remote manifest for dynamic plugins
VITE_PLUGINS_MANIFEST_URL=https://example.com/manifest.json
```

## Built-in plugins (DM-first)
- Checklist: `checkin`, `checkout`, `checklist`
- High-Fly: `highfly on/off/recent` (altitude alerts)
- Weather: `weather here/node/now/forecast/alerts`, subscribe/unsubscribe; uses mesh node positions, place names, rain chance
- BBS: `bbs post/inbox/read/delete/search/to`
- Alerts: `alerts quake [minMag]` (USGS), `alerts severe`, `alerts tsunami` (NOAA), subscribe/unsubscribe

## Remote plugin catalog (optional)
- Set `VITE_PLUGINS_MANIFEST_URL` to a JSON manifest URL.
- Manifest format (array):
```json
[
  {
    "id": "example-remote",
    "name": "Example Remote",
    "description": "Remote plugin",
    "version": "1.0.0",
    "bundleUrl": "https://cdn.example.com/plugins/example-remote.js",
    "enabledByDefault": false
  }
]
```
- When enabled in the UI, the bundle is dynamically imported and registered at runtime.
- Enabled remote plugins are tracked in localStorage; manifest fetch is on startup.

## Security posture
- Feature-flagged: `VITE_PLUGINS_ENABLED` off by default.
- Dynamic imports only when the flag is on (and manifest URL set).
- Browser-only: plugins use localStorage; no server processes added.
- Network calls (built-ins): Open-Meteo, Nominatim, USGS, NOAA (no credentials).
- No eval/exec; no filesystem access; no background schedulers. Actions are triggered by DM commands.
- Consider rate-limiting sendText if hosting in production.

## Dev notes
- Plugin integration points:
  - `src/core/plugins/` (types, registry, manager, storage, built-ins)
  - `src/core/services/pluginCatalog.ts` (remote manifest + dynamic import)
  - `src/core/subscriptions.ts` (feature-flagged dynamic import of handlers)
  - `src/pages/Settings/PluginConfig.tsx` (Plugins panel)
- With the flag off, the Plugins panel is hidden and plugin code is not loaded.

## Build / Run
```bash
cd meshtastic-web
pnpm install
cd packages/web
pnpm dev          # flag on -> Plugins visible
pnpm build
```

## Docker (client only)
From `packages/web`:
```bash
docker build -t meshtastic-web:plugins -f ./infra/Containerfile .
docker run -p 3000:3000 meshtastic-web:plugins
```
# Plugin Support (Preview) for meshtastic-web

This branch adds an optional, feature-flagged plugin system to meshtastic-web. When disabled, no plugin code loads and core behavior is unchanged.

## Enable
Create or update `packages/web/.env`:
```
VITE_PLUGINS_ENABLED=true
# Optional: backend API for external plugin mgmt
VITE_PLUGINS_API_URL=http://localhost:8000
# Optional: remote manifest for dynamic plugins
VITE_PLUGINS_MANIFEST_URL=https://example.com/manifest.json
```

## Built-in plugins (DM-first)
- Checklist: `checkin`, `checkout`, `checklist`
- High-Fly: `highfly on/off/recent` (altitude alerts)
- Weather: `weather here/node/now/forecast/alerts`, subscribe/unsubscribe; uses mesh node positions, place names, rain chance
- BBS: `bbs post/inbox/read/delete/search/to`
- Alerts: `alerts quake [minMag]` (USGS), `alerts severe`, `alerts tsunami` (NOAA), subscribe/unsubscribe

## Remote plugin catalog (optional)
- Set `VITE_PLUGINS_MANIFEST_URL` to a JSON manifest URL.
- Manifest format (array):
```json
[
  {
    "id": "example-remote",
    "name": "Example Remote",
    "description": "Remote plugin",
    "version": "1.0.0",
    "bundleUrl": "https://cdn.example.com/plugins/example-remote.js",
    "enabledByDefault": false
  }
]
```
- When enabled in the UI, the bundle is dynamically imported and registered at runtime.
- Enabled remote plugins are tracked in localStorage; manifest fetch is on startup.

## Security posture
- Feature-flagged: `VITE_PLUGINS_ENABLED` off by default.
- Dynamic imports only when the flag is on (and manifest URL set).
- Browser-only: plugins use localStorage; no server processes added.
- Network calls (built-ins): Open-Meteo, Nominatim, USGS, NOAA (no credentials).
- No eval/exec; no filesystem access; no background schedulers. Actions are triggered by DM commands.
- Consider rate-limiting sendText if hosting in production.

## Dev notes
- Plugin integration points:
  - `src/core/plugins/` (types, registry, manager, storage, built-ins)
  - `src/core/services/pluginCatalog.ts` (remote manifest + dynamic import)
  - `src/core/subscriptions.ts` (feature-flagged dynamic import of handlers)
  - `src/pages/Settings/PluginConfig.tsx` (Plugins panel)
- With the flag off, the Plugins panel is hidden and plugin code is not loaded.

## Build / Run
```bash
cd meshtastic-web
pnpm install
cd packages/web
pnpm dev          # flag on -> Plugins visible
pnpm build
```

## Docker (client only)
From `packages/web`:
```bash
docker build -t meshtastic-web:plugins -f ./infra/Containerfile .
docker run -p 3000:3000 meshtastic-web:plugins
```
# Plugin Support (Preview) for meshtastic-web

This branch adds an optional, feature-flagged plugin system to meshtastic-web. When disabled, no plugin code loads and core behavior is unchanged.

## Enable
Create or update `packages/web/.env`:
```
VITE_PLUGINS_ENABLED=true
# Optional: backend API for external plugin mgmt
VITE_PLUGINS_API_URL=http://localhost:8000
# Optional: remote manifest for dynamic plugins
VITE_PLUGINS_MANIFEST_URL=https://example.com/manifest.json
```

## Built-in plugins (DM-first)
- Checklist: `checkin`, `checkout`, `checklist`
- High-Fly: `highfly on/off/recent` (altitude alerts)
/- Weather: `weather here/node/now/forecast/alerts`, subscribe/unsubscribe; uses mesh node positions, place names, rain chance
/- BBS: `bbs post/inbox/read/delete/search/to`
/- Alerts: `alerts quake [minMag]` (USGS), `alerts severe`, `alerts tsunami` (NOAA), subscribe/unsubscribe

## Remote plugin catalog (optional)
- Set `VITE_PLUGINS_MANIFEST_URL` to a JSON manifest URL.
- Manifest format (array):
```json
[
  {
    "id": "example-remote",
    "name": "Example Remote",
    "description": "Remote plugin",
    "version": "1.0.0",
    "bundleUrl": "https://cdn.example.com/plugins/example-remote.js",
    "enabledByDefault": false
  }
]
```
- When enabled in the UI, the bundle is dynamically imported and registered at runtime.
- Enabled remote plugins are tracked in localStorage; manifest fetch is on startup.

## Security posture
- Feature-flagged: `VITE_PLUGINS_ENABLED` off by default.
- Dynamic imports only when the flag is on (and manifest URL set).
- Browser-only: plugins use localStorage; no server processes added.
- Network calls (built-ins): Open-Meteo, Nominatim, USGS, NOAA (no credentials).
- No eval/exec; no filesystem access; no background schedulers. Actions are triggered by DM commands.
- Consider rate-limiting sendText if hosting in production.

## Dev notes
- Plugin integration points:
  - `src/core/plugins/` (types, registry, manager, storage, built-ins)
  - `src/core/services/pluginCatalog.ts` (remote manifest + dynamic import)
  - `src/core/subscriptions.ts` (feature-flagged dynamic import of handlers)
  - `src/pages/Settings/PluginConfig.tsx` (Plugins panel)
- With the flag off, the Plugins panel is hidden and plugin code is not loaded.

## Build / Run
```bash
cd meshtastic-web
pnpm install
cd packages/web
pnpm dev          # flag on -> Plugins visible
pnpm build
```

## Docker (client only)
From `packages/web`:
```bash
docker build -t meshtastic-web:plugins -f ./infra/Containerfile .
docker run -p 3000:3000 meshtastic-web:plugins
```

