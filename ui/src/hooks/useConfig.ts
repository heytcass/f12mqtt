import { useState, useEffect, useCallback } from 'react';

export function useConfig() {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        setConfig(await res.json() as Record<string, unknown>);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (key: string, value: unknown) => {
    const res = await fetch(`/api/config/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (res.ok) {
      setConfig((prev) => ({ ...prev, [key]: value }));
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  return { config, loading, saveConfig, reload: loadConfig };
}
