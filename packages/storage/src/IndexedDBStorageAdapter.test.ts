import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDBStorageAdapter } from './IndexedDBStorageAdapter';
import type { SavedScenario } from './index';
import { MONTHLY_LOGNORMAL_MODEL_VERSION } from '@marketsim/domain';

const mockScenario: SavedScenario = {
  id: 'test-1',
  name: 'Test Scenario',
  updatedAt: new Date().toISOString(),
  config: {
    durationMonths: 120,
    initialBalance: 10000,
    monthlyContribution: 500,
    modelVersion: MONTHLY_LOGNORMAL_MODEL_VERSION,
    modelParameters: {
      annualMeanReturn: 0.07,
      annualVolatility: 0.15,
    },
    inflation: {
      annualRate: 0.02,
    },
  },
};

describe('IndexedDBStorageAdapter', () => {
  let adapter: IndexedDBStorageAdapter;

  beforeEach(() => {
    // fake-indexeddb resets between runs if needed, but we can also just use a fresh adapter
    adapter = new IndexedDBStorageAdapter();
  });

  it('saves and retrieves a scenario', async () => {
    await adapter.saveScenario(mockScenario);

    const retrieved = await adapter.getScenario('test-1');
    expect(retrieved).toEqual(mockScenario);
  });

  it('returns null for unknown scenario', async () => {
    const retrieved = await adapter.getScenario('unknown');
    expect(retrieved).toBeNull();
  });

  it('lists saved scenarios in order of recent updates', async () => {
    const older: SavedScenario = {
      ...mockScenario,
      id: 'older',
      updatedAt: '2020-01-01T00:00:00Z',
    };
    const newer: SavedScenario = {
      ...mockScenario,
      id: 'newer',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    await adapter.saveScenario(older);
    await adapter.saveScenario(newer);

    const list = await adapter.listScenarios();
    expect(list.length).toBeGreaterThanOrEqual(2);
    // the newest should be first
    const retrievedNewerIndex = list.findIndex((s) => s.id === 'newer');
    const retrievedOlderIndex = list.findIndex((s) => s.id === 'older');
    expect(retrievedNewerIndex).toBeLessThan(retrievedOlderIndex);
  });

  it('deletes a scenario', async () => {
    await adapter.saveScenario(mockScenario);
    await adapter.deleteScenario('test-1');

    const retrieved = await adapter.getScenario('test-1');
    expect(retrieved).toBeNull();
  });
});
