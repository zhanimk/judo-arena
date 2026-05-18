/**
 * Тесты алгоритма посева (seeding) и Single Elimination.
 * Запуск: cd api && npm test
 */

import { describe, it, expect } from "vitest";
import { seedAthletes, nextPowerOfTwo } from "../seeding.js";
import { buildSingleElimination, propagateResult } from "../single-elimination.js";
import { buildRoundRobin, computeStandings } from "../round-robin.js";

describe("nextPowerOfTwo", () => {
  it("возвращает 2 для 0, 1, 2", () => {
    expect(nextPowerOfTwo(0)).toBe(2);
    expect(nextPowerOfTwo(1)).toBe(2);
    expect(nextPowerOfTwo(2)).toBe(2);
  });
  it("округляет вверх", () => {
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
    expect(nextPowerOfTwo(33)).toBe(64);
  });
});

describe("seedAthletes", () => {
  it("возвращает массив правильной длины с BYE-слотами", () => {
    const athletes = [
      { id: "a1", clubId: "c1" },
      { id: "a2", clubId: "c2" },
      { id: "a3", clubId: "c1" },
    ];
    const slots = seedAthletes(athletes, 4, 42);
    expect(slots).toHaveLength(4);
    expect(slots.filter((s) => s !== null)).toHaveLength(3);
    expect(slots.filter((s) => s === null)).toHaveLength(1);
  });

  it("разводит одноклубников по разным четвертям", () => {
    // 4 спортсмена одного клуба + 4 другого, сетка 8
    const sameClub = Array.from({ length: 4 }, (_, i) => ({ id: `a${i}`, clubId: "A" }));
    const otherClub = Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, clubId: "B" }));
    const slots = seedAthletes([...sameClub, ...otherClub], 8, 100);

    // Проверка: в каждой четверти (по 2 слота) одноклубники не должны встречаться
    for (let q = 0; q < 4; q++) {
      const quarter = slots.slice(q * 2, q * 2 + 2).filter(Boolean);
      const clubs = new Set(quarter.map((id) => id!.startsWith("a") ? "A" : "B"));
      expect(quarter.length <= 1 || clubs.size === quarter.length).toBe(true);
    }
  });

  it("детерминирован при одинаковом seed", () => {
    const ath = [
      { id: "a", clubId: "1" },
      { id: "b", clubId: "2" },
      { id: "c", clubId: "1" },
      { id: "d", clubId: "2" },
    ];
    const slots1 = seedAthletes(ath, 4, 12345);
    const slots2 = seedAthletes(ath, 4, 12345);
    expect(slots1).toEqual(slots2);
  });
});

describe("buildSingleElimination", () => {
  it("создаёт правильное число матчей для сетки 4", () => {
    const slots = ["a", "b", "c", "d"];
    const matches = buildSingleElimination(slots);
    // 2 матча первого раунда + финал + 1 бронза = 4
    expect(matches).toHaveLength(4);
    expect(matches.filter((m) => m.bracketSection === "main")).toHaveLength(2);
    expect(matches.filter((m) => m.bracketSection === "final")).toHaveLength(1);
    expect(matches.filter((m) => m.bracketSection === "bronze1")).toHaveLength(1);
  });

  it("создаёт правильное число матчей для сетки 8", () => {
    const slots = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const matches = buildSingleElimination(slots);
    // 4 + 2 + 1 = 7 в основной сетке (1/4 + 1/2 + финал) + 2 Repechage + 2 бронзы
    expect(matches.filter((m) => m.bracketSection === "main")).toHaveLength(6);
    expect(matches.filter((m) => m.bracketSection === "final")).toHaveLength(1);
    expect(matches.filter((m) => m.bracketSection === "repechage")).toHaveLength(2);
    expect(matches.filter((m) => m.bracketSection === "bronze1")).toHaveLength(1);
    expect(matches.filter((m) => m.bracketSection === "bronze2")).toHaveLength(1);
  });

  it("заполняет первый раунд участниками, последующие — пусто", () => {
    const slots = ["a", "b", "c", "d"];
    const matches = buildSingleElimination(slots);
    const round1 = matches.filter((m) => m.bracketSection === "main");
    expect(round1[0]!.redAthleteId).toBe("a");
    expect(round1[0]!.blueAthleteId).toBe("b");
    expect(round1[1]!.redAthleteId).toBe("c");
    expect(round1[1]!.blueAthleteId).toBe("d");
    // Финал пустой
    const final = matches.find((m) => m.bracketSection === "final");
    expect(final!.redAthleteId).toBeNull();
    expect(final!.blueAthleteId).toBeNull();
  });

  it("отказывает на не-степени двойки", () => {
    expect(() => buildSingleElimination(["a", "b", "c"])).toThrow();
  });
});

