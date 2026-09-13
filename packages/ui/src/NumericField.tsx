import type { ChangeEventHandler } from 'react';

interface NumericFieldProps {
  description?: string;
  disabled?: boolean;
  error?: string | undefined;
  id: string;
  label: string;
  max?: number;
  min?: number;
  onChange: ChangeEventHandler<HTMLInputElement>;
  prefix?: string;
  step?: number;
  suffix?: string;
  value: string;
}

export function NumericField({
  description,
  disabled = false,
  error,
  id,
  label,
  max,
  min,
  onChange,
  prefix,
  step,
  suffix,
  value,
}: NumericFieldProps) {
  const message = error ?? description;
  const descriptionId = message ? `${id}-description` : undefined;

  return (
    <div className="ms-field">
      <label className="ms-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="ms-field__control">
        {prefix ? <span className="ms-field__affix">{prefix}</span> : null}
        <input
          aria-describedby={descriptionId}
          aria-invalid={error ? true : undefined}
          className="ms-field__input"
          disabled={disabled}
          id={id}
          inputMode="decimal"
          max={max}
          min={min}
          onChange={onChange}
          step={step}
          type="number"
          value={value}
        />
        {suffix ? <span className="ms-field__affix">{suffix}</span> : null}
      </div>
      {message ? (
        <span
          className={
            error ? 'ms-field__description ms-field__error' : 'ms-field__description'
          }
          id={descriptionId}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
