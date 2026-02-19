import { describe, it, expect } from 'vitest';
import { Timeline } from '../../src/playback/timeline.js';
import type { TimelineEntry } from '../../src/playback/data-source.js';

function makeEntries(timestamps: string[]): TimelineEntry[] {
  return timestamps.map((ts) => ({
    timestamp: ts,
    topic: 'TestTopic',
    data: { ts },
  }));
}

describe('Timeline', () => {
  const timestamps = [
    '2025-01-01T00:00:00Z',
    '2025-01-01T00:00:01Z',
    '2025-01-01T00:00:02Z',
    '2025-01-01T00:00:03Z',
    '2025-01-01T00:00:05Z',
    '2025-01-01T00:00:08Z',
    '2025-01-01T00:00:10Z',
  ];

  it('sorts entries by timestamp', () => {
    const entries = makeEntries([timestamps[2]!, timestamps[0]!, timestamps[1]!]);
    const timeline = new Timeline(entries);
    expect(timeline.getEntry(0)?.timestamp).toBe(timestamps[0]);
    expect(timeline.getEntry(1)?.timestamp).toBe(timestamps[1]);
    expect(timeline.getEntry(2)?.timestamp).toBe(timestamps[2]);
  });

  describe('getTimeRange', () => {
    it('returns start and end', () => {
      const timeline = new Timeline(makeEntries(timestamps));
      const range = timeline.getTimeRange();
      expect(range?.start).toBe('2025-01-01T00:00:00Z');
      expect(range?.end).toBe('2025-01-01T00:00:10Z');
    });

    it('returns null for empty timeline', () => {
      const timeline = new Timeline([]);
      expect(timeline.getTimeRange()).toBeNull();
    });
  });

  describe('findIndex (binary search)', () => {
    const timeline = new Timeline(makeEntries(timestamps));

    it('finds exact match', () => {
      const idx = timeline.findIndex('2025-01-01T00:00:03Z');
      expect(idx).toBe(3);
    });

    it('finds first entry at or after target', () => {
      // No entry at 00:00:04, should find 00:00:05 at index 4
      const idx = timeline.findIndex('2025-01-01T00:00:04Z');
      expect(idx).toBe(4);
    });

    it('returns 0 for timestamp before all entries', () => {
      const idx = timeline.findIndex('2024-12-31T00:00:00Z');
      expect(idx).toBe(0);
    });

    it('returns length for timestamp after all entries', () => {
      const idx = timeline.findIndex('2025-01-01T00:00:11Z');
      expect(idx).toBe(7);
    });

    it('finds first entry', () => {
      const idx = timeline.findIndex('2025-01-01T00:00:00Z');
      expect(idx).toBe(0);
    });

    it('finds last entry', () => {
      const idx = timeline.findIndex('2025-01-01T00:00:10Z');
      expect(idx).toBe(6);
    });
  });

  describe('getRange', () => {
    const timeline = new Timeline(makeEntries(timestamps));

    it('returns entries in range (inclusive)', () => {
      const range = timeline.getRange(
        '2025-01-01T00:00:01Z',
        '2025-01-01T00:00:05Z',
      );
      expect(range).toHaveLength(4);
      expect(range[0]?.timestamp).toBe('2025-01-01T00:00:01Z');
      expect(range[3]?.timestamp).toBe('2025-01-01T00:00:05Z');
    });

    it('returns empty for range with no entries', () => {
      const range = timeline.getRange(
        '2025-01-01T00:00:06Z',
        '2025-01-01T00:00:07Z',
      );
      expect(range).toHaveLength(0);
    });

    it('returns all entries for full range', () => {
      const range = timeline.getRange(
        '2025-01-01T00:00:00Z',
        '2025-01-01T00:00:10Z',
      );
      expect(range).toHaveLength(7);
    });
  });

  describe('length', () => {
    it('returns correct count', () => {
      const timeline = new Timeline(makeEntries(timestamps));
      expect(timeline.length).toBe(7);
    });

    it('returns 0 for empty', () => {
      const timeline = new Timeline([]);
      expect(timeline.length).toBe(0);
    });
  });
});
