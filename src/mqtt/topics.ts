/**
 * MQTT topic builders for all f12mqtt topics.
 */

import { DEFAULT_MQTT_PREFIX } from '../util/constants.js';

export function makePrefix(prefix?: string): string {
  return prefix ?? DEFAULT_MQTT_PREFIX;
}

// --- Session topics ---
export const sessionStatus = (p: string) => `${p}/session/status`;
export const sessionInfo = (p: string) => `${p}/session/info`;
export const sessionFlag = (p: string) => `${p}/session/flag`;
export const sessionLeader = (p: string) => `${p}/session/leader`;
export const sessionLap = (p: string) => `${p}/session/lap`;
export const sessionWeather = (p: string) => `${p}/session/weather`;
export const sessionRaceControl = (p: string) => `${p}/session/race_control`;

// --- Driver topics ---
export const driverPosition = (p: string, num: string) =>
  `${p}/driver/${num}/position`;
export const driverGap = (p: string, num: string) =>
  `${p}/driver/${num}/gap`;
export const driverTyre = (p: string, num: string) =>
  `${p}/driver/${num}/tyre`;
export const driverStatus = (p: string, num: string) =>
  `${p}/driver/${num}/status`;

// --- Event topics ---
export const eventFlag = (p: string) => `${p}/event/flag`;
export const eventOvertake = (p: string) => `${p}/event/overtake`;
export const eventPitStop = (p: string) => `${p}/event/pit_stop`;
export const eventWeather = (p: string) => `${p}/event/weather`;

// --- Playback topics ---
export const playbackState = (p: string) => `${p}/playback/state`;
export const playbackCommand = (p: string) => `${p}/playback/command`;

// --- Persistent topics ---
export const lastWinner = (p: string) => `${p}/standings/last_winner`;
export const driversLeader = (p: string) => `${p}/standings/drivers_leader`;
export const constructorsLeader = (p: string) =>
  `${p}/standings/constructors_leader`;
export const nextRace = (p: string) => `${p}/schedule/next_race`;

// --- System topics ---
export const statusTopic = (p: string) => `${p}/status`;
