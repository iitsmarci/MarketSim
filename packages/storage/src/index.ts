import type { SimulationConfig } from '@marketsim/domain';

export interface SavedScenario {
  id: string;
  name: string;
  updatedAt: string;
  config: SimulationConfig;
}

export interface StorageAdapter {
  listScenarios(): Promise<SavedScenario[]>;
  getScenario(id: string): Promise<SavedScenario | null>;
  saveScenario(scenario: SavedScenario): Promise<void>;
  deleteScenario(id: string): Promise<void>;
}

export * from './IndexedDBStorageAdapter';
