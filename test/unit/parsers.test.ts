import { describe, it, expect } from 'vitest';
import {
  parseTrackStatus,
  parseDriverList,
  parseTimingData,
  parseTimingAppData,
  parseSessionInfo,
  parseLapCount,
  parseWeatherData,
} from '../../src/signalr/parsers.js';

describe('parseTrackStatus', () => {
  it('parses green flag', () => {
    expect(parseTrackStatus({ Status: '1' })).toEqual({
      flag: 'green',
      message: undefined,
    });
  });

  it('parses yellow flag', () => {
    expect(parseTrackStatus({ Status: '2' })).toEqual({
      flag: 'yellow',
      message: undefined,
    });
  });

  it('parses safety car', () => {
    expect(parseTrackStatus({ Status: '4', Message: 'Safety Car Deployed' })).toEqual({
      flag: 'sc',
      message: 'Safety Car Deployed',
    });
  });

  it('parses red flag', () => {
    expect(parseTrackStatus({ Status: '5' })).toEqual({
      flag: 'red',
      message: undefined,
    });
  });

  it('parses VSC', () => {
    expect(parseTrackStatus({ Status: '6' })).toEqual({
      flag: 'vsc',
      message: undefined,
    });
  });

  it('parses VSC ending', () => {
    expect(parseTrackStatus({ Status: '7' })).toEqual({
      flag: 'vsc_ending',
      message: undefined,
    });
  });

  it('returns null for missing status', () => {
    expect(parseTrackStatus({})).toBeNull();
  });

  it('returns null for unknown status code', () => {
    expect(parseTrackStatus({ Status: '99' })).toBeNull();
  });
});

