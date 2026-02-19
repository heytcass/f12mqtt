import { describe, it, expect, afterEach } from 'vitest';
import { SessionRecorder } from '../../src/recording/recorder.js';
import { loadInitialState, loadTimeline, listRecordings } from '../../src/recording/storage.js';
import { createEmptySessionState } from '../../src/data/types.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('SessionRecorder + Storage', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  function setup() {
    tempDir = mkdtempSync(join(tmpdir(), 'f12mqtt-test-'));
    const recorder = new SessionRecorder(tempDir, 'test-session', 2025);
    return recorder;
  }

  it('writes metadata, initial state, and JSONL', async () => {
    const recorder = setup();
    const state = createEmptySessionState();
    state.lapCount = { current: 1, total: 52 };

    recorder.start(
      {
        sessionKey: 'test-session',
        year: 2025,
        sessionName: 'Test Race',
        sessionType: 'Race',
        circuit: 'Silverstone',
        startTime: '2025-07-06T14:00:00Z',
      },
      state,
    );

    recorder.write({
      topic: 'LapCount',
      data: { CurrentLap: 2, TotalLaps: 52 },
      timestamp: '2025-07-06T14:01:00Z',
    });

    recorder.write({
      topic: 'TrackStatus',
      data: { Status: '4' },
      timestamp: '2025-07-06T14:01:30Z',
    });

    await recorder.stop();
    expect(recorder.getMessageCount()).toBe(2);

    // Load back
    const dir = recorder.getDirectory();
    const loadedState = loadInitialState(dir);
    expect(loadedState?.lapCount.current).toBe(1);

    const timeline = loadTimeline(dir);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.topic).toBe('LapCount');
    expect(timeline[1]?.topic).toBe('TrackStatus');
  });

  it('listRecordings finds recorded sessions', async () => {
    const recorder = setup();
    recorder.start(
      {
        sessionKey: 'test-session',
        year: 2025,
        sessionName: 'Test Race',
        sessionType: 'Race',
        circuit: 'Silverstone',
        startTime: '2025-07-06T14:00:00Z',
      },
      createEmptySessionState(),
    );
    await recorder.stop();

    const recordings = listRecordings(tempDir);
    expect(recordings).toHaveLength(1);
    expect(recordings[0]?.metadata.sessionName).toBe('Test Race');
  });

  it('listRecordings returns empty for missing directory', () => {
    expect(listRecordings('/nonexistent/path')).toEqual([]);
  });

  it('loadInitialState returns null for missing file', () => {
    expect(loadInitialState('/nonexistent/path')).toBeNull();
  });

  it('loadTimeline returns empty for missing file', () => {
    expect(loadTimeline('/nonexistent/path')).toEqual([]);
  });
});
