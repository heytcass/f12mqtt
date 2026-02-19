/**
 * Recorded data source: loads a recorded session from disk.
 */

import type { DataSource, TimelineEntry } from './data-source.js';
import type { SessionState } from '../data/types.js';
import { loadInitialState, loadTimeline } from '../recording/storage.js';

export class RecordedDataSource implements DataSource {
  private entries: TimelineEntry[];
  private initialState: SessionState | null;

  constructor(sessionDir: string) {
    this.initialState = loadInitialState(sessionDir);
    this.entries = loadTimeline(sessionDir);
  }

  async getInitialState(): Promise<SessionState | null> {
    return this.initialState;
  }

  async *stream(from: string, speed: number): AsyncIterable<TimelineEntry> {
    const startIdx = this.entries.findIndex(
      (e) => e.timestamp >= from,
    );
    if (startIdx === -1) return;

    let prevTime = new Date(this.entries[startIdx]!.timestamp).getTime();

    for (let i = startIdx; i < this.entries.length; i++) {
      const entry = this.entries[i]!;
      const currTime = new Date(entry.timestamp).getTime();
      const delay = (currTime - prevTime) / speed;

      if (delay > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(delay, 5000)),
        );
      }

      yield entry;
      prevTime = currTime;
    }
  }

  async getTimeRange(): Promise<{ start: string; end: string } | null> {
    if (this.entries.length === 0) return null;
    return {
      start: this.entries[0]!.timestamp,
      end: this.entries[this.entries.length - 1]!.timestamp,
    };
  }

  async close(): Promise<void> {
    // No resources to clean up for file-based source
  }
}
