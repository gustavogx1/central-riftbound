"use client";

import { useState, type PointerEvent, type ReactNode } from "react";

const W = 260;
const GAP = 18;

/**
 * Mostra a imagem da carta flutuando ao lado do mouse enquanto ele está em cima de `children`.
 * Só com mouse: no toque a imagem cobriria a lista e não haveria como fechar.
 */
export function CardHover({ src, landscape = false, className, children }: { src: string | null; landscape?: boolean; className?: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  if (!src) return <span className={className}>{children}</span>;
  const w = landscape ? Math.round(W * 1.4) : W;
  const h = landscape ? Math.round(w * (266 / 372)) : Math.round(W * (519 / 372));
  const place = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const x = e.clientX + GAP + w > window.innerWidth ? e.clientX - GAP - w : e.clientX + GAP;
    const y = Math.min(Math.max(8, e.clientY - h / 2), window.innerHeight - h - 8);
    setPos({ x: Math.max(8, x), y });
  };
  return (
    <span className={className} onPointerEnter={place} onPointerMove={place} onPointerLeave={() => setPos(null)}>
      {children}
      {pos && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={w}
          height={h}
          className="pointer-events-none fixed z-50 rounded-xl shadow-2xl shadow-black/60"
          style={{ left: pos.x, top: pos.y, width: w, height: h }}
        />
      )}
    </span>
  );
}
