/**
 * Session recorder: writes live SignalR data to disk.
 * Format: metadata.json + subscribe.json + live.jsonl
 */

import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import type { WriteStream } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../util/logger.js';
import type { SessionState } from '../data/types.js';
import type { SignalRMessage } from '../signalr/client.js';

const log = createChildLogger('recorder');

export interface RecordingMetadata {
  sessionKey: string;
  year: number;
  sessionName: string;
  sessionType: string;
  circuit: string;
  startTime: string;
  endTime?: string;
}

export class SessionRecorder {
  private stream: WriteStream | null = null;
  private dir: string;
  private messageCount = 0;

  constructor(baseDir: string, sessionKey: string, year: number) {
    this.dir = join(baseDir, `${year}-${sessionKey}`);
  }

  /** Start recording. Writes metadata and initial state snapshot. */
  start(metadata: RecordingMetadata, initialState: SessionState): void {
    mkdirSync(this.dir, { recursive: true });

    writeFileSync(
      join(this.dir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
    );
    writeFileSync(
      join(this.dir, 'subscribe.json'),
      JSON.stringify(initialState, null, 2),
    );

    this.stream = createWriteStream(join(this.dir, 'live.jsonl'), {
      flags: 'a',
    });

    log.info({ dir: this.dir }, 'Recording started');
  }

  /** Append a message to the JSONL log */
  write(msg: SignalRMessage): void {
    if (!this.stream) return;
    const line = JSON.stringify({
      ts: msg.timestamp,
      topic: msg.topic,
      data: msg.data,
    });
    this.stream.write(line + '\n');
    this.messageCount++;
  }

  /** Stop recording */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.stream) {
        const s = this.stream;
        this.stream = null;
        s.end(() => {
          log.info(
            { messageCount: this.messageCount, dir: this.dir },
            'Recording stopped',
          );
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getMessageCount(): number {
    return this.messageCount;
  }

  getDirectory(): string {
    return this.dir;
  }
}
