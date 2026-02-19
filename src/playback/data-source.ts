/**
 * DataSource interface: all sources (live, recorded, OpenF1) implement this.
 */

import type { SessionState } from '../data/types.js';

export interface TimelineEntry {
  timestamp: string; // ISO 8601
  topic: string;
  data: unknown;
}

export interface DataSource {
  /** Get the initial state snapshot (subscribe.json equivalent) */
  getInitialState(): Promise<SessionState | null>;

  /** Stream entries from a given timestamp at a given speed multiplier */
  stream(from: string, speed: number): AsyncIterable<TimelineEntry>;

  /** Get the time range of available data */
  getTimeRange(): Promise<{ start: string; end: string } | null>;

  /** Clean up resources */
  close(): Promise<void>;
}
