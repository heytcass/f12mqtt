/**
 * Integration test: OpenF1 client → mapper → pipeline.
 *
 * Uses a local Fastify server to mock the OpenF1 API, then verifies
 * the full flow from HTTP fetch through mapper to event detection.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { OpenF1Client } from '../../src/openf1/client.js';
import { OpenF1Source } from '../../src/openf1/source.js';
import { SignalRPipeline } from '../../src/signalr/pipeline.js';

// Mock OpenF1 API data
const MOCK_DRIVERS = [
  {
    driver_number: 1,
    name_acronym: 'VER',
    first_name: 'Max',
    last_name: 'Verstappen',
    team_name: 'Red Bull Racing',
    team_colour: '3671C6',
    country_code: 'NED',
    session_key: 9999,
  },
  {
    driver_number: 4,
    name_acronym: 'NOR',
    first_name: 'Lando',
    last_name: 'Norris',
    team_name: 'McLaren',
    team_colour: 'FF8000',
    country_code: 'GBR',
    session_key: 9999,
  },
];

const MOCK_RACE_CONTROL = [
  { date: '2025-06-15T14:00:00Z', category: 'Flag', flag: 'GREEN', message: 'GREEN LIGHT' },
  { date: '2025-06-15T14:10:00Z', category: 'Flag', flag: 'RED', message: 'RED FLAG' },
  { date: '2025-06-15T14:20:00Z', category: 'Flag', flag: 'GREEN', message: 'GREEN FLAG' },
];

const MOCK_POSITIONS = [
  { driver_number: 1, position: 1, date: '2025-06-15T14:01:00Z' },
  { driver_number: 4, position: 2, date: '2025-06-15T14:01:00Z' },
  { driver_number: 4, position: 1, date: '2025-06-15T14:25:00Z' },
  { driver_number: 1, position: 2, date: '2025-06-15T14:25:00Z' },
];

const MOCK_PITS = [
  {
    driver_number: 1,
    pit_duration: 23.5,
    date: '2025-06-15T14:15:00Z',
    lap_number: 12,
    stint_number: 2,
    compound: 'HARD',
  },
];

const MOCK_STINTS = [
  {
    driver_number: 1,
    stint_number: 1,
    compound: 'SOFT',
    lap_start: 1,
    lap_end: 12,
    tyre_age_at_start: 0,
    session_key: 9999,
  },
];

const MOCK_WEATHER = [
  {
    date: '2025-06-15T14:00:00Z',
    air_temperature: 25.0,
    track_temperature: 40.0,
    humidity: 55,
    pressure: 1013.0,
    rainfall: 0,
    wind_direction: 180,
    wind_speed: 3.5,
    session_key: 9999,
  },
];

describe('OpenF1 source integration', () => {
  let mockServer: FastifyInstance;
  let mockBaseUrl: string;
  let client: OpenF1Client;

  beforeAll(async () => {
    // Start a local mock OpenF1 API
    mockServer = Fastify({ logger: false });

    mockServer.get('/drivers', async (request) => {
      return MOCK_DRIVERS;
    });

    mockServer.get('/race_control', async () => {
      return MOCK_RACE_CONTROL;
    });

    mockServer.get('/position', async () => {
      return MOCK_POSITIONS;
    });

    mockServer.get('/pit', async () => {
      return MOCK_PITS;
    });

    mockServer.get('/stints', async () => {
      return MOCK_STINTS;
    });

    mockServer.get('/weather', async () => {
      return MOCK_WEATHER;
    });

    mockServer.get('/sessions', async () => {
      return [{
        session_key: 9999,
        session_name: 'Race',
        session_type: 'Race',
        date_start: '2025-06-15T14:00:00Z',
        date_end: '2025-06-15T16:00:00Z',
        year: 2025,
        circuit_short_name: 'Testville',
        country_name: 'Testland',
        meeting_name: 'Test GP',
      }];
    });

    await mockServer.listen({ port: 0, host: '127.0.0.1' });
    const addr = mockServer.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    mockBaseUrl = `http://127.0.0.1:${port}`;

    client = new OpenF1Client(mockBaseUrl);
  });

  afterAll(async () => {
    await mockServer?.close();
  });

  it('client fetches sessions from mock API', async () => {
    const sessions = await client.getSessions({ year: 2025 });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.session_key).toBe(9999);
  });

  it('client fetches drivers from mock API', async () => {
    const drivers = await client.getDrivers(9999);
    expect(drivers).toHaveLength(2);
    expect(drivers[0]!.name_acronym).toBe('VER');
  });

  it('OpenF1Source loads data and produces timeline entries that detect events', async () => {
    const source = new OpenF1Source(9999, client);

    // Get initial state (should have drivers)
    const initialState = await source.getInitialState();
    expect(initialState).not.toBeNull();
    expect(Object.keys(initialState!.drivers)).toHaveLength(2);
    expect(initialState!.drivers['1']!.abbreviation).toBe('VER');

    // Get time range
    const range = await source.getTimeRange();
    expect(range).not.toBeNull();

    // Feed all entries through the pipeline
    const pipeline = new SignalRPipeline();
    pipeline.loadInitialState(initialState!);

    const allEvents: Array<{ type: string }> = [];
    const entries: Array<{ timestamp: string; topic: string }> = [];

    for await (const entry of source.stream(range!.start, Infinity)) {
      const result = pipeline.processMessage({
        topic: entry.topic,
        data: entry.data,
        timestamp: entry.timestamp,
      });
      entries.push({ timestamp: entry.timestamp, topic: entry.topic });
      for (const event of result.events) {
        allEvents.push(event);
      }
    }

    // Should have timeline entries from race control, positions, and pits
    expect(entries.length).toBeGreaterThan(0);

    // Verify flag events detected (GREEN → RED → GREEN = 2 flag changes)
    const flagEvents = allEvents.filter((e) => e.type === 'flag_change');
    expect(flagEvents.length).toBeGreaterThanOrEqual(2);

    // Verify overtake detected (NOR passes VER at 14:25)
    const overtakeEvents = allEvents.filter((e) => e.type === 'overtake');
    expect(overtakeEvents.length).toBeGreaterThanOrEqual(1);

    // Final state should show NOR in P1
    const finalState = pipeline.getState();
    expect(finalState.timing['4']?.position).toBe(1);
    expect(finalState.timing['1']?.position).toBe(2);

    await source.close();
  });
});
