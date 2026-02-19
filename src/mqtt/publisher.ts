/**
 * MQTT publisher: publishes session state and events to MQTT topics.
 * Handles HA discovery lifecycle and AWTRIX 3 integration.
 */

import type { F1MqttClient } from './client.js';
import type { SessionState } from '../data/types.js';
import type { F1Event } from '../events/types.js';
import * as topics from './topics.js';
import * as ha from './ha-discovery.js';
import * as awtrix from './awtrix.js';
import { createChildLogger } from '../util/logger.js';

const log = createChildLogger('publisher');

export interface PublisherConfig {
  prefix: string;
  favoriteDrivers: string[];
  awtrixEnabled: boolean;
  awtrixPrefix: string;
}

export class MqttPublisher {
  private sessionActive = false;
  private registeredEphemeralTopics: string[] = [];

  constructor(
    private mqtt: F1MqttClient,
    private config: PublisherConfig,
  ) {}

  /** Register persistent HA entities (called once on startup) */
  registerPersistentEntities(): void {
    const entities = ha.persistentEntities(this.config.prefix);
    for (const entity of entities) {
      this.mqtt.publish(entity.topic, entity.payload, true);
    }
    log.info({ count: entities.length }, 'Registered persistent HA entities');
  }

  /** Register ephemeral HA entities (called on session start) */
  registerSessionEntities(): void {
    const entities = ha.ephemeralEntities(
      this.config.prefix,
      this.config.favoriteDrivers,
    );
    this.registeredEphemeralTopics = entities.map((e) => e.topic);

    for (const entity of entities) {
      this.mqtt.publish(entity.topic, entity.payload, true);
    }

    this.mqtt.publish(
      topics.sessionStatus(this.config.prefix),
      'active',
      true,
    );
    this.sessionActive = true;
    log.info({ count: entities.length }, 'Registered ephemeral HA entities');
  }

  /** Remove ephemeral HA entities (called on session end) */
  deregisterSessionEntities(): void {
    for (const topic of this.registeredEphemeralTopics) {
      this.mqtt.clear(topic);
    }
    this.mqtt.publish(
      topics.sessionStatus(this.config.prefix),
      'finished',
      true,
    );
    this.sessionActive = false;
    this.registeredEphemeralTopics = [];
    log.info('Deregistered ephemeral HA entities');
  }

  /** Publish current session state snapshot */
  publishState(state: SessionState): void {
    if (!this.sessionActive) return;
    const p = this.config.prefix;

    // Session-level topics
    this.mqtt.publish(topics.sessionFlag(p), state.trackStatus.flag, true);

    if (state.lapCount.total > 0) {
      this.mqtt.publish(topics.sessionLap(p), state.lapCount, true);
    }

    if (state.weather) {
      this.mqtt.publish(topics.sessionWeather(p), state.weather, true);
    }

    if (state.sessionInfo) {
      this.mqtt.publish(topics.sessionInfo(p), state.sessionInfo, true);
    }

    if (state.latestRaceControlMessage) {
      this.mqtt.publish(
        topics.sessionRaceControl(p),
        state.latestRaceControlMessage,
        true,
      );
    }

    // Find leader
    const leader = Object.values(state.timing).find((t) => t.position === 1);
    if (leader) {
      const driverInfo = state.drivers[leader.driverNumber];
      this.mqtt.publish(
        topics.sessionLeader(p),
        {
          driverNumber: leader.driverNumber,
          abbreviation: driverInfo?.abbreviation ?? leader.driverNumber,
          teamColor: driverInfo?.teamColor ?? 'FFFFFF',
        },
        true,
      );
    }

    // Favorite driver topics
    for (const num of this.config.favoriteDrivers) {
      const timing = state.timing[num];
      if (!timing) continue;

      this.mqtt.publish(
        topics.driverPosition(p, num),
        String(timing.position),
        true,
      );
      this.mqtt.publish(
        topics.driverGap(p, num),
        timing.position === 1 ? 'LEADER' : timing.gapToLeader,
        true,
      );

      const stint = state.stints[num];
      if (stint) {
        this.mqtt.publish(topics.driverTyre(p, num), stint, true);
      }

      const driverStatusValue = timing.retired
        ? 'retired'
        : timing.inPit
          ? 'pit'
          : 'racing';
      this.mqtt.publish(
        topics.driverStatus(p, num),
        driverStatusValue,
        true,
      );
    }

    // AWTRIX custom apps
    if (this.config.awtrixEnabled) {
      this.publishAwtrixApps(state);
    }
  }

  /** Publish detected events */
  publishEvents(events: F1Event[]): void {
    const p = this.config.prefix;

    for (const event of events) {
      switch (event.type) {
        case 'flag_change':
          this.mqtt.publish(topics.eventFlag(p), event);
          if (this.config.awtrixEnabled) {
            this.mqtt.publish(
              awtrix.awtrixNotifyTopic(this.config.awtrixPrefix),
              awtrix.flagNotification(event),
            );
          }
          break;

        case 'overtake':
          this.mqtt.publish(topics.eventOvertake(p), event);
          if (this.config.awtrixEnabled) {
            this.mqtt.publish(
              awtrix.awtrixNotifyTopic(this.config.awtrixPrefix),
              awtrix.overtakeNotification(event),
            );
          }
          break;

        case 'pit_stop':
          this.mqtt.publish(topics.eventPitStop(p), event);
          if (this.config.awtrixEnabled) {
            this.mqtt.publish(
              awtrix.awtrixNotifyTopic(this.config.awtrixPrefix),
              awtrix.pitStopNotification(event),
            );
          }
          break;

        case 'weather_change':
          this.mqtt.publish(topics.eventWeather(p), event);
          break;
      }
    }
  }

  private publishAwtrixApps(state: SessionState): void {
    const ap = this.config.awtrixPrefix;

    // Flag app
    this.mqtt.publish(
      awtrix.awtrixCustomAppTopic(ap, 'f1flag'),
      awtrix.flagApp(state.trackStatus.flag),
    );

    // Lap counter
    if (state.lapCount.total > 0) {
      this.mqtt.publish(
        awtrix.awtrixCustomAppTopic(ap, 'f1lap'),
        awtrix.lapApp(state.lapCount.current, state.lapCount.total),
      );
    }

    // Favorite driver apps
    const driverSlots = ['f1drv1', 'f1drv2', 'f1drv3'];
    for (let i = 0; i < this.config.favoriteDrivers.length && i < 3; i++) {
      const num = this.config.favoriteDrivers[i]!;
      const timing = state.timing[num];
      const driver = state.drivers[num];
      if (!timing || !driver) continue;

      this.mqtt.publish(
        awtrix.awtrixCustomAppTopic(ap, driverSlots[i]!),
        awtrix.driverApp(
          timing.position,
          driver.abbreviation,
          timing.position === 1 ? '' : timing.gapToLeader,
          driver.teamColor,
        ),
      );
    }

    // Top three app
    if (state.topThree.length > 0) {
      this.mqtt.publish(
        awtrix.awtrixCustomAppTopic(ap, 'f1top3'),
        awtrix.topThreeApp(state.topThree),
      );
    }
  }
}
