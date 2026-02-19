/**
 * 2026 F1 team colors (hex without #).
 * Updated each season. Key is the team name as returned by SignalR DriverList.
 */
export const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '4781D7',
  McLaren: 'F47600',
  Ferrari: 'ED1131',
  Mercedes: '00D7B6',
  'Aston Martin': '229971',
  Alpine: '00A1E8',
  Williams: '1868DB',
  'Racing Bulls': '6C98FF',
  Audi: 'F50537',
  'Haas F1 Team': '9C9FA2',
  Cadillac: '909090',
};

/** Fallback color if team not found */
export const DEFAULT_TEAM_COLOR = 'FFFFFF';

export function getTeamColor(teamName: string): string {
  return TEAM_COLORS[teamName] ?? DEFAULT_TEAM_COLOR;
}
