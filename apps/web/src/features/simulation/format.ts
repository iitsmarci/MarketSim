const currencyFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter.format(value);
}

export function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs.toFixed(0)} ms`;
  }

  return `${(durationMs / 1_000).toFixed(2)} s`;
}

export function formatSimulationPeriod(month: number): string {
  if (month === 0) {
    return 'Start';
  }
  if (month < 12) {
    return `${String(month)} mo`;
  }

  const years = Math.floor(month / 12);
  const remainingMonths = month % 12;
  return remainingMonths === 0
    ? `${String(years)} yr`
    : `${String(years)} yr ${String(remainingMonths)} mo`;
}
