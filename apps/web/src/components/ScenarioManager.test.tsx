import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimulationConfig } from '@marketsim/domain';
import { ScenarioManager } from './ScenarioManager';
import { useStorage } from '../hooks/useStorage';

vi.mock('../hooks/useStorage', () => ({
  useStorage: vi.fn(),
}));

describe('ScenarioManager', () => {
  const mockSaveScenario = vi.fn();
  const mockDeleteScenario = vi.fn();
  const mockOnLoad = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useStorage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      scenarios: [],
      saveScenario: mockSaveScenario,
      deleteScenario: mockDeleteScenario,
    });
  });

  const defaultProps = {
    currentConfig: { annualReturn: 5 } as unknown as Partial<SimulationConfig>,
    onLoad: mockOnLoad,
  };

  it('renders a collapsed state initially', () => {
    render(<ScenarioManager {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /Manage Saved Scenarios/i }),
    ).toBeInTheDocument();
  });

  it('expands when clicking the manage button', () => {
    render(<ScenarioManager {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Manage Saved Scenarios/i }));
    expect(
      screen.getByRole('heading', { name: /Saved Scenarios/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Name this scenario/i)).toBeInTheDocument();
  });

  it('saves a new scenario', () => {
    render(<ScenarioManager {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Manage Saved Scenarios/i }));

    const input = screen.getByPlaceholderText(/Name this scenario/i);
    fireEvent.change(input, { target: { value: 'My Test Scenario' } });

    const saveButton = screen.getByRole('button', { name: /Save Current/i });
    fireEvent.click(saveButton);

    expect(mockSaveScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Test Scenario',
        config: { annualReturn: 5 },
      }),
    );
  });

  it('lists saved scenarios and allows loading and deleting', () => {
    (useStorage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      scenarios: [
        {
          id: '1',
          name: 'Scenario A',
          updatedAt: new Date().toISOString(),
          config: { annualReturn: 7 },
        },
      ],
      saveScenario: mockSaveScenario,
      deleteScenario: mockDeleteScenario,
    });

    render(<ScenarioManager {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Manage Saved Scenarios/i }));

    expect(screen.getByText('Scenario A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Load/i }));
    expect(mockOnLoad).toHaveBeenCalledWith({ annualReturn: 7 });

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    expect(mockDeleteScenario).toHaveBeenCalledWith('1');
  });

  it('exports a scenario to json', () => {
    const clickSpy = vi
      .spyOn(HTMLElement.prototype, 'click')
      .mockImplementation(() => {});

    (useStorage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      scenarios: [
        {
          id: '1',
          name: 'Scenario A',
          updatedAt: new Date().toISOString(),
          config: { annualReturn: 7 },
        },
      ],
      saveScenario: mockSaveScenario,
      deleteScenario: mockDeleteScenario,
    });

    render(<ScenarioManager {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Manage Saved Scenarios/i }));

    fireEvent.click(screen.getByRole('button', { name: /Export/i }));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
