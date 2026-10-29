"use client";

import { useState } from "react";
import { renderDeckImage, type ExportDeck, type Orientation } from "@/lib/deck-image";

type Format = "png" | "jpg";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "deck";

/** Botão que gera a imagem do deck no navegador e baixa como PNG ou JPG. */
export function DeckExport({
  deck,
  labels,
  className,
}: {
  deck: ExportDeck;
  labels: { button: string; vertical: string; horizontal: string; format: string; orientation: string; download: string; working: string; error: string };
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const [format, setFormat] = useState<Format>("png");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  const download = async () => {
    setState("working");
    try {
      const canvas = await renderDeckImage(deck, orientation);
      const type = format === "png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
      if (!blob) throw new Error("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(deck.title)}-${orientation}.${format}`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const seg = (on: boolean) => `rounded-full px-3 py-1 ${on ? "bg-accent text-accent-ink" : "text-muted hover:text-text"}`;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className={className}>
        {labels.button}
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 w-72 space-y-3 rounded-xl border border-border bg-surface p-4 text-sm shadow-2xl shadow-black/50">
          <div>
            <p className="mb-1 text-xs text-muted">{labels.orientation}</p>
            <div role="group" aria-label={labels.orientation} className="inline-flex flex-wrap rounded-full border border-border p-0.5">
              {(["vertical", "horizontal"] as const).map((o) => (
                <button key={o} onClick={() => setOrientation(o)} aria-pressed={orientation === o} className={seg(orientation === o)}>
                  {labels[o]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">{labels.format}</p>
            <div role="group" aria-label={labels.format} className="inline-flex rounded-full border border-border p-0.5">
              {(["png", "jpg"] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)} aria-pressed={format === f} className={seg(format === f)}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button onClick={download} disabled={state === "working"} className="w-full rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink disabled:opacity-60">
            {state === "working" ? labels.working : labels.download}
          </button>
          {state === "error" && <p className="text-xs text-bad">{labels.error}</p>}
        </div>
      )}
    </div>
  );
}
