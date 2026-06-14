/**
 * Unit tests for IJF match-scoring pure functions.
 *
 * osaekomiScore() is exported from match.service and contains zero side-effects —
 * no Prisma, no I/O. Tests run instantly with no mocks required.
 *
 * Coverage:
 *   • Hold-down (osaekomi) time thresholds per IJF rules
 *   • YUKO gate (allowYuko flag for legacy categories)
 *   • Exact boundary values (4 s, 5 s, 9 s, 10 s, 19 s, 20 s)
 */

import { describe, it, expect } from "vitest";
import { osaekomiScore } from "../../src/services/match.service.js";
import { ijfMatchDuration, IJF_CATEGORIES } from "../../src/services/tournament.service.js";

describe("osaekomiScore() — IJF hold-down thresholds", () => {
  // ── No score ───────────────────────────────────────────────────────────────

  it("returns null for 0 seconds", () => {
    expect(osaekomiScore(0, true)).toBeNull();
    expect(osaekomiScore(0, false)).toBeNull();
  });

  it("returns null for 1–4 seconds regardless of allowYuko", () => {
    for (const sec of [1, 2, 3, 4]) {
      expect(osaekomiScore(sec, true)).toBeNull();
      expect(osaekomiScore(sec, false)).toBeNull();
    }
  });

  // ── YUKO gate (5–9 s) ─────────────────────────────────────────────────────

  it("returns YUKO for 5 s when allowYuko is enabled", () => {
    expect(osaekomiScore(5, true)).toEqual({ type: "YUKO" });
  });

  it("returns YUKO for 6–9 s when allowYuko is enabled", () => {
    for (const sec of [6, 7, 8, 9]) {
      expect(osaekomiScore(sec, true)).toEqual({ type: "YUKO" });
    }
  });

  it("returns null for 5–9 s when allowYuko is DISABLED (modern IJF rules)", () => {
    for (const sec of [5, 6, 7, 8, 9]) {
      expect(osaekomiScore(sec, false)).toBeNull();
    }
  });

  // ── WAZA_ARI (10–19 s) ────────────────────────────────────────────────────

  it("returns WAZA_ARI at exactly 10 seconds", () => {
    expect(osaekomiScore(10, true)).toEqual({ type: "WAZA_ARI" });
    expect(osaekomiScore(10, false)).toEqual({ type: "WAZA_ARI" });
  });

  it("returns WAZA_ARI for 11–19 seconds", () => {
    for (const sec of [11, 12, 15, 18, 19]) {
      expect(osaekomiScore(sec, true)).toEqual({ type: "WAZA_ARI" });
      expect(osaekomiScore(sec, false)).toEqual({ type: "WAZA_ARI" });
    }
  });

  // ── IPPON (20+ s) — instant win ──────────────────────────────────────────

  it("returns IPPON at exactly 20 seconds", () => {
    expect(osaekomiScore(20, true)).toEqual({ type: "IPPON" });
    expect(osaekomiScore(20, false)).toEqual({ type: "IPPON" });
  });

  it("returns IPPON for any duration ≥ 20 s", () => {
    for (const sec of [21, 25, 30, 60]) {
      expect(osaekomiScore(sec, true)).toEqual({ type: "IPPON" });
      expect(osaekomiScore(sec, false)).toEqual({ type: "IPPON" });
    }
  });

  // ── Boundary precision ────────────────────────────────────────────────────

  it("transitions from YUKO to WAZA_ARI at exactly 10 s (allowYuko on)", () => {
    expect(osaekomiScore(9, true)).toEqual({ type: "YUKO" });
    expect(osaekomiScore(10, true)).toEqual({ type: "WAZA_ARI" });
  });

  it("transitions from WAZA_ARI to IPPON at exactly 20 s", () => {
    expect(osaekomiScore(19, true)).toEqual({ type: "WAZA_ARI" });
    expect(osaekomiScore(20, true)).toEqual({ type: "IPPON" });
  });

  it("IPPON takes priority over WAZA_ARI at 20 s even with allowYuko off", () => {
    expect(osaekomiScore(19, false)).toEqual({ type: "WAZA_ARI" });
    expect(osaekomiScore(20, false)).toEqual({ type: "IPPON" });
  });
});

// ─── ijfMatchDuration — длительность матча по возрасту ───────────────────────

describe("ijfMatchDuration() — IJF age-based match duration", () => {
  it("returns 120 s (2 min) for ageMax ≤ 12 (юные)", () => {
    expect(ijfMatchDuration(10)).toBe(120);
    expect(ijfMatchDuration(12)).toBe(120);
  });

  it("returns 180 s (3 min) for ageMax 13–14 (Youth U15)", () => {
    expect(ijfMatchDuration(13)).toBe(180);
    expect(ijfMatchDuration(14)).toBe(180);
  });

  it("returns 240 s (4 min) for ageMax ≥ 15 (Cadet, Junior, Senior)", () => {
    expect(ijfMatchDuration(15)).toBe(240);
    expect(ijfMatchDuration(17)).toBe(240);
    expect(ijfMatchDuration(21)).toBe(240);
    expect(ijfMatchDuration(99)).toBe(240);
  });
});

// ─── IJF_CATEGORIES — стандартные весовые категории ─────────────────────────

