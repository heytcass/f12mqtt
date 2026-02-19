import { useState } from 'react';
import { useConfig } from '../hooks/useConfig';

interface ConfigPanelProps {
  onClose: () => void;
}

interface MqttConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  prefix: string;
}

interface AwtrixConfig {
  enabled: boolean;
  prefix: string;
}

export function ConfigPanel({ onClose }: ConfigPanelProps) {
  const { config, loading, saveConfig } = useConfig();

  const mqtt = (config['mqtt'] as MqttConfig | undefined) ?? {
    host: '',
    port: 1883,
    username: '',
    password: '',
    prefix: 'f12mqtt',
  };

  const awtrix = (config['awtrix'] as AwtrixConfig | undefined) ?? {
    enabled: false,
    prefix: '',
  };

  const favorites = (config['favorites'] as string[] | undefined) ?? [];

  const [mqttForm, setMqttForm] = useState(mqtt);
  const [awtrixForm, setAwtrixForm] = useState(awtrix);
  const [favoritesForm, setFavoritesForm] = useState(favorites.join(', '));

  const handleSave = async () => {
    await saveConfig('mqtt', mqttForm);
    await saveConfig('awtrix', awtrixForm);
    await saveConfig('favorites', favoritesForm.split(',').map((s) => s.trim()).filter(Boolean));
    onClose();
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        {/* MQTT */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-300">MQTT Broker</legend>
          <div className="grid grid-cols-3 gap-2">
            <input
              className="col-span-2 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              placeholder="Host"
              value={mqttForm.host}
              onChange={(e) => setMqttForm({ ...mqttForm, host: e.target.value })}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              placeholder="Port"
              type="number"
              value={mqttForm.port}
              onChange={(e) => setMqttForm({ ...mqttForm, port: parseInt(e.target.value) || 1883 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              placeholder="Username"
              value={mqttForm.username}
              onChange={(e) => setMqttForm({ ...mqttForm, username: e.target.value })}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              placeholder="Password"
              type="password"
              value={mqttForm.password}
              onChange={(e) => setMqttForm({ ...mqttForm, password: e.target.value })}
            />
          </div>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            placeholder="Topic prefix (e.g. f12mqtt)"
            value={mqttForm.prefix}
            onChange={(e) => setMqttForm({ ...mqttForm, prefix: e.target.value })}
          />
        </fieldset>

        {/* AWTRIX */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-300">AWTRIX 3</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={awtrixForm.enabled}
              onChange={(e) => setAwtrixForm({ ...awtrixForm, enabled: e.target.checked })}
              className="rounded"
            />
            Enable AWTRIX notifications
          </label>
          {awtrixForm.enabled && (
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              placeholder="AWTRIX MQTT prefix"
              value={awtrixForm.prefix}
              onChange={(e) => setAwtrixForm({ ...awtrixForm, prefix: e.target.value })}
            />
          )}
        </fieldset>

        {/* Favorites */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-300">Favorite Drivers</legend>
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            placeholder="Driver numbers, comma-separated (e.g. 1, 4, 44)"
            value={favoritesForm}
            onChange={(e) => setFavoritesForm(e.target.value)}
          />
        </fieldset>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white px-4 py-1.5 rounded hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
