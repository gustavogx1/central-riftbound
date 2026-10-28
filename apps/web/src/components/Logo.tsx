type Props = { className?: string; title?: string };

/** Runa hexagonal com a fenda do Rift atravessando o C. */
export function Logo({ className, title = "Central Riftbound" }: Props) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label={title}>
      <path d="M24 2 43 13v22L24 46 5 35V13Z" fill="var(--surface-2)" stroke="var(--accent)" strokeWidth="2.5" />
      <path d="M33 15.5A11 11 0 1 0 33 32.5" fill="none" stroke="var(--text)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="m26 8-4 12 6 3-5 17" fill="none" stroke="var(--accent-2)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
