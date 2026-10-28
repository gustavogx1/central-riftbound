import { describe, expect, it } from "vitest";
import { tokenizeRulesText } from "./rules-text";

describe("tokenizeRulesText", () => {
  it("separa energia, poder de domínio e palavra-chave", () => {
    expect(tokenizeRulesText("[Accelerate] (You may pay [1 Energy][Fury Power] to have me enter ready.)")).toEqual([
      { kind: "keyword", name: "Accelerate", value: null },
      { kind: "text", value: " (You may pay " },
      { kind: "energy", amount: 1 },
      { kind: "power", domain: "Fury" },
      { kind: "text", value: " to have me enter ready.)" },
    ]);
  });

  it("lê palavra-chave com número, setas e ícones simples", () => {
    expect(tokenizeRulesText("[Level 6][>] [>>][Exhaust]: +2 [Might] [Any Power]")).toEqual([
      { kind: "keyword", name: "Level", value: 6 },
      { kind: "arrow", nested: false },
      { kind: "text", value: " " },
      { kind: "arrow", nested: true },
      { kind: "exhaust" },
      { kind: "text", value: ": +2 " },
      { kind: "might" },
      { kind: "text", value: " " },
      { kind: "power", domain: "Any" },
    ]);
  });

  it("texto sem marcadores vira um único pedaço", () => {
    expect(tokenizeRulesText("Draw 1.")).toEqual([{ kind: "text", value: "Draw 1." }]);
    expect(tokenizeRulesText("")).toEqual([]);
  });
});
