/**
 * Integration test: Config API routes through Fastify server.
 *
 * Proves:
 * 1. GET /api/config returns all config from SQLite
 * 2. PUT /api/config/:key saves and returns updated value
 * 3. Config persists and loads correctly across requests
 * 4. WebSocket clients receive config change notifications
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp, type App } from '../../src/web/app.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';

describe('Config API integration', () => {
  let tempDir: string;
  let app: App;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'f12mqtt-config-api-'));
    const recordingsDir = join(tempDir, 'recordings');
    const dbPath = join(tempDir, 'config.db');

    app = await createApp({
      port: 0,
      host: '127.0.0.1',
      recordingsDir,
      dbPath,
    });

    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(async () => {
    await app?.close();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /api/config returns empty config initially', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({});
  });

  it('PUT /api/config/:key saves and returns value', async () => {
    const mqttConfig = {
      host: '192.168.1.100',
      port: 1883,
      username: 'homeassistant',
      password: 'secret',
      prefix: 'f12mqtt',
    };

    const res = await fetch(`${baseUrl}/api/config/mqtt`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: mqttConfig }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    // Read it back
    const getRes = await fetch(`${baseUrl}/api/config`);
    const allConfig = (await getRes.json()) as Record<string, unknown>;
    expect(allConfig['mqtt']).toEqual(mqttConfig);
  });

  it('saves multiple config keys and retrieves all', async () => {
    await fetch(`${baseUrl}/api/config/awtrix`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { enabled: true, prefix: 'awtrix_abc' } }),
    });

    await fetch(`${baseUrl}/api/config/favorites`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: ['1', '4', '44'] }),
    });

    const res = await fetch(`${baseUrl}/api/config`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['mqtt']).toBeDefined(); // from previous test
    expect(body['awtrix']).toEqual({ enabled: true, prefix: 'awtrix_abc' });
    expect(body['favorites']).toEqual(['1', '4', '44']);
  });

  it('DELETE /api/config/:key removes a key', async () => {
    // First verify it exists
    let res = await fetch(`${baseUrl}/api/config`);
    let body = (await res.json()) as Record<string, unknown>;
    expect(body['awtrix']).toBeDefined();

    // Delete it
    const delRes = await fetch(`${baseUrl}/api/config/awtrix`, {
      method: 'DELETE',
    });
    expect(delRes.status).toBe(200);

    // Verify it's gone
    res = await fetch(`${baseUrl}/api/config`);
    body = (await res.json()) as Record<string, unknown>;
    expect(body['awtrix']).toBeUndefined();
  });

  it('WebSocket client receives config_change notification on PUT', async () => {
    const messages: Array<{ type: string; [key: string]: unknown }> = [];

    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    // Small delay for WS setup
    await sleep(50);
    messages.length = 0; // clear the initial playback_state message

    // Update config
    await fetch(`${baseUrl}/api/config/favorites`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: ['1', '16', '63'] }),
    });

    await sleep(50);

    const configMsg = messages.find((m) => m.type === 'config_change');
    expect(configMsg).toBeDefined();
    expect(configMsg!['key']).toBe('favorites');
    expect(configMsg!['value']).toEqual(['1', '16', '63']);

    ws.close();
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
