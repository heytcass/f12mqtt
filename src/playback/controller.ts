/**
 * Playback controller: manages seek/pause/resume/speed across data sources.
 * Drives the pipeline by replaying timeline entries at the configured speed.
 */

import { EventEmitter } from 'node:events';
import { Timeline } from './timeline.js';
import { StateAccumulator } from '../data/state-accumulator.js';
import { detectEvents } from '../events/detector.js';
import type { TimelineEntry } from './data-source.js';
import type { SessionState } from '../data/types.js';
import { createChildLogger } from '../util/logger.js';

const log = createChildLogger('playback');

export type PlaybackStatus = 'playing' | 'paused' | 'stopped';
export type PlaybackMode = 'live' | 'recorded' | 'openf1';

export interface PlaybackState {
  mode: PlaybackMode;
  status: PlaybackStatus;
  speed: number;
  currentTime: string;
  startTime: string;
  endTime: string;
  currentIndex: number;
  totalEntries: number;
}

export class PlaybackController extends EventEmitter {
  private timeline: Timeline | null = null;
  private initialState: SessionState | null = null;
  private accumulator = new StateAccumulator();
  private currentIndex = 0;
  private status: PlaybackStatus = 'stopped';
  private speed = 1;
  private mode: PlaybackMode = 'recorded';
  private timer: ReturnType<typeof setTimeout> | null = null;

  getPlaybackState(): PlaybackState {
    const range = this.timeline?.getTimeRange();
    return {
      mode: this.mode,
      status: this.status,
      speed: this.speed,
      currentTime: this.getCurrentTime(),
      startTime: range?.start ?? '',
      endTime: range?.end ?? '',
      currentIndex: this.currentIndex,
      totalEntries: this.timeline?.length ?? 0,
    };
  }

  getSessionState(): SessionState {
    return this.accumulator.getState();
  }

  /** Load a timeline for playback */
  load(
    timeline: Timeline,
    initialState: SessionState | null,
    mode: PlaybackMode = 'recorded',
  ): void {
    this.stop();
    this.timeline = timeline;
    this.initialState = initialState;
    this.mode = mode;
    this.currentIndex = 0;

    if (initialState) {
      this.accumulator = new StateAccumulator(
        JSON.parse(JSON.stringify(initialState)) as SessionState,
      );
    } else {
      this.accumulator = new StateAccumulator();
    }

    this.emit('loaded', this.getPlaybackState());
    log.info(
      { entries: timeline.length, mode },
      'Timeline loaded',
    );
  }

  play(): void {
    if (!this.timeline || this.timeline.length === 0) return;
    if (this.status === 'playing') return;

    this.status = 'playing';
    this.emit('stateChange', this.getPlaybackState());
    this.scheduleNext();
  }

  pause(): void {
    this.status = 'paused';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.emit('stateChange', this.getPlaybackState());
  }

  stop(): void {
    this.status = 'stopped';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentIndex = 0;
    this.emit('stateChange', this.getPlaybackState());
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    // If playing, reschedule at new speed
    if (this.status === 'playing' && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.scheduleNext();
    }
    this.emit('stateChange', this.getPlaybackState());
  }

  /**
   * Seek to a specific timestamp.
   * Rebuilds state by replaying from initial state to target.
   */
  seek(timestamp: string): void {
    if (!this.timeline) return;

    const wasPlaying = this.status === 'playing';
    if (wasPlaying) this.pause();

    // Reset to initial state
    if (this.initialState) {
      this.accumulator = new StateAccumulator(
        JSON.parse(JSON.stringify(this.initialState)) as SessionState,
      );
    } else {
      this.accumulator = new StateAccumulator();
    }

    // Find target index
    const targetIndex = this.timeline.findIndex(timestamp);

    // Fast-forward: replay all entries up to target (without emitting events)
    for (let i = 0; i < targetIndex && i < this.timeline.length; i++) {
      const entry = this.timeline.getEntry(i)!;
      this.accumulator.applyMessage(entry.topic, entry.data, entry.timestamp);
    }

    this.currentIndex = targetIndex;

    this.emit('seek', {
      state: this.accumulator.getState(),
      playbackState: this.getPlaybackState(),
    });

    if (wasPlaying) this.play();
  }

  private getCurrentTime(): string {
    if (!this.timeline) return '';
    const entry = this.timeline.getEntry(
      Math.min(this.currentIndex, this.timeline.length - 1),
    );
    return entry?.timestamp ?? '';
  }

  private scheduleNext(): void {
    if (
      this.status !== 'playing' ||
      !this.timeline ||
      this.currentIndex >= this.timeline.length
    ) {
      if (this.currentIndex >= (this.timeline?.length ?? 0)) {
        this.status = 'stopped';
        this.emit('finished');
        this.emit('stateChange', this.getPlaybackState());
      }
      return;
    }

    const currentEntry = this.timeline.getEntry(this.currentIndex);
    const nextEntry = this.timeline.getEntry(this.currentIndex + 1);

    if (!currentEntry) return;

    // Process current entry
    this.processEntry(currentEntry);
    this.currentIndex++;

    // Calculate delay to next entry
    if (nextEntry && this.currentIndex < this.timeline.length) {
      const currentMs = new Date(currentEntry.timestamp).getTime();
      const nextMs = new Date(nextEntry.timestamp).getTime();
      const delayMs = Math.max(0, (nextMs - currentMs) / this.speed);

      // Cap delay at 5 seconds (for large gaps in data)
      const cappedDelay = Math.min(delayMs, 5000);
      this.timer = setTimeout(() => this.scheduleNext(), cappedDelay);
    } else {
      // No more entries
      this.scheduleNext();
    }
  }

  private processEntry(entry: TimelineEntry): void {
    const prevState = this.accumulator.snapshot();
    this.accumulator.applyMessage(entry.topic, entry.data, entry.timestamp);
    const currState = this.accumulator.getState();
    const events = detectEvents(prevState, currState);

    this.emit('update', {
      state: currState,
      events,
      entry,
      playbackState: this.getPlaybackState(),
    });

    for (const event of events) {
      this.emit('event', event);
    }
  }
}
