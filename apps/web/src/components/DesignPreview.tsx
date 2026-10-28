"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const TOKENS = ["bg", "surface", "surface-2", "border", "text", "muted", "accent", "accent-2"] as const;
const DOMAINS = ["fury", "calm", "mind", "body", "chaos", "order"] as const;
const TIERS = ["s", "a", "b", "c", "d"] as const;

export function DesignPreview() {
  const t = useTranslations("Design");
  const [palette, setPalette] = useState<"a" | "b">("a");

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    return () => {
      document.documentElement.dataset.palette = "a";
    };
  }, [palette]);

  return (
    <div className="space-y-10">
      <div role="radiogroup" aria-label={t("palette")} className="flex flex-wrap gap-3">
        {(["a", "b"] as const).map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={palette === p}
            onClick={() => setPalette(p)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
              palette === p ? "border-accent bg-surface-2" : "border-border bg-surface hover:bg-surface-2"
            }`}
          >
            <Logo variant={p} className="size-10" />
            <span className="font-display font-semibold">{t(p === "a" ? "optionA" : "optionB")}</span>
          </button>
        ))}
      </div>

      <section aria-labelledby="logo-h">
        <h2 id="logo-h" className="font-display text-xl font-semibold">{t("logo")}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-8 rounded-xl border border-border bg-surface p-6">
          <Logo variant={palette} className="size-24" />
          <div className="flex items-center gap-3">
            <Logo variant={palette} className="size-10" />
            <span className="font-display text-2xl font-bold tracking-wide">Central Riftbound</span>
          </div>
          <Logo variant={palette} className="size-6" />
        </div>
      </section>

      <section aria-labelledby="tokens-h">
        <h2 id="tokens-h" className="font-display text-xl font-semibold">{t("tokens")}</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TOKENS.map((k) => (
            <li key={k} className="overflow-hidden rounded-lg border border-border">
              <div className="h-14" style={{ background: `var(--${k})` }} />
              <code className="block bg-surface px-3 py-2 text-xs text-muted">--{k}</code>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-10 md:grid-cols-2">
        <section aria-labelledby="domains-h">
          <h2 id="domains-h" className="font-display text-xl font-semibold">{t("domains")}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {DOMAINS.map((d) => (
              <li key={d} className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm capitalize">
                <span className="size-3 rounded-full" style={{ background: `var(--domain-${d})` }} aria-hidden />
                {d}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="tiers-h">
          <h2 id="tiers-h" className="font-display text-xl font-semibold">{t("tiers")}</h2>
          <ul className="mt-4 flex gap-2">
            {TIERS.map((tier) => (
              <li
                key={tier}
                className="grid size-10 place-items-center rounded-lg font-display text-lg font-bold uppercase text-[#111]"
                style={{ background: `var(--tier-${tier})` }}
              >
                {tier}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="sample-h">
        <h2 id="sample-h" className="font-display text-xl font-semibold">{t("sample")}</h2>
        <article className="mt-4 max-w-md rounded-xl border border-border bg-surface p-5 shadow-[0_0_40px_var(--glow)]">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-full border-2 border-accent bg-surface-2 font-display text-xl font-bold">K</div>
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-semibold">{t("sampleLegend")}</h3>
              <div className="mt-1 flex gap-1.5">
                <span className="size-3 rounded-full" style={{ background: "var(--domain-fury)" }} aria-label="Fury" />
                <span className="size-3 rounded-full" style={{ background: "var(--domain-mind)" }} aria-label="Mind" />
              </div>
            </div>
            <span className="ml-auto grid size-10 place-items-center rounded-lg font-display text-lg font-bold text-[#111]" style={{ background: "var(--tier-a)" }}>
              A
            </span>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-muted">{t("sampleWinrate")}</dt><dd className="font-semibold">54.8%</dd></div>
            <div><dt className="text-muted">{t("samplePlays")}</dt><dd className="font-semibold">1,284</dd></div>
            <div><dt className="text-muted">{t("sampleTrend")}</dt><dd className="font-semibold text-accent-2">▲ 2.1</dd></div>
          </dl>
        </article>
      </section>
    </div>
  );
}
