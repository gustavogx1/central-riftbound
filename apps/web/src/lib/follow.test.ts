import { describe, expect, it } from "vitest";
import { FOLLOW_MAX, parseFollow, serializeFollow, toggleFollow } from "./follow";

describe("follow", () => {
  it("lê o cookie e ignora lixo e repetidos", () => {
    expect(parseFollow("12.-5.abc.12.0")).toEqual([12, -5]);
    expect(parseFollow(undefined)).toEqual([]);
  });
  it("liga e desliga um jogador", () => {
    expect(toggleFollow([1, 2], 3)).toEqual([3, 1, 2]);
    expect(toggleFollow([1, 2], 1)).toEqual([2]);
  });
  it("respeita o limite", () => {
    const many = Array.from({ length: FOLLOW_MAX }, (_, i) => i + 1);
    expect(toggleFollow(many, 999)).toHaveLength(FOLLOW_MAX);
    expect(parseFollow(serializeFollow([4, 5]))).toEqual([4, 5]);
  });
});
