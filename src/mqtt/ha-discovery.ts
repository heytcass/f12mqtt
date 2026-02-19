/**
 * Home Assistant MQTT Auto-Discovery payload generators.
 * Publishes config payloads to homeassistant/sensor/f12mqtt/<id>/config.
 */

export interface HADiscoveryPayload {
  name: string;
  unique_id: string;
  state_topic: string;
  value_template?: string;
  json_attributes_topic?: string;
  icon?: string;
  device: HADevicePayload;
  availability?: {
    topic: string;
    payload_available: string;
    payload_not_available: string;
  };
}

export interface HADevicePayload {
  identifiers: string[];
  name: string;
  manufacturer: string;
  model: string;
}

const DEVICE: HADevicePayload = {
  identifiers: ['f12mqtt'],
  name: 'F1 Live Timing',
  manufacturer: 'f12mqtt',
  model: 'F1 MQTT Bridge',
};

export function discoveryTopic(entityId: string): string {
  return `homeassistant/sensor/f12mqtt/${entityId}/config`;
}

export function sensorPayload(
  entityId: string,
  name: string,
  stateTopic: string,
  opts: {
    icon?: string;
    valueTemplate?: string;
    jsonAttributesTopic?: string;
    availabilityTopic?: string;
  } = {},
): HADiscoveryPayload {
  const payload: HADiscoveryPayload = {
    name,
    unique_id: `f12mqtt_${entityId}`,
    state_topic: stateTopic,
    device: DEVICE,
  };

  if (opts.icon) payload.icon = opts.icon;
  if (opts.valueTemplate) payload.value_template = opts.valueTemplate;
  if (opts.jsonAttributesTopic)
    payload.json_attributes_topic = opts.jsonAttributesTopic;
  if (opts.availabilityTopic) {
    payload.availability = {
      topic: opts.availabilityTopic,
      payload_available: 'online',
      payload_not_available: 'offline',
    };
  }

  return payload;
}

// --- Ephemeral entities (created on session start, removed on session end) ---

export function sessionStatusEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('session_status', 'F1 Session Status', `${prefix}/session/status`, {
    icon: 'mdi:flag-checkered',
    availabilityTopic: `${prefix}/status`,
  });
}

export function flagStatusEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('flag_status', 'F1 Flag Status', `${prefix}/session/flag`, {
    icon: 'mdi:flag',
    availabilityTopic: `${prefix}/status`,
  });
}

export function raceLeaderEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('race_leader', 'F1 Race Leader', `${prefix}/session/leader`, {
    icon: 'mdi:trophy',
    valueTemplate: '{{ value_json.abbreviation }}',
    jsonAttributesTopic: `${prefix}/session/leader`,
    availabilityTopic: `${prefix}/status`,
  });
}

export function lapCountEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('lap_count', 'F1 Lap Count', `${prefix}/session/lap`, {
    icon: 'mdi:counter',
    valueTemplate: '{{ value_json.current }}/{{ value_json.total }}',
    availabilityTopic: `${prefix}/status`,
  });
}

export function weatherStatusEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('weather_status', 'F1 Weather', `${prefix}/session/weather`, {
    icon: 'mdi:weather-partly-cloudy',
    valueTemplate: '{% if value_json.rainfall %}Wet{% else %}Dry{% endif %}',
    jsonAttributesTopic: `${prefix}/session/weather`,
    availabilityTopic: `${prefix}/status`,
  });
}

export function driverPositionEntity(
  prefix: string,
  driverNum: string,
): HADiscoveryPayload {
  return sensorPayload(
    `driver_${driverNum}_position`,
    `F1 Driver ${driverNum} Position`,
    `${prefix}/driver/${driverNum}/position`,
    {
      icon: 'mdi:car-sports',
      availabilityTopic: `${prefix}/status`,
    },
  );
}

export function driverGapEntity(
  prefix: string,
  driverNum: string,
): HADiscoveryPayload {
  return sensorPayload(
    `driver_${driverNum}_gap`,
    `F1 Driver ${driverNum} Gap`,
    `${prefix}/driver/${driverNum}/gap`,
    {
      icon: 'mdi:timer-outline',
      availabilityTopic: `${prefix}/status`,
    },
  );
}

