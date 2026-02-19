import { describe, it, expect } from 'vitest';
import { detectFlagChange } from '../../src/events/flag-detector.js';
import { detectOvertakes } from '../../src/events/overtake-detector.js';
import { detectPitStops } from '../../src/events/pit-detector.js';
import { detectWeatherChange } from '../../src/events/weather-detector.js';
import type { SessionState } from '../../src/data/types.js';
import { createEmptySessionState } from '../../src/data/types.js';

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return { ...createEmptySessionState(), ...overrides };
}

// ─── Flag Detector ───────────────────────────────────────────────

describe('detectFlagChange', () => {
  it('detects green to red transition', () => {
    const prev = makeState({ trackStatus: { flag: 'green' } });
    const curr = makeState({
      trackStatus: { flag: 'red', message: 'Red Flag' },
      timestamp: '2025-01-01T00:00:00Z',
    });
    const events = detectFlagChange(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('flag_change');
    expect(events[0]?.previousFlag).toBe('green');
    expect(events[0]?.newFlag).toBe('red');
  });

  it('detects safety car deployment', () => {
    const prev = makeState({ trackStatus: { flag: 'green' } });
    const curr = makeState({ trackStatus: { flag: 'sc' } });
    const events = detectFlagChange(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]?.newFlag).toBe('sc');
  });

  it('returns empty when flag unchanged', () => {
    const prev = makeState({ trackStatus: { flag: 'green' } });
    const curr = makeState({ trackStatus: { flag: 'green' } });
    const events = detectFlagChange(prev, curr);
    expect(events).toHaveLength(0);
  });

  it('detects VSC to VSC ending', () => {
    const prev = makeState({ trackStatus: { flag: 'vsc' } });
    const curr = makeState({ trackStatus: { flag: 'vsc_ending' } });
    const events = detectFlagChange(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]?.previousFlag).toBe('vsc');
    expect(events[0]?.newFlag).toBe('vsc_ending');
  });
});

// ─── Overtake Detector ───────────────────────────────────────────

