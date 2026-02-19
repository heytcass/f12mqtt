/**
 * Event types emitted by detectors.
 * Each event is a discrete, meaningful occurrence (not noisy continuous data).
 */

import type { TrackFlag } from '../data/types.js';

export interface FlagChangeEvent {
  type: 'flag_change';
  timestamp: string;
  previousFlag: TrackFlag;
  newFlag: TrackFlag;
  message?: string;
}

export interface OvertakeEvent {
  type: 'overtake';
  timestamp: string;
  overtakingDriver: string; // driver number
  overtakingAbbreviation: string;
  overtakingTeamColor: string;
  overtakenDriver: string; // driver number
  overtakenAbbreviation: string;
  overtakenTeamColor: string;
  newPosition: number;
}

export interface PitStopEvent {
  type: 'pit_stop';
  timestamp: string;
  driverNumber: string;
  abbreviation: string;
  teamColor: string;
  newCompound: string;
  stintNumber: number;
}

export interface WeatherChangeEvent {
  type: 'weather_change';
  timestamp: string;
  previousRainfall: boolean;
  newRainfall: boolean;
}

export type F1Event =
  | FlagChangeEvent
  | OvertakeEvent
  | PitStopEvent
  | WeatherChangeEvent;
