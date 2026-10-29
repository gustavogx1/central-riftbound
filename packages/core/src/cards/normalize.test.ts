import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "./normalize";
import { slugify } from "./slug";
import type { RawCard } from "./types";

function raw(over: Partial<RawCard>): RawCard {
  return {
    id: "ogn-001-298", code: "OGN-001", name: "Blazing Scorcher", subtitle: "", set: "OGN", set_name: "Origins",
    collector_number: 1, public_code: "OGN-001/298", variant: "", rarity: "Common", type: "Unit", subtypes: "",
    tags: "Dragon / Noxus", domains: ["Fury"], energy_cost: "5", power_cost: "", might: "5", might_bonus: "",
    rules_text: "", effect_text: "", artist: "Envar Studio", orientation: "portrait", image_url: "", same_card_as: "",
    ...over,
  };
}

describe("normalizeCatalog", () => {
  const rows = [
    raw({}),
    raw({ id: "ogn-001a-298", code: "OGN-001a", public_code: "OGN-001a/298", variant: "alt art", same_card_as: "OGN-001/298", artist: "Outro" }),
    raw({ id: "ogn-247-298", code: "OGN-247", name: "Daughter of the Void", public_code: "OGN-247/298", type: "Legend", tags: "Kai'Sa", domains: ["Fury", "Mind"], energy_cost: "", might: "" }),
  ];
  const catalog = normalizeCatalog(rows, new Date("2026-10-28T00:00:00Z"));

  it("junta variantes na carta base", () => {
    expect(catalog.cards).toHaveLength(2);
    expect(catalog.prints).toHaveLength(3);
    expect(catalog.prints.find((p) => p.id === "ogn-001a-298")?.cardId).toBe("ogn-001-298");
  });

  it("converte números e listas", () => {
    const c = catalog.cards.find((x) => x.id === "ogn-001-298")!;
    expect(c).toMatchObject({ energyCost: 5, might: 5, powerCost: null, tags: ["Dragon", "Noxus"], domains: ["Fury"] });
  });

  it("cria lendas com slug do campeão + título", () => {
    expect(catalog.legends).toEqual([
      { slug: "kaisa-daughter-of-the-void", cardId: "ogn-247-298", champion: "Kai'Sa", title: "Daughter of the Void", domains: ["Fury", "Mind"] },
    ]);
  });

  it("preenche o domínio que a galeria manda vazio e respeita o da origem", () => {
    const c = normalizeCatalog([
      raw({ id: "rad-041-167", public_code: "RAD-041/167", set: "RAD", domains: [] }),
      raw({ id: "rad-006-167", public_code: "RAD-006/167", set: "RAD", domains: ["Body"] }),
      raw({ id: "rad-999-167", public_code: "RAD-999/167", set: "RAD", domains: ["Colorless"] }),
    ]);
    expect(c.cards.map((x) => x.domains)).toEqual([["Calm"], ["Body"], []]);
  });

  it("conta impressões por set", () => {
    expect(catalog.sets).toEqual([{ id: "OGN", name: "Origins", printCount: 3 }]);
  });

  it("liga variante sem same_card_as à impressão base de mesmo nome e texto", () => {
    const c = normalizeCatalog([
      raw({ rules_text: "Deal 3." }),
      raw({ id: "ogn-305s-298", code: "OGN-305", public_code: "OGN-305*/298", variant: "overnumbered, signed", rules_text: "Deal 3. (Reminder text.)" }),
      raw({ id: "ogn-305-298", code: "OGN-305", public_code: "OGN-305/298", variant: "overnumbered", same_card_as: "OGN-305*/298" }),
    ]);
    expect(c.cards).toHaveLength(1);
    expect(c.prints.map((p) => p.cardId)).toEqual(["ogn-001-298", "ogn-001-298", "ogn-001-298"]);
  });

  it("não junta campeões de mesmo nome com textos diferentes", () => {
    const c = normalizeCatalog([
      raw({ id: "ogn-110-298", code: "OGN-110", public_code: "OGN-110/298", name: "Ekko", rules_text: "[Accelerate] [Deathknell] — Recycle me to ready your runes." }),
      raw({ id: "rad-021a-167", code: "RAD-021a", public_code: "RAD-021a/167", set: "RAD", name: "Ekko", variant: "alt art", rules_text: "I enter ready. [Assault] [Action][>] Discard 1." }),
    ]);
    expect(c.cards).toHaveLength(2);
  });

  it("falha com same_card_as que não existe", () => {
    expect(() => normalizeCatalog([raw({ same_card_as: "XXX-1/1" })])).toThrow(/same_card_as/);
  });
});

describe("slugify", () => {
  it("remove acentos e apóstrofos", () => {
    expect(slugify("Kai'Sa, Daughter of the Void")).toBe("kaisa-daughter-of-the-void");
    expect(slugify("Dr. Mundo")).toBe("dr-mundo");
  });
});
