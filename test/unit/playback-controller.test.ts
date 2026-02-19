import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackController } from '../../src/playback/controller.js';
import { Timeline } from '../../src/playback/timeline.js';
import { createEmptySessionState } from '../../src/data/types.js';
import type { TimelineEntry } from '../../src/playback/data-source.js';

function makeTimeline(): { timeline: Timeline; entries: TimelineEntry[] } {
  const entries: TimelineEntry[] = [
    {
      timestamp: '2025-01-01T00:00:00Z',
      topic: 'LapCount',
      data: { CurrentLap: 1, TotalLaps: 52 },
    },
    {
      timestamp: '2025-01-01T00:00:01Z',
      topic: 'TrackStatus',
      data: { Status: '1' },
    },
    {
      timestamp: '2025-01-01T00:00:02Z',
      topic: 'LapCount',
      data: { CurrentLap: 2, TotalLaps: 52 },
    },
    {
      timestamp: '2025-01-01T00:00:03Z',
      topic: 'TrackStatus',
      data: { Status: '5' }, // Red flag!
    },
    {
      timestamp: '2025-01-01T00:00:05Z',
      topic: 'TrackStatus',
      data: { Status: '1' }, // Back to green
    },
  ];

  return { timeline: new Timeline(entries), entries };
}

describe('PlaybackController', () => {
  let controller: PlaybackController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new PlaybackController();
  });

  afterEach(() => {
    controller.stop();
    vi.useRealTimers();
  });

  describe('load', () => {
    it('loads a timeline', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, null);
      const state = controller.getPlaybackState();
      expect(state.status).toBe('stopped');
      expect(state.totalEntries).toBe(5);
    });

    it('emits loaded event', () => {
      const { timeline } = makeTimeline();
      const spy = vi.fn();
      controller.on('loaded', spy);
      controller.load(timeline, null);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('play/pause/stop', () => {
    it('transitions to playing', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, null);
      controller.play();
      expect(controller.getPlaybackState().status).toBe('playing');
    });

    it('transitions to paused', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, null);
      controller.play();
      controller.pause();
      expect(controller.getPlaybackState().status).toBe('paused');
    });

    it('transitions to stopped', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, null);
      controller.play();
      controller.stop();
      expect(controller.getPlaybackState().status).toBe('stopped');
    });

    it('processes first entry immediately on play', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, null);

      const updateSpy = vi.fn();
      controller.on('update', updateSpy);
      controller.play();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy.mock.calls[0]![0].state.lapCount.current).toBe(1);
    });

    it('emits events when detected during playback', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, null);

      const eventSpy = vi.fn();
      controller.on('event', eventSpy);
      controller.play();

      // Advance through all timers
      vi.runAllTimers();

      const flagChanges = eventSpy.mock.calls.filter(
        ([e]) => e.type === 'flag_change',
      );
      // green→green (no change from initial), then green→red, then red→green
      expect(flagChanges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('speed', () => {
    it('defaults to 1x', () => {
      expect(controller.getPlaybackState().speed).toBe(1);
    });

    it('can be changed', () => {
      controller.setSpeed(2);
      expect(controller.getPlaybackState().speed).toBe(2);
    });
  });

  describe('seek', () => {
    it('rebuilds state from initial to target', () => {
      const { timeline } = makeTimeline();
      const initialState = createEmptySessionState();
      controller.load(timeline, initialState);

      // Seek to 00:00:02. findIndex returns 2 (entry with LapCount CurrentLap:2).
      // Entries 0 and 1 are replayed (LapCount:1, TrackStatus:green).
      // The entry AT index 2 is the next to be played.
      controller.seek('2025-01-01T00:00:02Z');

      const state = controller.getSessionState();
      expect(state.lapCount.current).toBe(1); // entries 0-1 replayed, entry 2 pending
      expect(controller.getPlaybackState().currentIndex).toBe(2);
    });

    it('replays all entries up to target time', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, createEmptySessionState());

      // Seek to just after the red flag
      controller.seek('2025-01-01T00:00:04Z');

      const state = controller.getSessionState();
      // Should have replayed up to index 3 (red flag), but target is at 00:00:04
      // which is between entries 3 and 4, so index 4 is found, entries 0-3 replayed
      expect(state.trackStatus.flag).toBe('red');
    });

    it('emits seek event', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, createEmptySessionState());

      const seekSpy = vi.fn();
      controller.on('seek', seekSpy);
      controller.seek('2025-01-01T00:00:02Z');

      expect(seekSpy).toHaveBeenCalledTimes(1);
    });

    it('resumes playing after seek if was playing', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, createEmptySessionState());
      controller.play();

      controller.seek('2025-01-01T00:00:02Z');
      expect(controller.getPlaybackState().status).toBe('playing');
    });

    it('stays paused after seek if was paused', () => {
      const { timeline } = makeTimeline();
      controller.load(timeline, createEmptySessionState());
      controller.pause();

      controller.seek('2025-01-01T00:00:02Z');
      expect(controller.getPlaybackState().status).toBe('paused');
    });
  });
});
