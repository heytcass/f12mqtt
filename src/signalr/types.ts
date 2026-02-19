/**
 * Raw SignalR message types as received from F1 live timing.
 * These are the wire format before mapping to canonical types.
 */

/** TrackStatus topic */
export interface RawTrackStatus {
  Status?: string; // "1", "2", "4", "5", "6", "7"
  Message?: string;
}

/** DriverList topic — keyed by driver number */
export interface RawDriverEntry {
  RacingNumber?: string;
  Tla?: string; // Three-letter abbreviation
  FirstName?: string;
  LastName?: string;
  TeamName?: string;
  TeamColour?: string;
  CountryCode?: string;
}

export type RawDriverList = Record<string, RawDriverEntry>;

/** TimingData topic — keyed by driver number under Lines */
export interface RawTimingDataEntry {
  Position?: string;
  GapToLeader?: string;
  IntervalToPositionAhead?: { Value?: string };
  LastLapTime?: { Value?: string };
  BestLapTime?: { Value?: string };
  Sectors?: Record<
    string,
    {
      Value?: string;
    }
  >;
  InPit?: boolean;
  Retired?: boolean;
  Stopped?: boolean;
}

export interface RawTimingData {
  Lines?: Record<string, RawTimingDataEntry>;
}

/** TimingAppData topic — stints keyed by driver number under Lines */
export interface RawTimingAppDataEntry {
  Stints?: Record<
    string,
    {
      Compound?: string;
      New?: string; // "true" / "false"
      TyresNotChanged?: string;
      TotalLaps?: number;
      StartLaps?: number;
    }
  >;
}

export interface RawTimingAppData {
  Lines?: Record<string, RawTimingAppDataEntry>;
}

/** SessionInfo topic */
export interface RawSessionInfo {
  Meeting?: {
    Name?: string;
    Circuit?: { ShortName?: string };
    Country?: { Name?: string };
  };
  Name?: string; // "Race", "Qualifying", etc.
  Type?: string;
  StartDate?: string;
  EndDate?: string;
}

/** LapCount topic */
export interface RawLapCount {
  CurrentLap?: number;
  TotalLaps?: number;
}

/** WeatherData topic */
export interface RawWeatherData {
  AirTemp?: string;
  TrackTemp?: string;
  Humidity?: string;
  Rainfall?: string; // "0" or "1"
  WindSpeed?: string;
  WindDirection?: string;
  Pressure?: string;
}

/** PitLaneTimeCollection topic — pit lane time data keyed by driver number */
export interface RawPitLaneTimeEntry {
  RacingNumber?: string;
  Duration?: string; // pit lane duration in seconds, e.g. "25.3"
  Lap?: string; // lap number of the pit stop
}

export interface RawPitLaneTimeCollection {
  PitTimes?: Record<string, RawPitLaneTimeEntry>;
}

/** TopThree topic — top 3 drivers with timing */
export interface RawTopThreeEntry {
  Position?: string;
  ShowPosition?: boolean;
  RacingNumber?: string;
  Tla?: string;
  BroadcastName?: string;
  FullName?: string;
  Team?: string;
  TeamColour?: string;
  LapTime?: string;
  LapState?: number;
  DiffToAhead?: string;
  DiffToLeader?: string;
  OverallFastest?: boolean;
  PersonalFastest?: boolean;
}

export interface RawTopThree {
  Lines?: RawTopThreeEntry[];
  Withheld?: boolean;
}

/** RaceControlMessages topic */
export interface RawRaceControlMessage {
  Messages?: Record<
    string,
    {
      Utc?: string;
      Message?: string;
      Category?: string;
      Flag?: string;
      Scope?: string; // "Track", "Sector", "Driver"
      Sector?: number; // sector number when Scope is "Sector"
      RacingNumber?: string; // driver number when relevant
    }
  >;
}

/** ExtrapolatedClock topic */
export interface RawExtrapolatedClock {
  Utc?: string;
  Remaining?: string;
  Extrapolating?: boolean;
}

/** Heartbeat topic */
export interface RawHeartbeat {
  Utc?: string;
}
