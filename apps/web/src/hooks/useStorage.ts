import { useState, useEffect, useCallback } from 'react';
import { IndexedDBStorageAdapter } from '@marketsim/storage';
import type { SavedScenario } from '@marketsim/storage';

const storage = new IndexedDBStorageAdapter();

export function useStorage() {
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadScenarios = useCallback(async () => {
    try {
      const list = await storage.listScenarios();
      setScenarios(list);
    } catch (e) {
      console.error('Failed to load scenarios', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadScenarios();
  }, [loadScenarios]);

  const saveScenario = async (scenario: SavedScenario) => {
    await storage.saveScenario(scenario);
    await loadScenarios();
  };

  const deleteScenario = async (id: string) => {
    await storage.deleteScenario(id);
    await loadScenarios();
  };

  return {
    scenarios,
    isLoading,
    saveScenario,
    deleteScenario,
    refresh: loadScenarios,
  };
}
