import type { SessionState } from '../data/types.js';
import type { PitStopEvent } from './types.js';

export function detectPitStops(
  prev: SessionState,
  curr: SessionState,
): PitStopEvent[] {
  const events: PitStopEvent[] = [];

  for (const [driverNum, currStint] of Object.entries(curr.stints)) {
    const prevStint = prev.stints[driverNum];

    // Detect stint change by stint number increment.
    // If no previous stint known, only report if stintNumber > 0
    // (stint 0 is the starting tyres, not a pit stop).
    if (prevStint) {
      if (currStint.stintNumber <= prevStint.stintNumber) continue;
    } else {
      if (currStint.stintNumber === 0) continue;
    }

    const driver = curr.drivers[driverNum];

    events.push({
      type: 'pit_stop',
      timestamp: curr.timestamp,
      driverNumber: driverNum,
      abbreviation: driver?.abbreviation ?? driverNum,
      teamColor: driver?.teamColor ?? 'FFFFFF',
      newCompound: currStint.compound,
      stintNumber: currStint.stintNumber,
    });
  }

  return events;
}
