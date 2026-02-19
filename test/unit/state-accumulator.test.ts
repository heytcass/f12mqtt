import { describe, it, expect, beforeEach } from 'vitest';
import { StateAccumulator } from '../../src/data/state-accumulator.js';

describe('StateAccumulator', () => {
  let acc: StateAccumulator;

  beforeEach(() => {
    acc = new StateAccumulator();
  });

  describe('initial state', () => {
    it('starts with green flag', () => {
      expect(acc.getState().trackStatus.flag).toBe('green');
    });

    it('starts with empty drivers', () => {
      expect(Object.keys(acc.getState().drivers)).toHaveLength(0);
    });

    it('starts with zero lap count', () => {
      expect(acc.getState().lapCount).toEqual({ current: 0, total: 0 });
    });
  });

  describe('TrackStatus', () => {
    it('applies flag change', () => {
      acc.applyMessage('TrackStatus', { Status: '4' });
      expect(acc.getState().trackStatus.flag).toBe('sc');
    });

    it('ignores invalid status code', () => {
      acc.applyMessage('TrackStatus', { Status: '99' });
      expect(acc.getState().trackStatus.flag).toBe('green');
    });
  });

  describe('DriverList', () => {
    it('adds new drivers', () => {
      acc.applyMessage('DriverList', {
        '1': { RacingNumber: '1', Tla: 'VER', TeamName: 'Red Bull Racing' },
        '44': { RacingNumber: '44', Tla: 'HAM', TeamName: 'Mercedes' },
      });
      expect(Object.keys(acc.getState().drivers)).toHaveLength(2);
      expect(acc.getState().drivers['1']?.abbreviation).toBe('VER');
    });

    it('merges incremental updates', () => {
      acc.applyMessage('DriverList', {
        '1': {
          RacingNumber: '1',
          Tla: 'VER',
          FirstName: 'Max',
          LastName: 'Verstappen',
          TeamName: 'Red Bull Racing',
        },
      });
      // Partial update — only TeamColour changes
      acc.applyMessage('DriverList', {
        '1': { RacingNumber: '1', Tla: 'VER', TeamColour: 'AABBCC' },
      });
      const driver = acc.getState().drivers['1'];
      expect(driver?.teamColor).toBe('AABBCC');
      expect(driver?.firstName).toBe('Max'); // preserved from first message
    });
  });

  describe('TimingData', () => {
    it('sets initial positions', () => {
      acc.applyMessage('TimingData', {
        Lines: {
          '1': { Position: '1', GapToLeader: '' },
          '44': { Position: '2', GapToLeader: '+1.5' },
        },
      });
      expect(acc.getState().timing['1']?.position).toBe(1);
      expect(acc.getState().timing['44']?.gapToLeader).toBe('+1.5');
    });

    it('merges partial timing diffs', () => {
      acc.applyMessage('TimingData', {
        Lines: {
          '1': { Position: '1', GapToLeader: '', InPit: false },
        },
      });
      // Later, only InPit changes
      acc.applyMessage('TimingData', {
        Lines: {
          '1': { InPit: true },
        },
      });
      const timing = acc.getState().timing['1'];
      expect(timing?.position).toBe(1); // unchanged
      expect(timing?.inPit).toBe(true); // updated
    });

    it('handles position swap', () => {
      acc.applyMessage('TimingData', {
        Lines: {
          '1': { Position: '1' },
          '44': { Position: '2' },
        },
      });
      acc.applyMessage('TimingData', {
        Lines: {
          '1': { Position: '2' },
          '44': { Position: '1' },
        },
      });
      expect(acc.getState().timing['1']?.position).toBe(2);
      expect(acc.getState().timing['44']?.position).toBe(1);
    });
  });

  describe('TimingAppData', () => {
    it('tracks tyre stints', () => {
      acc.applyMessage('TimingAppData', {
        Lines: {
          '1': {
            Stints: {
              '0': { Compound: 'SOFT', New: 'true', TotalLaps: 0 },
            },
          },
        },
      });
      expect(acc.getState().stints['1']?.compound).toBe('SOFT');
    });

    it('updates to new stint', () => {
      acc.applyMessage('TimingAppData', {
        Lines: {
          '1': {
            Stints: {
              '0': { Compound: 'SOFT', New: 'true', TotalLaps: 20 },
            },
          },
        },
      });
      acc.applyMessage('TimingAppData', {
        Lines: {
          '1': {
            Stints: {
              '0': { Compound: 'SOFT', New: 'true', TotalLaps: 20 },
              '1': { Compound: 'HARD', New: 'true', TotalLaps: 0 },
            },
          },
        },
      });
      const stint = acc.getState().stints['1'];
      expect(stint?.compound).toBe('HARD');
      expect(stint?.stintNumber).toBe(1);
    });
  });

  describe('SessionInfo', () => {
    it('sets session info', () => {
      acc.applyMessage('SessionInfo', {
        Meeting: {
          Name: 'British Grand Prix',
          Circuit: { ShortName: 'Silverstone' },
          Country: { Name: 'Great Britain' },
        },
        Name: 'Race',
        StartDate: '2025-07-06T14:00:00Z',
      });
      const info = acc.getState().sessionInfo;
      expect(info?.name).toBe('British Grand Prix');
      expect(info?.type).toBe('Race');
      expect(info?.circuit).toBe('Silverstone');
    });
  });

  describe('LapCount', () => {
    it('updates lap count', () => {
      acc.applyMessage('LapCount', { CurrentLap: 15, TotalLaps: 52 });
      expect(acc.getState().lapCount).toEqual({ current: 15, total: 52 });
    });
  });

  describe('WeatherData', () => {
    it('sets initial weather', () => {
      acc.applyMessage('WeatherData', {
        AirTemp: '25.0',
        TrackTemp: '40.0',
        Rainfall: '0',
        Humidity: '55.0',
        WindSpeed: '2.1',
        WindDirection: '270',
        Pressure: '1015.0',
      });
      const weather = acc.getState().weather;
      expect(weather?.rainfall).toBe(false);
      expect(weather?.airTemp).toBe(25.0);
    });

    it('merges partial weather updates', () => {
      acc.applyMessage('WeatherData', {
        AirTemp: '25.0',
        TrackTemp: '40.0',
        Rainfall: '0',
        Humidity: '55.0',
        WindSpeed: '2.1',
        WindDirection: '270',
        Pressure: '1015.0',
      });
      // Only rainfall changes
      acc.applyMessage('WeatherData', { Rainfall: '1' });
      const weather = acc.getState().weather;
      expect(weather?.rainfall).toBe(true);
      expect(weather?.airTemp).toBe(25.0); // preserved
    });
  });

  describe('snapshot', () => {
    it('returns a deep copy', () => {
      acc.applyMessage('TrackStatus', { Status: '1' });
      const snap = acc.snapshot();
      acc.applyMessage('TrackStatus', { Status: '5' });
      expect(snap.trackStatus.flag).toBe('green');
      expect(acc.getState().trackStatus.flag).toBe('red');
    });
  });

  describe('reset', () => {
    it('resets to empty state', () => {
      acc.applyMessage('LapCount', { CurrentLap: 42, TotalLaps: 57 });
      acc.reset();
      expect(acc.getState().lapCount.current).toBe(0);
    });
  });

  describe('timestamp', () => {
    it('updates timestamp when provided', () => {
      acc.applyMessage('TrackStatus', { Status: '1' }, '2025-05-25T14:30:00Z');
      expect(acc.getState().timestamp).toBe('2025-05-25T14:30:00Z');
    });
  });

  describe('unknown topics', () => {
    it('ignores unknown topics gracefully', () => {
      const before = acc.snapshot();
      acc.applyMessage('UnknownTopic', { foo: 'bar' });
      // State should be unchanged except timestamp
      expect(acc.getState().trackStatus).toEqual(before.trackStatus);
    });
  });
});
