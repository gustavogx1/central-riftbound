import { useTranslations } from "next-intl";
import { domainColor } from "./LegendAvatar";

export function DomainDots({ domains }: { domains: string[] }) {
  const t = useTranslations("Domains");
  return (
    <span className="inline-flex gap-1">
      {domains.map((d) => (
        <span key={d} className="size-2.5 rounded-full" style={{ background: domainColor(d) }} title={t(d as "Fury")} aria-label={t(d as "Fury")} role="img" />
      ))}
    </span>
  );
}
