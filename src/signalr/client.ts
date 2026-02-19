/**
 * F1 Live Timing SignalR client.
 * Connects to livetiming.formula1.com/signalr using legacy ASP.NET SignalR protocol.
 */

import { Client as SignalRClient } from 'node-signalr';
import { EventEmitter } from 'node:events';
import { createChildLogger } from '../util/logger.js';
import { SIGNALR_BASE_URL, SIGNALR_TOPICS } from '../util/constants.js';
import { decompressMessage } from '../util/zlib.js';

const log = createChildLogger('signalr');

const HUB_NAME = 'Streaming';

export interface SignalRMessage {
  topic: string;
  data: unknown;
  timestamp: string;
}

export interface F1SignalRClientOptions {
  /** Optional auth cookie for F1TV subscription data */
  authCookie?: string;
}

export class F1SignalRClient extends EventEmitter {
  private client: SignalRClient | null = null;
  private connected = false;

  constructor(private options: F1SignalRClientOptions = {}) {
    super();
  }

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    const client = new SignalRClient(SIGNALR_BASE_URL, [HUB_NAME]);

    // Required headers for F1 SignalR endpoint
    client.headers['User-Agent'] = 'BestHTTP';
    client.headers['Accept-Encoding'] = 'gzip, identity';

    if (this.options.authCookie) {
      client.headers['Cookie'] = this.options.authCookie;
    }

    client.reconnectDelayTime = 5000;
    client.requestTimeout = 10000;

    client.on('connected', () => {
      log.info('Connected to F1 Live Timing');
      this.connected = true;
      this.subscribe(client);
      this.emit('connected');
    });

    client.on('reconnecting', (count) => {
      log.warn({ retryCount: count }, 'Reconnecting...');
      this.connected = false;
      this.emit('reconnecting', count);
    });

    client.on('disconnected', (reason) => {
      log.info({ reason }, 'Disconnected');
      this.connected = false;
      this.emit('disconnected', reason);
    });

    client.on('error', (error) => {
      log.error({ code: error.code, message: error.message }, 'SignalR error');
      this.emit('error', error);
    });

    this.client = client;
    client.start();
  }

  stop(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
    }
  }

  private subscribe(client: SignalRClient): void {
    // Subscribe to receive data for all topics via the "feed" method
    for (const topic of SIGNALR_TOPICS) {
      client.connection.hub.on(HUB_NAME, topic, (data: unknown) => {
        this.handleMessage(topic, data);
      });
    }

    // Invoke Subscribe on the Streaming hub with the list of topics
    client.connection.hub.invoke(HUB_NAME, 'Subscribe', [
      ...SIGNALR_TOPICS,
    ]);

    log.info({ topics: SIGNALR_TOPICS.length }, 'Subscribed to topics');
  }

  private handleMessage(topic: string, data: unknown): void {
    const timestamp = new Date().toISOString();

    // Handle compressed .z topics
    if (topic.endsWith('.z') && typeof data === 'string') {
      decompressMessage(data)
        .then((decompressed) => {
          const parsed: unknown = JSON.parse(decompressed);
          const baseTopic = topic.replace('.z', '');
          const msg: SignalRMessage = {
            topic: baseTopic,
            data: parsed,
            timestamp,
          };
          this.emit('message', msg);
        })
        .catch((err) => {
          log.error({ topic, err }, 'Failed to decompress message');
        });
    } else {
      const msg: SignalRMessage = { topic, data, timestamp };
      this.emit('message', msg);
    }
  }
}
