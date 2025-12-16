# Plugin Manager Service (optional)

Lightweight Node.js/TypeScript service for managing plugins.

## Features

- ✅ Reads/writes `config.ini` directly
- ✅ Discovers plugins from modules
- ✅ REST API for plugin management
- ✅ No Python required
- ✅ TypeScript throughout

## Setup

```bash
cd packages/plugin-manager
pnpm install
```

## Configuration

Set environment variables:

```env
PLUGIN_PATH=../plugins
CONFIG_INI_PATH=../plugins/config.ini
MODULES_PATH=../plugins/modules
PORT=8000
```

## Development

```bash
pnpm dev
```

Starts on http://localhost:8000

## API Endpoints

- `GET /api/plugins` - List all plugins
- `GET /api/plugins/:id` - Get plugin status
- `PUT /api/plugins/:id` - Update plugin config
- `GET /api/config` - Get full config

## Integration

The service is automatically started when running `pnpm dev` in the web package (if feature is enabled).

Vite proxies `/api/plugins/*` requests to this service.

