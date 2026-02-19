/**
 * OpenF1 data source adapter.
 * Fetches historical session data from OpenF1 API and maps it to timeline entries
 * compatible with the PlaybackController.
 */

import type { SessionState } from '../data/types.js';
import type { DataSource, TimelineEntry } from '../playback/data-source.js';
import { OpenF1Client, type OpenF1Driver } from './client.js';
import {
  mapOpenF1RaceControl,
  mapOpenF1Position,
  mapOpenF1Pit,
} from './mapper.js';
import { createChildLogger } from '../util/logger.js';

const log = createChildLogger('openf1-source');

export class OpenF1Source implements DataSource {
  private client: OpenF1Client;
  private sessionKey: number;
  private entries: TimelineEntry[] | null = null;
  private drivers: OpenF1Driver[] | null = null;

  constructor(sessionKey: number, client?: OpenF1Client) {
    this.sessionKey = sessionKey;
    this.client = client ?? new OpenF1Client();
  }

  async getInitialState(): Promise<SessionState | null> {
    // Fetch drivers to build the initial DriverList message
    this.drivers = await this.client.getDrivers(this.sessionKey);
    if (this.drivers.length === 0) return null;

    const driverData: Record<string, {
      RacingNumber: string;
      Tla: string;
      TeamName: string;
      TeamColour: string;
    }> = {};
    for (const d of this.drivers) {
      driverData[String(d.driver_number)] = {
        RacingNumber: String(d.driver_number),
        Tla: d.name_acronym,
        TeamName: d.team_name,
        TeamColour: d.team_colour,
      };
    }

    // Build a minimal initial state by processing DriverList through the accumulator
    const { StateAccumulator } = await import('../data/state-accumulator.js');
    const acc = new StateAccumulator();
    acc.applyMessage('DriverList', driverData, new Date().toISOString());
    return acc.getState();
  }

  async getTimeRange(): Promise<{ start: string; end: string } | null> {
    await this.loadEntries();
    if (!this.entries || this.entries.length === 0) return null;
    return {
      start: this.entries[0]!.timestamp,
      end: this.entries[this.entries.length - 1]!.timestamp,
    };
  }

  async *stream(from: string, speed: number): AsyncIterable<TimelineEntry> {
    await this.loadEntries();
    if (!this.entries) return;

    // Find start index using binary search
    let startIdx = 0;
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i]!.timestamp >= from) {
        startIdx = i;
        break;
      }
    }

    let prevTimestamp = from;
    for (let i = startIdx; i < this.entries.length; i++) {
      const entry = this.entries[i]!;
      const entryTime = new Date(entry.timestamp).getTime();
      const prevTime = new Date(prevTimestamp).getTime();
      const delay = Math.max(0, (entryTime - prevTime) / speed);

      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      yield entry;
      prevTimestamp = entry.timestamp;
    }
  }

  async close(): Promise<void> {
    this.entries = null;
    this.drivers = null;
  }

  /** Fetch all data for the session and build sorted timeline entries */
  private async loadEntries(): Promise<void> {
    if (this.entries) return;

    log.info({ sessionKey: this.sessionKey }, 'Loading OpenF1 session data');

    const [raceControl, positions, pits] = await Promise.all([
      this.client.getRaceControl(this.sessionKey),
      this.client.getPositions(this.sessionKey),
      this.client.getPitStops(this.sessionKey),
    ]);

    const entries: TimelineEntry[] = [];

    // Race control → TrackStatus messages
    for (const rc of raceControl) {
      if (rc.flag) {
        const msg = mapOpenF1RaceControl(rc);
        entries.push({ timestamp: msg.timestamp, topic: msg.topic, data: msg.data });
      }
    }

    // Positions → group by timestamp, map to TimingData
    const positionsByTime = new Map<string, typeof positions>();
    for (const p of positions) {
      const existing = positionsByTime.get(p.date);
      if (existing) {
        existing.push(p);
      } else {
        positionsByTime.set(p.date, [p]);
      }
    }
    for (const [, posGroup] of positionsByTime) {
      const msg = mapOpenF1Position(posGroup);
      entries.push({ timestamp: msg.timestamp, topic: msg.topic, data: msg.data });
    }

    // Pit stops → TimingAppData
    for (const pit of pits) {
      const msg = mapOpenF1Pit(pit);
      entries.push({ timestamp: msg.timestamp, topic: msg.topic, data: msg.data });
    }

    // Sort by timestamp
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    this.entries = entries;
    log.info({ sessionKey: this.sessionKey, entryCount: entries.length }, 'OpenF1 session data loaded');
  }
}
