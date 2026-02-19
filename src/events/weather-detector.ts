import type { SessionState } from '../data/types.js';
import type { WeatherChangeEvent } from './types.js';

export function detectWeatherChange(
  prev: SessionState,
  curr: SessionState,
): WeatherChangeEvent[] {
  const prevRainfall = prev.weather?.rainfall ?? false;
  const currRainfall = curr.weather?.rainfall;

  // No weather data yet
  if (currRainfall === undefined) return [];

  // No change
  if (prevRainfall === currRainfall) return [];

  return [
    {
      type: 'weather_change',
      timestamp: curr.timestamp,
      previousRainfall: prevRainfall,
      newRainfall: currRainfall,
    },
  ];
}
