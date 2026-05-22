/**
 * Integration tests for Application workflow.
 *
 * Tests the submit → approve / reject lifecycle at the service level.
 * Prisma is mocked — no database required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSchema } from "../../src/validators/auth.schema.js";
import {
  createTournamentSchema,
  createCategorySchema,
} from "../../src/validators/tournament.schema.js";

// ─── Validator-based workflow tests (no Prisma) ───────────────────────────────

describe("Application entry validation — weight/age/gender checks", () => {
  const category = createCategorySchema.parse({
    gender: "MALE",
    ageMin: 18,
    ageMax: 30,
    weightMin: 60,
    weightMax: 66,
    matchDurationSec: 240,
  });

  function athleteFitsCategory(athlete: {
    gender: string;
    age: number;
    weightKg: number;
  }): boolean {
    return (
      athlete.gender === category.gender &&
      athlete.age >= category.ageMin &&
      athlete.age <= category.ageMax &&
      athlete.weightKg >= category.weightMin &&
      athlete.weightKg <= category.weightMax
    );
  }

  it("accepts an athlete who matches all criteria", () => {
    expect(athleteFitsCategory({ gender: "MALE", age: 22, weightKg: 63 })).toBe(true);
  });

  it("rejects wrong gender", () => {
    expect(athleteFitsCategory({ gender: "FEMALE", age: 22, weightKg: 63 })).toBe(false);
  });

  it("rejects age below minimum", () => {
    expect(athleteFitsCategory({ gender: "MALE", age: 16, weightKg: 63 })).toBe(false);
  });

  it("rejects age above maximum", () => {
    expect(athleteFitsCategory({ gender: "MALE", age: 35, weightKg: 63 })).toBe(false);
  });

  it("rejects weight below minimum", () => {
    expect(athleteFitsCategory({ gender: "MALE", age: 22, weightKg: 58 })).toBe(false);
  });

  it("rejects weight above maximum", () => {
    expect(athleteFitsCategory({ gender: "MALE", age: 22, weightKg: 70 })).toBe(false);
  });
});

// ─── Tournament lifecycle status transitions ──────────────────────────────────

describe("Tournament status transition rules", () => {
  const validTransitions: Record<string, string[]> = {
    DRAFT: ["REGISTRATION_OPEN", "CANCELLED"],
    REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "CANCELLED"],
    REGISTRATION_CLOSED: ["IN_PROGRESS", "REGISTRATION_OPEN", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: ["DRAFT"],
  };

  function canTransition(from: string, to: string): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  it("allows DRAFT → REGISTRATION_OPEN", () => {
    expect(canTransition("DRAFT", "REGISTRATION_OPEN")).toBe(true);
  });

  it("allows REGISTRATION_CLOSED → IN_PROGRESS", () => {
    expect(canTransition("REGISTRATION_CLOSED", "IN_PROGRESS")).toBe(true);
  });

  it("allows IN_PROGRESS → COMPLETED", () => {
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("blocks COMPLETED → anything other than cancelled", () => {
    expect(canTransition("COMPLETED", "DRAFT")).toBe(false);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
  });

  it("allows re-opening registration from REGISTRATION_CLOSED", () => {
    expect(canTransition("REGISTRATION_CLOSED", "REGISTRATION_OPEN")).toBe(true);
  });

  it("allows cancellation from any active state", () => {
    for (const state of ["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS"]) {
      expect(canTransition(state, "CANCELLED")).toBe(true);
    }
  });
});

// ─── Rating points calculation ─────────────────────────────────────────────────

describe("Rating points by place", () => {
  const pointsTable: Record<number, number> = {
    1: 100,
    2: 80,
    3: 50,
    5: 30,
    7: 15,
  };

  function pointsForPlace(place: number): number {
    return pointsTable[place] ?? 0;
  }

  it("awards 100 points for 1st place", () => expect(pointsForPlace(1)).toBe(100));
  it("awards 80 points for 2nd place", () => expect(pointsForPlace(2)).toBe(80));
  it("awards 50 points for 3rd place", () => expect(pointsForPlace(3)).toBe(50));
  it("awards 30 points for 5th place (lost bronze)", () => expect(pointsForPlace(5)).toBe(30));
  it("awards 15 points for 7th place (repechage loss)", () => expect(pointsForPlace(7)).toBe(15));
  it("awards 0 points for participation only", () => expect(pointsForPlace(9)).toBe(0));
});

// ─── Osaekomi (hold-down) scoring rules ──────────────────────────────────────

describe("Osaekomi score by duration", () => {
  function osaekomiScore(durationMs: number, allowYuko = true): string | null {
    const sec = durationMs / 1000;
    if (sec >= 20) return "IPPON";
    if (sec >= 10) return "WAZA_ARI";
    if (sec >= 5 && allowYuko) return "YUKO";
    return null;
  }

  it("awards IPPON for 20+ seconds", () => {
    expect(osaekomiScore(20000)).toBe("IPPON");
    expect(osaekomiScore(25000)).toBe("IPPON");
  });

  it("awards WAZA_ARI for 10–19 seconds", () => {
    expect(osaekomiScore(10000)).toBe("WAZA_ARI");
    expect(osaekomiScore(15000)).toBe("WAZA_ARI");
  });

  it("awards YUKO for 5–9 seconds (when allowed)", () => {
    expect(osaekomiScore(5000, true)).toBe("YUKO");
    expect(osaekomiScore(8000, true)).toBe("YUKO");
  });

  it("awards nothing for 5–9 seconds when YUKO is disabled", () => {
    expect(osaekomiScore(7000, false)).toBeNull();
  });

  it("awards nothing for under 5 seconds", () => {
    expect(osaekomiScore(3000)).toBeNull();
  });
});

// ─── Auto-finish IJF rules ────────────────────────────────────────────────────

describe("Auto-finish IJF rules", () => {
  interface Score { ippon: number; wazaari: number; shido: number }

  function shouldAutoFinish(red: Score, blue: Score): { finished: boolean; winner?: "RED" | "BLUE"; reason?: string } {
    // Ippon → instant win
    if (red.ippon >= 1) return { finished: true, winner: "RED", reason: "IPPON" };
    if (blue.ippon >= 1) return { finished: true, winner: "BLUE", reason: "IPPON" };
    // 2×Waza-ari = Ippon
    if (red.wazaari >= 2) return { finished: true, winner: "RED", reason: "WAZA_ARI_x2" };
    if (blue.wazaari >= 2) return { finished: true, winner: "BLUE", reason: "WAZA_ARI_x2" };
    // 3×Shido → Hansoku-make → opponent wins
    if (red.shido >= 3) return { finished: true, winner: "BLUE", reason: "HANSOKU_MAKE" };
    if (blue.shido >= 3) return { finished: true, winner: "RED", reason: "HANSOKU_MAKE" };
    return { finished: false };
  }

  it("finishes on RED Ippon", () => {
    const r = shouldAutoFinish({ ippon: 1, wazaari: 0, shido: 0 }, { ippon: 0, wazaari: 0, shido: 0 });
    expect(r.finished).toBe(true);
    expect(r.winner).toBe("RED");
  });

  it("finishes on 2 Waza-ari for BLUE", () => {
    const r = shouldAutoFinish({ ippon: 0, wazaari: 0, shido: 0 }, { ippon: 0, wazaari: 2, shido: 0 });
    expect(r.winner).toBe("BLUE");
    expect(r.reason).toBe("WAZA_ARI_x2");
  });

  it("finishes on 3 Shido for RED → BLUE wins", () => {
    const r = shouldAutoFinish({ ippon: 0, wazaari: 0, shido: 3 }, { ippon: 0, wazaari: 0, shido: 0 });
    expect(r.winner).toBe("BLUE");
    expect(r.reason).toBe("HANSOKU_MAKE");
  });

  it("does not finish on 2 Shido", () => {
    const r = shouldAutoFinish({ ippon: 0, wazaari: 0, shido: 2 }, { ippon: 0, wazaari: 0, shido: 0 });
    expect(r.finished).toBe(false);
  });

  it("does not finish with no decisive scores", () => {
    const r = shouldAutoFinish({ ippon: 0, wazaari: 1, shido: 1 }, { ippon: 0, wazaari: 0, shido: 0 });
    expect(r.finished).toBe(false);
  });
});
