/**
 * Single Elimination + IJF Repechage.
 *
 * Структура матчей:
 *   - bracketSection "main"      — основная сетка (раунды 1..log2(size))
 *   - bracketSection "repechage" — зона переигровок (только для size >= 8)
 *   - bracketSection "bronze1"   — 1-я бронза
 *   - bracketSection "bronze2"   — 2-я бронза
 *   - bracketSection "final"     — финал
 *
 * Spec в координатах (round, position):
 *   main:
 *     round 1: position 0 .. size/2 - 1
 *     round 2: position 0 .. size/4 - 1
 *     ...
 *     round R: position 0 (это полуфинал, R = log2(size) - 1)
 *     round R+1 (=final): тоже в section "final", position 0
 *
 *   Победитель матча (round r, position p) идёт в матч (round r+1, position floor(p/2)),
 *   слот: red если p чётный, blue если p нечётный.
 *
 *   IJF Repechage (для size >= 8):
 *     Проигравшие в 1/4 финала (round=R-1) идут в repechage.
 *     Repechage A: ((R-1, 0) loser) vs ((R-1, 1) loser) → победитель в Bronze1
 *     Repechage B: ((R-1, 2) loser) vs ((R-1, 3) loser) → победитель в Bronze2
 *     Bronze1: winner(RepA) vs loser(semi1)
 *     Bronze2: winner(RepB) vs loser(semi2)
 */

export interface SEMatch {
  round: number;
  position: number;
  bracketSection: "main" | "repechage" | "bronze1" | "bronze2" | "final";
  redAthleteId: string | null;
  blueAthleteId: string | null;
}

export function buildSingleElimination(slots: (string | null)[]): SEMatch[] {
  const size = slots.length;
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error("Размер сетки должен быть степенью двойки ≥ 2");
  }

  const matches: SEMatch[] = [];
  const totalRounds = Math.log2(size); // size=8 → 3 раунда (1/4, 1/2, финал)
  // round-1 = первый раунд; finalRound = totalRounds; semis = totalRounds - 1; quarters = totalRounds - 2

  // ---- Основная сетка ----
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = size / Math.pow(2, round);
    for (let position = 0; position < matchesInRound; position++) {
      const isFinal = round === totalRounds;
      const section: SEMatch["bracketSection"] = isFinal ? "final" : "main";

      let red: string | null = null;
      let blue: string | null = null;
      if (round === 1) {
        red = slots[position * 2]!;
        blue = slots[position * 2 + 1]!;
      }
      matches.push({ round, position, bracketSection: section, redAthleteId: red, blueAthleteId: blue });
    }
  }

  // ---- Repechage + бронзовые матчи (только для size >= 8) ----
  if (size >= 8) {
    const quartersRound = totalRounds - 2; // round полуфинала -1
    // У нас 4 проигравших в 1/4 финала: positions 0..3 в round=quartersRound
    // Repechage A (left half): loser(0) vs loser(1)
    // Repechage B (right half): loser(2) vs loser(3)
    matches.push({
      round: quartersRound + 1, // используем тот же round что и полуфиналы, для удобства схемы
      position: 0,
      bracketSection: "repechage",
      redAthleteId: null,
      blueAthleteId: null,
    });
    matches.push({
      round: quartersRound + 1,
      position: 1,
      bracketSection: "repechage",
      redAthleteId: null,
      blueAthleteId: null,
    });

    // Bronze матчи (на финальной волне, чтобы провести параллельно)
    matches.push({
      round: totalRounds,
      position: 0,
      bracketSection: "bronze1",
      redAthleteId: null,
      blueAthleteId: null,
    });
    matches.push({
      round: totalRounds,
      position: 1,
      bracketSection: "bronze2",
      redAthleteId: null,
      blueAthleteId: null,
    });
  }
  // Для size=4: одна бронза по упрощённой схеме (loser(SF1) vs loser(SF2))
  if (size === 4) {
    matches.push({
      round: 2,
      position: 0,
      bracketSection: "bronze1",
      redAthleteId: null,
      blueAthleteId: null,
    });
  }

  return matches;
}

/**
 * После завершения матча — куда отправляется победитель и проигравший?
 *
 * @returns массив инструкций "поставить athleteId в match (round, position, section) на слот red|blue"
 */
