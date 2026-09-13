import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeSelector } from './ThemeSelector';

describe('ThemeSelector', () => {
  it('exposes the selected theme and reports a new preference', () => {
    const onChange = vi.fn();

    render(<ThemeSelector onChange={onChange} value="system" />);

    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});
