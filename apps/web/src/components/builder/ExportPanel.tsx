"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { decodeDeck, deckToText, emptyDeck, encodeDeck, textToDeck, type PoolCard } from "@cr/core";
import { getPathname } from "@/i18n/navigation";
import { SavePanel } from "./SavePanel";
import type { Draft, DraftStore } from "./store";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Parece um código de deck: uma palavra só, base32 maiúsculo. */
const looksLikeCode = (s: string) => /^[A-Z2-7]{16,}$/.test(s.trim());

export function ExportPanel({ draft, pool, store, legal }: { draft: Draft; pool: Map<string, PoolCard>; store: DraftStore; legal: boolean }) {
  const t = useTranslations("Builder");
  const locale = useLocale();
  const [copied, setCopied] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const code = useMemo(() => {
    try {
      return encodeDeck(draft.deck, pool);
    } catch {
      return "";
    }
  }, [draft.deck, pool]);
  const text = useMemo(() => deckToText(draft.deck, pool), [draft.deck, pool]);
  const query = code ? { code, ...(draft.name ? { name: draft.name } : {}) } : null;
  const shareUrl = query && typeof window !== "undefined" ? `${window.location.origin}${getPathname({ href: { pathname: "/builder", query }, locale })}` : "";
  const printHref = query ? getPathname({ href: { pathname: "/builder/print", query }, locale }) : null;

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1800);
  };
  const doCopy = async (key: string, value: string) => {
    if (await copy(value)) flash(key);
  };

  const download = () => {
    const blob = new Blob([`${draft.name ? `${draft.name}\n\n` : ""}${text}\n`], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(draft.name || "deck").replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "deck"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = () => {
    const value = input.trim();
    if (!value) return;
    try {
      const { deck, unknown } = looksLikeCode(value) ? decodeDeck(value, pool) : textToDeck(value, pool);
      const empty = !deck.legend && !deck.champion && !Object.keys(deck.main).length && !Object.keys(deck.runes).length && !deck.battlefields.length;
      if (empty) {
        setImportMsg({ ok: false, text: t("importNothing") });
        return;
      }
      store.set((s) => ({ ...s, deck, savedId: null }));
      setInput("");
      setImportMsg({ ok: true, text: unknown.length ? t("importPartial", { lines: unknown.slice(0, 5).join(", "), count: unknown.length }) : t("importOk") });
    } catch {
      setImportMsg({ ok: false, text: t("importInvalid") });
    }
  };

  const btn = "rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50";
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <SavePanel draft={draft} store={store} code={code} />
      <section>
        <h3 className="font-display text-sm font-semibold">{t("export")}</h3>
        {!legal && code && <p className="mt-1 text-xs text-muted">{t("exportIllegal")}</p>}
        <label className="mt-2 block text-xs text-muted">
          {t("deckCode")}
          <input readOnly value={code} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text" />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={btn} disabled={!code} onClick={() => doCopy("code", code)}>
            {copied === "code" ? t("copied") : t("copyCode")}
          </button>
          <button className={btn} disabled={!shareUrl} onClick={() => doCopy("link", shareUrl)}>
            {copied === "link" ? t("copied") : t("copyLink")}
          </button>
          <button className={btn} disabled={!text} onClick={() => doCopy("text", text)}>
            {copied === "text" ? t("copied") : t("copyText")}
          </button>
          <button className={btn} disabled={!text} onClick={download}>
            {t("downloadText")}
          </button>
          {printHref && (
            <a className={btn} href={printHref} target="_blank" rel="noopener">
              {t("print")}
            </a>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">{t("codeCompat")}</p>
      </section>

      <section>
        <h3 className="font-display text-sm font-semibold">{t("import")}</h3>
        <label className="mt-2 block text-xs text-muted">
          {t("importHelp")}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className={btn} disabled={!input.trim()} onClick={doImport}>
            {t("importButton")}
          </button>
          <button
            className={`${btn} text-bad`}
            onClick={() => {
              if (window.confirm(t("clearConfirm"))) store.set((s) => ({ ...s, name: "", deck: emptyDeck(), savedId: null }));
            }}
          >
            {t("clear")}
          </button>
        </div>
        {importMsg && (
          <p role="status" className={`mt-2 text-xs ${importMsg.ok ? "text-good" : "text-bad"}`}>
            {importMsg.text}
          </p>
        )}
      </section>
    </div>
  );
}