describe('parseDriverList', () => {
  it('parses a driver entry', () => {
    const raw = {
      '1': {
        RacingNumber: '1',
        Tla: 'VER',
        FirstName: 'Max',
        LastName: 'Verstappen',
        TeamName: 'Red Bull Racing',
        TeamColour: '3671C6',
        CountryCode: 'NED',
      },
    };
    const result = parseDriverList(raw);
    expect(result['1']).toEqual({
      driverNumber: '1',
      abbreviation: 'VER',
      firstName: 'Max',
      lastName: 'Verstappen',
      teamName: 'Red Bull Racing',
      teamColor: '3671C6',
      countryCode: 'NED',
    });
  });

  it('falls back to team color lookup when TeamColour missing', () => {
    const raw = {
      '4': {
        RacingNumber: '4',
        Tla: 'NOR',
        TeamName: 'McLaren',
      },
    };
    const result = parseDriverList(raw);
    expect(result['4']?.teamColor).toBe('FF8000');
  });

  it('uses driver number key when RacingNumber missing', () => {
    const raw = {
      '44': { Tla: 'HAM' },
    };
    const result = parseDriverList(raw);
    expect(result['44']?.driverNumber).toBe('44');
  });

  it('skips entries without RacingNumber or Tla', () => {
    const raw = {
      '99': { FirstName: 'Test' },
    };
    const result = parseDriverList(raw);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('parses multiple drivers', () => {
    const raw = {
      '1': { RacingNumber: '1', Tla: 'VER' },
      '44': { RacingNumber: '44', Tla: 'HAM' },
    };
    const result = parseDriverList(raw);
    expect(Object.keys(result)).toHaveLength(2);
  });
});

describe('parseTimingData', () => {
  it('parses position and gap', () => {
    const raw = {
      Lines: {
        '1': {
          Position: '1',
          GapToLeader: '',
          IntervalToPositionAhead: { Value: '' },
        },
        '44': {
          Position: '2',
          GapToLeader: '+1.234',
          IntervalToPositionAhead: { Value: '+1.234' },
        },
      },
    };
    const result = parseTimingData(raw);
    expect(result['1']?.position).toBe(1);
    expect(result['1']?.gapToLeader).toBe('');
    expect(result['44']?.position).toBe(2);
    expect(result['44']?.gapToLeader).toBe('+1.234');
  });

  it('parses pit and retired status', () => {
    const raw = {
      Lines: {
        '1': { InPit: true },
        '44': { Retired: true },
      },
    };
    const result = parseTimingData(raw);
    expect(result['1']?.inPit).toBe(true);
    expect(result['44']?.retired).toBe(true);
  });

  it('parses sectors', () => {
    const raw = {
      Lines: {
        '1': {
          Sectors: {
            '0': { Value: '28.123' },
            '1': { Value: '35.456' },
            '2': { Value: '30.789' },
          },
        },
      },
    };
    const result = parseTimingData(raw);
    expect(result['1']?.sector1).toBe('28.123');
    expect(result['1']?.sector2).toBe('35.456');
    expect(result['1']?.sector3).toBe('30.789');
  });

  it('handles partial diff (only some fields)', () => {
    const raw = {
      Lines: {
        '1': { Position: '3' },
      },
    };
    const result = parseTimingData(raw);
    expect(result['1']?.position).toBe(3);
    expect(result['1']?.inPit).toBeUndefined();
    expect(result['1']?.retired).toBeUndefined();
  });

  it('returns empty for missing Lines', () => {
    const result = parseTimingData({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('parseTimingAppData', () => {
  it('parses latest stint', () => {
    const raw = {
      Lines: {
        '1': {
          Stints: {
            '0': { Compound: 'SOFT', New: 'true', TotalLaps: 0 },
            '1': { Compound: 'HARD', New: 'true', TotalLaps: 5 },
          },
        },
      },
    };
    const result = parseTimingAppData(raw);
    expect(result['1']).toEqual({
      driverNumber: '1',
      stintNumber: 1,
      compound: 'HARD',
      tyreAge: 5,
      new: true,
    });
  });

  it('handles single stint', () => {
    const raw = {
      Lines: {
        '44': {
          Stints: {
            '0': { Compound: 'MEDIUM', New: 'false', TotalLaps: 12 },
          },
        },
      },
    };
    const result = parseTimingAppData(raw);
    expect(result['44']?.compound).toBe('MEDIUM');
    expect(result['44']?.new).toBe(false);
  });

  it('returns empty for missing Lines', () => {
    const result = parseTimingAppData({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('skips entries without stints', () => {
    const raw = { Lines: { '1': {} } };
    const result = parseTimingAppData(raw);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('parseSessionInfo', () => {
  it('parses race session', () => {
    const raw = {
      Meeting: {
        Name: 'Monaco Grand Prix',
        Circuit: { ShortName: 'Monaco' },
        Country: { Name: 'Monaco' },
      },
      Name: 'Race',
      StartDate: '2025-05-25T13:00:00Z',
      EndDate: '2025-05-25T15:00:00Z',
    };
    const result = parseSessionInfo(raw);
    expect(result).toEqual({
      name: 'Monaco Grand Prix',
      type: 'Race',
      circuit: 'Monaco',
      country: 'Monaco',
      startTime: '2025-05-25T13:00:00Z',
      endTime: '2025-05-25T15:00:00Z',
    });
  });

  it('maps Sprint Shootout to SprintQualifying', () => {
    const raw = {
      Meeting: { Name: 'Test GP' },
      Name: 'Sprint Shootout',
    };
    const result = parseSessionInfo(raw);
    expect(result?.type).toBe('SprintQualifying');
  });

  it('defaults to Practice for unknown type', () => {
    const raw = {
      Meeting: { Name: 'Test GP' },
      Name: 'SomeUnknownType',
    };
    const result = parseSessionInfo(raw);
    expect(result?.type).toBe('Practice');
  });

  it('returns null when Meeting.Name is missing', () => {
    const raw = { Meeting: {} };
    const result = parseSessionInfo(raw);
    expect(result).toBeNull();
  });
});

describe('parseLapCount', () => {
  it('parses lap count', () => {
    expect(parseLapCount({ CurrentLap: 42, TotalLaps: 57 })).toEqual({
      current: 42,
      total: 57,
    });
  });

  it('handles partial update (only current)', () => {
    expect(parseLapCount({ CurrentLap: 10 })).toEqual({
      current: 10,
      total: 0,
    });
  });

  it('returns null when both undefined', () => {
    expect(parseLapCount({})).toBeNull();
  });
});

describe('parseWeatherData', () => {
  it('parses full weather data', () => {
    const raw = {
      AirTemp: '25.3',
      TrackTemp: '45.1',
      Humidity: '62.0',
      Rainfall: '0',
      WindSpeed: '3.2',
      WindDirection: '180',
      Pressure: '1013.25',
    };
    const result = parseWeatherData(raw);
    expect(result).toEqual({
      airTemp: 25.3,
      trackTemp: 45.1,
      humidity: 62.0,
      rainfall: false,
      windSpeed: 3.2,
      windDirection: 180,
      pressure: 1013.25,
    });
  });

  it('parses rainfall as boolean', () => {
    expect(parseWeatherData({ Rainfall: '1' }).rainfall).toBe(true);
    expect(parseWeatherData({ Rainfall: '0' }).rainfall).toBe(false);
  });

  it('handles partial weather update', () => {
    const result = parseWeatherData({ AirTemp: '30.0' });
    expect(result.airTemp).toBe(30.0);
    expect(result.rainfall).toBeUndefined();
  });
});
