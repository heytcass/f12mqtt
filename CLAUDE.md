# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

f12mqtt bridges the FIA Formula 1 Live Timing SignalR feed to MQTT for Home Assistant and AWTRIX 3 LED matrix displays. It connects to the official F1 timing feed during sessions, accumulates state, detects events (flags, overtakes, pit stops, weather), and publishes structured MQTT messages.

## Commands

```bash
npm test                          # run all tests (vitest)
npm run test:watch                # vitest in watch mode
npx vitest run test/unit/foo.test.ts  # run a single test file
npm run dev                       # backend with hot reload (tsx)
npm run dev:ui                    # frontend Vite dev server
npm run build                     # compile backend (tsc) + frontend (vite)
npm run lint                      # ESLint on src/ and test/
npm run format                    # Prettier on src/ and test/
```

Dev environment uses Nix flake + direnv — `cd` into the project to activate (Node.js 22, npm, native build tools).

## Architecture

### Core Data Flow

```
F1 SignalR Feed → F1SignalRClient → SignalRPipeline → MqttPublisher → MQTT broker
                                         ↓
                                    WebSocket → React UI
```

**SignalRPipeline** (`src/signalr/pipeline.ts`) is the central orchestrator:
1. Receives raw `SignalRMessage` from the SignalR client
2. Takes a `snapshot()` of current state (for before/after comparison)
3. Applies the message to `StateAccumulator` via `applyMessage(topic, data, timestamp)`
4. Runs `detectEvents(prevState, currState)` — pure function that aggregates all detectors
5. Emits `'update'` (state + events) and individual `'event'` events

### Event Detectors — Pure Function Pattern

All detectors in `src/events/` follow the same signature:

```typescript
(prev: SessionState, curr: SessionState) => F1Event[]
```

`detectEvents()` in `src/events/detector.ts` aggregates all four detectors (flag, overtake, pit, weather). Detectors are stateless — all context comes from the two state snapshots.

### Playback System

Playback reuses the same accumulator + event detection pipeline but with recorded data:

- **DataSource** (`src/playback/data-source.ts`) — interface with `getInitialState()`, `stream()`, `getTimeRange()`, `close()`. Implementations: `RecordedSource` (JSONL files), `OpenF1Source` (REST API).
- **Timeline** (`src/playback/timeline.ts`) — sorted, indexed `TimelineEntry` collection with binary search by timestamp.
- **PlaybackController** (`src/playback/controller.ts`) — replays entries through the accumulator at configurable speed, emits the same events as the live pipeline. Seek resets state and fast-forwards.

### Recording Format

Sessions are stored as directories containing:
- `metadata.json` — session info (key, year, circuit)
- `subscribe.json` — initial state snapshot
- `live.jsonl` — one `{ts, topic, data}` JSON object per line

### Web Layer

- **Fastify** server (`src/web/app.ts`) with `@fastify/websocket` and `@fastify/static`
- REST API at `/api/*` — playback control, config CRUD, session listing, health
- WebSocket at `/ws` — broadcasts state updates, events, and playback state changes
- React frontend in `ui/` connects via WebSocket (`ui/src/hooks/useWebSocket.ts`)

### MQTT Publishing

- `src/mqtt/publisher.ts` — publishes session state, per-driver data, and events to topic hierarchy under `f12mqtt/`
- `src/mqtt/ha-discovery.ts` — Home Assistant MQTT Auto-Discovery with device grouping
- `src/mqtt/awtrix.ts` — AWTRIX 3 LED matrix notification payloads with team colors
- `src/mqtt/topics.ts` — topic path constants

### Config

SQLite-backed key-value store (`src/config/store.ts`) using `better-sqlite3`. Runtime config (MQTT connection, favorite drivers, AWTRIX settings) managed through the web UI and REST API.

## Conventions

- **TypeScript strict mode** — no `any`, no implicit types. `noUncheckedIndexedAccess` is enabled.
- **ESM** — `"type": "module"` in package.json. Use `.js` extensions in all relative imports (TypeScript resolves them to `.ts` at compile time).
- **Pure functions for detectors** — event detectors take `(prevState, currState)` and return events. No side effects.
- **TDD** — write tests first for data processing logic.
- **Zod** for runtime validation of config and external data.
- **pino** for logging — use `createChildLogger('module-name')` from `src/util/logger.ts`.
- **EventEmitter pub/sub** — pipeline, controller, and client communicate via typed events, not direct calls.

## Testing

- Tests: `test/unit/*.test.ts` and `test/integration/*.test.ts`
- Fixtures: `test/fixtures/`
- Vitest globals enabled (`describe`/`it`/`expect` — no imports needed)
- Coverage via v8 provider, excludes `src/index.ts`
