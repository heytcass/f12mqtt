import { useState, useEffect } from 'react';
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
      <div className="bg-gray-900 rounded-lg p-4 text-gray-400 text-sm text-center">
        No recorded sessions found. Record a live session or place recordings in the data directory.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-gray-300">Sessions</h2>
        {playbackState?.sessionName && (
          <span className="text-xs text-gray-500">
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
            className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded transition-colors"
          >
            {s.metadata.sessionName} ({s.metadata.sessionType})
          </button>
        ))}
      </div>
    </div>
  );
}
