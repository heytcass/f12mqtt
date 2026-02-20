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

const inputClass =
  'bg-gray-800/70 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-colors';

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl border border-gray-800/60 shadow-2xl shadow-black/40 p-6 max-w-md w-full mx-4 space-y-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white hover:bg-gray-800 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-150 text-lg"
          >
            &times;
          </button>
        </div>

        {/* MQTT */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-gray-500">MQTT Broker</legend>
          <div className="grid grid-cols-3 gap-2">
            <input
              className={`col-span-2 ${inputClass}`}
              placeholder="Host"
              value={mqttForm.host}
              onChange={(e) => setMqttForm({ ...mqttForm, host: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Port"
              type="number"
              value={mqttForm.port}
              onChange={(e) => setMqttForm({ ...mqttForm, port: parseInt(e.target.value) || 1883 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              placeholder="Username"
              value={mqttForm.username}
              onChange={(e) => setMqttForm({ ...mqttForm, username: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Password"
              type="password"
              value={mqttForm.password}
              onChange={(e) => setMqttForm({ ...mqttForm, password: e.target.value })}
            />
          </div>
          <input
            className={`w-full ${inputClass}`}
            placeholder="Topic prefix (e.g. f12mqtt)"
            value={mqttForm.prefix}
            onChange={(e) => setMqttForm({ ...mqttForm, prefix: e.target.value })}
          />
        </fieldset>

        {/* AWTRIX */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-gray-500">AWTRIX 3</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={awtrixForm.enabled}
              onChange={(e) => setAwtrixForm({ ...awtrixForm, enabled: e.target.checked })}
              className="rounded accent-blue-500"
            />
            Enable AWTRIX notifications
          </label>
          {awtrixForm.enabled && (
            <input
              className={`w-full ${inputClass}`}
              placeholder="AWTRIX MQTT prefix"
              value={awtrixForm.prefix}
              onChange={(e) => setAwtrixForm({ ...awtrixForm, prefix: e.target.value })}
            />
          )}
        </fieldset>

        {/* Favorites */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-gray-500">Favorite Drivers</legend>
          <input
            className={`w-full ${inputClass}`}
            placeholder="Driver numbers, comma-separated (e.g. 1, 4, 44)"
            value={favoritesForm}
            onChange={(e) => setFavoritesForm(e.target.value)}
          />
        </fieldset>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-800/40">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 px-4 py-2 rounded-lg transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            className="text-sm bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-all duration-150 shadow-md shadow-blue-900/30"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