describe('detectOvertakes', () => {
  it('detects a simple position swap', () => {
    const prev = makeState({
      trackStatus: { flag: 'green' },
      timing: {
        '1': {
          driverNumber: '1',
          position: 1,
          gapToLeader: '',
          interval: '',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: false,
          retired: false,
          stopped: false,
        },
        '44': {
          driverNumber: '44',
          position: 2,
          gapToLeader: '+1.0',
          interval: '+1.0',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: false,
          retired: false,
          stopped: false,
        },
      },
      drivers: {
        '1': {
          driverNumber: '1',
          abbreviation: 'VER',
          firstName: 'Max',
          lastName: 'Verstappen',
          teamName: 'Red Bull Racing',
          teamColor: '3671C6',
          countryCode: 'NED',
        },
        '44': {
          driverNumber: '44',
          abbreviation: 'HAM',
          firstName: 'Lewis',
          lastName: 'Hamilton',
          teamName: 'Ferrari',
          teamColor: 'E8002D',
          countryCode: 'GBR',
        },
      },
    });

    const curr = makeState({
      ...prev,
      timing: {
        '1': { ...prev.timing['1']!, position: 2 },
        '44': { ...prev.timing['44']!, position: 1 },
      },
      drivers: prev.drivers,
      trackStatus: { flag: 'green' },
    });

    const events = detectOvertakes(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]?.overtakingDriver).toBe('44');
    expect(events[0]?.overtakingAbbreviation).toBe('HAM');
    expect(events[0]?.overtakenDriver).toBe('1');
    expect(events[0]?.newPosition).toBe(1);
  });

  it('filters out overtakes when overtaken driver is in pit', () => {
    const prev = makeState({
      trackStatus: { flag: 'green' },
      timing: {
        '1': {
          driverNumber: '1',
          position: 1,
          gapToLeader: '',
          interval: '',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: true, // VER pitting
          retired: false,
          stopped: false,
        },
        '44': {
          driverNumber: '44',
          position: 2,
          gapToLeader: '+1.0',
          interval: '+1.0',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: false,
          retired: false,
          stopped: false,
        },
      },
      drivers: {
        '1': {
          driverNumber: '1',
          abbreviation: 'VER',
          firstName: 'Max',
          lastName: 'Verstappen',
          teamName: 'Red Bull Racing',
          teamColor: '3671C6',
          countryCode: 'NED',
        },
        '44': {
          driverNumber: '44',
          abbreviation: 'HAM',
          firstName: 'Lewis',
          lastName: 'Hamilton',
          teamName: 'Ferrari',
          teamColor: 'E8002D',
          countryCode: 'GBR',
        },
      },
    });

    const curr = makeState({
      ...prev,
      timing: {
        '1': { ...prev.timing['1']!, position: 2 },
        '44': { ...prev.timing['44']!, position: 1 },
      },
      drivers: prev.drivers,
      trackStatus: { flag: 'green' },
    });

    const events = detectOvertakes(prev, curr);
    expect(events).toHaveLength(0);
  });

  it('filters out overtakes when overtaken driver is retired', () => {
    const prev = makeState({
      trackStatus: { flag: 'green' },
      timing: {
        '1': {
          driverNumber: '1',
          position: 1,
          gapToLeader: '',
          interval: '',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: false,
          retired: true, // retired
          stopped: false,
        },
        '44': {
          driverNumber: '44',
          position: 2,
          gapToLeader: '+1.0',
          interval: '+1.0',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: false,
          retired: false,
          stopped: false,
        },
      },
      drivers: {
        '1': {
          driverNumber: '1',
          abbreviation: 'VER',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: '3671C6',
          countryCode: '',
        },
        '44': {
          driverNumber: '44',
          abbreviation: 'HAM',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: 'E8002D',
          countryCode: '',
        },
      },
    });

    const curr = makeState({
      ...prev,
      timing: {
        '1': { ...prev.timing['1']!, position: 2 },
        '44': { ...prev.timing['44']!, position: 1 },
      },
      drivers: prev.drivers,
      trackStatus: { flag: 'green' },
    });

    const events = detectOvertakes(prev, curr);
    expect(events).toHaveLength(0);
  });

  it('filters out overtakes during safety car', () => {
    const prev = makeState({
      trackStatus: { flag: 'sc' },
      timing: {
        '1': {
          driverNumber: '1',
          position: 1,
          gapToLeader: '',
          interval: '',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: false,
          retired: false,
          stopped: false,
        },
        '44': {
          driverNumber: '44',
          position: 2,
          gapToLeader: '+1.0',
          interval: '+1.0',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: false,
          retired: false,
          stopped: false,
        },
      },
      drivers: {
        '1': {
          driverNumber: '1',
          abbreviation: 'VER',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: '3671C6',
          countryCode: '',
        },
        '44': {
          driverNumber: '44',
          abbreviation: 'HAM',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: 'E8002D',
          countryCode: '',
        },
      },
    });

    const curr = makeState({
      ...prev,
      timing: {
        '1': { ...prev.timing['1']!, position: 2 },
        '44': { ...prev.timing['44']!, position: 1 },
      },
      drivers: prev.drivers,
      trackStatus: { flag: 'sc' },
    });

    const events = detectOvertakes(prev, curr);
    expect(events).toHaveLength(0);
  });

  it('filters out overtakes when overtaking driver is in pit', () => {
    const prev = makeState({
      trackStatus: { flag: 'green' },
      timing: {
        '1': {
          driverNumber: '1',
          position: 1,
          gapToLeader: '',
          interval: '',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: false,
          retired: false,
          stopped: false,
        },
        '44': {
          driverNumber: '44',
          position: 2,
          gapToLeader: '+1.0',
          interval: '+1.0',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: true, // HAM pitting
          retired: false,
          stopped: false,
        },
      },
      drivers: {
        '1': {
          driverNumber: '1',
          abbreviation: 'VER',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: '3671C6',
          countryCode: '',
        },
        '44': {
          driverNumber: '44',
          abbreviation: 'HAM',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: 'E8002D',
          countryCode: '',
        },
      },
    });

    const curr = makeState({
      ...prev,
      timing: {
        '1': { ...prev.timing['1']!, position: 2 },
        '44': { ...prev.timing['44']!, position: 1, inPit: true },
      },
      drivers: prev.drivers,
      trackStatus: { flag: 'green' },
    });

    const events = detectOvertakes(prev, curr);
    expect(events).toHaveLength(0);
  });

  it('returns empty when no position changes', () => {
    const state = makeState({
      trackStatus: { flag: 'green' },
      timing: {
        '1': {
          driverNumber: '1',
          position: 1,
          gapToLeader: '',
          interval: '',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: false,
          retired: false,
          stopped: false,
        },
      },
      drivers: {
        '1': {
          driverNumber: '1',
          abbreviation: 'VER',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: '3671C6',
          countryCode: '',
        },
      },
    });
    const events = detectOvertakes(state, state);
    expect(events).toHaveLength(0);
  });
});

// ─── Pit Stop Detector ───────────────────────────────────────────

