import { Flag, ArrowRightLeft, Wrench, CloudRain, CircleAlert } from 'lucide-react';
import type { F1Event } from '../hooks/useWebSocket';
import type { ComponentType } from 'react';

interface EventFeedProps {
  events: F1Event[];
}

interface EventStyle {
  bg: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
}

const EVENT_STYLES: Record<string, EventStyle> = {
  flag_change: { bg: 'bg-yellow-900/50 border-yellow-700', icon: Flag, label: 'FLAG' },
  overtake: { bg: 'bg-blue-900/50 border-blue-700', icon: ArrowRightLeft, label: 'OVERTAKE' },
  pit_stop: { bg: 'bg-orange-900/50 border-orange-700', icon: Wrench, label: 'PIT' },
  weather_change: { bg: 'bg-cyan-900/50 border-cyan-700', icon: CloudRain, label: 'WEATHER' },
};

const DEFAULT_STYLE: EventStyle = { bg: 'bg-gray-800 border-gray-700', icon: CircleAlert, label: 'EVENT' };

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
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Events</h2>
      <div className="bg-gray-900/80 rounded-xl border border-gray-800/60 shadow-lg shadow-black/20 overflow-hidden">
        <div className="space-y-px max-h-72 overflow-y-auto p-1">
          {events.map((event, i) => {
            const style = EVENT_STYLES[event.type] ?? DEFAULT_STYLE;
            const Icon = style.icon;
            return (
              <div
                key={`${event.timestamp}-${i}`}
                className={`${style.bg} border-l-2 rounded-lg px-3 py-2 flex items-center gap-3`}
              >
                <Icon size={14} className="text-gray-400 shrink-0" />
                <span className="text-[11px] font-mono text-gray-600 w-16 shrink-0 tabular-nums">
                  {formatTime(event.timestamp)}
                </span>
                <span className="text-sm text-gray-300">
                  {formatEvent(event)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
