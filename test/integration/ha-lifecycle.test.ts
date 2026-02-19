/**
 * Integration test: HA discovery entity lifecycle.
 * Verifies the full flow:
 * 1. App starts → persistent entities registered
 * 2. Session starts → ephemeral entities registered, state updates flow
 * 3. Session ends → ephemeral entities removed, persistent state updated
 * 4. New session starts → fresh ephemeral entities registered
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MqttPublisher } from '../../src/mqtt/publisher.js';
import { SignalRPipeline } from '../../src/signalr/pipeline.js';
import type { F1MqttClient } from '../../src/mqtt/client.js';

interface MqttCall {
  topic: string;
  payload: string | object;
  retain: boolean;
}

function mockMqttClient() {
  const calls: MqttCall[] = [];

  const client = {
    publish(topic: string, payload: string | object, retain = false) {
      calls.push({ topic, payload, retain });
    },
    clear(topic: string) {
      calls.push({ topic, payload: '', retain: true });
    },
    isConnected: () => true,
  } as unknown as F1MqttClient;

  return { client, calls };
}

describe('HA Discovery Lifecycle', () => {
  let pipeline: SignalRPipeline;
  let publisher: MqttPublisher;
  let mqtt: ReturnType<typeof mockMqttClient>;

  beforeEach(() => {
    pipeline = new SignalRPipeline();
    mqtt = mockMqttClient();
    publisher = new MqttPublisher(mqtt.client, {
      prefix: 'f12mqtt',
      favoriteDrivers: ['1'],
      awtrixEnabled: false,
      awtrixPrefix: '',
    });
  });

  it('follows the complete lifecycle across two sessions', () => {
    // === Step 1: App starts, register persistent entities ===
    publisher.registerPersistentEntities();

    const persistentTopics = mqtt.calls
      .filter((c) => c.topic.startsWith('homeassistant/'))
      .map((c) => c.topic);

    expect(persistentTopics).toContain(
      'homeassistant/sensor/f12mqtt/last_winner/config',
    );
    expect(persistentTopics).toContain(
      'homeassistant/sensor/f12mqtt/drivers_leader/config',
    );
    expect(persistentTopics).toContain(
      'homeassistant/sensor/f12mqtt/constructors_leader/config',
    );
    expect(persistentTopics).toContain(
      'homeassistant/sensor/f12mqtt/next_race/config',
    );
    expect(persistentTopics).toHaveLength(4);

    // Verify all persistent entities are retained
    const persistentCalls = mqtt.calls.filter((c) =>
      c.topic.startsWith('homeassistant/'),
    );
    for (const call of persistentCalls) {
      expect(call.retain).toBe(true);
    }

    mqtt.calls.length = 0;

    // === Step 2: Session 1 starts ===
    publisher.registerSessionEntities();

    const ephemeralTopics = mqtt.calls
      .filter((c) => c.topic.startsWith('homeassistant/'))
      .map((c) => c.topic);

    // Should have ephemeral entities: 8 base + 3 per driver × 1 favorite = 11
    expect(ephemeralTopics).toHaveLength(11);
    expect(ephemeralTopics).toContain(
      'homeassistant/sensor/f12mqtt/session_status/config',
    );
    expect(ephemeralTopics).toContain(
      'homeassistant/sensor/f12mqtt/flag_status/config',
    );
    expect(ephemeralTopics).toContain(
      'homeassistant/sensor/f12mqtt/driver_1_position/config',
    );
    expect(ephemeralTopics).toContain(
      'homeassistant/sensor/f12mqtt/driver_1_gap/config',
    );
    expect(ephemeralTopics).toContain(
      'homeassistant/sensor/f12mqtt/driver_1_tyre/config',
    );

    // Session status should be "active"
    const activeCalls = mqtt.calls.filter(
      (c) =>
        c.topic === 'f12mqtt/session/status' && c.payload === 'active',
    );
    expect(activeCalls).toHaveLength(1);

    mqtt.calls.length = 0;

    // === Step 3: State updates flow during session ===
    pipeline.processMessage({
      topic: 'DriverList',
      data: {
        '1': {
          RacingNumber: '1',
          Tla: 'VER',
          TeamName: 'Red Bull Racing',
          TeamColour: '3671C6',
        },
      },
      timestamp: '2025-01-01T00:00:00Z',
    });
    pipeline.processMessage({
      topic: 'TimingData',
      data: {
        Lines: {
          '1': { Position: '1', GapToLeader: '', InPit: false },
        },
      },
      timestamp: '2025-01-01T00:00:01Z',
    });
    const lapMsg = pipeline.processMessage({
      topic: 'LapCount',
      data: { CurrentLap: 10, TotalLaps: 52 },
      timestamp: '2025-01-01T00:00:02Z',
    });

    publisher.publishState(lapMsg.state);

    // Verify driver data flows to MQTT
    const driverPosCalls = mqtt.calls.filter(
      (c) => c.topic === 'f12mqtt/driver/1/position',
    );
    expect(driverPosCalls.length).toBeGreaterThan(0);
    expect(driverPosCalls[0]!.payload).toBe('1');

    const driverGapCalls = mqtt.calls.filter(
      (c) => c.topic === 'f12mqtt/driver/1/gap',
    );
    expect(driverGapCalls[0]!.payload).toBe('LEADER');

    const lapCalls = mqtt.calls.filter(
      (c) => c.topic === 'f12mqtt/session/lap',
    );
    expect(lapCalls[0]!.payload).toEqual({ current: 10, total: 52 });

    mqtt.calls.length = 0;

    // === Step 4: Session 1 ends ===
    publisher.deregisterSessionEntities();

    // All 11 ephemeral discovery topics should be cleared (empty payload)
    const clearCalls = mqtt.calls.filter(
      (c) =>
        c.topic.startsWith('homeassistant/') &&
        c.payload === '' &&
        c.retain === true,
    );
    expect(clearCalls).toHaveLength(11);

    // Session status should be "finished"
    const finishedCalls = mqtt.calls.filter(
      (c) =>
        c.topic === 'f12mqtt/session/status' && c.payload === 'finished',
    );
    expect(finishedCalls).toHaveLength(1);

    // State updates should NOT be published while session is inactive
    mqtt.calls.length = 0;
    publisher.publishState(lapMsg.state);
    const postSessionCalls = mqtt.calls.filter(
      (c) => c.topic.startsWith('f12mqtt/session/') || c.topic.startsWith('f12mqtt/driver/'),
    );
    expect(postSessionCalls).toHaveLength(0);

    // === Step 5: Session 2 starts (fresh entities) ===
    pipeline.reset(); // new session, fresh state
    mqtt.calls.length = 0;

    publisher.registerSessionEntities();

    const session2Ephemeral = mqtt.calls
      .filter((c) => c.topic.startsWith('homeassistant/'))
      .map((c) => c.topic);
    expect(session2Ephemeral).toHaveLength(11); // same count as session 1

    // State updates should work again
    const msg = pipeline.processMessage({
      topic: 'LapCount',
      data: { CurrentLap: 1, TotalLaps: 44 },
      timestamp: '2025-02-01T00:00:00Z',
    });
    mqtt.calls.length = 0;
    publisher.publishState(msg.state);

    const session2LapCalls = mqtt.calls.filter(
      (c) => c.topic === 'f12mqtt/session/lap',
    );
    expect(session2LapCalls).toHaveLength(1);
    expect(session2LapCalls[0]!.payload).toEqual({ current: 1, total: 44 });
  });
});
