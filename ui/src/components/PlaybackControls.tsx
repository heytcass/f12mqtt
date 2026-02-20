import { Play, Pause, Square } from 'lucide-react';
import type { PlaybackState } from '../hooks/useWebSocket';

interface PlaybackControlsProps {
  playbackState: PlaybackState;
  sendCommand: (command: string, value?: string | number) => void;
}

const SPEEDS = [0.5, 1, 2, 4, 10];

export function PlaybackControls({ playbackState, sendCommand }: PlaybackControlsProps) {
  const { status, speed, currentTime, startTime, endTime, sessionName } = playbackState;

  // Calculate progress percentage
  let progress = 0;
  if (currentTime && startTime && endTime) {
    const current = new Date(currentTime).getTime();
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const range = end - start;
    if (range > 0) {
      progress = Math.min(100, Math.max(0, ((current - start) / range) * 100));
    }
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--:--';
    const d = new Date(iso);
    return d.toLocaleTimeString();
  };

  return (
    <div className="bg-gray-900/80 rounded-xl border border-gray-800/60 shadow-lg shadow-black/20 p-4 space-y-4">
      {/* Session info */}
      {sessionName && (
        <div className="text-center">
          <span className="text-sm font-medium text-gray-200">{sessionName}</span>
        </div>
      )}

      {/* Progress bar with playhead */}
      <div className="relative h-2.5 bg-gray-800/80 rounded-full overflow-hidden group">
        <div
          className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-[width] duration-300 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
          style={{ width: `${progress}%` }}
        />
        {/* Playhead dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md shadow-black/30 border-2 border-blue-500 transition-[left] duration-300 opacity-0 group-hover:opacity-100"
          style={{ left: `calc(${progress}% - 7px)` }}
        />
      </div>

      {/* Time labels */}
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-mono text-gray-600">{formatTime(startTime)}</span>
        <span className="text-sm font-mono font-medium text-gray-200 tabular-nums">{formatTime(currentTime)}</span>
        <span className="text-xs font-mono text-gray-600">{formatTime(endTime)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => sendCommand('stop')}
          className="text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 p-2.5 rounded-lg transition-all duration-150"
          title="Stop"
        >
          <Square size={16} />
        </button>

        {status === 'playing' ? (
          <button
            onClick={() => sendCommand('pause')}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white p-3 rounded-full transition-all duration-150 shadow-lg shadow-blue-900/40"
            title="Pause"
          >
            <Pause size={20} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={() => sendCommand('play')}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white p-3 rounded-full transition-all duration-150 shadow-lg shadow-blue-900/40"
            title="Play"
          >
            <Play size={20} fill="currentColor" />
          </button>
        )}

        {/* Speed buttons */}
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => sendCommand('speed', s)}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-all duration-150 ${
                speed === s
                  ? 'bg-blue-600/90 text-white ring-1 ring-blue-400/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
