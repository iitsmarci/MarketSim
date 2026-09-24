import { get, set, del, keys } from 'idb-keyval';
import type { SavedScenario, StorageAdapter } from './index';

export class IndexedDBStorageAdapter implements StorageAdapter {
  private readonly storePrefix = 'marketsim_scenario_';

  private getKey(id: string): string {
    return `${this.storePrefix}${id}`;
  }

  async listScenarios(): Promise<SavedScenario[]> {
    const allKeys = await keys();
    const scenarioKeys = allKeys.filter(
      (k): k is string => typeof k === 'string' && k.startsWith(this.storePrefix),
    );

    const scenarios: SavedScenario[] = [];
    for (const key of scenarioKeys) {
      const scenario = await get<SavedScenario>(key);
      if (scenario) {
        scenarios.push(scenario);
      }
    }

    // Sort by most recently updated
    return scenarios.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async getScenario(id: string): Promise<SavedScenario | null> {
    const scenario = await get<SavedScenario>(this.getKey(id));
    return scenario || null;
  }

  async saveScenario(scenario: SavedScenario): Promise<void> {
    await set(this.getKey(scenario.id), scenario);
  }

  async deleteScenario(id: string): Promise<void> {
    await del(this.getKey(id));
  }
}
