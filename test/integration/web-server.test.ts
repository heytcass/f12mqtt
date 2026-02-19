/**
 * Integration test: Fastify server + WebSocket + playback.
 *
 * Proves: start server → connect WebSocket → receive state/events →
 *         send playback commands → REST API returns config/sessions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp, type App } from '../../src/web/app.js';
import { SessionRecorder } from '../../src/recording/recorder.js';
import { SignalRPipeline } from '../../src/signalr/pipeline.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';

const RACE_MESSAGES = [
  {
    topic: 'SessionInfo',
    data: {
      Meeting: {
        Name: 'Web Test GP',
        Circuit: { ShortName: 'Webville' },
        Country: { Name: 'Testland' },
      },
      Name: 'Race',
      StartDate: '2025-06-15T14:00:00Z',
    },
    timestamp: '2025-06-15T14:00:00.000Z',
  },
  {
    topic: 'DriverList',
    data: {
      '1': {
        RacingNumber: '1',
        Tla: 'VER',
        TeamName: 'Red Bull Racing',
        TeamColour: '3671C6',
      },
      '4': {
        RacingNumber: '4',
        Tla: 'NOR',
        TeamName: 'McLaren',
        TeamColour: 'FF8000',
      },
    },
    timestamp: '2025-06-15T14:00:00.100Z',
  },
  {
    topic: 'LapCount',
    data: { CurrentLap: 1, TotalLaps: 50 },
    timestamp: '2025-06-15T14:00:00.200Z',
  },
  {
    topic: 'TimingData',
    data: {
      Lines: {
        '1': { Position: '1', GapToLeader: '', InPit: false },
        '4': { Position: '2', GapToLeader: '+1.2', InPit: false },
      },
    },
    timestamp: '2025-06-15T14:00:01.000Z',
  },
  {
    topic: 'TrackStatus',
    data: { Status: '5' },
    timestamp: '2025-06-15T14:01:00.000Z',
  },
  {
    topic: 'TrackStatus',
    data: { Status: '1' },
    timestamp: '2025-06-15T14:02:00.000Z',
  },
  {
    topic: 'TimingData',
    data: { Lines: { '4': { Position: '1' }, '1': { Position: '2' } } },
    timestamp: '2025-06-15T14:02:01.000Z',
  },
];

let tempDir: string;
let sessionDir: string;

/** Record a fixture session to disk before tests run */
async function recordFixtureSession() {
  tempDir = mkdtempSync(join(tmpdir(), 'f12mqtt-web-test-'));
  const pipeline = new SignalRPipeline();
  const recorder = new SessionRecorder(tempDir, 'web-test', 2025);

  pipeline.processMessage(RACE_MESSAGES[0]!);
  recorder.start(
    {
      sessionKey: 'web-test',
      year: 2025,
      sessionName: 'Web Test GP',
      sessionType: 'Race',
      circuit: 'Webville',
      startTime: '2025-06-15T14:00:00Z',
    },
    pipeline.getState(),
  );

  for (let i = 1; i < RACE_MESSAGES.length; i++) {
    recorder.write(RACE_MESSAGES[i]!);
  }
  await recorder.stop();
  sessionDir = recorder.getDirectory();
}

describe('Web server integration', () => {
  let app: App;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    await recordFixtureSession();
    app = await createApp({ port: 0, host: '127.0.0.1', recordingsDir: tempDir });
    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(async () => {
    await app?.close();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('health endpoint returns ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
  });

  it('lists recorded sessions', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`);
    const body = (await res.json()) as Array<{ metadata: { sessionName: string } }>;
    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]!.metadata.sessionName).toBe('Web Test GP');
  });

  it('connects WebSocket, loads session, receives state and events during playback', async () => {
    const messages: Array<{ type: string; [key: string]: unknown }> = [];

    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    // Collect messages
    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    // Load the recorded session via REST
    const loadRes = await fetch(`${baseUrl}/api/playback/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionDir }),
    });
    expect(loadRes.status).toBe(200);

    // Small delay for the 'loaded' message to arrive
    await sleep(50);

    const loadedMsg = messages.find((m) => m.type === 'playback_state');
    expect(loadedMsg).toBeDefined();

    // Play
    messages.length = 0;
    const playRes = await fetch(`${baseUrl}/api/playback/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'play' }),
    });
    expect(playRes.status).toBe(200);

    // Wait for playback to process entries (fake timers won't work here, so use high speed)
    await fetch(`${baseUrl}/api/playback/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'speed', value: 1000 }),
    });

    // Give it time to replay all entries at 1000x speed
    await sleep(500);

    // Should have received update messages with state
    const updateMessages = messages.filter((m) => m.type === 'update');
    expect(updateMessages.length).toBeGreaterThan(0);

    // Should have received event messages (flag changes, overtake)
    const eventMessages = messages.filter((m) => m.type === 'event');
    expect(eventMessages.length).toBeGreaterThan(0);

    // Verify we got a flag change event
    const flagEvent = eventMessages.find(
      (m) => (m.event as { type: string })?.type === 'flag_change',
    );
    expect(flagEvent).toBeDefined();

    // Verify we got an overtake event
    const overtakeEvent = eventMessages.find(
      (m) => (m.event as { type: string })?.type === 'overtake',
    );
    expect(overtakeEvent).toBeDefined();

    ws.close();
  });

  it('seek command repositions playback', async () => {
    // Load session
    await fetch(`${baseUrl}/api/playback/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionDir }),
    });

    // Seek to after red flag
    const seekRes = await fetch(`${baseUrl}/api/playback/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'seek', value: '2025-06-15T14:01:30.000Z' }),
    });
    expect(seekRes.status).toBe(200);
    const seekBody = (await seekRes.json()) as { state: { trackStatus: { flag: string } } };
    expect(seekBody.state.trackStatus.flag).toBe('red');
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
