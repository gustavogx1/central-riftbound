import { describe, expect, it, vi } from "vitest";

vi.mock("./queries", () => ({ METAGAMES: ["RAD", "VEN", "UNL", "SFD", "OGN"], getStatScopes: vi.fn() }));
const { pickScope } = await import("./scope");

const scopes = new Set(["RAD:showdown", "RAD:all", "VEN:main", "VEN:showdown", "VEN:all", "all:main", "all:showdown", "all:all"]);

describe("pickScope", () => {
  it("abre no set mais novo, nos Showdowns quando o set ainda não teve RQ", () => {
    expect(pickScope(scopes, undefined, undefined)).toMatchObject({ meta: "RAD", kind: "showdown", metagames: ["RAD", "VEN"] });
  });
  it("prefere RQs quando o set tem", () => {
    expect(pickScope(scopes, "VEN", undefined)).toMatchObject({ meta: "VEN", kind: "main" });
  });
  it("com só o tipo escolhido, acha o set mais novo com esse tipo", () => {
    expect(pickScope(scopes, undefined, "main")).toMatchObject({ meta: "VEN", kind: "main" });
  });
  it("respeita a escolha explícita mesmo sem dados", () => {
    expect(pickScope(scopes, "RAD", "main")).toMatchObject({ meta: "RAD", kind: "main", scope: "RAD:main" });
  });
  it("ignora valores inválidos", () => {
    expect(pickScope(scopes, "XYZ", "bogus")).toMatchObject({ meta: "RAD", kind: "showdown" });
  });
  it("sem nenhum dado cai em all:main", () => {
    expect(pickScope(new Set(), undefined, undefined)).toMatchObject({ meta: "all", kind: "main", metagames: [] });
  });
});
