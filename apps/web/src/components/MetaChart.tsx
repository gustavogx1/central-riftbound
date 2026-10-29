"use client";

import { useMemo, useState } from "react";

export interface ChartPoint {
  slug: string;
  champion: string;
  title: string;
  power: number;
  tier: string;
  share: number;
  matches: number;
  winRate: number | null;
  low: number | null;
  high: number | null;
  avatar: string | null;
  domains: string[];
  href: string;
  /** Complexidade votada (1–5, média bayesiana); null sem votos suficientes. */
  complexity: number | null;
}

interface Labels {
  chart: string;
  yAxis: string;
  xLabel: string;
  xShare: string;
  xComplexity: string;
  xComplexityOff: string;
  complexity: string;
  missingVotes: string;
  share: string;
  winRate: string;
  matches: string;
  power: string;
}

const W = 1000;
const H = 600;
const M = { top: 24, right: 28, bottom: 52, left: 64 };
const TIER_BANDS = [
  { tier: "S", from: 90, to: 100 },
  { tier: "A", from: 70, to: 90 },
  { tier: "B", from: 40, to: 70 },
  { tier: "C", from: 15, to: 40 },
  { tier: "D", from: 0, to: 15 },
];
const DOMAIN_VAR: Record<string, string> = {
  Fury: "var(--domain-fury)", Calm: "var(--domain-calm)", Mind: "var(--domain-mind)",
  Body: "var(--domain-body)", Chaos: "var(--domain-chaos)", Order: "var(--domain-order)",
};

/** Afasta círculos sobrepostos com poucas iterações determinísticas. */
function relax(nodes: { x: number; y: number; r: number; ox: number; oy: number }[]) {
  for (let iter = 0; iter < 120; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r + 2;
        if (d >= min) continue;
        if (d === 0) {
          dx = j % 2 ? 1 : -1;
          dy = 0;
          d = 1;
        }
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    // Mola fraca de volta à posição real, para não perder o sentido do gráfico.
    for (const n of nodes) {
      n.x += (n.ox - n.x) * 0.02;
      n.y += (n.oy - n.y) * 0.02;
      n.x = Math.min(W - M.right - n.r, Math.max(M.left + n.r, n.x));
      n.y = Math.min(H - M.bottom - n.r, Math.max(M.top + n.r, n.y));
    }
    if (!moved) break;
  }
}