describe("IJF_CATEGORIES — стандартные категории IJF", () => {
  it("Senior Men: 7 весовых категорий (-60 до +100)", () => {
    expect(IJF_CATEGORIES.SENIOR_MEN).toHaveLength(7);
    expect(IJF_CATEGORIES.SENIOR_MEN.every((c) => c.gender === "MALE")).toBe(true);
    expect(IJF_CATEGORIES.SENIOR_MEN.every((c) => c.matchDurationSec === 240)).toBe(true);
    expect(IJF_CATEGORIES.SENIOR_MEN.every((c) => !c.allowYuko)).toBe(true);
  });

  it("Senior Women: 7 весовых категорий (-48 до +78)", () => {
    expect(IJF_CATEGORIES.SENIOR_WOMEN).toHaveLength(7);
    expect(IJF_CATEGORIES.SENIOR_WOMEN[0]!.weightMax).toBe(48);
    expect(IJF_CATEGORIES.SENIOR_WOMEN[6]!.weightMax).toBe(999); // открытая
  });

  it("Cadet Men U18: 7 категорий, длительность 4 мин", () => {
    expect(IJF_CATEGORIES.CADET_MEN).toHaveLength(7);
    expect(IJF_CATEGORIES.CADET_MEN.every((c) => c.ageMax === 17)).toBe(true);
  });

  it("Youth Boys U15: 9 категорий, длительность 3 мин, Юко разрешено", () => {
    expect(IJF_CATEGORIES.YOUTH_BOYS).toHaveLength(9);
    expect(IJF_CATEGORIES.YOUTH_BOYS.every((c) => c.matchDurationSec === 180)).toBe(true);
    expect(IJF_CATEGORIES.YOUTH_BOYS.every((c) => c.allowYuko)).toBe(true);
  });

  it("Youth Girls U15: 9 категорий", () => {
    expect(IJF_CATEGORIES.YOUTH_GIRLS).toHaveLength(9);
    expect(IJF_CATEGORIES.YOUTH_GIRLS[0]!.weightMax).toBe(32);
  });

  it("все весовые диапазоны не перекрываются внутри группы", () => {
    for (const group of Object.values(IJF_CATEGORIES)) {
      const sorted = [...group].sort((a, b) => a.weightMin - b.weightMin);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.weightMin).toBeGreaterThanOrEqual(sorted[i - 1]!.weightMax);
      }
    }
  });

  it("первая категория в каждой группе начинается с weightMin=0", () => {
    for (const [key, group] of Object.entries(IJF_CATEGORIES)) {
      const sorted = [...group].sort((a, b) => a.weightMin - b.weightMin);
      expect(sorted[0]!.weightMin, `${key}: weightMin первой категории`).toBe(0);
    }
  });

  it("последняя категория в каждой группе — открытая (weightMax=999)", () => {
    for (const [key, group] of Object.entries(IJF_CATEGORIES)) {
      const sorted = [...group].sort((a, b) => a.weightMax - b.weightMax);
      expect(sorted[sorted.length - 1]!.weightMax, `${key}: последняя категория`).toBe(999);
    }
  });
});

// ─── osaekomiScore — дополнительные граничные случаи ─────────────────────────

describe("osaekomiScore() — edge cases and type stability", () => {
  it("returns null for negative seconds", () => {
    expect(osaekomiScore(-1, true)).toBeNull();
    expect(osaekomiScore(-100, false)).toBeNull();
  });

  it("returns null for fractional values below 5", () => {
    expect(osaekomiScore(4.9, true)).toBeNull();
    expect(osaekomiScore(4.999, false)).toBeNull();
  });

  it("returns YUKO at exactly 5.0 (allowYuko=true)", () => {
    expect(osaekomiScore(5.0, true)).toEqual({ type: "YUKO" });
  });

  it("YUKO → WAZA_ARI boundary: 9.99 is YUKO, 10.0 is WAZA_ARI (allowYuko on)", () => {
    expect(osaekomiScore(9.99, true)).toEqual({ type: "YUKO" });
    expect(osaekomiScore(10.0, true)).toEqual({ type: "WAZA_ARI" });
  });

  it("WAZA_ARI → IPPON boundary: 19.99 is WAZA_ARI, 20.0 is IPPON", () => {
    expect(osaekomiScore(19.99, true)).toEqual({ type: "WAZA_ARI" });
    expect(osaekomiScore(20.0, true)).toEqual({ type: "IPPON" });
  });

  it("without YUKO: 5-9s returns null, 10s returns WAZA_ARI immediately", () => {
    expect(osaekomiScore(5, false)).toBeNull();
    expect(osaekomiScore(9.99, false)).toBeNull();
    expect(osaekomiScore(10, false)).toEqual({ type: "WAZA_ARI" });
  });

  it("result type is always an object with exactly one 'type' key", () => {
    const nonNull = [5, 10, 15, 20, 30];
    for (const sec of nonNull) {
      const result = osaekomiScore(sec, true);
      expect(result).not.toBeNull();
      if (result) {
        expect(Object.keys(result)).toEqual(["type"]);
        expect(typeof result.type).toBe("string");
      }
    }
  });
});

// ─── ijfMatchDuration — дополнительные граничные значения ────────────────────

describe("ijfMatchDuration() — additional boundaries", () => {
  it("0 years → 120s (youngest group)", () => {
    expect(ijfMatchDuration(0)).toBe(120);
  });

  it("exactly 12 → 120s (still in youngest group)", () => {
    expect(ijfMatchDuration(12)).toBe(120);
  });

  it("exactly 13 → 180s (Youth U15 group starts)", () => {
    expect(ijfMatchDuration(13)).toBe(180);
  });

  it("exactly 14 → 180s (last year in U15 group)", () => {
    expect(ijfMatchDuration(14)).toBe(180);
  });

  it("exactly 15 → 240s (Cadet and above)", () => {
    expect(ijfMatchDuration(15)).toBe(240);
  });

  it("large ageMax (100+) → still 240s", () => {
    expect(ijfMatchDuration(100)).toBe(240);
    expect(ijfMatchDuration(200)).toBe(240);
  });
});
