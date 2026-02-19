import type { PlaybackState } from '../hooks/useWebSocket';

interface StatusBarProps {
  connected: boolean;
  playbackState: PlaybackState | null;
  onConfigClick: () => void;
}

export function StatusBar({ connected, playbackState, onConfigClick }: StatusBarProps) {
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight">f12mqtt</h1>
        <span className={`inline-flex items-center gap-1.5 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {playbackState?.status && (
          <span className="text-xs text-gray-400">
            {playbackState.status} {playbackState.speed !== 1 ? `(${playbackState.speed}x)` : ''}
          </span>
        )}
        <button
          onClick={onConfigClick}
          className="text-gray-400 hover:text-white transition-colors text-sm px-2 py-1 rounded hover:bg-gray-800"
        >
          Settings
        </button>
      </div>
    </header>
  );
}
