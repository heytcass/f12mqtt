import { Trophy, CircleDot } from 'lucide-react';

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

const PODIUM_COLORS: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
};

export function DriverCards({ drivers, timing, stints }: DriverCardsProps) {
  // Sort drivers by position
  const sorted = Object.entries(timing)
    .sort(([, a], [, b]) => a.position - b.position)
    .slice(0, 20);

  if (sorted.length === 0) return null;

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Standings</h2>
      <div className="bg-gray-900/80 rounded-xl border border-gray-800/60 shadow-lg shadow-black/20 overflow-hidden">
        {sorted.map(([num, t]) => {
          const driver = drivers[num];
          const stint = stints[num];
          const teamColor = driver?.teamColor ?? 'FFFFFF';
          const isPodium = t.position <= 3;

          return (
            <div
              key={num}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/40 last:border-0 hover:bg-gray-800/30 transition-colors duration-100"
            >
              {/* Position */}
              <div className="w-7 text-right flex items-center justify-end gap-1">
                {isPodium && (
                  <Trophy size={12} className={PODIUM_COLORS[t.position]} />
                )}
                <span className={`text-sm font-mono ${isPodium ? 'text-gray-200 font-bold' : 'text-gray-500'}`}>
                  {t.position}
                </span>
              </div>

              {/* Team color bar */}
              <div
                className="w-1 h-6 rounded-full"
                style={{ backgroundColor: `#${teamColor}` }}
              />

              {/* Driver name */}
              <span
                className="text-sm font-bold w-12 tracking-wide"
                style={{ color: `#${teamColor}` }}
              >
                {driver?.abbreviation ?? num}
              </span>

              {/* Gap */}
              <span className="text-xs font-mono tabular-nums text-gray-500 flex-1">
                {t.position === 1 ? (
                  <span className="text-gray-600 uppercase tracking-wider">Leader</span>
                ) : (
                  t.gapToLeader || ''
                )}
              </span>

              {/* Tyre */}
              {stint && (
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${COMPOUND_COLORS[stint.compound] ?? 'text-gray-400'} bg-gray-800/50`}>
                  {stint.compound?.charAt(0) ?? '?'}{stint.tyreAge > 0 ? stint.tyreAge : ''}
                </span>
              )}

              {/* Status badges */}
              {t.inPit && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-md ring-1 ring-yellow-500/20">
                  <CircleDot size={10} />
                  PIT
                </span>
              )}
              {t.retired && (
                <span className="text-[10px] font-bold bg-red-500/15 text-red-400 px-2 py-0.5 rounded-md ring-1 ring-red-500/20">
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
