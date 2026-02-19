/**
 * Integration test: full pipeline → MQTT publisher flow.
 * Feeds a realistic SignalR message sequence through the pipeline,
 * verifies the publisher calls MQTT with correct topics and payloads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignalRPipeline } from '../../src/signalr/pipeline.js';
import { MqttPublisher } from '../../src/mqtt/publisher.js';
import type { F1MqttClient } from '../../src/mqtt/client.js';

/** Create a mock MQTT client that records all publish calls */
function mockMqttClient() {
  const calls: Array<{ topic: string; payload: string | object; retain: boolean }> =
    [];
  const cleared: string[] = [];

  const client = {
    publish(topic: string, payload: string | object, retain = false) {
      calls.push({ topic, payload, retain });
    },
    clear(topic: string) {
      cleared.push(topic);
      calls.push({ topic, payload: '', retain: true });
    },
    isConnected: () => true,
  } as unknown as F1MqttClient;

  return { client, calls, cleared };
}

describe('Pipeline → Publisher integration', () => {
  let pipeline: SignalRPipeline;
  let publisher: MqttPublisher;
  let mqtt: ReturnType<typeof mockMqttClient>;

  beforeEach(() => {
    pipeline = new SignalRPipeline();
    mqtt = mockMqttClient();
    publisher = new MqttPublisher(mqtt.client, {
      prefix: 'f12mqtt',
      favoriteDrivers: ['1', '4'],
      awtrixEnabled: true,
      awtrixPrefix: 'awtrix_abc',
    });
  });

  it('publishes state and events from a realistic race sequence', () => {
    // 1. Register entities (session start)
    publisher.registerSessionEntities();

    // Verify HA discovery was published
    const discoveryTopics = mqtt.calls
      .filter((c) => c.topic.startsWith('homeassistant/sensor/'))
      .map((c) => c.topic);
    expect(discoveryTopics.length).toBeGreaterThan(0);
    expect(discoveryTopics).toContain(
      'homeassistant/sensor/f12mqtt/session_status/config',
    );
    expect(discoveryTopics).toContain(
      'homeassistant/sensor/f12mqtt/flag_status/config',
    );
    // Per-driver entities for favorites
    expect(discoveryTopics).toContain(
      'homeassistant/sensor/f12mqtt/driver_1_position/config',
    );
    expect(discoveryTopics).toContain(
      'homeassistant/sensor/f12mqtt/driver_4_position/config',
    );

    // Session status should be "active"
    const sessionStatusCalls = mqtt.calls.filter(
      (c) => c.topic === 'f12mqtt/session/status',
    );
    expect(sessionStatusCalls).toHaveLength(1);
    expect(sessionStatusCalls[0]!.payload).toBe('active');

    // Clear calls to focus on state updates
    mqtt.calls.length = 0;

    // 2. Feed session info
    const msg1 = pipeline.processMessage({
      topic: 'SessionInfo',
      data: {
        Meeting: {
          Name: 'British Grand Prix',
          Circuit: { ShortName: 'Silverstone' },
          Country: { Name: 'Great Britain' },
        },
        Name: 'Race',
        StartDate: '2025-07-06T14:00:00Z',
      },
      timestamp: '2025-07-06T14:00:00Z',
    });
    publisher.publishState(msg1.state);
    publisher.publishEvents(msg1.events);

    // Verify session info published
    const sessionInfoCalls = mqtt.calls.filter(
      (c) => c.topic === 'f12mqtt/session/info',
    );
    expect(sessionInfoCalls).toHaveLength(1);
    const infoPayload = sessionInfoCalls[0]!.payload as object;
    expect(infoPayload).toHaveProperty('name', 'British Grand Prix');

    mqtt.calls.length = 0;

    // 3. Feed driver list
    const msg2 = pipeline.processMessage({
      topic: 'DriverList',
      data: {
        '1': {
          RacingNumber: '1',
          Tla: 'VER',
          FirstName: 'Max',
          LastName: 'Verstappen',
          TeamName: 'Red Bull Racing',
          TeamColour: '3671C6',
          CountryCode: 'NED',
        },
        '4': {
          RacingNumber: '4',
          Tla: 'NOR',
          FirstName: 'Lando',
          LastName: 'Norris',
          TeamName: 'McLaren',
          TeamColour: 'FF8000',
          CountryCode: 'GBR',
        },
        '44': {
          RacingNumber: '44',
          Tla: 'HAM',
          FirstName: 'Lewis',
          LastName: 'Hamilton',
          TeamName: 'Ferrari',
          TeamColour: 'E8002D',
          CountryCode: 'GBR',
        },
      },
      timestamp: '2025-07-06T14:00:01Z',
    });
    publisher.publishState(msg2.state);

    mqtt.calls.length = 0;

    // 4. Feed initial positions + lap count
    const msg3 = pipeline.processMessage({
      topic: 'TimingData',
      data: {
        Lines: {
          '1': { Position: '1', GapToLeader: '', InPit: false, Retired: false },
          '4': {
            Position: '2',
            GapToLeader: '+1.5',
            InPit: false,
            Retired: false,
          },
          '44': {
            Position: '3',
            GapToLeader: '+3.2',
            InPit: false,
            Retired: false,
          },
        },
      },
      timestamp: '2025-07-06T14:00:02Z',
    });
    const msg3b = pipeline.processMessage({
      topic: 'LapCount',
      data: { CurrentLap: 1, TotalLaps: 52 },
      timestamp: '2025-07-06T14:00:02Z',
    });
    publisher.publishState(msg3b.state);

    // Verify driver data published for favorites
    const ver_pos = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/driver/1/position',
    );
    expect(ver_pos).toBeDefined();
    expect(ver_pos!.payload).toBe('1');

    const nor_pos = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/driver/4/position',
    );
    expect(nor_pos).toBeDefined();
    expect(nor_pos!.payload).toBe('2');

    const ver_gap = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/driver/1/gap',
    );
    expect(ver_gap!.payload).toBe('LEADER');

    const nor_gap = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/driver/4/gap',
    );
    expect(nor_gap!.payload).toBe('+1.5');

    // Verify flag published
    const flagCall = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/session/flag',
    );
    expect(flagCall!.payload).toBe('green');

    // Verify lap count published
    const lapCall = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/session/lap',
    );
    expect(lapCall!.payload).toEqual({ current: 1, total: 52 });

    // Verify leader published
    const leaderCall = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/session/leader',
    );
    expect(leaderCall!.payload).toEqual({
      driverNumber: '1',
      abbreviation: 'VER',
      teamColor: '3671C6',
    });

    // Verify AWTRIX flag app published
    const awtrixFlag = mqtt.calls.find(
      (c) => c.topic === 'awtrix_abc/custom/f1flag',
    );
    expect(awtrixFlag).toBeDefined();
    expect(awtrixFlag!.payload).toHaveProperty('text', 'GREEN');

    // Verify AWTRIX driver apps for favorites
    const awtrixDrv1 = mqtt.calls.find(
      (c) => c.topic === 'awtrix_abc/custom/f1drv1',
    );
    expect(awtrixDrv1).toBeDefined();
    const drv1Text = (awtrixDrv1!.payload as { text: Array<{ t: string; c: string }> }).text;
    expect(drv1Text[0]).toEqual({ t: 'P1 ', c: 'FFFFFF' });
    expect(drv1Text[1]).toEqual({ t: 'VER', c: '3671C6' });

    mqtt.calls.length = 0;

    // 5. Safety car!
    const msg4 = pipeline.processMessage({
      topic: 'TrackStatus',
      data: { Status: '4', Message: 'SAFETY CAR DEPLOYED' },
      timestamp: '2025-07-06T14:05:00Z',
    });
    publisher.publishState(msg4.state);
    publisher.publishEvents(msg4.events);

    // Verify flag change event published
    const flagEventCall = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/event/flag',
    );
    expect(flagEventCall).toBeDefined();
    expect(flagEventCall!.payload).toHaveProperty('newFlag', 'sc');
    expect(flagEventCall!.payload).toHaveProperty('previousFlag', 'green');

    // Verify AWTRIX notification sent
    const awtrixNotif = mqtt.calls.find(
      (c) => c.topic === 'awtrix_abc/notify',
    );
    expect(awtrixNotif).toBeDefined();
    expect(awtrixNotif!.payload).toHaveProperty('text', 'SAFETY CAR');
    expect(awtrixNotif!.payload).toHaveProperty('wakeup', true);

    // Verify flag status updated
    const flagUpdate = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/session/flag',
    );
    expect(flagUpdate!.payload).toBe('sc');

    mqtt.calls.length = 0;

    // 6. Back to green, then overtake
    pipeline.processMessage({
      topic: 'TrackStatus',
      data: { Status: '1' },
      timestamp: '2025-07-06T14:10:00Z',
    });

    const msg5 = pipeline.processMessage({
      topic: 'TimingData',
      data: {
        Lines: {
          '4': { Position: '1' },
          '1': { Position: '2' },
        },
      },
      timestamp: '2025-07-06T14:10:01Z',
    });
    publisher.publishState(msg5.state);
    publisher.publishEvents(msg5.events);

    // Verify overtake event published
    const overtakeCall = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/event/overtake',
    );
    expect(overtakeCall).toBeDefined();
    expect(overtakeCall!.payload).toHaveProperty('overtakingAbbreviation', 'NOR');
    expect(overtakeCall!.payload).toHaveProperty('overtakenAbbreviation', 'VER');
    expect(overtakeCall!.payload).toHaveProperty('newPosition', 1);

    // Verify AWTRIX overtake notification
    const overtakeNotif = mqtt.calls.filter(
      (c) => c.topic === 'awtrix_abc/notify',
    );
    const norPassesVer = overtakeNotif.find((c) => {
      const text = (c.payload as { text?: Array<{ t: string }> }).text;
      return Array.isArray(text) && text.some((t) => t.t === 'NOR');
    });
    expect(norPassesVer).toBeDefined();

    // Verify updated positions for favorites
    const newNorPos = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/driver/4/position',
    );
    expect(newNorPos!.payload).toBe('1');

    const newVerPos = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/driver/1/position',
    );
    expect(newVerPos!.payload).toBe('2');

    mqtt.calls.length = 0;

    // 7. Pit stop: VER pits and changes to HARD
    pipeline.processMessage({
      topic: 'TimingData',
      data: { Lines: { '1': { InPit: true } } },
      timestamp: '2025-07-06T14:12:00Z',
    });

    const msg6 = pipeline.processMessage({
      topic: 'TimingAppData',
      data: {
        Lines: {
          '1': {
            Stints: {
              '0': { Compound: 'SOFT', New: 'true', TotalLaps: 12 },
              '1': { Compound: 'HARD', New: 'true', TotalLaps: 0 },
            },
          },
        },
      },
      timestamp: '2025-07-06T14:12:01Z',
    });
    publisher.publishState(msg6.state);
    publisher.publishEvents(msg6.events);

    // Verify pit stop event published
    const pitCall = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/event/pit_stop',
    );
    expect(pitCall).toBeDefined();
    expect(pitCall!.payload).toHaveProperty('abbreviation', 'VER');
    expect(pitCall!.payload).toHaveProperty('newCompound', 'HARD');

    // Verify driver tyre updated
    const tyrCall = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/driver/1/tyre',
    );
    expect(tyrCall).toBeDefined();
    expect(tyrCall!.payload).toHaveProperty('compound', 'HARD');

    // Verify driver status is "pit"
    const statusCall = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/driver/1/status',
    );
    expect(statusCall!.payload).toBe('pit');
  });

  it('deregisters ephemeral entities on session end', () => {
    publisher.registerSessionEntities();
    const registeredCount = mqtt.calls.filter((c) =>
      c.topic.startsWith('homeassistant/sensor/'),
    ).length;

    mqtt.calls.length = 0;
    mqtt.cleared.length = 0;

    publisher.deregisterSessionEntities();

    // Should clear all ephemeral discovery topics
    expect(mqtt.cleared.length).toBe(registeredCount);
    for (const topic of mqtt.cleared) {
      expect(topic).toMatch(/^homeassistant\/sensor\/f12mqtt\//);
    }

    // Session status should be "finished"
    const statusCall = mqtt.calls.find(
      (c) => c.topic === 'f12mqtt/session/status' && c.payload === 'finished',
    );
    expect(statusCall).toBeDefined();
  });

  it('does not publish state when session is not active', () => {
    // Don't call registerSessionEntities — session is not active
    const msg = pipeline.processMessage({
      topic: 'LapCount',
      data: { CurrentLap: 5, TotalLaps: 52 },
      timestamp: '2025-07-06T14:00:00Z',
    });
    publisher.publishState(msg.state);

    // No state topics should be published
    const stateCalls = mqtt.calls.filter((c) =>
      c.topic.startsWith('f12mqtt/session/'),
    );
    expect(stateCalls).toHaveLength(0);
  });
});
