import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { makeFormat } from "@/lib/format";
import type { LegendInfo } from "@/lib/queries";
import { LegendAvatar } from "./LegendAvatar";

export interface DeckSummary {
  id: string;
  name: string;
  author: string;
  legendCardId: string | null;
  legal: boolean;
  visibility: "private" | "unlisted" | "public";
  updatedAt: Date;
}

/** Linha de deck nas listas (biblioteca e minha conta). */
export function DeckCardItem({ deck, legend, locale, showVisibility = false }: { deck: DeckSummary; legend?: LegendInfo; locale: string; showVisibility?: boolean }) {
  const t = useTranslations("Decks");
  const f = makeFormat(locale);
  return (
    <Link href={`/decks/${deck.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:border-accent">
      {legend ? <LegendAvatar cardId={legend.cardId} champion={legend.champion} domains={legend.domains} size={44} /> : <span className="size-11 rounded-full bg-surface-2" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{deck.name}</span>
        <span className="block truncate text-xs text-muted">
          {legend ? `${legend.champion}, ${legend.title}` : t("noLegend")} · {deck.author} · {f.date(deck.updatedAt)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
        {showVisibility && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">{t(`visibility.${deck.visibility}`)}</span>}
        <span className={`rounded px-1.5 py-0.5 ${deck.legal ? "bg-good/15 text-good" : "bg-bad/15 text-bad"}`}>{deck.legal ? t("legal") : t("notLegal")}</span>
      </span>
    </Link>
  );
}
