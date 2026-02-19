import type { PlaybackState } from '../hooks/useWebSocket';

interface PlaybackControlsProps {
  playbackState: PlaybackState;
  sendCommand: (command: string, value?: string | number) => void;
}

const SPEEDS = [0.5, 1, 2, 4, 10];

export function PlaybackControls({ playbackState, sendCommand }: PlaybackControlsProps) {
  const { status, speed, currentTime, startTime, endTime } = playbackState;

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
    <div className="bg-gray-900 rounded-lg p-3 space-y-3">
      {/* Progress bar */}
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatTime(startTime)}</span>
        <span className="text-gray-300">{formatTime(currentTime)}</span>
        <span>{formatTime(endTime)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => sendCommand('stop')}
          className="text-gray-400 hover:text-white text-sm px-3 py-1 rounded hover:bg-gray-800 transition-colors"
        >
          Stop
        </button>

        {status === 'playing' ? (
          <button
            onClick={() => sendCommand('pause')}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-1.5 rounded transition-colors"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={() => sendCommand('play')}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-1.5 rounded transition-colors"
          >
            Play
          </button>
        )}

        {/* Speed buttons */}
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => sendCommand('speed', s)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                speed === s
                  ? 'bg-blue-600 text-white'
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
