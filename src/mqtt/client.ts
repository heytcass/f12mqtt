/**
 * MQTT client wrapper with LWT (Last Will and Testament) support.
 */

import mqtt from 'mqtt';
import type { MqttClient, IClientOptions } from 'mqtt';
import { createChildLogger } from '../util/logger.js';
import { statusTopic } from './topics.js';

const log = createChildLogger('mqtt');

export interface MqttConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  prefix: string;
}

export class F1MqttClient {
  private client: MqttClient | null = null;
  private prefix: string;

  constructor(private config: MqttConfig) {
    this.prefix = config.prefix;
  }

  async connect(): Promise<void> {
    const url = `mqtt://${this.config.host}:${this.config.port}`;
    const opts: IClientOptions = {
      will: {
        topic: statusTopic(this.prefix),
        payload: Buffer.from('offline'),
        qos: 1,
        retain: true,
      },
      username: this.config.username,
      password: this.config.password,
    };

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(url, opts);

      this.client.on('connect', () => {
        log.info({ url }, 'Connected to MQTT broker');
        // Publish online status
        this.publish(statusTopic(this.prefix), 'online', true);
        resolve();
      });

      this.client.on('error', (err) => {
        log.error({ err }, 'MQTT error');
        reject(err);
      });

      this.client.on('reconnect', () => {
        log.warn('MQTT reconnecting...');
      });

      // Subscribe to playback command topic
      this.client.on('connect', () => {
        this.client?.subscribe(`${this.prefix}/playback/command`);
      });

      this.client.on('message', (topic, payload) => {
        if (topic === `${this.prefix}/playback/command`) {
          this.onPlaybackCommand?.(payload.toString());
        }
      });
    });
  }

  /** Callback for playback commands received via MQTT */
  onPlaybackCommand?: (command: string) => void;

  publish(topic: string, payload: string | object, retain = false): void {
    if (!this.client?.connected) {
      log.warn({ topic }, 'Cannot publish: not connected');
      return;
    }

    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.client.publish(topic, data, { qos: 0, retain });
  }

  /** Publish empty payload to remove a retained topic */
  clear(topic: string): void {
    this.publish(topic, '', true);
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    // Publish offline before disconnect (LWT is for ungraceful disconnects)
    this.publish(statusTopic(this.prefix), 'offline', true);
    return new Promise((resolve) => {
      this.client?.end(false, () => {
        log.info('MQTT disconnected');
        resolve();
      });
    });
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }
}
