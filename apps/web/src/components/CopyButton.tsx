"use client";

import { useState } from "react";

export function CopyButton({ value, label, done, className }: { value: string; label: string; done: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        } catch {
          // Sem permissão de área de transferência: o código continua visível na página.
        }
      }}
    >
      {ok ? done : label}
    </button>
  );
}
