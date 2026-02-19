/**
 * Parse raw SignalR messages into canonical types.
 */

import type {
  DriverInfo,
  DriverTiming,
  DriverStint,
  SessionInfo,
  SessionType,
  TrackStatus,
  TrackFlag,
  LapCount,
  WeatherData,
} from '../data/types.js';
import type {
  RawDriverList,
  RawTimingData,
  RawTimingAppData,
  RawTrackStatus,
  RawSessionInfo,
  RawLapCount,
  RawWeatherData,
} from './types.js';
import { FLAG_NAMES } from '../util/constants.js';
import { getTeamColor } from '../util/team-colors.js';

export function parseTrackStatus(raw: RawTrackStatus): TrackStatus | null {
  const code = raw.Status;
  if (!code) return null;
  const flag = FLAG_NAMES[code] as TrackFlag | undefined;
  if (!flag) return null;
  return { flag, message: raw.Message };
}

export function parseDriverList(
  raw: RawDriverList,
): Record<string, Partial<DriverInfo>> {
  const result: Record<string, Partial<DriverInfo>> = {};
  for (const [num, entry] of Object.entries(raw)) {
    if (!entry.RacingNumber && !entry.Tla) continue;
    const driverNumber = entry.RacingNumber ?? num;
    const partial: Partial<DriverInfo> = { driverNumber };

    if (entry.Tla !== undefined) partial.abbreviation = entry.Tla;
    if (entry.FirstName !== undefined) partial.firstName = entry.FirstName;
    if (entry.LastName !== undefined) partial.lastName = entry.LastName;
    if (entry.TeamName !== undefined) partial.teamName = entry.TeamName;
    if (entry.TeamColour !== undefined) partial.teamColor = entry.TeamColour;
    else if (entry.TeamName !== undefined)
      partial.teamColor = getTeamColor(entry.TeamName);
    if (entry.CountryCode !== undefined) partial.countryCode = entry.CountryCode;

    result[driverNumber] = partial;
  }
  return result;
}

export function parseTimingData(
  raw: RawTimingData,
): Record<string, Partial<DriverTiming>> {
  const result: Record<string, Partial<DriverTiming>> = {};
  if (!raw.Lines) return result;

  for (const [num, entry] of Object.entries(raw.Lines)) {
    const partial: Partial<DriverTiming> = { driverNumber: num };

    if (entry.Position !== undefined)
      partial.position = parseInt(entry.Position, 10);
    if (entry.GapToLeader !== undefined) partial.gapToLeader = entry.GapToLeader;
    if (entry.IntervalToPositionAhead?.Value !== undefined)
      partial.interval = entry.IntervalToPositionAhead.Value;
    if (entry.LastLapTime?.Value !== undefined)
      partial.lastLapTime = entry.LastLapTime.Value;
    if (entry.BestLapTime?.Value !== undefined)
      partial.bestLapTime = entry.BestLapTime.Value;
    if (entry.InPit !== undefined) partial.inPit = entry.InPit;
    if (entry.Retired !== undefined) partial.retired = entry.Retired;
    if (entry.Stopped !== undefined) partial.stopped = entry.Stopped;

    // Parse sectors
    if (entry.Sectors) {
      for (const [sectorNum, sector] of Object.entries(entry.Sectors)) {
        if (sector.Value !== undefined) {
          if (sectorNum === '0') partial.sector1 = sector.Value;
          else if (sectorNum === '1') partial.sector2 = sector.Value;
          else if (sectorNum === '2') partial.sector3 = sector.Value;
        }
      }
    }

    result[num] = partial;
  }
  return result;
}

export function parseTimingAppData(
  raw: RawTimingAppData,
): Record<string, DriverStint> {
  const result: Record<string, DriverStint> = {};
  if (!raw.Lines) return result;

  for (const [num, entry] of Object.entries(raw.Lines)) {
    if (!entry.Stints) continue;
    // Get the latest stint (highest key number)
    const stintKeys = Object.keys(entry.Stints)
      .map(Number)
      .sort((a, b) => a - b);
    const latestKey = stintKeys[stintKeys.length - 1];
    if (latestKey === undefined) continue;

    const stint = entry.Stints[String(latestKey)];
    if (!stint) continue;

    result[num] = {
      driverNumber: num,
      stintNumber: latestKey,
      compound: stint.Compound ?? 'UNKNOWN',
      tyreAge: stint.TotalLaps ?? 0,
      new: stint.New === 'true',
    };
  }
  return result;
}

const SESSION_TYPE_MAP: Record<string, SessionType> = {
  Race: 'Race',
  Qualifying: 'Qualifying',
  Practice: 'Practice',
  Sprint: 'Sprint',
  'Sprint Qualifying': 'SprintQualifying',
  'Sprint Shootout': 'SprintQualifying',
};

export function parseSessionInfo(raw: RawSessionInfo): SessionInfo | null {
  const name = raw.Meeting?.Name;
  if (!name) return null;

  const rawType = raw.Name ?? raw.Type ?? 'Practice';
  const type: SessionType = SESSION_TYPE_MAP[rawType] ?? 'Practice';

  return {
    name,
    type,
    circuit: raw.Meeting?.Circuit?.ShortName ?? '',
    country: raw.Meeting?.Country?.Name ?? '',
    startTime: raw.StartDate ?? '',
    endTime: raw.EndDate,
  };
}

export function parseLapCount(raw: RawLapCount): LapCount | null {
  if (raw.CurrentLap === undefined && raw.TotalLaps === undefined) return null;
  return {
    current: raw.CurrentLap ?? 0,
    total: raw.TotalLaps ?? 0,
  };
}

export function parseWeatherData(raw: RawWeatherData): Partial<WeatherData> {
  const result: Partial<WeatherData> = {};
  if (raw.Rainfall !== undefined) result.rainfall = raw.Rainfall === '1';
  if (raw.AirTemp !== undefined) result.airTemp = parseFloat(raw.AirTemp);
  if (raw.TrackTemp !== undefined) result.trackTemp = parseFloat(raw.TrackTemp);
  if (raw.Humidity !== undefined) result.humidity = parseFloat(raw.Humidity);
  if (raw.WindSpeed !== undefined) result.windSpeed = parseFloat(raw.WindSpeed);
  if (raw.WindDirection !== undefined)
    result.windDirection = parseFloat(raw.WindDirection);
  if (raw.Pressure !== undefined) result.pressure = parseFloat(raw.Pressure);
  return result;
}
