interface EecSealProps {
  className?: string;
}

export function EecSeal({ className }: EecSealProps) {
  return (
    <svg
      aria-hidden="true"
      className={className ? `eec-seal ${className}` : "eec-seal"}
      focusable="false"
      viewBox="0 0 100 100"
    >
      <circle className="eec-seal-field" cx="50" cy="50" r="47" />
      <circle className="eec-seal-outer" cx="50" cy="50" r="43" />
      <circle className="eec-seal-inner" cx="50" cy="50" r="34" />
      <path className="eec-seal-tick" d="M50 7v8M50 85v8M7 50h8M85 50h8" />
      <path className="eec-seal-star" d="M50 18l4.6 22.1L82 50l-27.4 9.9L50 82l-4.6-22.1L18 50l27.4-9.9L50 18Z" />
      <circle className="eec-seal-center" cx="50" cy="50" r="23" />
      <path className="eec-seal-flourish" d="M27 31c-5 4-8 9-10 15M73 31c5 4 8 9 10 15M27 69c-5-4-8-9-10-15M73 69c5-4 8-9 10-15" />
      <text className="eec-seal-monogram" x="50" y="55" textAnchor="middle">EEC</text>
      <circle className="eec-seal-dot" cx="50" cy="11" r="1.5" />
      <circle className="eec-seal-dot" cx="50" cy="89" r="1.5" />
      <circle className="eec-seal-dot" cx="11" cy="50" r="1.5" />
      <circle className="eec-seal-dot" cx="89" cy="50" r="1.5" />
    </svg>
  );
}

export function EecHeroEmblem({ institutionName }: { institutionName: string }) {
  return (
    <aside className="eec-hero-emblem" aria-hidden="true">
      <span className="eec-emblem-kicker">Official company registry</span>
      <EecSeal className="eec-emblem-seal" />
      <span className="eec-emblem-name">{institutionName}</span>
      <span className="eec-emblem-rule"><i /><b>◆</b><i /></span>
      <span className="eec-emblem-motto">Trade · Supply · Authority</span>
    </aside>
  );
}
