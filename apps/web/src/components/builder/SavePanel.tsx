"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useMe } from "@/lib/auth/use-me";
import { saveDeckAction } from "@/lib/deck-actions";
import type { Draft, DraftStore } from "./store";

/** Salvar na conta: só aparece com login configurado. */
export function SavePanel({ draft, store, code }: { draft: Draft; store: DraftStore; code: string }) {
  const t = useTranslations("Builder");
  const me = useMe();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!me?.enabled) return null;

  const save = (asNew: boolean) =>
    start(async () => {
      setMsg(null);
      const input = { id: asNew ? null : draft.savedId, name: draft.name, code, format: draft.format, visibility: draft.visibility };
      let res = await saveDeckAction(input);
      // O deck salvo sumiu (apagado em outra aba) ou é de outra pessoa: grava como novo.
      if (!res.ok && res.error === "notFound") res = await saveDeckAction({ ...input, id: null });
      if (res.ok) {
        store.set((s) => ({ ...s, savedId: res.id }));
        setMsg({ ok: true, text: t("saved") });
      } else {
        setMsg({ ok: false, text: t(`saveError.${res.error}`) });
      }
    });

  const btn = "rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50";
  return (
    <section>
      <h3 className="font-display text-sm font-semibold">{t("saveTitle")}</h3>
      {!me.user ? (
        <p className="mt-2 text-sm text-muted">
          {t.rich("saveLogin", { link: (c) => <Link href={{ pathname: "/login", query: { next: pathname } }} className="text-accent underline">{c}</Link> })}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-sm">
              <span className="sr-only">{t("visibilityLabel")}</span>
              <select
                value={draft.visibility}
                onChange={(e) => store.set((s) => ({ ...s, visibility: e.target.value as Draft["visibility"] }))}
                className="rounded-md border border-border bg-bg px-2 py-1.5"
              >
                <option value="private">{t("visibility.private")}</option>
                <option value="unlisted">{t("visibility.unlisted")}</option>
                <option value="public">{t("visibility.public")}</option>
              </select>
            </label>
            <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-50" disabled={!code || pending} onClick={() => save(false)}>
              {pending ? t("saving") : draft.savedId ? t("saveChanges") : t("save")}
            </button>
            {draft.savedId && (
              <button className={btn} disabled={!code || pending} onClick={() => save(true)}>
                {t("saveCopy")}
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">{t(`visibilityHelp.${draft.visibility}`)}</p>
          {draft.savedId && (
            <p className="mt-1 text-xs">
              <Link href={`/decks/${draft.savedId}`} className="text-accent underline">{t("openSaved")}</Link>
            </p>
          )}
          {msg && (
            <p role="status" className={`mt-1 text-xs ${msg.ok ? "text-good" : "text-bad"}`}>
              {msg.text}
            </p>
          )}
        </>
      )}
    </section>
  );
}
