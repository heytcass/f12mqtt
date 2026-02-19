/**
 * AWTRIX 3 payload builders for custom apps and notifications.
 */

import type { TopThreeEntry, TrackFlag } from '../data/types.js';
import type {
  FlagChangeEvent,
  OvertakeEvent,
  PitStopEvent,
} from '../events/types.js';

/** AWTRIX text fragment with color */
export interface AwtrixTextFragment {
  t: string;
  c: string;
}

/** AWTRIX custom app payload */
export interface AwtrixAppPayload {
  text?: string | AwtrixTextFragment[];
  background?: string;
  color?: string;
  effect?: string;
  duration?: number;
  lifetime?: number;
  icon?: string;
}

/** AWTRIX notification payload */
export interface AwtrixNotifyPayload {
  text?: string | AwtrixTextFragment[];
  background?: string;
  color?: string;
  effect?: string;
  duration?: number;
  sound?: string;
  wakeup?: boolean;
  hold?: boolean;
}

// Flag colors for AWTRIX background
const FLAG_COLORS: Record<TrackFlag, string> = {
  green: '00FF00',
  yellow: 'FFFF00',
  red: 'FF0000',
  sc: 'FFA500',
  vsc: 'FFA500',
  vsc_ending: '00FF00',
  chequered: 'FFFFFF',
};

const FLAG_LABELS: Record<TrackFlag, string> = {
  green: 'GREEN',
  yellow: 'YELLOW',
  red: 'RED FLAG',
  sc: 'SAFETY CAR',
  vsc: 'VSC',
  vsc_ending: 'VSC END',
  chequered: 'CHEQUERED',
};

/** Build the f1flag custom app payload */
export function flagApp(flag: TrackFlag): AwtrixAppPayload {
  return {
    text: FLAG_LABELS[flag],
    background: FLAG_COLORS[flag],
    color: flag === 'yellow' || flag === 'chequered' ? '000000' : 'FFFFFF',
    effect: flag === 'red' || flag === 'sc' ? 'Pulse' : undefined,
  };
}

/** Build a driver position custom app payload */
export function driverApp(
  position: number,
  abbreviation: string,
  gap: string,
  teamColor: string,
): AwtrixAppPayload {
  const text: AwtrixTextFragment[] = [
    { t: `P${position} `, c: 'FFFFFF' },
    { t: abbreviation, c: teamColor },
  ];
  if (gap) {
    text.push({ t: ` ${gap}`, c: 'AAAAAA' });
  }
  return { text };
}

/** Build lap counter custom app payload */
export function lapApp(current: number, total: number): AwtrixAppPayload {
  return {
    text: `LAP ${current}/${total}`,
    color: 'FFFFFF',
  };
}

/** Build notification for flag change */
export function flagNotification(event: FlagChangeEvent): AwtrixNotifyPayload {
  return {
    text: FLAG_LABELS[event.newFlag],
    background: FLAG_COLORS[event.newFlag],
    color:
      event.newFlag === 'yellow' || event.newFlag === 'chequered'
        ? '000000'
        : 'FFFFFF',
    effect: 'Pulse',
    duration: 5,
    sound: 'alarm',
    wakeup: true,
  };
}

/** Build notification for overtake */
export function overtakeNotification(event: OvertakeEvent): AwtrixNotifyPayload {
  const text: AwtrixTextFragment[] = [
    { t: event.overtakingAbbreviation, c: event.overtakingTeamColor },
    { t: ' PASSES ', c: 'FFFFFF' },
    { t: event.overtakenAbbreviation, c: event.overtakenTeamColor },
  ];
  return {
    text,
    duration: 4,
    sound: 'notification',
  };
}

/** Build notification for pit stop */
export function pitStopNotification(event: PitStopEvent): AwtrixNotifyPayload {
  const text: AwtrixTextFragment[] = [
    { t: 'PIT ', c: 'FFFFFF' },
    { t: event.abbreviation, c: event.teamColor },
    { t: ` ${event.newCompound}`, c: 'AAAAAA' },
  ];
  if (event.pitLaneDuration) {
    text.push({ t: ` ${event.pitLaneDuration}s`, c: 'AAAAAA' });
  }
  return {
    text,
    duration: 3,
  };
}

/** Build top three custom app payload */
export function topThreeApp(topThree: TopThreeEntry[]): AwtrixAppPayload {
  const text: AwtrixTextFragment[] = [];
  for (const entry of topThree) {
    if (text.length > 0) {
      text.push({ t: ' ', c: 'FFFFFF' });
    }
    text.push({ t: `P${entry.position} `, c: 'FFFFFF' });
    text.push({ t: entry.abbreviation, c: entry.teamColor });
  }
  return { text };
}

/** AWTRIX MQTT topic builders */
export function awtrixCustomAppTopic(
  awtrixPrefix: string,
  appName: string,
): string {
  return `${awtrixPrefix}/custom/${appName}`;
}

export function awtrixNotifyTopic(awtrixPrefix: string): string {
  return `${awtrixPrefix}/notify`;
}
