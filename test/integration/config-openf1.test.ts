/**
 * Integration test: Config persistence + OpenF1 data through pipeline.
 *
 * Proves:
 * 1. Config saves to SQLite and loads back correctly
 * 2. OpenF1 API responses map to internal types
 * 3. OpenF1 data fed through the pipeline produces valid state + events
 */

import { describe, it, expect, afterEach } from 'vitest';
import { ConfigStore } from '../../src/config/store.js';
import { mapOpenF1RaceControl, mapOpenF1Position, mapOpenF1Pit } from '../../src/openf1/mapper.js';
import { SignalRPipeline } from '../../src/signalr/pipeline.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Config persistence', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves and loads config from SQLite', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'f12mqtt-config-'));
    const dbPath = join(tempDir, 'config.db');
    const store = new ConfigStore(dbPath);

    // Save config
    store.set('mqtt', {
      host: '192.168.1.100',
      port: 1883,
      username: 'homeassistant',
      password: 'secret',
      prefix: 'f12mqtt',
    });

    store.set('awtrix', {
      enabled: true,
      prefix: 'awtrix_abc123',
    });

    store.set('favorites', ['1', '4', '44']);

    // Load in a new store instance (simulates app restart)
    const store2 = new ConfigStore(dbPath);
    const mqtt = store2.get('mqtt');
    expect(mqtt).toEqual({
      host: '192.168.1.100',
      port: 1883,
      username: 'homeassistant',
      password: 'secret',
      prefix: 'f12mqtt',
    });

    const awtrix = store2.get('awtrix');
    expect(awtrix).toEqual({ enabled: true, prefix: 'awtrix_abc123' });

    const favs = store2.get('favorites');
    expect(favs).toEqual(['1', '4', '44']);

    store.close();
    store2.close();
  });

  it('returns null for missing keys', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'f12mqtt-config-'));
    const store = new ConfigStore(join(tempDir, 'config.db'));
    expect(store.get('nonexistent')).toBeNull();
    store.close();
  });

  it('overwrites existing keys', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'f12mqtt-config-'));
    const store = new ConfigStore(join(tempDir, 'config.db'));
    store.set('favorites', ['1']);
    store.set('favorites', ['1', '44']);
    expect(store.get('favorites')).toEqual(['1', '44']);
    store.close();
  });
});

describe('OpenF1 data through pipeline', () => {
  it('maps race control messages to SignalR-compatible format and detects flag', () => {
    const openf1RaceControl = {
      date: '2025-06-15T14:30:00.000Z',
      category: 'Flag',
      flag: 'RED',
      message: 'RED FLAG',
    };

    const mapped = mapOpenF1RaceControl(openf1RaceControl);
    expect(mapped.topic).toBe('TrackStatus');

    const pipeline = new SignalRPipeline();
    pipeline.processMessage({
      topic: 'TrackStatus',
      data: { Status: '1' },
      timestamp: '2025-06-15T14:00:00Z',
    });
    const result = pipeline.processMessage({
      topic: mapped.topic,
      data: mapped.data,
      timestamp: mapped.timestamp,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.type).toBe('flag_change');
    if (result.events[0]!.type === 'flag_change') {
      expect(result.events[0]!.newFlag).toBe('red');
    }
  });

  it('maps position data and detects overtakes', () => {
    const pipeline = new SignalRPipeline();

    // Set up drivers
    pipeline.processMessage({
      topic: 'DriverList',
      data: {
        '1': { RacingNumber: '1', Tla: 'VER', TeamName: 'Red Bull Racing' },
        '4': { RacingNumber: '4', Tla: 'NOR', TeamName: 'McLaren' },
      },
      timestamp: '2025-06-15T14:00:00Z',
    });

    // Initial positions via OpenF1 format
    const positions1 = [
      { driver_number: 1, position: 1, date: '2025-06-15T14:00:01Z' },
      { driver_number: 4, position: 2, date: '2025-06-15T14:00:01Z' },
    ];
    const mapped1 = mapOpenF1Position(positions1);
    pipeline.processMessage({
      topic: mapped1.topic,
      data: mapped1.data,
      timestamp: mapped1.timestamp,
    });

    // Set InPit false explicitly
    pipeline.processMessage({
      topic: 'TimingData',
      data: {
        Lines: {
          '1': { InPit: false },
          '4': { InPit: false },
        },
      },
      timestamp: '2025-06-15T14:00:01Z',
    });

    // Overtake: NOR passes VER
    const positions2 = [
      { driver_number: 4, position: 1, date: '2025-06-15T14:01:00Z' },
      { driver_number: 1, position: 2, date: '2025-06-15T14:01:00Z' },
    ];
    const mapped2 = mapOpenF1Position(positions2);
    const result = pipeline.processMessage({
      topic: mapped2.topic,
      data: mapped2.data,
      timestamp: mapped2.timestamp,
    });

    const overtake = result.events.find((e) => e.type === 'overtake');
    expect(overtake).toBeDefined();
    if (overtake?.type === 'overtake') {
      expect(overtake.overtakingAbbreviation).toBe('NOR');
    }
  });

  it('maps pit data and detects pit stops', () => {
    const pipeline = new SignalRPipeline();

    pipeline.processMessage({
      topic: 'DriverList',
      data: {
        '1': { RacingNumber: '1', Tla: 'VER', TeamName: 'Red Bull Racing' },
      },
      timestamp: '2025-06-15T14:00:00Z',
    });

    // Initial stint
    pipeline.processMessage({
      topic: 'TimingAppData',
      data: {
        Lines: {
          '1': { Stints: { '0': { Compound: 'SOFT', New: 'true', TotalLaps: 0 } } },
        },
      },
      timestamp: '2025-06-15T14:00:00Z',
    });

    // Pit stop from OpenF1
    const openf1Pit = {
      driver_number: 1,
      pit_duration: 23.5,
      date: '2025-06-15T14:20:00Z',
      lap_number: 15,
      stint_number: 2,
      compound: 'HARD',
    };
    const mapped = mapOpenF1Pit(openf1Pit);
    const result = pipeline.processMessage({
      topic: mapped.topic,
      data: mapped.data,
      timestamp: mapped.timestamp,
    });

    const pitStop = result.events.find((e) => e.type === 'pit_stop');
    expect(pitStop).toBeDefined();
    if (pitStop?.type === 'pit_stop') {
      expect(pitStop.abbreviation).toBe('VER');
      expect(pitStop.newCompound).toBe('HARD');
    }
  });
});
