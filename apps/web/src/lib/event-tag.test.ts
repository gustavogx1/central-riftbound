import { describe, expect, it } from "vitest";
import { eventStatusKey, venueDateTime } from "./event-tag";

describe("eventStatusKey", () => {
  it("traduz os status da UVS", () => {
    expect(eventStatusKey("complete")).toBe("statusComplete");
    expect(eventStatusKey("inProgress")).toBe("statusInProgress");
    expect(eventStatusKey("upcoming")).toBe("statusUpcoming");
    expect(eventStatusKey("weird")).toBeNull();
  });
});

describe("venueDateTime", () => {
  it("mostra a hora no fuso do local", () => {
    expect(venueDateTime("en-US", new Date("2026-10-31T13:30:00Z"), "America/New_York")).toBe("Sat, Oct 31, 2026 · 9:30 AM EDT");
  });
  it("ignora fuso inválido", () => {
    expect(venueDateTime("en-US", new Date(), "Not/AZone")).toBeNull();
  });
});
