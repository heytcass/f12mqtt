import { useState, useEffect, useRef, useCallback } from 'react';

export interface PlaybackState {
  mode: string;
  status: string;
  speed: number;
  currentTime: string | null;
  startTime: string | null;
  endTime: string | null;
  sessionName?: string;
}

export interface F1Event {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface SessionState {
  sessionInfo: { name: string; type: string; circuit: string; country: string } | null;
  trackStatus: { flag: string; message?: string };
  lapCount: { current: number; total: number };
  weather: { rainfall: boolean; airTemp: number; trackTemp: number } | null;
  drivers: Record<string, { driverNumber: string; abbreviation: string; teamName: string; teamColor: string }>;
  timing: Record<string, { driverNumber: string; position: number; gapToLeader: string; inPit: boolean; retired: boolean }>;
  stints: Record<string, { compound: string; tyreAge: number; new: boolean }>;
  timestamp: string;
}

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [events, setEvents] = useState<F1Event[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const sendCommand = useCallback((command: string, value?: string | number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command, value }));
    }
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 2s
        setTimeout(connect, 2000);
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as WSMessage;

        switch (msg.type) {
          case 'playback_state':
            setPlaybackState(msg as unknown as PlaybackState);
            break;
          case 'update':
            setSessionState(msg['state'] as SessionState);
            setPlaybackState(msg['playbackState'] as PlaybackState);
            if (Array.isArray(msg['events'])) {
              setEvents((prev) => [
                ...((msg['events'] as F1Event[]).map((e) => e)),
                ...prev,
              ].slice(0, 100));
            }
            break;
          case 'event':
            setEvents((prev) => [msg['event'] as F1Event, ...prev].slice(0, 100));
            break;
          case 'seek':
            setSessionState(msg['state'] as SessionState);
            setPlaybackState(msg['playbackState'] as PlaybackState);
            break;
          case 'playback_finished':
            setPlaybackState((prev) => prev ? { ...prev, status: 'finished' } : null);
            break;
        }
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { connected, playbackState, sessionState, events, sendCommand };
}
