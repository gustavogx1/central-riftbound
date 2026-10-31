"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FOLLOW_COOKIE, parseFollow, serializeFollow, toggleFollow } from "@/lib/follow";

function readCookie(): number[] {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${FOLLOW_COOKIE}=`));
  return parseFollow(raw?.slice(FOLLOW_COOKIE.length + 1));
}

/** Coração de seguir/deixar de seguir. O estado inicial vem do servidor (que leu o cookie). */
export function FollowButton({ playerId, name, followed, refresh = false }: { playerId: number; name: string; followed: boolean; refresh?: boolean }) {
  const t = useTranslations("Event");
  const router = useRouter();
  const [on, setOn] = useState(followed);
  const [pending, start] = useTransition();

  const click = () => {
    const ids = toggleFollow(readCookie(), playerId);
    document.cookie = `${FOLLOW_COOKIE}=${serializeFollow(ids)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setOn(ids.includes(playerId));
    if (refresh) start(() => router.refresh());
  };
  const label = on ? t("unfollow", { player: name }) : t("follow", { player: name });

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition hover:bg-surface-2 ${on ? "text-bad" : "text-muted hover:text-text"}`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.9 3.8 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.5 0 5.7 3.4 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3Z" />
      </svg>
    </button>
  );
}
