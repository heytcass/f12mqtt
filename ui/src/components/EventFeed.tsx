import type { F1Event } from '../hooks/useWebSocket';

interface EventFeedProps {
  events: F1Event[];
}

const EVENT_STYLES: Record<string, { bg: string; label: string }> = {
  flag_change: { bg: 'bg-yellow-900/50 border-yellow-700', label: 'FLAG' },
  overtake: { bg: 'bg-blue-900/50 border-blue-700', label: 'OVERTAKE' },
  pit_stop: { bg: 'bg-orange-900/50 border-orange-700', label: 'PIT' },
  weather_change: { bg: 'bg-cyan-900/50 border-cyan-700', label: 'WEATHER' },
};

function formatEvent(event: F1Event): string {
  switch (event.type) {
    case 'flag_change':
      return `${(event['previousFlag'] as string ?? '').toUpperCase()} → ${(event['newFlag'] as string ?? '').toUpperCase()}`;
    case 'overtake':
      return `${event['overtakingAbbreviation'] as string ?? '?'} passes ${event['overtakenAbbreviation'] as string ?? '?'} for P${event['newPosition'] as number ?? '?'}`;
    case 'pit_stop':
      return `${event['abbreviation'] as string ?? '?'} pits → ${event['newCompound'] as string ?? '?'}`;
    case 'weather_change':
      return (event['isWet'] as boolean) ? 'Rain detected' : 'Track is dry';
    default:
      return event.type;
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

export function EventFeed({ events }: EventFeedProps) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-1">
      <h2 className="text-sm font-medium text-gray-300 mb-2">Events</h2>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {events.map((event, i) => {
          const style = EVENT_STYLES[event.type] ?? { bg: 'bg-gray-800 border-gray-700', label: event.type.toUpperCase() };
          return (
            <div
              key={`${event.timestamp}-${i}`}
              className={`${style.bg} border-l-2 rounded-r px-3 py-1.5 flex items-center gap-2`}
            >
              <span className="text-xs font-mono text-gray-500 w-16 shrink-0">
                {formatTime(event.timestamp)}
              </span>
              <span className="text-xs font-bold text-gray-400 w-16 shrink-0">
                {style.label}
              </span>
              <span className="text-sm text-gray-200">
                {formatEvent(event)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