export function propagateResult(
  finishedRound: number,
  finishedPosition: number,
  finishedSection: SEMatch["bracketSection"],
  winnerId: string,
  loserId: string,
  bracketSize: number,
): Propagation[] {
  const totalRounds = Math.log2(bracketSize);
  const out: Propagation[] = [];

  // ---- Основная сетка ----
  if (finishedSection === "main") {
    const nextRound = finishedRound + 1;
    const nextPosition = Math.floor(finishedPosition / 2);
    const slot: "red" | "blue" = finishedPosition % 2 === 0 ? "red" : "blue";
    const nextSection: SEMatch["bracketSection"] = nextRound === totalRounds ? "final" : "main";
    out.push({ round: nextRound, position: nextPosition, section: nextSection, slot, athleteId: winnerId });

    // Repechage routing: проигравший 1/4 финала идёт в Repechage A или B
    const quartersRound = totalRounds - 2;
    if (bracketSize >= 8 && finishedRound === quartersRound) {
      // positions 0,1 → Repechage A (position 0); positions 2,3 → Repechage B (position 1)
      const repPosition = finishedPosition < 2 ? 0 : 1;
      const repSlot: "red" | "blue" = finishedPosition % 2 === 0 ? "red" : "blue";
      out.push({
        round: quartersRound + 1,
        position: repPosition,
        section: "repechage",
        slot: repSlot,
        athleteId: loserId,
      });
    }

    // Проигравший полуфинала идёт в Bronze1 / Bronze2
    const semisRound = totalRounds - 1;
    if (bracketSize >= 8 && finishedRound === semisRound) {
      // position 0 → Bronze1, position 1 → Bronze2
      // Слот: blue (red — победитель из Repechage)
      const bronzeSection: SEMatch["bracketSection"] = finishedPosition === 0 ? "bronze1" : "bronze2";
      out.push({
        round: totalRounds,
        position: finishedPosition,
        section: bronzeSection,
        slot: "blue",
        athleteId: loserId,
      });
    }

    // size=4: проигравшие полуфиналов идут в single bronze
    if (bracketSize === 4 && finishedRound === 1) {
      out.push({
        round: 2,
        position: 0,
        section: "bronze1",
        slot: finishedPosition === 0 ? "red" : "blue",
        athleteId: loserId,
      });
    }
  }

  // ---- Repechage → Bronze ----
  if (finishedSection === "repechage") {
    const bronzeSection: SEMatch["bracketSection"] = finishedPosition === 0 ? "bronze1" : "bronze2";
    out.push({
      round: totalRounds,
      position: finishedPosition,
      section: bronzeSection,
      slot: "red",
      athleteId: winnerId,
    });
  }

  // ---- Финал и бронзы — конечные точки, дальше не идём ----

  return out;
}

export interface Propagation {
  round: number;
  position: number;
  section: SEMatch["bracketSection"];
  slot: "red" | "blue";
  athleteId: string;
}

/**
 * Вычисление мест после всех завершённых матчей основной сетки + бронз + финала.
 * Возвращает { athleteId → place } для 1, 2, 3, 3, 5, 5, 7, 7 (если хватает участников).
 */
export interface PlacementInput {
  finalWinnerId?: string;
  finalLoserId?: string;
  bronze1WinnerId?: string;
  bronze2WinnerId?: string;
  // Проигравшие repechage = места 5
  rep1LoserId?: string;
  rep2LoserId?: string;
  // Проигравшие 1/4 (которые не дошли до repechage — для size=4 это не применимо)
  // По правилам IJF: проигравшие первого раунда (1/8 или раньше) → место 7+
}

export function computePlaces(input: PlacementInput): Record<string, number> {
  const places: Record<string, number> = {};
  if (input.finalWinnerId) places[input.finalWinnerId] = 1;
  if (input.finalLoserId) places[input.finalLoserId] = 2;
  if (input.bronze1WinnerId) places[input.bronze1WinnerId] = 3;
  if (input.bronze2WinnerId) places[input.bronze2WinnerId] = 3;
  if (input.rep1LoserId) places[input.rep1LoserId] = 5;
  if (input.rep2LoserId) places[input.rep2LoserId] = 5;
  return places;
}
