/**
 * Recording storage: list and load recorded sessions from disk.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RecordingMetadata } from './recorder.js';
import type { SessionState } from '../data/types.js';
import type { TimelineEntry } from '../playback/data-source.js';
import { createChildLogger } from '../util/logger.js';

const log = createChildLogger('storage');

export interface RecordedSession {
  dir: string;
  metadata: RecordingMetadata;
}

/** List all recorded sessions in the base directory */
export function listRecordings(baseDir: string): RecordedSession[] {
  if (!existsSync(baseDir)) return [];

  const dirs = readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const sessions: RecordedSession[] = [];

  for (const dirName of dirs) {
    const metadataPath = join(baseDir, dirName, 'metadata.json');
    if (!existsSync(metadataPath)) continue;

    try {
      const raw = readFileSync(metadataPath, 'utf-8');
      const metadata = JSON.parse(raw) as RecordingMetadata;
      sessions.push({ dir: join(baseDir, dirName), metadata });
    } catch (err) {
      log.warn({ dir: dirName, err }, 'Failed to read recording metadata');
    }
  }

  return sessions;
}

/** Load the initial state snapshot from a recording */
export function loadInitialState(sessionDir: string): SessionState | null {
  const path = join(sessionDir, 'subscribe.json');
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

/** Load all timeline entries from a recording's JSONL file */
export function loadTimeline(sessionDir: string): TimelineEntry[] {
  const path = join(sessionDir, 'live.jsonl');
  if (!existsSync(path)) return [];

  const content = readFileSync(path, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());

  return lines.map((line) => {
    const parsed = JSON.parse(line) as {
      ts: string;
      topic: string;
      data: unknown;
    };
    return {
      timestamp: parsed.ts,
      topic: parsed.topic,
      data: parsed.data,
    };
  });
}
