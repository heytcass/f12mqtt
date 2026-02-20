# f12mqtt

F1 Live Timing → MQTT Bridge for Home Assistant and AWTRIX 3.

## Commands

- `npm test` — run all tests (vitest)
- `npm run test:watch` — run tests in watch mode
- `npm run dev` — start dev server with hot reload (tsx)
- `npm run build` — compile TypeScript
- `npm run lint` — ESLint
- `npm run format` — Prettier

## Conventions

- **TypeScript strict mode** — no `any`, no implicit types
- **ESM** — `"type": "module"` in package.json, use `.js` extensions in imports
- **Pure functions for detectors** — event detectors take state in, return events out
- **TDD** — write tests first for all data processing logic
- **Zod** for runtime validation of config and external data
- **pino** for logging — use `createChildLogger('module-name')`

## Project Structure

- `src/data/` — canonical types, state accumulator
- `src/events/` — event detectors (flag, overtake, pit, weather)
- `src/signalr/` — SignalR client and message parsers
- `src/openf1/` — OpenF1 REST client
- `src/mqtt/` — MQTT publisher, HA discovery, AWTRIX payloads
- `src/playback/` — playback controller, timeline, data sources
- `src/recording/` — session recorder and storage
- `src/web/` — Fastify server, REST routes, WebSocket
- `src/config/` — Zod schemas, SQLite config store
- `src/util/` — logger, zlib, team colors, constants
- `test/` — unit and integration tests
- `ui/` — React + Vite frontend

## Testing

- Tests live in `test/unit/` and `test/integration/`
- Fixtures in `test/fixtures/`
- Name test files `*.test.ts`
- Use `describe`/`it`/`expect` from vitest globals

## Dev Environment

Uses Nix flake + direnv. `cd` into the project to activate the dev shell automatically (Node.js 22, npm, native build tools).
