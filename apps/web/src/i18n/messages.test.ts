import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import pt from "../../messages/pt-BR.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)/g)].map((m) => m[1]!).sort();
}

describe("mensagens", () => {
  it("en e pt-BR têm exatamente as mesmas chaves", () => {
    expect(keys(pt).sort()).toEqual(keys(en).sort());
  });

  it("nenhuma tradução vazia e os mesmos placeholders", () => {
    const get = (obj: object, path: string) =>
      path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], obj) as string;
    for (const key of keys(en)) {
      const a = get(en, key);
      const b = get(pt, key);
      expect(b.trim(), key).not.toBe("");
      expect(placeholders(b), key).toEqual(placeholders(a));
    }
  });
});
