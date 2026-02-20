# f12mqtt

F1 Live Timing to MQTT bridge for Home Assistant and AWTRIX 3.

Connects to the FIA's official Formula 1 Live Timing SignalR feed during sessions, converts telemetry into structured MQTT messages, and publishes real-time data for smart home automations and LED matrix displays.

## Features

- **Real-time F1 data** — Subscribes to 15 SignalR topics including timing, track status, weather, race control messages, driver list, pit lane times, and car telemetry
- **MQTT publishing** — Session state, per-driver positions/gaps/tyres, and standings published to configurable topic hierarchy
- **Home Assistant integration** — MQTT Auto-Discovery sensors with device grouping, availability tracking, and persistent entities
- **AWTRIX 3 notifications** — Flag changes, overtakes, and pit stops formatted for LED matrix displays with team colors and effects
- **Event detection** — Pure-function detectors for flag changes, overtakes, pit stops, and weather transitions
- **Session recording & playback** — Record live sessions to JSONL, replay with seek/pause/speed control
- **Web UI** — React dashboard for playback control, live event feed, driver cards, and configuration
- **Home Assistant add-on** — Native HA addon with ingress panel support

## Quick start

### Docker Compose (recommended)

```bash
docker compose up -d
```

This starts f12mqtt on port 3000 and an Eclipse Mosquitto broker on port 1883. The web UI is available at `http://localhost:3000`.

### Node.js

Requires Node.js 22+.

```bash
npm install
npm run build
npm start
```

### Development

```bash
npm run dev       # Backend with hot reload
npm run dev:ui    # Frontend dev server (Vite)
npm test          # Run tests
npm run lint      # ESLint
npm run format    # Prettier
```

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `./data` | Data directory root |
| `RECORDINGS_DIR` | `$DATA_DIR/recordings` | Session recordings path |
| `DB_PATH` | `$DATA_DIR/config.db` | SQLite config database |

Runtime configuration (MQTT connection, favorite drivers, AWTRIX settings) is managed through the web UI and persisted in SQLite via the REST API at `/api/config`.

## MQTT topics

All topics are prefixed with `f12mqtt/` by default.

### Session

| Topic | Description |
|---|---|
| `session/status` | `online` / `offline` |
| `session/info` | Session name, type, circuit |
| `session/flag` | Current track flag |
| `session/leader` | Session leader |
| `session/lap` | Current lap / total laps |
| `session/weather` | Temperature, wind, rain |
| `session/race_control` | Race control messages |

### Drivers

Per-driver topics at `driver/{number}/`:

| Topic | Description |
|---|---|
| `position` | Track position |
| `gap` | Gap to leader / interval |
| `tyre` | Current compound and stint |
| `status` | On track, in pit, out, retired |

### Events

| Topic | Description |
|---|---|
| `event/flag` | Flag change events |
| `event/overtake` | Position change events |
| `event/pit_stop` | Pit stop events with tyre and duration |
| `event/weather` | Weather transition events |

### Standings

| Topic | Description |
|---|---|
| `standings/last_winner` | Most recent race winner |
| `standings/drivers_leader` | WDC leader |
| `standings/constructors_leader` | WCC leader |
| `schedule/next_race` | Next scheduled race |

## Home Assistant add-on

Copy the `ha-addon/` directory to your Home Assistant add-on repository. The addon requires the Mosquitto MQTT broker add-on and exposes an ingress panel with the web UI.

Supported architectures: `aarch64`, `amd64`.

## Project structure

```
src/
  signalr/      SignalR client and message parsers
  data/         Canonical types and state accumulator
  events/       Event detectors (flag, overtake, pit, weather)
  mqtt/         MQTT publisher, HA discovery, AWTRIX payloads
  playback/     Session playback controller
  recording/    JSONL session recorder
  openf1/       OpenF1 REST client
  web/          Fastify server, REST API, WebSocket
  config/       SQLite config store
  util/         Logger, constants, team colors
ui/             React + Vite + Tailwind frontend
test/           Unit and integration tests
```

## License

MIT
