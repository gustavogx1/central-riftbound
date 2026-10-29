import { describe, expect, it } from "vitest";
import { matchCard, parseCardQuery } from "../cards/query";
import { decodeDeck, encodeDeck } from "./codes";
import { addCard, defaultZone, energyCurve, moveCard, removeCard } from "./edit";
import { copyLimit, mainCount, validateDeck } from "./rules";
import { deckToText, textToDeck } from "./text";
import { emptyDeck, type DeckList, type PoolCard } from "./types";

/** Cartas fictícias com a forma das reais (nada do banco de cartas entra no git). */
function card(code: string, over: Partial<PoolCard> = {}): PoolCard {
  return {
    id: code.toLowerCase(),
    code,
    codes: [code, `${code}a`],
    name: `Card ${code}`,
    subtitle: null,
    type: "Unit",
    supertypes: [],
    tags: [],
    domains: ["Fury"],
    energyCost: 2,
    powerCost: null,
    might: 2,
    rulesText: "",
    setId: code.slice(0, 3),
    number: Number(code.slice(4)) || 0,
    rarity: "Common",
    ...over,
  };
}

const legend = card("OGN-247", { type: "Legend", name: "Void Daughter", tags: ["Kaisa"], domains: ["Fury", "Mind"], energyCost: null, might: null });
const champion = card("OGN-103", { name: "Kaisa", subtitle: "Survivor", supertypes: ["Champion"], tags: ["Kaisa"], domains: ["Mind"] });
const fury = card("OGN-007", { type: "Rune", name: "Fury Rune", supertypes: ["Basic"], energyCost: null, might: null });
const mind = card("OGN-089", { type: "Rune", name: "Mind Rune", supertypes: ["Basic"], domains: ["Mind"], energyCost: null, might: null });
const fields = ["OGN-280", "OGN-288", "OGN-292"].map((c) => card(c, { type: "Battlefield", domains: [], energyCost: null, might: null }));
const triples = ["OGN-004", "OGN-009", "OGN-012", "OGN-027", "OGN-029", "OGN-087", "OGN-095", "OGN-096", "OGN-104", "OGN-116"].map((c) => card(c));
const doubles = ["OGN-039", "OGN-122", "OGN-248"].map((c) => card(c, { type: "Spell", might: null }));
const single = card("OGN-013", { type: "Gear", might: null });
const side = ["OGN-022", "OGN-024", "OGN-093", "OGN-088", "OGN-114"].map((c) => card(c, { type: "Spell", domains: ["Mind"], might: null }));
const extra = {
  calm: card("OGN-050", { domains: ["Calm"], name: "Calm Thing" }),
  signature: card("OGN-060", { type: "Spell", supertypes: ["Signature"], tags: ["Kaisa"], name: "Void Spell" }),
  otherSignature: card("OGN-061", { type: "Spell", supertypes: ["Signature"], tags: ["Jinx"], name: "Rocket" }),
  unique: card("SFD-190", { type: "Gear", name: "Cape", rulesText: "[Unique] (Your deck can have only 1 card with this name.)" }),
  swarm: card("VEN-097", { name: "Spider", rulesText: "Your deck can have any number of cards named Spider." }),
  banned: card("OGN-070", { type: "Spell", name: "Called Shot" }),
  neutral: card("RAD-167", { name: "Mimic", domains: [], rulesText: "If Mimic is in your deck, choose 3 different legends in addition to your starting legend." }),
  legend2: card("OGN-251", { type: "Legend", name: "Loose Cannon", tags: ["Jinx"], domains: ["Fury", "Chaos"] }),
  legend3: card("OGN-253", { type: "Legend", name: "Hand of Noxus", tags: ["Darius"], domains: ["Fury", "Order"] }),
  legend4: card("OGN-255", { type: "Legend", name: "Nine-Tailed Fox", tags: ["Ahri"], domains: ["Calm", "Mind"] }),
};
const all = [legend, champion, fury, mind, ...fields, ...triples, ...doubles, single, ...side, ...Object.values(extra)];
const pool = new Map(all.map((c) => [c.id, c]));

