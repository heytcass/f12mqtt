import type { SessionState } from '../data/types.js';
import type { OvertakeEvent } from './types.js';

/** Flags under which position changes are not real overtakes */
const NON_OVERTAKE_FLAGS = new Set(['sc', 'vsc', 'vsc_ending', 'red']);

export function detectOvertakes(
  prev: SessionState,
  curr: SessionState,
): OvertakeEvent[] {
  // No overtakes during safety car, VSC, or red flag
  if (NON_OVERTAKE_FLAGS.has(curr.trackStatus.flag)) return [];

  const events: OvertakeEvent[] = [];

  for (const [driverNum, currTiming] of Object.entries(curr.timing)) {
    const prevTiming = prev.timing[driverNum];
    if (!prevTiming) continue;
    if (currTiming.position >= prevTiming.position) continue;

    // Driver gained positions — check if it's a real overtake
    // Skip if the gaining driver is currently in pit
    if (currTiming.inPit) continue;

    // Find who they passed: drivers who were ahead and are now behind
    for (const [otherNum, otherCurrTiming] of Object.entries(curr.timing)) {
      if (otherNum === driverNum) continue;
      const otherPrevTiming = prev.timing[otherNum];
      if (!otherPrevTiming) continue;

      // Was the other driver ahead before and behind now?
      if (
        otherPrevTiming.position < prevTiming.position &&
        otherCurrTiming.position > currTiming.position &&
        otherPrevTiming.position >= currTiming.position
      ) {
        // Filter: overtaken driver in pit or retired
        if (otherCurrTiming.inPit || otherPrevTiming.inPit) continue;
        if (otherCurrTiming.retired) continue;

        const overtaker = curr.drivers[driverNum];
        const overtaken = curr.drivers[otherNum];

        events.push({
          type: 'overtake',
          timestamp: curr.timestamp,
          overtakingDriver: driverNum,
          overtakingAbbreviation: overtaker?.abbreviation ?? driverNum,
          overtakingTeamColor: overtaker?.teamColor ?? 'FFFFFF',
          overtakenDriver: otherNum,
          overtakenAbbreviation: overtaken?.abbreviation ?? otherNum,
          overtakenTeamColor: overtaken?.teamColor ?? 'FFFFFF',
          newPosition: currTiming.position,
        });
      }
    }
  }

  return events;
}
