import { describe, it, expect } from 'vitest';
import {
  discoveryTopic,
  sessionStatusEntity,
  flagStatusEntity,
  raceLeaderEntity,
  lapCountEntity,
  driverPositionEntity,
  driverTyreEntity,
  ephemeralEntities,
  persistentEntities,
  lastWinnerEntity,
  nextRaceEntity,
} from '../../src/mqtt/ha-discovery.js';

const PREFIX = 'f12mqtt';

describe('HA Discovery', () => {
  describe('discoveryTopic', () => {
    it('builds correct discovery topic path', () => {
      expect(discoveryTopic('session_status')).toBe(
        'homeassistant/sensor/f12mqtt/session_status/config',
      );
    });
  });

  describe('entity payloads', () => {
    it('sessionStatusEntity has correct structure', () => {
      const entity = sessionStatusEntity(PREFIX);
      expect(entity.unique_id).toBe('f12mqtt_session_status');
      expect(entity.name).toBe('F1 Session Status');
      expect(entity.state_topic).toBe('f12mqtt/session/status');
      expect(entity.icon).toBe('mdi:flag-checkered');
      expect(entity.device.identifiers).toContain('f12mqtt');
      expect(entity.availability?.topic).toBe('f12mqtt/status');
    });

    it('flagStatusEntity has correct structure', () => {
      const entity = flagStatusEntity(PREFIX);
      expect(entity.unique_id).toBe('f12mqtt_flag_status');
      expect(entity.state_topic).toBe('f12mqtt/session/flag');
    });

    it('raceLeaderEntity has value_template and json_attributes', () => {
      const entity = raceLeaderEntity(PREFIX);
      expect(entity.value_template).toBe('{{ value_json.abbreviation }}');
      expect(entity.json_attributes_topic).toBe('f12mqtt/session/leader');
    });

    it('lapCountEntity has composite value_template', () => {
      const entity = lapCountEntity(PREFIX);
      expect(entity.value_template).toBe(
        '{{ value_json.current }}/{{ value_json.total }}',
      );
    });

    it('driverPositionEntity includes driver number', () => {
      const entity = driverPositionEntity(PREFIX, '1');
      expect(entity.unique_id).toBe('f12mqtt_driver_1_position');
      expect(entity.state_topic).toBe('f12mqtt/driver/1/position');
    });

    it('driverTyreEntity has compound value_template', () => {
      const entity = driverTyreEntity(PREFIX, '44');
      expect(entity.value_template).toBe('{{ value_json.compound }}');
      expect(entity.json_attributes_topic).toBe('f12mqtt/driver/44/tyre');
    });
  });

  describe('ephemeralEntities', () => {
    it('generates base entities + per-driver entities', () => {
      const entities = ephemeralEntities(PREFIX, ['1', '44']);
      // 9 base + 3 per driver × 2 drivers = 15
      expect(entities).toHaveLength(15);
    });

    it('generates base entities only when no favorites', () => {
      const entities = ephemeralEntities(PREFIX, []);
      expect(entities).toHaveLength(9);
    });

    it('includes race control entity', () => {
      const entities = ephemeralEntities('f12mqtt', []);
      const rcEntity = entities.find(e => e.topic.includes('race_control'));
      expect(rcEntity).toBeDefined();
      expect(rcEntity!.payload.name).toBe('F1 Race Control');
      expect(rcEntity!.payload.icon).toBe('mdi:message-alert');
    });
  });

  describe('persistentEntities', () => {
    it('generates 4 persistent entities', () => {
      const entities = persistentEntities(PREFIX);
      expect(entities).toHaveLength(4);
    });

    it('lastWinnerEntity has correct structure', () => {
      const entity = lastWinnerEntity(PREFIX);
      expect(entity.unique_id).toBe('f12mqtt_last_winner');
      expect(entity.icon).toBe('mdi:trophy');
    });

    it('nextRaceEntity has correct structure', () => {
      const entity = nextRaceEntity(PREFIX);
      expect(entity.unique_id).toBe('f12mqtt_next_race');
      expect(entity.state_topic).toBe('f12mqtt/schedule/next_race');
    });
  });

  describe('custom prefix', () => {
    it('uses custom prefix in all topics', () => {
      const entity = sessionStatusEntity('custom');
      expect(entity.state_topic).toBe('custom/session/status');
      expect(entity.availability?.topic).toBe('custom/status');
    });
  });
});
