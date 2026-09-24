import { useState, useRef } from 'react';
import type { SimulationConfig } from '@marketsim/domain';
import type { SavedScenario } from '@marketsim/storage';
import { useStorage } from '../hooks/useStorage';

interface ScenarioManagerProps {
  currentConfig: Partial<SimulationConfig>;
  onLoad: (config: Partial<SimulationConfig>) => void;
  disabled?: boolean;
}

export function ScenarioManager({
  currentConfig,
  onLoad,
  disabled,
}: ScenarioManagerProps) {
  const { scenarios, saveScenario, deleteScenario } = useStorage();
  const [saveName, setSaveName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const id = Date.now().toString();
    void saveScenario({
      id,
      name: saveName.trim(),
      updatedAt: new Date().toISOString(),
      config: currentConfig as SimulationConfig,
    });
    setSaveName('');
  };

  const handleExport = (scenario: SavedScenario) => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(scenario.config, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `${scenario.name}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string) as SimulationConfig;
        const name = file.name.replace('.json', '');
        const id = Date.now().toString();
        void saveScenario({
          id,
          name,
          updatedAt: new Date().toISOString(),
          config,
        });
      } catch (error) {
        console.error('Failed to parse scenario file', error);
        alert('Failed to import scenario. Invalid JSON.');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (!isExpanded) {
    return (
      <div className="scenario-manager-collapsed">
        <button type="button" onClick={() => setIsExpanded(true)} disabled={disabled}>
          Manage Saved Scenarios
        </button>
      </div>
    );
  }

  return (
    <div className="scenario-manager">
      <header className="scenario-manager__header">
        <h3>Saved Scenarios</h3>
        <button type="button" onClick={() => setIsExpanded(false)}>
          Close
        </button>
      </header>

      <div className="scenario-save-form">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Name this scenario..."
          disabled={disabled}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || !saveName.trim()}
        >
          Save Current
        </button>
      </div>

      <div
        className="scenario-import-form"
        style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}
      >
        <input
          type="file"
          accept=".json"
          onChange={handleImport}
          ref={fileInputRef}
          style={{ display: 'none' }}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          Import Scenario
        </button>
      </div>

      {scenarios.length > 0 ? (
        <ul className="scenario-list">
          {scenarios.map((s) => (
            <li key={s.id} className="scenario-list-item">
              <div>
                <strong>{s.name}</strong>
                <div className="scenario-list-item__meta">
                  {new Date(s.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="scenario-list-item__actions">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onLoad(s.config)}
                >
                  Load
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleExport(s)}
                >
                  Export
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void deleteScenario(s.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="scenario-list-empty">No saved scenarios.</p>
      )}
    </div>
  );
}
