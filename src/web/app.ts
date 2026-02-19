/**
 * Fastify app: REST API + WebSocket for real-time updates.
 * Wires together playback controller, session storage, and WebSocket broadcasting.
 */

import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { PlaybackController } from '../playback/controller.js';
import { Timeline } from '../playback/timeline.js';
import { listRecordings, loadInitialState, loadTimeline } from '../recording/storage.js';
import { ConfigStore } from '../config/store.js';
import { createChildLogger } from '../util/logger.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const log = createChildLogger('web');

export interface AppOptions {
  port: number;
  host: string;
  recordingsDir: string;
  dbPath?: string;
}

export interface App {
  server: FastifyInstance['server'];
  close(): Promise<void>;
}

export async function createApp(opts: AppOptions): Promise<App> {
  const fastify = Fastify({ logger: false });
  await fastify.register(fastifyWebsocket);

  const controller = new PlaybackController();
  const clients = new Set<WebSocket>();
  const configStore = opts.dbPath ? new ConfigStore(opts.dbPath) : null;

  // --- WebSocket: broadcast state/events to connected clients ---

  fastify.register(async function (app) {
    app.get('/ws', { websocket: true }, (socket) => {
      clients.add(socket);
      log.info({ clientCount: clients.size }, 'WebSocket client connected');

      // Send current playback state on connect
      send(socket, { type: 'playback_state', ...controller.getPlaybackState() });

      socket.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as {
            command: string;
            value?: string | number;
          };
          handlePlaybackCommand(msg.command, msg.value);
        } catch (err) {
          log.warn({ err }, 'Invalid WebSocket message');
        }
      });

      socket.on('close', () => {
        clients.delete(socket);
        log.info({ clientCount: clients.size }, 'WebSocket client disconnected');
      });
    });
  });

  // Wire controller events → WebSocket broadcast
  controller.on('update', (data) => {
    broadcast({
      type: 'update',
      state: data.state,
      events: data.events,
      playbackState: data.playbackState,
    });
  });

  controller.on('event', (event) => {
    broadcast({ type: 'event', event });
  });

  controller.on('stateChange', (playbackState) => {
    broadcast({ type: 'playback_state', ...playbackState });
  });

  controller.on('seek', (data) => {
    broadcast({
      type: 'seek',
      state: data.state,
      playbackState: data.playbackState,
    });
  });

  controller.on('loaded', (playbackState) => {
    broadcast({ type: 'playback_state', ...playbackState });
  });

  controller.on('finished', () => {
    broadcast({ type: 'playback_finished' });
  });

  // --- REST API ---

  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/api/sessions', async () => {
    return listRecordings(opts.recordingsDir);
  });

  fastify.get('/api/playback/state', async () => {
    return {
      playbackState: controller.getPlaybackState(),
      sessionState: controller.getSessionState(),
    };
  });

  fastify.post<{
    Body: { sessionDir: string };
  }>('/api/playback/load', async (request) => {
    const { sessionDir } = request.body;
    const initialState = loadInitialState(sessionDir);
    const entries = loadTimeline(sessionDir);
    const timeline = new Timeline(entries);
    controller.load(timeline, initialState, 'recorded');
    return { ok: true, entries: entries.length };
  });

  fastify.post<{
    Body: { command: string; value?: string | number };
  }>('/api/playback/command', async (request) => {
    const { command, value } = request.body;
    return handlePlaybackCommand(command, value);
  });

  // --- Config API ---

  fastify.get('/api/config', async (_request, reply) => {
    if (!configStore) return reply.code(501).send({ error: 'Config not available' });
    return configStore.getAll();
  });

  fastify.put<{
    Params: { key: string };
    Body: { value: unknown };
  }>('/api/config/:key', async (request, reply) => {
    if (!configStore) return reply.code(501).send({ error: 'Config not available' });
    const { key } = request.params;
    const { value } = request.body;
    configStore.set(key, value);
    broadcast({ type: 'config_change', key, value });
    return { ok: true };
  });

  fastify.delete<{
    Params: { key: string };
  }>('/api/config/:key', async (request, reply) => {
    if (!configStore) return reply.code(501).send({ error: 'Config not available' });
    const { key } = request.params;
    configStore.delete(key);
    broadcast({ type: 'config_change', key, value: null });
    return { ok: true };
  });

  // --- Static UI files ---
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
  if (existsSync(publicDir)) {
    await fastify.register(fastifyStatic, {
      root: publicDir,
      wildcard: false,
    });
    // SPA fallback: serve index.html for non-API routes
    fastify.setNotFoundHandler((_request, reply) => {
      return reply.sendFile('index.html');
    });
  }

  // --- Helpers ---

  function handlePlaybackCommand(
    command: string,
    value?: string | number,
  ): object {
    switch (command) {
      case 'play':
        controller.play();
        return { ok: true, status: 'playing' };
      case 'pause':
        controller.pause();
        return { ok: true, status: 'paused' };
      case 'stop':
        controller.stop();
        return { ok: true, status: 'stopped' };
      case 'speed':
        controller.setSpeed(Number(value) || 1);
        return { ok: true, speed: Number(value) || 1 };
      case 'seek':
        controller.seek(String(value));
        return {
          ok: true,
          state: controller.getSessionState(),
          playbackState: controller.getPlaybackState(),
        };
      default:
        return { ok: false, error: `Unknown command: ${command}` };
    }
  }

  function broadcast(msg: object): void {
    const data = JSON.stringify(msg);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  function send(socket: WebSocket, msg: object): void {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(msg));
    }
  }

  // Start listening
  await fastify.listen({ port: opts.port, host: opts.host });
  const addr = fastify.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : opts.port;
  log.info({ host: opts.host, port }, 'Server listening');

  return {
    server: fastify.server,
    async close() {
      await fastify.close();
      configStore?.close();
    },
  };
}
