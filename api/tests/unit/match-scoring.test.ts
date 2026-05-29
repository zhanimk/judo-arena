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
