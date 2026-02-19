import { describe, it, expect } from 'vitest';
import {
  flagApp,
  driverApp,
  lapApp,
  flagNotification,
  overtakeNotification,
  pitStopNotification,
  awtrixCustomAppTopic,
  awtrixNotifyTopic,
} from '../../src/mqtt/awtrix.js';
import type { FlagChangeEvent, OvertakeEvent, PitStopEvent } from '../../src/events/types.js';

describe('AWTRIX payloads', () => {
  describe('flagApp', () => {
    it('builds green flag app', () => {
      const app = flagApp('green');
      expect(app.text).toBe('GREEN');
      expect(app.background).toBe('00FF00');
      expect(app.color).toBe('FFFFFF');
    });

    it('builds red flag app with pulse', () => {
      const app = flagApp('red');
      expect(app.text).toBe('RED FLAG');
      expect(app.background).toBe('FF0000');
      expect(app.effect).toBe('Pulse');
    });

    it('yellow flag has dark text', () => {
      const app = flagApp('yellow');
      expect(app.color).toBe('000000');
    });

    it('safety car has pulse', () => {
      const app = flagApp('sc');
      expect(app.text).toBe('SAFETY CAR');
      expect(app.effect).toBe('Pulse');
    });
  });

  describe('driverApp', () => {
    it('builds driver position display', () => {
      const app = driverApp(1, 'VER', '', '3671C6');
      const text = app.text as Array<{ t: string; c: string }>;
      expect(text).toHaveLength(2);
      expect(text[0]).toEqual({ t: 'P1 ', c: 'FFFFFF' });
      expect(text[1]).toEqual({ t: 'VER', c: '3671C6' });
    });

    it('includes gap when not leader', () => {
      const app = driverApp(3, 'NOR', '+5.123', 'FF8000');
      const text = app.text as Array<{ t: string; c: string }>;
      expect(text).toHaveLength(3);
      expect(text[2]).toEqual({ t: ' +5.123', c: 'AAAAAA' });
    });
  });

  describe('lapApp', () => {
    it('builds lap counter', () => {
      const app = lapApp(42, 57);
      expect(app.text).toBe('LAP 42/57');
    });
  });

  describe('flagNotification', () => {
    it('builds red flag notification with wakeup', () => {
      const event: FlagChangeEvent = {
        type: 'flag_change',
        timestamp: '2025-01-01T00:00:00Z',
        previousFlag: 'green',
        newFlag: 'red',
      };
      const notif = flagNotification(event);
      expect(notif.text).toBe('RED FLAG');
      expect(notif.background).toBe('FF0000');
      expect(notif.wakeup).toBe(true);
      expect(notif.sound).toBe('alarm');
    });
  });

  describe('overtakeNotification', () => {
    it('builds overtake with team colors', () => {
      const event: OvertakeEvent = {
        type: 'overtake',
        timestamp: '2025-01-01T00:00:00Z',
        overtakingDriver: '44',
        overtakingAbbreviation: 'HAM',
        overtakingTeamColor: 'E8002D',
        overtakenDriver: '1',
        overtakenAbbreviation: 'VER',
        overtakenTeamColor: '3671C6',
        newPosition: 1,
      };
      const notif = overtakeNotification(event);
      const text = notif.text as Array<{ t: string; c: string }>;
      expect(text[0]).toEqual({ t: 'HAM', c: 'E8002D' });
      expect(text[1]).toEqual({ t: ' PASSES ', c: 'FFFFFF' });
      expect(text[2]).toEqual({ t: 'VER', c: '3671C6' });
    });
  });

  describe('pitStopNotification', () => {
    it('builds pit stop with compound', () => {
      const event: PitStopEvent = {
        type: 'pit_stop',
        timestamp: '2025-01-01T00:00:00Z',
        driverNumber: '1',
        abbreviation: 'VER',
        teamColor: '3671C6',
        newCompound: 'HARD',
        stintNumber: 1,
      };
      const notif = pitStopNotification(event);
      const text = notif.text as Array<{ t: string; c: string }>;
      expect(text[0]).toEqual({ t: 'PIT ', c: 'FFFFFF' });
      expect(text[1]).toEqual({ t: 'VER', c: '3671C6' });
      expect(text[2]).toEqual({ t: ' HARD', c: 'AAAAAA' });
    });
  });

  describe('topic builders', () => {
    it('builds custom app topic', () => {
      expect(awtrixCustomAppTopic('awtrix_abc123', 'f1flag')).toBe(
        'awtrix_abc123/custom/f1flag',
      );
    });

    it('builds notify topic', () => {
      expect(awtrixNotifyTopic('awtrix_abc123')).toBe('awtrix_abc123/notify');
    });
  });
});
