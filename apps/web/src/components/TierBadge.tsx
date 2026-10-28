export function TierBadge({ tier, size = "md" }: { tier: string; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "size-6 text-xs" : "size-8 text-sm";
  return (
    <span className={`inline-grid ${dims} shrink-0 place-items-center rounded-md font-display font-bold text-[#111]`} style={{ background: `var(--tier-${tier.toLowerCase()})` }}>
      {tier}
    </span>
  );
}
