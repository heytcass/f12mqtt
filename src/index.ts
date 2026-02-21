import { createApp } from './web/app.js';
import { logger } from './util/logger.js';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { SignalRPipeline } from './signalr/pipeline.js';
import { F1SignalRClient } from './signalr/client.js';
import { F1MqttClient } from './mqtt/client.js';
import { MqttPublisher } from './mqtt/publisher.js';
import { ConfigStore } from './config/store.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const DATA_DIR = process.env['DATA_DIR'] ?? './data';
const RECORDINGS_DIR =
  process.env['RECORDINGS_DIR'] ?? join(DATA_DIR, 'recordings');
const DB_PATH = process.env['DB_PATH'] ?? join(DATA_DIR, 'config.db');

// MQTT config (optional — omit MQTT_HOST for web-only mode)
const MQTT_HOST = process.env['MQTT_HOST'];
const MQTT_PORT = parseInt(process.env['MQTT_PORT'] ?? '1883', 10);
const MQTT_USERNAME = process.env['MQTT_USERNAME'];
const MQTT_PASSWORD = process.env['MQTT_PASSWORD'];
const MQTT_PREFIX = process.env['MQTT_PREFIX'] ?? 'f12mqtt';

// F1 SignalR auth cookie (optional — needed for F1TV subscription data)
const AUTH_COOKIE = process.env['AUTH_COOKIE'];

async function main() {
  logger.info('f12mqtt starting...');

  // Ensure data directories exist
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(RECORDINGS_DIR, { recursive: true });

  // Config store — created early so publisher can read settings
  const configStore = new ConfigStore(DB_PATH);

  // Core pipeline
  const pipeline = new SignalRPipeline();

  // MQTT (optional — skip for web-only mode)
  let mqttClient: F1MqttClient | undefined;
  let publisher: MqttPublisher | undefined;

  if (MQTT_HOST) {
    mqttClient = new F1MqttClient({
      host: MQTT_HOST,
      port: MQTT_PORT,
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      prefix: MQTT_PREFIX,
    });
    await mqttClient.connect();

    const favoriteDrivers =
      (configStore.get('favoriteDrivers') as string[] | null) ?? [];
    const awtrixEnabled =
      (configStore.get('awtrixEnabled') as boolean | null) ?? false;
    const awtrixPrefix =
      (configStore.get('awtrixPrefix') as string | null) ?? 'awtrix';

    publisher = new MqttPublisher(mqttClient, {
      prefix: MQTT_PREFIX,
      favoriteDrivers,
      awtrixEnabled,
      awtrixPrefix,
    });
    publisher.registerPersistentEntities();

    logger.info(
      { host: MQTT_HOST, port: MQTT_PORT, prefix: MQTT_PREFIX },
      'MQTT connected',
    );
  } else {
    logger.info('No MQTT_HOST set — running in web-only mode');
  }

  // F1 SignalR client
  const signalRClient = new F1SignalRClient({
    authCookie: AUTH_COOKIE,
  });

  // Wire: SignalR messages → Pipeline
  signalRClient.on('message', (msg) => {
    pipeline.processMessage(msg);
  });

  // Wire: Pipeline state/events → MQTT Publisher
  pipeline.on('update', ({ state, events }) => {
    publisher?.publishState(state);
    publisher?.publishEvents(events);
  });

  // Wire: session lifecycle → MQTT entity registration
  signalRClient.on('connected', () => {
    publisher?.registerSessionEntities();
  });

  signalRClient.on('disconnected', () => {
    publisher?.deregisterSessionEntities();
  });

  // Web server (passes pipeline + signalRClient for live status/WS)
  const app = await createApp({
    port: PORT,
    host: HOST,
    recordingsDir: RECORDINGS_DIR,
    configStore,
    pipeline,
    signalRClient,
  });

  // Start connecting to F1 feed
  signalRClient.start();

  logger.info({ port: PORT, host: HOST, dataDir: DATA_DIR }, 'f12mqtt ready');

  const shutdown = async () => {
    logger.info('Shutting down...');
    signalRClient.stop();
    await mqttClient?.disconnect();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal(err, 'Failed to start');
  process.exit(1);
});