function kaisa(): DeckList {
  const d = emptyDeck();
  d.legend = legend.id;
  d.champion = champion.id;
  d.main[champion.id] = 2;
  for (const c of triples) d.main[c.id] = 3;
  for (const c of doubles) d.main[c.id] = 2;
  d.main[single.id] = 1;
  d.runes = { [fury.id]: 7, [mind.id]: 5 };
  d.battlefields = fields.map((c) => c.id);
  d.side = { [side[0]!.id]: 2, [side[1]!.id]: 2, [side[2]!.id]: 2, [side[3]!.id]: 1, [side[4]!.id]: 1 };
  return d;
}

const codes = (d: DeckList) => validateDeck(d, pool).map((i) => i.code);

describe("validação do deck", () => {
  it("aceita um deck de torneio completo", () => {
    expect(mainCount(kaisa())).toBe(40);
    expect(validateDeck(kaisa(), pool)).toEqual([]);
  });

  it("pede exatamente 40 no torneio e pelo menos 40 no casual", () => {
    const d = kaisa();
    d.main[extra.neutral.id] = 0;
    d.main[triples[0]!.id] = 2;
    expect(codes(d)).toContain("mainExact");
    d.main[triples[0]!.id] = 3;
    d.main[extra.swarm.id] = 5;
    expect(codes(d)).toContain("mainExact");
    expect(validateDeck(d, pool, "casual").map((i) => i.code)).not.toContain("mainMin");
  });

  it("limita cópias por nome, somando campeão e sideboard", () => {
    const d = kaisa();
    d.side[champion.id] = 1;
    expect(codes(d)).toContain("copies");
  });

  it("respeita [Unique] e 'any number of cards named'", () => {
    expect(copyLimit(extra.unique)).toBe(1);
    expect(copyLimit(extra.swarm)).toBe(Infinity);
  });

  it("barra cartas fora da identidade de domínio, mas aceita as neutras", () => {
    const d = kaisa();
    d.main[triples[0]!.id] = 2;
    d.main[extra.calm.id] = 1;
    expect(codes(d)).toContain("domain");
    d.main[extra.calm.id] = 0;
    delete d.main[extra.calm.id];
    d.main[extra.neutral.id] = 1;
    expect(codes(d)).not.toContain("domain");
  });

  it("confere o campeão escolhido, as assinaturas, runas, campos e banidas", () => {
    const d = kaisa();
    d.champion = triples[0]!.id;
    expect(codes(d)).toContain("championInvalid");
    const e = kaisa();
    e.main[extra.otherSignature.id] = 1;
    e.main[extra.signature.id] = 3;
    e.main[extra.banned.id] = 1;
    e.runes[fury.id] = 8;
    e.battlefields = [fields[0]!.id, fields[0]!.id, fields[1]!.id];
    expect(codes(e)).toEqual(expect.arrayContaining(["signatureTag", "signatures", "banned", "runes", "battlefieldDuplicate"]));
    expect(validateDeck(e, pool, "casual").map((i) => i.code)).not.toContain("banned");
  });

  it("pede 3 lendas extras com nomes diferentes quando a carta manda", () => {
    const d = kaisa();
    d.main[triples[0]!.id] = 2;
    d.main[extra.neutral.id] = 1;
    expect(codes(d)).toContain("extraLegends");
    d.extraLegends = [extra.legend2.id, extra.legend3.id, extra.legend4.id];
    expect(codes(d)).not.toContain("extraLegends");
  });
});

describe("códigos de deck", () => {
  // Exemplo do README de @piltoverarchive/riftbound-deck-codes (versão 2, sem campeão marcado).
  const PA = "CIAAAAAAAAAQCAAAA4AACAIAABMQAAILAAAAICIMDMOVOX3AM5UHIAIDAAACO6XYAEAQKAAABX3QDGACUABKIAQAAEBQAAAWDBOQCAQAABMHE";
  const unmarked = () => {
    const d = kaisa();
    d.champion = null;
    d.main[champion.id] = 3;
    return d;
  };

  it("gera o mesmo código do Piltover Archive", () => {
    // A biblioteca hoje grava a versão 3: mesmo corpo, mais o bloco do campeão no fim.
    expect(encodeDeck(unmarked(), pool).slice(2).startsWith(PA.slice(2))).toBe(true);
    expect(encodeDeck(kaisa(), pool).slice(2).startsWith(PA.slice(2))).toBe(true);
  });

  it("lê o código de volta no mesmo deck", () => {
    expect(decodeDeck(PA, pool)).toEqual({ deck: unmarked(), unknown: [] });
    expect(decodeDeck(encodeDeck(kaisa(), pool), pool)).toEqual({ deck: kaisa(), unknown: [] });
  });

  it("lê variantes como a carta base e avisa o que não conhece", () => {
    const d = emptyDeck();
    d.legend = legend.id;
    d.main[triples[0]!.id] = 3;
    const code = encodeDeck(d, pool);
    const short = new Map(pool);
    short.delete(triples[0]!.id);
    expect(decodeDeck(code, short).unknown).toEqual(["OGN-004"]);
  });

  it("leva as lendas extras junto", () => {
    const d = kaisa();
    d.extraLegends = [extra.legend2.id, extra.legend3.id, extra.legend4.id];
    expect(decodeDeck(encodeDeck(d, pool), pool).deck.extraLegends).toEqual(d.extraLegends);
  });
});

