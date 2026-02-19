import type { SessionState } from '../data/types.js';
import type { FlagChangeEvent } from './types.js';

export function detectFlagChange(
  prev: SessionState,
  curr: SessionState,
): FlagChangeEvent[] {
  if (prev.trackStatus.flag === curr.trackStatus.flag) return [];

  return [
    {
      type: 'flag_change',
      timestamp: curr.timestamp,
      previousFlag: prev.trackStatus.flag,
      newFlag: curr.trackStatus.flag,
      message: curr.trackStatus.message,
    },
  ];
}
