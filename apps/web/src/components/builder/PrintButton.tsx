"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button onClick={() => window.print()} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
      {label}
    </button>
  );
}
