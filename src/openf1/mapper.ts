/**
 * Map OpenF1 API responses to SignalR-compatible message format.
 * This lets OpenF1 data flow through the same pipeline as live SignalR data.
 */

import type { SignalRMessage } from '../signalr/client.js';

const FLAG_MAP: Record<string, string> = {
  GREEN: '1',
  YELLOW: '2',
  RED: '5',
  DOUBLE_YELLOW: '2',
  SAFETY_CAR: '4',
  VIRTUAL_SAFETY_CAR: '6',
  VSC_ENDING: '7',
};

export interface OpenF1RaceControl {
  date: string;
  category: string;
  flag?: string;
  message?: string;
}

export function mapOpenF1RaceControl(rc: OpenF1RaceControl): SignalRMessage {
  const statusCode = rc.flag ? (FLAG_MAP[rc.flag] ?? '1') : '1';
  return {
    topic: 'TrackStatus',
    data: { Status: statusCode, Message: rc.message },
    timestamp: rc.date,
  };
}

export interface OpenF1Position {
  driver_number: number;
  position: number;
  date: string;
}

export function mapOpenF1Position(positions: OpenF1Position[]): SignalRMessage {
  const lines: Record<string, { Position: string }> = {};
  for (const p of positions) {
    lines[String(p.driver_number)] = { Position: String(p.position) };
  }
  return {
    topic: 'TimingData',
    data: { Lines: lines },
    timestamp: positions[0]?.date ?? new Date().toISOString(),
  };
}

export interface OpenF1Pit {
  driver_number: number;
  pit_duration: number;
  date: string;
  lap_number: number;
  stint_number: number;
  compound: string;
}

export function mapOpenF1Pit(pit: OpenF1Pit): SignalRMessage {
  const driverNum = String(pit.driver_number);
  const stints: Record<string, { Compound: string; New: string; TotalLaps: number }> = {
    [String(pit.stint_number - 1)]: {
      Compound: pit.compound,
      New: 'true',
      TotalLaps: 0,
    },
  };
  return {
    topic: 'TimingAppData',
    data: {
      Lines: {
        [driverNum]: { Stints: stints },
      },
    },
    timestamp: pit.date,
  };
}