describe("propagateResult", () => {
  it("отправляет победителя в следующий матч", () => {
    // size=4, выиграл round=1 position=0
    const props = propagateResult(1, 0, "main", "winner-id", "loser-id", 4);
    const toFinal = props.find((p) => p.section === "final");
    expect(toFinal).toBeDefined();
    expect(toFinal!.athleteId).toBe("winner-id");
    expect(toFinal!.slot).toBe("red");
  });

  it("отправляет проигравшего полуфинала в bronze для size=8", () => {
    // size=8, полуфинал = round=2
    const props = propagateResult(2, 0, "main", "winner-id", "loser-id", 8);
    const toFinal = props.find((p) => p.section === "final");
    const toBronze = props.find((p) => p.section === "bronze1");
    expect(toFinal).toBeDefined();
    expect(toFinal!.athleteId).toBe("winner-id");
    expect(toBronze).toBeDefined();
    expect(toBronze!.athleteId).toBe("loser-id");
  });
});

describe("buildRoundRobin", () => {
  it("каждый играет с каждым", () => {
    const ath = ["a", "b", "c", "d"];
    const matches = buildRoundRobin(ath);
    // N*(N-1)/2 = 6 матчей
    expect(matches).toHaveLength(6);

    // Каждая пара должна встречаться ровно один раз
    const pairs = new Set<string>();
    for (const m of matches) {
      const key = [m.redAthleteId, m.blueAthleteId].sort().join(",");
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    }
    expect(pairs.size).toBe(6);
  });

  it("работает с нечётным числом участников (3)", () => {
    const matches = buildRoundRobin(["x", "y", "z"]);
    expect(matches).toHaveLength(3);
  });

  it("отказывает на 1 участнике", () => {
    expect(() => buildRoundRobin(["only-one"])).toThrow();
  });
});

describe("computeStandings", () => {
  it("распределяет места по победам", () => {
    const ath = ["a", "b", "c"];
    const matches = [
      { redAthleteId: "a", blueAthleteId: "b", winnerId: "a",
        redScore: { ippon: 1, wazaari: 0, shido: 0 }, blueScore: { ippon: 0, wazaari: 0, shido: 0 } },
      { redAthleteId: "a", blueAthleteId: "c", winnerId: "a",
        redScore: { ippon: 0, wazaari: 1, shido: 0 }, blueScore: { ippon: 0, wazaari: 0, shido: 0 } },
      { redAthleteId: "b", blueAthleteId: "c", winnerId: "b",
        redScore: { ippon: 0, wazaari: 1, shido: 0 }, blueScore: { ippon: 0, wazaari: 0, shido: 0 } },
    ];
    const standings = computeStandings(ath, matches);
    expect(standings[0]!.athleteId).toBe("a");
    expect(standings[0]!.place).toBe(1);
    expect(standings[1]!.athleteId).toBe("b");
    expect(standings[2]!.athleteId).toBe("c");
  });

  it("применяет тай-брейкер по личной встрече", () => {
    const ath = ["a", "b"];
    const matches = [
      { redAthleteId: "a", blueAthleteId: "b", winnerId: "b",
        redScore: { ippon: 0, wazaari: 0, shido: 0 }, blueScore: { ippon: 1, wazaari: 0, shido: 0 } },
    ];
    const s = computeStandings(ath, matches);
    expect(s[0]!.athleteId).toBe("b"); // выиграл — первый
    expect(s[1]!.athleteId).toBe("a");
  });
});
