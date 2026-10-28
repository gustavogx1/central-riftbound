export function makeFormat(locale: string) {
  const pct = (v: number | null | undefined, digits = 1) =>
    v === null || v === undefined ? "—" : new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  const num = (v: number) => new Intl.NumberFormat(locale).format(v);
  const dec = (v: number, digits = 2) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  const date = (d: Date | string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(d));
  return { pct, num, dec, date };
}
