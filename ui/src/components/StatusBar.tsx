import { Settings, Wifi, WifiOff, Square, Play, Pause, FlagTriangleRight } from 'lucide-react';
import type { PlaybackState } from '../hooks/useWebSocket';

interface StatusBarProps {
  connected: boolean;
  playbackState: PlaybackState | null;
  onConfigClick: () => void;
}

function PlaybackBadge({ playbackState }: { playbackState: PlaybackState | null }) {
  if (!playbackState?.status) return null;

  const { status, speed } = playbackState;

  const config = {
    stopped: { icon: Square, label: 'Stopped', bg: 'bg-red-500/15', text: 'text-red-400', ring: 'ring-red-500/20' },
    playing: { icon: Play, label: 'Playing', bg: 'bg-green-500/15', text: 'text-green-400', ring: 'ring-green-500/20' },
    paused: { icon: Pause, label: 'Paused', bg: 'bg-yellow-500/15', text: 'text-yellow-400', ring: 'ring-yellow-500/20' },
    finished: { icon: Square, label: 'Finished', bg: 'bg-gray-500/15', text: 'text-gray-400', ring: 'ring-gray-500/20' },
  }[status] ?? { icon: Square, label: status, bg: 'bg-gray-500/15', text: 'text-gray-400', ring: 'ring-gray-500/20' };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${config.bg} ${config.text} ${config.ring}`}>
      <Icon size={12} fill="currentColor" />
      {config.label}
      {speed !== 1 && status === 'playing' ? ` ${speed}x` : ''}
    </span>
  );
}

export function StatusBar({ connected, playbackState, onConfigClick }: StatusBarProps) {
  const ConnectionIcon = connected ? Wifi : WifiOff;

  return (
    <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/60 shadow-md shadow-black/10 px-4 sm:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FlagTriangleRight size={20} className="text-blue-400" fill="currentColor" />
          <h1 className="text-lg font-bold tracking-tight text-white">f12mqtt</h1>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
          <ConnectionIcon size={14} className={!connected ? 'animate-pulse' : ''} />
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <PlaybackBadge playbackState={playbackState} />
        <button
          onClick={onConfigClick}
          className="text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 p-2 rounded-lg transition-all duration-150"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
