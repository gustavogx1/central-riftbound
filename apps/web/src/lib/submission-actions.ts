"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "./auth/server";
import { safeNext } from "./auth/next";
import { COMMUNITY_PREFIX } from "./event-decks";
import { deleteMySubmission, REJECT_REASONS, reviewSubmission, submitDeck, type RejectReason, type SubmitInput, type SubmitResult } from "./submissions";

/** Páginas que mostram as listas aprovadas de um evento e de uma lenda. */
function refresh(eventId: number, legend: string | null, id: string) {
  revalidatePath(`/[locale]/events/${eventId}`, "page");
  revalidatePath(`/[locale]/events/${eventId}/decks/${COMMUNITY_PREFIX}${id}`, "page");
  if (legend) revalidatePath(`/[locale]/legends/${legend}`, "page");
}

export async function submitDeckAction(input: SubmitInput): Promise<SubmitResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "login" };
  const res = await submitDeck(user, {
    eventId: Number(input.eventId),
    playerId: Number(input.playerId),
    list: String(input.list ?? ""),
    sourceUrl: input.sourceUrl ? String(input.sourceUrl) : undefined,
    note: input.note ? String(input.note) : undefined,
  });
  if (res.ok && res.status === "approved") refresh(Number(input.eventId), null, res.id);
  return res;
}

export async function reviewAction(form: FormData) {
  const user = await getSessionUser();
  const next = safeNext(String(form.get("next") ?? "/"));
  if (user?.admin) {
    const id = String(form.get("id") ?? "");
    const approve = form.get("decision") === "approve";
    const reason = String(form.get("reason") ?? "other");
    const res = await reviewSubmission(user.id, id, approve, (REJECT_REASONS as readonly string[]).includes(reason) ? (reason as RejectReason) : "other");
    if (res.ok) refresh(res.eventId, res.legend, id);
    else redirect(`${next}${next.includes("?") ? "&" : "?"}error=${res.error}`);
  }
  redirect(next);
}

export async function deleteSubmissionAction(form: FormData) {
  const user = await getSessionUser();
  const next = safeNext(String(form.get("next") ?? "/"));
  if (user) await deleteMySubmission(user.id, String(form.get("id") ?? ""));
  redirect(next);
}
