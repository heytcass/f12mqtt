import { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { StatusBar } from './StatusBar';
import { FlagIndicator } from './FlagIndicator';
import { SessionSelector } from './SessionSelector';
import { PlaybackControls } from './PlaybackControls';
import { EventFeed } from './EventFeed';
import { DriverCards } from './DriverCards';
import { ConfigPanel } from './ConfigPanel';

export function App() {
  const { connected, playbackState, sessionState, events, sendCommand } = useWebSocket();
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar connected={connected} playbackState={playbackState} onConfigClick={() => setShowConfig(true)} />

      <FlagIndicator flag={sessionState?.trackStatus.flag ?? 'green'} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 pb-12 space-y-6">
        <SessionSelector playbackState={playbackState} />

        {playbackState && (
          <PlaybackControls
            playbackState={playbackState}
            sendCommand={sendCommand}
          />
        )}

        {sessionState && (
          <DriverCards
            drivers={sessionState.drivers}
            timing={sessionState.timing}
            stints={sessionState.stints}
          />
        )}

        <EventFeed events={events} />
      </main>

      {showConfig && <ConfigPanel onClose={() => setShowConfig(false)} />}
    </div>
  );
}