describe("lista em texto", () => {
  it("exporta e importa sem perder nada", () => {
    const text = deckToText(kaisa(), pool);
    expect(text).toContain("Legend:\n1 Kaisa, Void Daughter");
    expect(text).toContain("Champion:\n1 Kaisa, Survivor");
    expect(textToDeck(text, pool)).toEqual({ deck: kaisa(), unknown: [] });
  });

  it("aceita '3x Nome', 'Nome x3', códigos e listas sem cabeçalho", () => {
    const { deck, unknown } = textToDeck("1 Void Daughter\n3x Card OGN-004\nCard OGN-009 x2\n7 OGN-007\nSideboard:\n1 OGN-022a\nnão existe", pool);
    expect(deck.legend).toBe(legend.id);
    expect(deck.main).toEqual({ [triples[0]!.id]: 3, [triples[1]!.id]: 2 });
    expect(deck.runes).toEqual({ [fury.id]: 7 });
    expect(deck.side).toEqual({ [side[0]!.id]: 1 });
    expect(unknown).toEqual(["não existe"]);
  });
});

describe("busca com sintaxe", () => {
  const find = (q: string) => all.filter((c) => matchCard(c, parseCardQuery(q))).map((c) => c.code);

  it("filtra por tipo, domínio, custo e texto", () => {
    expect(find("t:legend d:mind")).toEqual(["OGN-247", "OGN-255"]);
    expect(find("t:champion")).toEqual(["OGN-103"]);
    expect(find('o:"any number"')).toEqual(["VEN-097"]);
    expect(find("t:gear c<=2 -is:unique")).toEqual(["OGN-013"]);
  });

  it("aceita identidade, OU, negação e nomes em português", () => {
    expect(find("id:fury+mind t:spell -is:signature tag:kaisa")).toEqual([]);
    expect(find("t:feitiço d:mente")).toEqual(side.map((c) => c.code));
    expect(find("is:banned or is:unique")).toEqual(["SFD-190", "OGN-070"].sort((a, b) => all.findIndex((c) => c.code === a) - all.findIndex((c) => c.code === b)));
    expect(find("d:none t:unit")).toEqual(["RAD-167"]);
  });

  it("aponta o que não entendeu", () => {
    expect(parseCardQuery("c<abc d:roxo xyz<3").errors).toEqual(["c<abc", "d:roxo", "xyz<3"]);
  });
});

describe("edição do deck", () => {
  it("manda cada carta para a zona certa e troca o campeão sem perder cópias", () => {
    let d = emptyDeck();
    d = addCard(d, legend, defaultZone(legend, d, pool));
    expect(d.legend).toBe(legend.id);
    d = addCard(d, champion, defaultZone(champion, d, pool));
    expect(d.champion).toBe(champion.id);
    d = addCard(d, champion, defaultZone(champion, d, pool));
    expect(d.main).toEqual({ [champion.id]: 1 });
    d = addCard(d, fury, defaultZone(fury, d, pool));
    d = addCard(d, fields[0]!, "battlefields");
    d = addCard(d, fields[0]!, "battlefields");
    expect(d.battlefields).toEqual([fields[0]!.id]);
    d = removeCard(d, champion.id, "champion");
    expect(d.champion).toBe(champion.id);
    expect(d.main).toEqual({});
    d = addCard(d, triples[0]!, "main");
    d = moveCard(d, triples[0]!.id, "main");
    expect(d.side).toEqual({ [triples[0]!.id]: 1 });
    expect(energyCurve(kaisa(), pool)[2]).toBe(40);
  });
});
