interface Driver {
  driverNumber: string;
  abbreviation: string;
  teamName: string;
  teamColor: string;
}

interface Timing {
  driverNumber: string;
  position: number;
  gapToLeader: string;
  inPit: boolean;
  retired: boolean;
}

interface Stint {
  compound: string;
  tyreAge: number;
  new: boolean;
}

interface DriverCardsProps {
  drivers: Record<string, Driver>;
  timing: Record<string, Timing>;
  stints: Record<string, Stint>;
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: 'text-red-400',
  MEDIUM: 'text-yellow-400',
  HARD: 'text-white',
  INTERMEDIATE: 'text-green-400',
  WET: 'text-blue-400',
};

export function DriverCards({ drivers, timing, stints }: DriverCardsProps) {
  // Sort drivers by position
  const sorted = Object.entries(timing)
    .sort(([, a], [, b]) => a.position - b.position)
    .slice(0, 20);

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-1">
      <h2 className="text-sm font-medium text-gray-300 mb-2">Standings</h2>
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        {sorted.map(([num, t]) => {
          const driver = drivers[num];
          const stint = stints[num];
          const teamColor = driver?.teamColor ?? 'FFFFFF';

          return (
            <div
              key={num}
              className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-800 last:border-0"
            >
              {/* Position */}
              <span className="text-sm font-mono w-6 text-right text-gray-400">
                {t.position}
              </span>

              {/* Team color bar */}
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: `#${teamColor}` }}
              />

              {/* Driver name */}
              <span
                className="text-sm font-bold w-12"
                style={{ color: `#${teamColor}` }}
              >
                {driver?.abbreviation ?? num}
              </span>

              {/* Gap */}
              <span className="text-xs text-gray-500 flex-1">
                {t.position === 1 ? 'LEADER' : t.gapToLeader || ''}
              </span>

              {/* Tyre */}
              {stint && (
                <span className={`text-xs font-mono ${COMPOUND_COLORS[stint.compound] ?? 'text-gray-400'}`}>
                  {stint.compound?.charAt(0) ?? '?'}{stint.tyreAge > 0 ? stint.tyreAge : ''}
                </span>
              )}

              {/* Status badges */}
              {t.inPit && (
                <span className="text-xs bg-yellow-900 text-yellow-200 px-1.5 py-0.5 rounded">
                  PIT
                </span>
              )}
              {t.retired && (
                <span className="text-xs bg-red-900 text-red-200 px-1.5 py-0.5 rounded">
                  OUT
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
