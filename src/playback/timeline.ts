/**
 * Timeline: sorted, indexed collection of timeline entries with binary search.
 */

import type { TimelineEntry } from './data-source.js';

export class Timeline {
  private entries: TimelineEntry[];

  constructor(entries: TimelineEntry[]) {
    // Ensure sorted by timestamp
    this.entries = [...entries].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );
  }

  get length(): number {
    return this.entries.length;
  }

  getEntry(index: number): TimelineEntry | undefined {
    return this.entries[index];
  }

  /** Get time range of the timeline */
  getTimeRange(): { start: string; end: string } | null {
    if (this.entries.length === 0) return null;
    return {
      start: this.entries[0]!.timestamp,
      end: this.entries[this.entries.length - 1]!.timestamp,
    };
  }

  /**
   * Binary search: find the index of the first entry at or after the given timestamp.
   * Returns entries.length if all entries are before the timestamp.
   */
  findIndex(timestamp: string): number {
    let lo = 0;
    let hi = this.entries.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.entries[mid]!.timestamp < timestamp) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    return lo;
  }

  /** Get all entries from startIndex up to (not including) endIndex */
  slice(startIndex: number, endIndex: number): TimelineEntry[] {
    return this.entries.slice(startIndex, endIndex);
  }

  /** Get all entries between two timestamps (inclusive) */
  getRange(startTime: string, endTime: string): TimelineEntry[] {
    const startIdx = this.findIndex(startTime);
    // Find first entry AFTER endTime
    let endIdx = this.findIndex(endTime);
    // Include entries at exactly endTime
    while (
      endIdx < this.entries.length &&
      this.entries[endIdx]!.timestamp === endTime
    ) {
      endIdx++;
    }
    return this.entries.slice(startIdx, endIdx);
  }
}
