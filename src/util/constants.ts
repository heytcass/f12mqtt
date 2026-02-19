/** F1 track status codes from SignalR TrackStatus topic */
export const TrackStatusCode = {
  AllClear: '1',
  Yellow: '2',
  SCDeployed: '4',
  Red: '5',
  VSC: '6',
  VSCEnding: '7',
} as const;

export type TrackStatusCodeValue =
  (typeof TrackStatusCode)[keyof typeof TrackStatusCode];

/** Mapped flag names for MQTT publishing */
export const FLAG_NAMES: Record<string, string> = {
  '1': 'green',
  '2': 'yellow',
  '4': 'sc',
  '5': 'red',
  '6': 'vsc',
  '7': 'vsc_ending',
};

/** Tyre compound names */
export const TYRE_COMPOUNDS: Record<string, string> = {
  '1': 'SOFT',
  '2': 'MEDIUM',
  '3': 'HARD',
  '4': 'INTERMEDIATE',
  '5': 'WET',
};

/** Default MQTT topic prefix */
export const DEFAULT_MQTT_PREFIX = 'f12mqtt';

/** SignalR live timing endpoint */
export const SIGNALR_BASE_URL = 'https://livetiming.formula1.com/signalr';

/** OpenF1 API base URL */
export const OPENF1_BASE_URL = 'https://api.openf1.org/v1';

/** SignalR topics to subscribe to */
export const SIGNALR_TOPICS = [
  'TimingData',
  'TrackStatus',
  'DriverList',
  'RaceControlMessages',
  'SessionInfo',
  'SessionData',
  'LapCount',
  'WeatherData',
  'TimingAppData',
  'ExtrapolatedClock',
  'Heartbeat',
  'CarData.z',
  'Position.z',
] as const;

export type SignalRTopic = (typeof SIGNALR_TOPICS)[number];
