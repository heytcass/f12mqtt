import { useState, useEffect } from 'react';
import { Film, FolderOpen } from 'lucide-react';
import { fetchSessions, loadSession, type RecordingEntry } from '../api/client';
import type { PlaybackState } from '../hooks/useWebSocket';

interface SessionSelectorProps {
  playbackState: PlaybackState | null;
}

export function SessionSelector({ playbackState }: SessionSelectorProps) {
  const [sessions, setSessions] = useState<RecordingEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSessions().then(setSessions).catch(() => {});
  }, []);

  const handleLoad = async (dir: string) => {
    setLoading(true);
    try {
      await loadSession(dir);
    } finally {
      setLoading(false);
    }
  };

  if (sessions.length === 0 && !playbackState?.sessionName) {
    return (
      <div className="bg-gray-900/80 rounded-xl border border-gray-800/60 shadow-lg shadow-black/20 p-8 text-center">
        <FolderOpen size={32} className="text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-400 mb-1">No recorded sessions found</p>
        <p className="text-xs text-gray-600">Record a live session or place recordings in the data directory.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/80 rounded-xl border border-gray-800/60 shadow-lg shadow-black/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sessions</h2>
        {playbackState?.sessionName && (
          <span className="text-xs text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded-md">
            Loaded: {playbackState.sessionName}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {sessions.map((s) => (
          <button
            key={s.directory}
            onClick={() => void handleLoad(s.directory)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs bg-gray-800/80 hover:bg-gray-700/80 active:bg-gray-600/80 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 px-3 py-2 rounded-lg border border-gray-700/40 transition-all duration-150 hover:border-gray-600/60"
          >
            <Film size={12} className="text-gray-500" />
            <span>{s.metadata.sessionName}</span>
            <span className="text-gray-600">{s.metadata.sessionType}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
