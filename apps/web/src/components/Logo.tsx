type Props = { variant?: "a" | "b"; className?: string; title?: string };

/** Duas propostas de logo. A: runa hexagonal com a fenda. B: monograma CR em cristais. */
export function Logo({ variant = "a", className, title = "Central Riftbound" }: Props) {
  if (variant === "b") {
    return (
      <svg viewBox="0 0 48 48" className={className} role="img" aria-label={title}>
        <path d="M24 3 41 14v20L24 45 7 34V14Z" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        <path d="M30 15h-8a9 9 0 0 0 0 18h8" fill="none" stroke="var(--text)" strokeWidth="3.2" strokeLinecap="round" />
        <path d="m26 24 6-4 4 13" fill="none" stroke="var(--accent-2)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label={title}>
      <path d="M24 2 43 13v22L24 46 5 35V13Z" fill="var(--surface-2)" stroke="var(--accent)" strokeWidth="2.5" />
      <path d="M33 15.5A11 11 0 1 0 33 32.5" fill="none" stroke="var(--text)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="m26 8-4 12 6 3-5 17" fill="none" stroke="var(--accent-2)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
