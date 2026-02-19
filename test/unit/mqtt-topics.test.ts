import { describe, it, expect } from 'vitest';
import * as topics from '../../src/mqtt/topics.js';

describe('MQTT topic builders', () => {
  const p = 'f12mqtt';

  it('builds status topic', () => {
    expect(topics.statusTopic(p)).toBe('f12mqtt/status');
  });

  it('builds session topics', () => {
    expect(topics.sessionStatus(p)).toBe('f12mqtt/session/status');
    expect(topics.sessionFlag(p)).toBe('f12mqtt/session/flag');
    expect(topics.sessionLap(p)).toBe('f12mqtt/session/lap');
    expect(topics.sessionWeather(p)).toBe('f12mqtt/session/weather');
    expect(topics.sessionLeader(p)).toBe('f12mqtt/session/leader');
    expect(topics.sessionInfo(p)).toBe('f12mqtt/session/info');
  });

  it('builds session race control topic', () => {
    expect(topics.sessionRaceControl(p)).toBe('f12mqtt/session/race_control');
  });

  it('builds driver topics with number', () => {
    expect(topics.driverPosition(p, '1')).toBe('f12mqtt/driver/1/position');
    expect(topics.driverGap(p, '44')).toBe('f12mqtt/driver/44/gap');
    expect(topics.driverTyre(p, '4')).toBe('f12mqtt/driver/4/tyre');
    expect(topics.driverStatus(p, '63')).toBe('f12mqtt/driver/63/status');
  });

  it('builds event topics', () => {
    expect(topics.eventFlag(p)).toBe('f12mqtt/event/flag');
    expect(topics.eventOvertake(p)).toBe('f12mqtt/event/overtake');
    expect(topics.eventPitStop(p)).toBe('f12mqtt/event/pit_stop');
    expect(topics.eventWeather(p)).toBe('f12mqtt/event/weather');
  });

  it('builds playback topics', () => {
    expect(topics.playbackState(p)).toBe('f12mqtt/playback/state');
    expect(topics.playbackCommand(p)).toBe('f12mqtt/playback/command');
  });

  it('builds persistent topics', () => {
    expect(topics.lastWinner(p)).toBe('f12mqtt/standings/last_winner');
    expect(topics.driversLeader(p)).toBe('f12mqtt/standings/drivers_leader');
    expect(topics.constructorsLeader(p)).toBe(
      'f12mqtt/standings/constructors_leader',
    );
    expect(topics.nextRace(p)).toBe('f12mqtt/schedule/next_race');
  });

  it('uses custom prefix', () => {
    expect(topics.sessionFlag('myprefix')).toBe('myprefix/session/flag');
    expect(topics.driverPosition('custom', '1')).toBe(
      'custom/driver/1/position',
    );
  });
});
