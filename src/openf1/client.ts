/**
 * OpenF1 REST client.
 * Fetches historical F1 data from api.openf1.org/v1/.
 */

import { createChildLogger } from '../util/logger.js';
import type {
  OpenF1RaceControl,
  OpenF1Position,
  OpenF1Pit,
} from './mapper.js';

const log = createChildLogger('openf1');
const BASE_URL = 'https://api.openf1.org/v1';

export interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  year: number;
  circuit_short_name: string;
  country_name: string;
  meeting_name: string;
}

export interface OpenF1Driver {
  driver_number: number;
  name_acronym: string;
  first_name: string;
  last_name: string;
  team_name: string;
  team_colour: string;
  country_code: string;
  session_key: number;
}

export interface OpenF1Stint {
  driver_number: number;
  stint_number: number;
  compound: string;
  lap_start: number;
  lap_end: number;
  tyre_age_at_start: number;
  session_key: number;
}

export interface OpenF1Weather {
  date: string;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  rainfall: number;
  wind_direction: number;
  wind_speed: number;
  session_key: number;
}

export class OpenF1Client {
  private baseUrl: string;

  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getSessions(params: { year?: number; session_type?: string } = {}): Promise<OpenF1Session[]> {
    return this.fetch<OpenF1Session[]>('/sessions', params);
  }

  async getDrivers(sessionKey: number): Promise<OpenF1Driver[]> {
    return this.fetch<OpenF1Driver[]>('/drivers', { session_key: sessionKey });
  }

  async getPositions(sessionKey: number): Promise<OpenF1Position[]> {
    return this.fetch<OpenF1Position[]>('/position', { session_key: sessionKey });
  }

  async getRaceControl(sessionKey: number): Promise<OpenF1RaceControl[]> {
    return this.fetch<OpenF1RaceControl[]>('/race_control', { session_key: sessionKey });
  }

  async getPitStops(sessionKey: number): Promise<OpenF1Pit[]> {
    return this.fetch<OpenF1Pit[]>('/pit', { session_key: sessionKey });
  }

  async getStints(sessionKey: number): Promise<OpenF1Stint[]> {
    return this.fetch<OpenF1Stint[]>('/stints', { session_key: sessionKey });
  }

  async getWeather(sessionKey: number): Promise<OpenF1Weather[]> {
    return this.fetch<OpenF1Weather[]>('/weather', { session_key: sessionKey });
  }

  private async fetch<T>(endpoint: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    log.info({ url: url.toString() }, 'Fetching from OpenF1');
    const res = await fetch(url.toString());

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenF1 API error ${res.status}: ${text}`);
    }

    return (await res.json()) as T;
  }
}