export function MetaChart({ points, labels, locale }: { points: ChartPoint[]; labels: Labels; locale: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [mode, setMode] = useState<"share" | "complexity">("share");
  const pct = (v: number, digits = 1) => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  const dec = (v: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
  const voted = points.filter((p) => p.complexity !== null);
  const missing = points.length - voted.length;

  const { nodes, xTicks } = useMemo(() => {
    const shown = mode === "complexity" ? points.filter((p) => p.complexity !== null) : points;
    const maxShare = Math.max(0.05, ...shown.map((p) => p.share)) * 1.08;
    const span = W - M.left - M.right;
    // Popularidade em escala raiz: separa as lendas com pouca presença sem esmagar as populares.
    // Complexidade em escala linear de 1 a 5.
    const sx = mode === "complexity" ? (c: number) => M.left + ((c - 1) / 4) * span : (s: number) => M.left + Math.sqrt(s / maxShare) * span;
    const sy = (p: number) => M.top + (1 - p / 100) * (H - M.top - M.bottom);
    const maxMatches = Math.max(1, ...shown.map((p) => p.matches));
    const ns = shown.map((p) => {
      const x = sx(mode === "complexity" ? p.complexity! : p.share);
      const y = sy(p.power);
      return { ...p, x, y, ox: x, oy: y, r: 13 + 11 * Math.sqrt(p.matches / maxMatches) };
    });
    relax(ns);
    const ticks =
      mode === "complexity"
        ? [1, 2, 3, 4, 5].map((t) => ({ t, x: sx(t), label: String(t) }))
        : [0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3].filter((t) => t < maxShare).map((t) => ({ t, x: sx(t), label: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(t) }));
    return { nodes: ns, xTicks: ticks };
  }, [points, mode, locale]);

  const sy = (p: number) => M.top + (1 - p / 100) * (H - M.top - M.bottom);
  const current = nodes.find((n) => n.slug === active);

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-sm">
        {mode === "complexity" && missing > 0 && <span className="mr-auto text-xs text-muted">{labels.missingVotes}</span>}
        <label htmlFor="x-axis" className="text-muted">{labels.xLabel}</label>
        <select id="x-axis" className="rounded-md border border-border bg-surface-2 px-2 py-1" value={mode} onChange={(e) => setMode(e.target.value === "complexity" ? "complexity" : "share")}>
          <option value="share">{labels.xShare}</option>
          <option value="complexity" disabled={voted.length === 0}>{voted.length ? labels.xComplexity : labels.xComplexityOff}</option>
        </select>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={labels.chart}>
        <defs>
          {nodes.map((n) => (
            <clipPath key={n.slug} id={`clip-${n.slug}`}>
              <circle cx={n.x} cy={n.y} r={n.r - 2} />
            </clipPath>
          ))}
        </defs>

        {TIER_BANDS.map((b) => (
          <g key={b.tier}>
            <rect x={M.left} y={sy(b.to)} width={W - M.left - M.right} height={sy(b.from) - sy(b.to)} fill={`var(--tier-${b.tier.toLowerCase()})`} opacity={0.07} />
            <line x1={M.left} x2={W - M.right} y1={sy(b.from)} y2={sy(b.from)} stroke="var(--border)" strokeDasharray="4 6" />
            <text x={M.left - 14} y={(sy(b.from) + sy(b.to)) / 2 + 6} textAnchor="end" className="font-display" fontSize={20} fontWeight={700} fill={`var(--tier-${b.tier.toLowerCase()})`}>
              {b.tier}
            </text>
          </g>
        ))}

        {xTicks.map(({ t, x, label }) => (
          <g key={t}>
            <line x1={x} x2={x} y1={M.top} y2={H - M.bottom} stroke="var(--border)" opacity={0.5} />
            <text x={x} y={H - M.bottom + 20} textAnchor="middle" fontSize={13} fill="var(--muted)">{label}</text>
          </g>
        ))}
        <text x={(W + M.left) / 2} y={H - 10} textAnchor="middle" fontSize={14} fill="var(--muted)">{mode === "complexity" ? labels.xComplexity : labels.xShare}</text>
        <text x={16} y={(H - M.bottom + M.top) / 2} textAnchor="middle" fontSize={14} fill="var(--muted)" transform={`rotate(-90 16 ${(H - M.bottom + M.top) / 2})`}>
          {labels.yAxis}
        </text>

        {nodes.map((n) => {
          const [d1, d2] = [DOMAIN_VAR[n.domains[0] ?? ""] ?? "var(--border)", DOMAIN_VAR[n.domains[1] ?? n.domains[0] ?? ""] ?? "var(--border)"];
          const on = active === n.slug;
          return (
            <a
              key={n.slug}
              href={n.href}
              aria-label={`${n.champion}, ${n.title}: ${labels.power} ${n.power}, ${n.tier}`}
              onMouseEnter={() => setActive(n.slug)}
              onMouseLeave={() => setActive((a) => (a === n.slug ? null : a))}
              onFocus={() => setActive(n.slug)}
              onBlur={() => setActive((a) => (a === n.slug ? null : a))}
              className="outline-none"
            >
              <circle cx={n.x} cy={n.y} r={n.r + (on ? 3 : 0)} fill={d1} />
              <path d={`M ${n.x} ${n.y - n.r - (on ? 3 : 0)} A ${n.r + (on ? 3 : 0)} ${n.r + (on ? 3 : 0)} 0 0 1 ${n.x} ${n.y + n.r + (on ? 3 : 0)} Z`} fill={d2} />
              {n.avatar ? (
                <image href={n.avatar} x={n.x - n.r + 2} y={n.y - n.r + 2} width={(n.r - 2) * 2} height={(n.r - 2) * 2} clipPath={`url(#clip-${n.slug})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <>
                  <circle cx={n.x} cy={n.y} r={n.r - 2} fill="var(--surface-2)" />
                  <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize={n.r * 0.8} fontWeight={700} fill="var(--text)" className="font-display">{n.champion.slice(0, 2)}</text>
                </>
              )}
              {on && <circle cx={n.x} cy={n.y} r={n.r + 6} fill="none" stroke="var(--focus)" strokeWidth={2} />}
            </a>
          );
        })}
      </svg>

      {current && (
        <div
          className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-sm shadow-xl"
          style={{ left: `${Math.min(84, Math.max(16, (current.x / W) * 100))}%`, top: `calc(${(current.y / H) * 100}% + ${current.r + 10}px)` }}
          role="tooltip"
        >
          <p className="font-display font-semibold">{current.champion}</p>
          <p className="text-xs text-muted">{current.title}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-muted">{labels.power}</dt><dd className="text-right font-semibold">{current.power} · {current.tier}</dd>
            <dt className="text-muted">{labels.winRate}</dt><dd className="text-right font-semibold">{current.winRate === null ? "—" : pct(current.winRate)}</dd>
            <dt className="text-muted">{labels.share}</dt><dd className="text-right font-semibold">{pct(current.share)}</dd>
            <dt className="text-muted">{labels.matches}</dt><dd className="text-right font-semibold">{new Intl.NumberFormat(locale).format(current.matches)}</dd>
            {current.complexity !== null && (
              <>
                <dt className="text-muted">{labels.complexity}</dt><dd className="text-right font-semibold">{dec(current.complexity)}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
