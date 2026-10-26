import { describe, expect, it } from "vitest";
import {
  birthYearBounds,
  fitsBirthYears,
  isAdult,
  tournamentYear,
} from "../../src/services/category-age.js";
import { createCategorySchema } from "../../src/validators/tournament.schema.js";

describe("sporting age and independent registration", () => {
  it("uses the tournament year in Kazakhstan at the year boundary", () => {
    expect(tournamentYear(new Date("2026-12-31T20:00:00Z"))).toBe(2027);
    expect(
      birthYearBounds({ ageMin: 18, ageMax: 22 }, new Date("2027-03-01")),
    ).toEqual({ birthYearMin: 2005, birthYearMax: 2009 });
  });
  it("keeps historical birth years even if the calendar or event date changes", () => {
    const category = {
      ageMin: 18,
      ageMax: 22,
      birthYearMin: 2004,
      birthYearMax: 2008,
    };
    expect(
      fitsBirthYears(new Date("2008-12-31"), category, new Date("2030-01-01")),
    ).toBe(true);
    expect(
      fitsBirthYears(new Date("2009-01-01"), category, new Date("2030-01-01")),
    ).toBe(false);
    expect(fitsBirthYears(null, category, new Date())).toBe(false);
  });
  it("requires completed 18 years independently of sporting eligibility", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    expect(isAdult(new Date("2008-10-17"), now)).toBe(true);
    expect(isAdult(new Date("2008-10-18"), now)).toBe(false);
    expect(isAdult(null, now)).toBe(false);
  });
  it("rejects finite Golden Score limits", () => {
    const base = {
      gender: "MALE",
      ageMin: 18,
      ageMax: 22,
      weightMin: 0,
      weightMax: 60,
    };
    expect(
      createCategorySchema.safeParse({ ...base, goldenScoreSec: 90 }).success,
    ).toBe(false);
    expect(createCategorySchema.parse(base).goldenScoreSec).toBe(0);
  });
});
