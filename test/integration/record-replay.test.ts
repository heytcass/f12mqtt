/**
 * Integration test: record a session → load it back → replay through PlaybackController.
 * Verifies that:
 * 1. Recorded data survives round-trip to disk
 * 2. Replayed data produces the same state as live
 * 3. Events are detected during replay
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { SignalRPipeline } from '../../src/signalr/pipeline.js';
import { SessionRecorder } from '../../src/recording/recorder.js';
import { PlaybackController } from '../../src/playback/controller.js';
import { Timeline } from '../../src/playback/timeline.js';
import { loadInitialState, loadTimeline } from '../../src/recording/storage.js';
import type { SignalRMessage } from '../../src/signalr/client.js';
import type { F1Event } from '../../src/events/types.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** A realistic sequence of SignalR messages simulating part of a race */
const RACE_MESSAGES: SignalRMessage[] = [
  {
    topic: 'SessionInfo',
    data: {
      Meeting: {
        Name: 'Test Grand Prix',
        Circuit: { ShortName: 'Testington' },
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
        FirstName: 'Max',
        LastName: 'Verstappen',
        TeamName: 'Red Bull Racing',
        TeamColour: '3671C6',
      },
      '4': {
        RacingNumber: '4',
        Tla: 'NOR',
        FirstName: 'Lando',
        LastName: 'Norris',
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
    topic: 'WeatherData',
    data: {
      AirTemp: '25.0',
      TrackTemp: '42.0',
      Rainfall: '0',
      Humidity: '55.0',
      WindSpeed: '3.0',
      WindDirection: '180',
      Pressure: '1013.0',
    },
    timestamp: '2025-06-15T14:00:00.300Z',
  },
  {
    topic: 'TimingData',
    data: {
      Lines: {
        '1': { Position: '1', GapToLeader: '', InPit: false, Retired: false },
        '4': {
          Position: '2',
          GapToLeader: '+1.2',
          InPit: false,
          Retired: false,
        },
      },
    },
    timestamp: '2025-06-15T14:00:01.000Z',
  },
  {
    topic: 'TimingAppData',
    data: {
      Lines: {
        '1': { Stints: { '0': { Compound: 'SOFT', New: 'true', TotalLaps: 0 } } },
        '4': { Stints: { '0': { Compound: 'MEDIUM', New: 'true', TotalLaps: 0 } } },
      },
    },
    timestamp: '2025-06-15T14:00:01.100Z',
  },
  // Lap 2
  {
    topic: 'LapCount',
    data: { CurrentLap: 2, TotalLaps: 50 },
    timestamp: '2025-06-15T14:01:30.000Z',
  },
  // Rain starts!
  {
    topic: 'WeatherData',
    data: { Rainfall: '1' },
    timestamp: '2025-06-15T14:02:00.000Z',
  },
  // Red flag
  {
    topic: 'TrackStatus',
    data: { Status: '5', Message: 'RED FLAG' },
    timestamp: '2025-06-15T14:02:30.000Z',
  },
  // Back to green
  {
    topic: 'TrackStatus',
    data: { Status: '1' },
    timestamp: '2025-06-15T14:05:00.000Z',
  },
  // NOR overtakes VER
  {
    topic: 'TimingData',
    data: {
      Lines: {
        '4': { Position: '1' },
        '1': { Position: '2' },
      },
    },
    timestamp: '2025-06-15T14:05:01.000Z',
  },
  // VER pits
  {
    topic: 'TimingData',
    data: { Lines: { '1': { InPit: true } } },
    timestamp: '2025-06-15T14:06:00.000Z',
  },
  {
    topic: 'TimingAppData',
    data: {
      Lines: {
        '1': {
          Stints: {
            '0': { Compound: 'SOFT', New: 'true', TotalLaps: 6 },
            '1': { Compound: 'INTERMEDIATE', New: 'true', TotalLaps: 0 },
          },
        },
      },
    },
    timestamp: '2025-06-15T14:06:01.000Z',
  },
];

describe('Record → Replay integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'f12mqtt-replay-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('records a session and replays it with identical state and events', async () => {
    // === PHASE 1: Record live session ===
    const livePipeline = new SignalRPipeline();
    const recorder = new SessionRecorder(tempDir, 'test-gp', 2025);
    const liveEvents: F1Event[] = [];

    livePipeline.on('event', (event: F1Event) => {
      liveEvents.push(event);
    });

    // Process first message to get initial state, then start recording
    livePipeline.processMessage(RACE_MESSAGES[0]!);
    recorder.start(
      {
        sessionKey: 'test-gp',
        year: 2025,
        sessionName: 'Test Grand Prix',
        sessionType: 'Race',
        circuit: 'Testington',
        startTime: '2025-06-15T14:00:00Z',
      },
      livePipeline.getState(),
    );

    // Process remaining messages, recording each one
    for (let i = 1; i < RACE_MESSAGES.length; i++) {
      const msg = RACE_MESSAGES[i]!;
      recorder.write(msg);
      livePipeline.processMessage(msg);
    }

    const liveEndState = livePipeline.getState();
    await recorder.stop();

    // Verify live processing detected expected events
    const liveEventTypes = liveEvents.map((e) => e.type);
    expect(liveEventTypes).toContain('weather_change');
    expect(liveEventTypes).toContain('flag_change');
    expect(liveEventTypes).toContain('overtake');
    expect(liveEventTypes).toContain('pit_stop');

    // === PHASE 2: Load recording and replay ===
    const sessionDir = recorder.getDirectory();
    const initialState = loadInitialState(sessionDir);
    const timelineEntries = loadTimeline(sessionDir);

    expect(initialState).not.toBeNull();
    expect(timelineEntries.length).toBe(RACE_MESSAGES.length - 1); // first msg was initial state

    const timeline = new Timeline(timelineEntries);
    const controller = new PlaybackController();
    const replayEvents: F1Event[] = [];

    controller.on('event', (event: F1Event) => {
      replayEvents.push(event);
    });

    controller.load(timeline, initialState!, 'recorded');

    // Use fake timers to fast-forward through playback
    vi.useFakeTimers();
    controller.play();
    vi.runAllTimers();
    vi.useRealTimers();

    // === PHASE 3: Compare live vs replay ===

    // Same events should be detected
    const replayEventTypes = replayEvents.map((e) => e.type);
    expect(replayEventTypes).toContain('weather_change');
    expect(replayEventTypes).toContain('flag_change');
    expect(replayEventTypes).toContain('overtake');
    expect(replayEventTypes).toContain('pit_stop');

    // Same number of each event type
    for (const eventType of ['flag_change', 'overtake', 'pit_stop', 'weather_change'] as const) {
      const liveCount = liveEvents.filter((e) => e.type === eventType).length;
      const replayCount = replayEvents.filter((e) => e.type === eventType).length;
      expect(replayCount, `${eventType} count mismatch`).toBe(liveCount);
    }

    // End state should match
    const replayEndState = controller.getSessionState();
    expect(replayEndState.lapCount).toEqual(liveEndState.lapCount);
    expect(replayEndState.trackStatus).toEqual(liveEndState.trackStatus);
    expect(replayEndState.weather?.rainfall).toBe(liveEndState.weather?.rainfall);
    expect(replayEndState.timing['1']?.position).toBe(
      liveEndState.timing['1']?.position,
    );
    expect(replayEndState.timing['4']?.position).toBe(
      liveEndState.timing['4']?.position,
    );
    expect(replayEndState.stints['1']?.compound).toBe(
      liveEndState.stints['1']?.compound,
    );

    // Verify specific event details
    const replayOvertake = replayEvents.find((e) => e.type === 'overtake');
    expect(replayOvertake).toBeDefined();
    if (replayOvertake?.type === 'overtake') {
      expect(replayOvertake.overtakingAbbreviation).toBe('NOR');
      expect(replayOvertake.overtakenAbbreviation).toBe('VER');
    }

    const replayPitStop = replayEvents.find((e) => e.type === 'pit_stop');
    expect(replayPitStop).toBeDefined();
    if (replayPitStop?.type === 'pit_stop') {
      expect(replayPitStop.abbreviation).toBe('VER');
      expect(replayPitStop.newCompound).toBe('INTERMEDIATE');
    }
  });

  it('seek during replay produces correct state', async () => {
    // Record
    const livePipeline = new SignalRPipeline();
    const recorder = new SessionRecorder(tempDir, 'seek-test', 2025);

    livePipeline.processMessage(RACE_MESSAGES[0]!);
    recorder.start(
      {
        sessionKey: 'seek-test',
        year: 2025,
        sessionName: 'Seek Test',
        sessionType: 'Race',
        circuit: 'Testington',
        startTime: '2025-06-15T14:00:00Z',
      },
      livePipeline.getState(),
    );

    for (let i = 1; i < RACE_MESSAGES.length; i++) {
      recorder.write(RACE_MESSAGES[i]!);
    }
    await recorder.stop();

    // Load and seek
    const sessionDir = recorder.getDirectory();
    const initialState = loadInitialState(sessionDir)!;
    const timeline = new Timeline(loadTimeline(sessionDir));
    const controller = new PlaybackController();
    controller.load(timeline, initialState, 'recorded');

    // Seek to just after the red flag (14:02:30)
    controller.seek('2025-06-15T14:03:00.000Z');
    const stateAfterRedFlag = controller.getSessionState();
    expect(stateAfterRedFlag.trackStatus.flag).toBe('red');
    expect(stateAfterRedFlag.lapCount.current).toBe(2);
    expect(stateAfterRedFlag.weather?.rainfall).toBe(true);

    // Seek forward to after the overtake (14:05:01)
    controller.seek('2025-06-15T14:05:02.000Z');
    const stateAfterOvertake = controller.getSessionState();
    expect(stateAfterOvertake.trackStatus.flag).toBe('green');
    expect(stateAfterOvertake.timing['4']?.position).toBe(1);
    expect(stateAfterOvertake.timing['1']?.position).toBe(2);

    // Seek backward to before the red flag
    controller.seek('2025-06-15T14:01:00.000Z');
    const stateBeforeRedFlag = controller.getSessionState();
    expect(stateBeforeRedFlag.trackStatus.flag).toBe('green');
    expect(stateBeforeRedFlag.timing['1']?.position).toBe(1);
    expect(stateBeforeRedFlag.lapCount.current).toBe(1);
  });
});