describe('detectPitStops', () => {
  it('detects a pit stop with compound change', () => {
    const prev = makeState({
      timing: {
        '1': {
          driverNumber: '1',
          position: 1,
          gapToLeader: '',
          interval: '',
          lastLapTime: '',
          bestLapTime: '',
          sector1: '',
          sector2: '',
          sector3: '',
          inPit: true,
          retired: false,
          stopped: false,
        },
      },
      stints: {
        '1': {
          driverNumber: '1',
          stintNumber: 0,
          compound: 'SOFT',
          tyreAge: 20,
          new: true,
        },
      },
      drivers: {
        '1': {
          driverNumber: '1',
          abbreviation: 'VER',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: '3671C6',
          countryCode: '',
        },
      },
    });

    const curr = makeState({
      ...prev,
      timing: {
        '1': { ...prev.timing['1']!, inPit: false },
      },
      stints: {
        '1': {
          driverNumber: '1',
          stintNumber: 1,
          compound: 'HARD',
          tyreAge: 0,
          new: true,
        },
      },
      drivers: prev.drivers,
    });

    const events = detectPitStops(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]?.driverNumber).toBe('1');
    expect(events[0]?.newCompound).toBe('HARD');
    expect(events[0]?.stintNumber).toBe(1);
  });

  it('detects pit stop by stint number change alone', () => {
    const prev = makeState({
      stints: {
        '44': {
          driverNumber: '44',
          stintNumber: 0,
          compound: 'MEDIUM',
          tyreAge: 15,
          new: true,
        },
      },
      drivers: {
        '44': {
          driverNumber: '44',
          abbreviation: 'HAM',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: 'E8002D',
          countryCode: '',
        },
      },
    });

    const curr = makeState({
      ...prev,
      stints: {
        '44': {
          driverNumber: '44',
          stintNumber: 1,
          compound: 'HARD',
          tyreAge: 0,
          new: true,
        },
      },
      drivers: prev.drivers,
    });

    const events = detectPitStops(prev, curr);
    expect(events).toHaveLength(1);
  });

  it('detects pit stop when no previous stint known but stintNumber > 0', () => {
    const prev = makeState({
      stints: {},
      drivers: {
        '1': {
          driverNumber: '1',
          abbreviation: 'VER',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: '3671C6',
          countryCode: '',
        },
      },
    });
    const curr = makeState({
      stints: {
        '1': {
          driverNumber: '1',
          stintNumber: 1,
          compound: 'HARD',
          tyreAge: 0,
          new: true,
        },
      },
      drivers: prev.drivers,
    });
    const events = detectPitStops(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]?.newCompound).toBe('HARD');
  });

  it('does not detect pit stop for initial stint (stintNumber 0)', () => {
    const prev = makeState({ stints: {} });
    const curr = makeState({
      stints: {
        '1': {
          driverNumber: '1',
          stintNumber: 0,
          compound: 'SOFT',
          tyreAge: 0,
          new: true,
        },
      },
    });
    const events = detectPitStops(prev, curr);
    expect(events).toHaveLength(0);
  });

  it('returns empty when no stint change', () => {
    const state = makeState({
      stints: {
        '1': {
          driverNumber: '1',
          stintNumber: 0,
          compound: 'SOFT',
          tyreAge: 10,
          new: true,
        },
      },
      drivers: {
        '1': {
          driverNumber: '1',
          abbreviation: 'VER',
          firstName: '',
          lastName: '',
          teamName: '',
          teamColor: '3671C6',
          countryCode: '',
        },
      },
    });
    const events = detectPitStops(state, state);
    expect(events).toHaveLength(0);
  });
});

// ─── Weather Detector ────────────────────────────────────────────

describe('detectWeatherChange', () => {
  it('detects dry to wet transition', () => {
    const prev = makeState({
      weather: {
        rainfall: false,
        airTemp: 25,
        trackTemp: 40,
        humidity: 55,
        windSpeed: 2,
        windDirection: 180,
        pressure: 1013,
      },
    });
    const curr = makeState({
      weather: {
        ...prev.weather!,
        rainfall: true,
      },
      timestamp: '2025-01-01T00:00:00Z',
    });
    const events = detectWeatherChange(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('weather_change');
    expect(events[0]?.previousRainfall).toBe(false);
    expect(events[0]?.newRainfall).toBe(true);
  });

  it('detects wet to dry transition', () => {
    const prev = makeState({
      weather: {
        rainfall: true,
        airTemp: 20,
        trackTemp: 30,
        humidity: 80,
        windSpeed: 5,
        windDirection: 270,
        pressure: 1010,
      },
    });
    const curr = makeState({
      weather: { ...prev.weather!, rainfall: false },
    });
    const events = detectWeatherChange(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]?.newRainfall).toBe(false);
  });

  it('returns empty when rainfall unchanged', () => {
    const state = makeState({
      weather: {
        rainfall: false,
        airTemp: 25,
        trackTemp: 40,
        humidity: 55,
        windSpeed: 2,
        windDirection: 180,
        pressure: 1013,
      },
    });
    const events = detectWeatherChange(state, state);
    expect(events).toHaveLength(0);
  });

  it('returns empty when weather is null', () => {
    const state = makeState({ weather: null });
    const events = detectWeatherChange(state, state);
    expect(events).toHaveLength(0);
  });

  it('handles transition from null weather to rainy', () => {
    const prev = makeState({ weather: null });
    const curr = makeState({
      weather: {
        rainfall: true,
        airTemp: 20,
        trackTemp: 30,
        humidity: 80,
        windSpeed: 5,
        windDirection: 270,
        pressure: 1010,
      },
    });
    const events = detectWeatherChange(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]?.newRainfall).toBe(true);
  });
});