export function driverTyreEntity(
  prefix: string,
  driverNum: string,
): HADiscoveryPayload {
  return sensorPayload(
    `driver_${driverNum}_tyre`,
    `F1 Driver ${driverNum} Tyre`,
    `${prefix}/driver/${driverNum}/tyre`,
    {
      icon: 'mdi:tire',
      valueTemplate: '{{ value_json.compound }}',
      jsonAttributesTopic: `${prefix}/driver/${driverNum}/tyre`,
      availabilityTopic: `${prefix}/status`,
    },
  );
}

export function latestOvertakeEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('latest_overtake', 'F1 Latest Overtake', `${prefix}/event/overtake`, {
    icon: 'mdi:swap-horizontal',
    valueTemplate:
      '{{ value_json.overtakingAbbreviation }} P{{ value_json.newPosition }}',
    jsonAttributesTopic: `${prefix}/event/overtake`,
    availabilityTopic: `${prefix}/status`,
  });
}

export function latestPitStopEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('latest_pit_stop', 'F1 Latest Pit Stop', `${prefix}/event/pit_stop`, {
    icon: 'mdi:wrench',
    valueTemplate: '{{ value_json.abbreviation }} {{ value_json.newCompound }}',
    jsonAttributesTopic: `${prefix}/event/pit_stop`,
    availabilityTopic: `${prefix}/status`,
  });
}

export function playbackStatusEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('playback_status', 'F1 Playback Status', `${prefix}/playback/state`, {
    icon: 'mdi:play-circle-outline',
    valueTemplate: '{{ value_json.status }}',
    jsonAttributesTopic: `${prefix}/playback/state`,
    availabilityTopic: `${prefix}/status`,
  });
}

// --- Persistent entities (always registered) ---

export function lastWinnerEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('last_winner', 'F1 Last Winner', `${prefix}/standings/last_winner`, {
    icon: 'mdi:trophy',
    valueTemplate: '{{ value_json.driver }}',
    jsonAttributesTopic: `${prefix}/standings/last_winner`,
    availabilityTopic: `${prefix}/status`,
  });
}

export function driversLeaderEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload(
    'drivers_leader',
    'F1 Drivers Championship Leader',
    `${prefix}/standings/drivers_leader`,
    {
      icon: 'mdi:medal',
      valueTemplate: '{{ value_json.driver }}',
      jsonAttributesTopic: `${prefix}/standings/drivers_leader`,
      availabilityTopic: `${prefix}/status`,
    },
  );
}

export function constructorsLeaderEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload(
    'constructors_leader',
    'F1 Constructors Championship Leader',
    `${prefix}/standings/constructors_leader`,
    {
      icon: 'mdi:medal',
      valueTemplate: '{{ value_json.team }}',
      jsonAttributesTopic: `${prefix}/standings/constructors_leader`,
      availabilityTopic: `${prefix}/status`,
    },
  );
}

export function nextRaceEntity(prefix: string): HADiscoveryPayload {
  return sensorPayload('next_race', 'F1 Next Race', `${prefix}/schedule/next_race`, {
    icon: 'mdi:calendar-clock',
    valueTemplate: '{{ value_json.name }}',
    jsonAttributesTopic: `${prefix}/schedule/next_race`,
    availabilityTopic: `${prefix}/status`,
  });
}

/** All ephemeral entity generators */
export function ephemeralEntities(
  prefix: string,
  favoriteDrivers: string[],
): { topic: string; payload: HADiscoveryPayload }[] {
  const entities = [
    sessionStatusEntity,
    flagStatusEntity,
    raceLeaderEntity,
    lapCountEntity,
    weatherStatusEntity,
    latestOvertakeEntity,
    latestPitStopEntity,
    playbackStatusEntity,
  ].map((fn) => ({
    topic: discoveryTopic(fn(prefix).unique_id.replace('f12mqtt_', '')),
    payload: fn(prefix),
  }));

  for (const num of favoriteDrivers) {
    for (const fn of [driverPositionEntity, driverGapEntity, driverTyreEntity]) {
      const payload = fn(prefix, num);
      entities.push({
        topic: discoveryTopic(payload.unique_id.replace('f12mqtt_', '')),
        payload,
      });
    }
  }

  return entities;
}

/** All persistent entity generators */
export function persistentEntities(
  prefix: string,
): { topic: string; payload: HADiscoveryPayload }[] {
  return [lastWinnerEntity, driversLeaderEntity, constructorsLeaderEntity, nextRaceEntity].map(
    (fn) => ({
      topic: discoveryTopic(fn(prefix).unique_id.replace('f12mqtt_', '')),
      payload: fn(prefix),
    }),
  );
}
