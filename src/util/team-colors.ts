/**
 * 2025 F1 team colors (hex without #).
 * Updated each season. Key is the team name as returned by SignalR DriverList.
 */
export const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '3671C6',
  McLaren: 'FF8000',
  Ferrari: 'E8002D',
  Mercedes: '27F4D2',
  'Aston Martin': '229971',
  Alpine: 'FF87BC',
  Williams: '64C4FF',
  'RB F1 Team': '6692FF',
  'Kick Sauber': '52E252',
  Haas: 'B6BABD',
  Cadillac: '1E4D2B',
};

/** Fallback color if team not found */
export const DEFAULT_TEAM_COLOR = 'FFFFFF';

export function getTeamColor(teamName: string): string {
  return TEAM_COLORS[teamName] ?? DEFAULT_TEAM_COLOR;
}
