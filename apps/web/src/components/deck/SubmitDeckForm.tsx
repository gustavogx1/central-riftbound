"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { submitDeckAction } from "@/lib/submission-actions";
import type { SubmitResult } from "@/lib/submissions";

interface Props {
  eventId: number;
  playerId: number;
  admin: boolean;
  myDecks: { id: string; name: string; code: string }[];
  limits: { list: number; note: number; url: number };
}

/** Colar a lista (texto ou código) ou escolher um deck salvo, e enviar para a moderação. */
export function SubmitDeckForm({ eventId, playerId, admin, myDecks, limits }: Props) {
  const t = useTranslations("Submit");
  const tb = useTranslations("Builder");
  const [list, setList] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [res, setRes] = useState<SubmitResult | null>(null);

  const send = () =>
    start(async () => {
      setRes(await submitDeckAction({ eventId, playerId, list, sourceUrl, note }));
    });

  const errorText = (r: Extract<SubmitResult, { ok: false }>) => {
    switch (r.error) {
      case "unknownCards":
        return t("errors.unknownCards", { lines: r.lines.join(" · ") });
      case "invalid":
        return t("errors.invalid", { issue: tb(`issues.${r.issue.code}` as "issues.legendMissing", r.issue.params) });
      case "legendMismatch":
        return t("errors.legendMismatch", { list: r.list, registered: r.registered });
      default:
        return t(`errors.${r.error}`);
    }
  };

  if (res?.ok) {
    return (
      <div role="status" className="rounded-xl border border-good/40 bg-good/10 p-6">
        <p className="font-semibold text-good">{res.status === "approved" ? t("doneApproved") : t("donePending")}</p>
        <p className="mt-2 text-sm">
          <Link href={`/events/${eventId}/decks/cr-${res.id}`} className="text-accent underline">{t("openSubmission")}</Link>
          {" · "}
          <Link href="/account" className="text-accent underline">{t("mySubmissions")}</Link>
        </p>
      </div>
    );
  }

  const field = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-text";
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <h2 className="font-display text-xl font-semibold">{t("step2")}</h2>
      {myDecks.length > 0 && (
        <label className="block text-sm text-muted">
          {t("fromMyDecks")}
          <select className={field} defaultValue="" onChange={(e) => setList(myDecks.find((d) => d.id === e.target.value)?.code ?? list)}>
            <option value="">{t("pickDeck")}</option>
            {myDecks.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm text-muted">
        {t("listLabel")}
        <textarea value={list} onChange={(e) => setList(e.target.value)} maxLength={limits.list} rows={12} required placeholder={t("listPlaceholder")} className={`${field} font-mono text-xs`} />
        <span className="mt-1 block text-xs">{t("listHelp")}</span>
      </label>
      <label className="block text-sm text-muted">
        {t("sourceLabel")}
        <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} maxLength={limits.url} placeholder="https://" className={field} />
        <span className="mt-1 block text-xs">{t("sourceHelp")}</span>
      </label>
      <label className="block text-sm text-muted">
        {t("noteLabel")}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={limits.note} rows={2} className={field} />
      </label>
      <p className="text-xs text-muted">{admin ? t("adminNote") : t("moderationNote")}</p>
      {res && !res.ok && (
        <p role="alert" className="rounded-md bg-bad/15 px-3 py-2 text-sm text-bad">{errorText(res)}</p>
      )}
      <button disabled={pending || !list.trim()} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
        {pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
