interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    <span className={`ms-brand ${className}`.trim()}>
      <svg aria-hidden="true" className="ms-brand__symbol" viewBox="0 0 36 36">
        <path d="M4 27 C11 24 15 20 18 10 C22 17 26 21 32 23" />
        <path d="M4 27 C11 26 16 24 20 16 C24 21 28 24 32 25" />
        <path d="M4 27 C13 27 21 27 32 27" />
      </svg>
      <span className="ms-brand__wordmark">MarketSim</span>
    </span>
  );
}
