import { describe, it, expect } from 'vitest';
import {
  parseTrackStatus,
  parseDriverList,
  parseTimingData,
  parseTimingAppData,
  parseSessionInfo,
  parseLapCount,
  parseWeatherData,
  parsePitLaneTimeCollection,
  parseTopThree,
  parseRaceControlMessages,
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
    expect(result['4']?.teamColor).toBe('F47600');
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

describe('parsePitLaneTimeCollection', () => {
  it('parses a single pit time entry', () => {
    const raw = {
      PitTimes: {
        '12': { RacingNumber: '12', Duration: '25.3', Lap: '15' },
      },
    };
    const result = parsePitLaneTimeCollection(raw);
    expect(result['12']).toEqual({
      driverNumber: '12',
      duration: '25.3',
      lap: '15',
    });
  });

  it('parses multiple entries', () => {
    const raw = {
      PitTimes: {
        '12': { RacingNumber: '12', Duration: '25.3', Lap: '15' },
        '44': { RacingNumber: '44', Duration: '23.1', Lap: '22' },
      },
    };
    const result = parsePitLaneTimeCollection(raw);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['12']?.duration).toBe('25.3');
    expect(result['44']?.duration).toBe('23.1');
  });

  it('handles empty/missing PitTimes', () => {
    expect(parsePitLaneTimeCollection({})).toEqual({});
    expect(parsePitLaneTimeCollection({ PitTimes: {} })).toEqual({});
  });

  it('handles entries with missing fields', () => {
    const raw = {
      PitTimes: {
        '12': { Duration: '25.3' },
        '44': { RacingNumber: '44' },
      },
    };
    const result = parsePitLaneTimeCollection(raw);
    // Entry '12' should use the key as driverNumber since RacingNumber is missing
    expect(result['12']).toEqual({
      driverNumber: '12',
      duration: '25.3',
      lap: '',
    });
    // Entry '44' should be skipped because Duration is missing
    expect(result['44']).toBeUndefined();
  });
});

describe('parseTopThree', () => {
  it('parses 3 entries from the Lines array', () => {
    const raw = {
      Lines: [
        {
          Position: '1',
          RacingNumber: '12',
          Tla: 'ANT',
          TeamColour: '00D7B6',
          LapTime: '1:32.803',
          DiffToLeader: '',
        },
        {
          Position: '2',
          RacingNumber: '81',
          Tla: 'PIA',
          TeamColour: 'F47600',
          LapTime: '1:32.861',
          DiffToLeader: '+0.058',
        },
        {
          Position: '3',
          RacingNumber: '1',
          Tla: 'VER',
          TeamColour: '3671C6',
          LapTime: '1:33.100',
          DiffToLeader: '+0.297',
        },
      ],
      Withheld: false,
    };
    const result = parseTopThree(raw);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      position: 1,
      driverNumber: '12',
      abbreviation: 'ANT',
      teamColor: '00D7B6',
      lapTime: '1:32.803',
      gapToLeader: '',
    });
    expect(result[1]).toEqual({
      position: 2,
      driverNumber: '81',
      abbreviation: 'PIA',
      teamColor: 'F47600',
      lapTime: '1:32.861',
      gapToLeader: '+0.058',
    });
    expect(result[2]).toEqual({
      position: 3,
      driverNumber: '1',
      abbreviation: 'VER',
      teamColor: '3671C6',
      lapTime: '1:33.100',
      gapToLeader: '+0.297',
    });
  });

  it('returns empty array when Withheld is true', () => {
    const raw = {
      Lines: [
        { Position: '1', RacingNumber: '12', Tla: 'ANT', TeamColour: '00D7B6' },
      ],
      Withheld: true,
    };
    const result = parseTopThree(raw);
    expect(result).toEqual([]);
  });

  it('handles missing/empty Lines', () => {
    expect(parseTopThree({})).toEqual([]);
    expect(parseTopThree({ Lines: [] })).toEqual([]);
  });

  it('sorts entries by position', () => {
    const raw = {
      Lines: [
        { Position: '3', RacingNumber: '1', Tla: 'VER', TeamColour: '3671C6' },
        { Position: '1', RacingNumber: '12', Tla: 'ANT', TeamColour: '00D7B6' },
        { Position: '2', RacingNumber: '81', Tla: 'PIA', TeamColour: 'F47600' },
      ],
    };
    const result = parseTopThree(raw);
    expect(result[0]?.position).toBe(1);
    expect(result[1]?.position).toBe(2);
    expect(result[2]?.position).toBe(3);
  });
});

describe('parseRaceControlMessages', () => {
  it('parses a message with Flag and Scope: "Track"', () => {
    const raw = {
      Messages: {
        '0': {
          Utc: '2025-05-25T13:00:00Z',
          Message: 'RED FLAG',
          Category: 'Flag',
          Flag: 'RED',
          Scope: 'Track',
        },
      },
    };
    const result = parseRaceControlMessages(raw);
    expect(result).toEqual({
      utc: '2025-05-25T13:00:00Z',
      message: 'RED FLAG',
      category: 'Flag',
      flag: 'RED',
      scope: 'Track',
      sector: undefined,
      racingNumber: undefined,
    });
  });

  it('parses a message with Scope: "Sector" and Sector number', () => {
    const raw = {
      Messages: {
        '0': {
          Utc: '2025-05-25T13:05:00Z',
          Message: 'YELLOW IN TRACK SECTOR 2',
          Category: 'Flag',
          Flag: 'YELLOW',
          Scope: 'Sector',
          Sector: 2,
        },
      },
    };
    const result = parseRaceControlMessages(raw);
    expect(result).toEqual({
      utc: '2025-05-25T13:05:00Z',
      message: 'YELLOW IN TRACK SECTOR 2',
      category: 'Flag',
      flag: 'YELLOW',
      scope: 'Sector',
      sector: 2,
      racingNumber: undefined,
    });
  });

  it('returns the latest message (highest key) when multiple', () => {
    const raw = {
      Messages: {
        '0': {
          Utc: '2025-05-25T13:00:00Z',
          Message: 'GREEN FLAG',
          Category: 'Flag',
          Flag: 'GREEN',
        },
        '1': {
          Utc: '2025-05-25T13:05:00Z',
          Message: 'RED FLAG',
          Category: 'Flag',
          Flag: 'RED',
          Scope: 'Track',
        },
      },
    };
    const result = parseRaceControlMessages(raw);
    expect(result?.message).toBe('RED FLAG');
    expect(result?.utc).toBe('2025-05-25T13:05:00Z');
  });

  it('handles missing/empty Messages', () => {
    expect(parseRaceControlMessages({})).toBeNull();
    expect(parseRaceControlMessages({ Messages: {} })).toBeNull();
  });

  it('parses RacingNumber field', () => {
    const raw = {
      Messages: {
        '0': {
          Utc: '2025-05-25T13:10:00Z',
          Message: 'TRACK LIMITS - Loss of track limits at Turn 4',
          Category: 'Other',
          Scope: 'Driver',
          RacingNumber: '44',
        },
      },
    };
    const result = parseRaceControlMessages(raw);
    expect(result?.racingNumber).toBe('44');
    expect(result?.scope).toBe('Driver');
  });
});
