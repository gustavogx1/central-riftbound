import { LegendAvatar } from "@/components/LegendAvatar";
import { Link } from "@/i18n/navigation";
import type { LegendInfo } from "@/lib/queries";

export function LegendCell({ slug, legends, size = 24 }: { slug: string | null; legends: Map<string, LegendInfo>; size?: number }) {
  const l = slug ? legends.get(slug) : undefined;
  if (!l) return <span className="text-muted">—</span>;
  return (
    <Link href={`/legends/${l.slug}`} className="flex min-w-0 items-center gap-2 hover:text-accent">
      <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={size} />
      <span className="truncate">{l.champion}</span>
    </Link>
  );
}
