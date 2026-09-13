export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeSelectorProps {
  onChange: (preference: ThemePreference) => void;
  value: ThemePreference;
}

const options: ReadonlyArray<{ label: string; value: ThemePreference }> = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

export function ThemeSelector({ onChange, value }: ThemeSelectorProps) {
  return (
    <div aria-label="Color theme" className="ms-theme" role="group">
      {options.map((option) => (
        <button
          aria-label={option.label}
          aria-pressed={value === option.value}
          className="ms-theme__option"
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          <span className="ms-theme__label">{option.label}</span>
          <span aria-hidden="true" className="ms-theme__short">
            {option.label.slice(0, 1)}
          </span>
        </button>
      ))}
    </div>
  );
}
