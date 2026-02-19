export interface RecordingMetadata {
  sessionKey: string;
  year: number;
  sessionName: string;
  sessionType: string;
  circuit: string;
  startTime: string;
}

export interface RecordingEntry {
  directory: string;
  metadata: RecordingMetadata;
}

export async function fetchSessions(): Promise<RecordingEntry[]> {
  const res = await fetch('/api/sessions');
  return (await res.json()) as RecordingEntry[];
}

export async function loadSession(sessionDir: string): Promise<{ ok: boolean; entries: number }> {
  const res = await fetch('/api/playback/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionDir }),
  });
  return (await res.json()) as { ok: boolean; entries: number };
}

export async function sendPlaybackCommand(
  command: string,
  value?: string | number,
): Promise<unknown> {
  const res = await fetch('/api/playback/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, value }),
  });
  return res.json();
}
