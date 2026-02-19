import type { SessionState } from '../data/types.js';
import type { F1Event } from './types.js';
import { detectFlagChange } from './flag-detector.js';
import { detectOvertakes } from './overtake-detector.js';
import { detectPitStops } from './pit-detector.js';
import { detectWeatherChange } from './weather-detector.js';

/**
 * Run all event detectors against two consecutive state snapshots.
 * Returns all detected events.
 */
export function detectEvents(
  prev: SessionState,
  curr: SessionState,
): F1Event[] {
  return [
    ...detectFlagChange(prev, curr),
    ...detectOvertakes(prev, curr),
    ...detectPitStops(prev, curr),
    ...detectWeatherChange(prev, curr),
  ];
}
