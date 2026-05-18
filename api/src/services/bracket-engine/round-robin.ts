/**
 * Round-Robin (круговая система).
 *
 * Каждый играет с каждым: N*(N-1)/2 матчей.
 * Используется метод "circle method" для расписания по турам (rounds).
 *
 * Тай-брейкеры (для финального ранжирования):
 *   1) Личная встреча (head-to-head)
 *   2) Сумма Ippon-побед
 *   3) Сумма Waza-ari
 *   4) Разница чистых очков (заработанные - полученные)
 *   5) Жребий
 */

export interface RRMatch {
  round: number;
  position: number;
  bracketSection: "main";
  redAthleteId: string;
  blueAthleteId: string;
}

/**
 * Генерация расписания Round-Robin.
 *
 * Используем circle method: если N нечётное, добавляем фейкового "BYE" игрока.
 * За N-1 (или N) туров каждый играет с каждым ровно один раз.
 */
export function buildRoundRobin(athleteIds: string[]): RRMatch[] {
  const n = athleteIds.length;
  if (n < 2) throw new Error("Для круговой системы нужно минимум 2 участника");
  if (n > 8) throw new Error("Round-Robin поддерживается для ≤ 8 участников");

  // Если нечётно — добавляем "BYE"
  const players = [...athleteIds];
  if (players.length % 2 === 1) players.push("__BYE__");
  const m = players.length;
  const rounds = m - 1;

  const matches: RRMatch[] = [];
  // Circle method: фиксируем игрока 0, остальные вращаются
  const rotating = players.slice(1); // [1..m-1]

  for (let r = 0; r < rounds; r++) {
    const roundPlayers = [players[0]!, ...rotating];
    let pos = 0;
    for (let i = 0; i < m / 2; i++) {
      const home = roundPlayers[i]!;
      const away = roundPlayers[m - 1 - i]!;
      if (home === "__BYE__" || away === "__BYE__") continue;
      matches.push({
        round: r + 1,
        position: pos++,
        bracketSection: "main",
        redAthleteId: home,
        blueAthleteId: away,
      });
    }
    // Поворот: последний элемент уходит в начало
    rotating.unshift(rotating.pop()!);
  }

  return matches;
}

/**
 * Подсчёт таблицы после всех матчей.
 *
 * @param matches  массив завершённых матчей с winnerId и scoreSnapshot
 * @returns        массив строк таблицы, отсортированный по местам с применением тай-брейкеров
 */
export interface RRMatchResult {
  redAthleteId: string;
  blueAthleteId: string;
  winnerId: string | null;       // null = ничья (редко в дзюдо, но возможно)
  redScore: { ippon: number; wazaari: number; shido: number; yuko?: number };
  blueScore: { ippon: number; wazaari: number; shido: number; yuko?: number };
}

export interface RRStanding {
  athleteId: string;
  wins: number;
  losses: number;
  draws: number;
  ipponTotal: number;
  wazaariTotal: number;
  netPoints: number;     // заработанные − полученные
  place: number;
}

export function computeStandings(
  athleteIds: string[],
  matches: RRMatchResult[],
): RRStanding[] {
  const stats = new Map<string, RRStanding>();
  for (const id of athleteIds) {
    stats.set(id, {
      athleteId: id,
      wins: 0,
      losses: 0,
      draws: 0,
      ipponTotal: 0,
      wazaariTotal: 0,
      netPoints: 0,
      place: 0,
    });
  }

  // Подсчёт W/L/D и agg-метрик
  for (const m of matches) {
    const red = stats.get(m.redAthleteId);
    const blue = stats.get(m.blueAthleteId);
    if (!red || !blue) continue;

    if (m.winnerId === null) {
      red.draws++;
      blue.draws++;
    } else if (m.winnerId === m.redAthleteId) {
      red.wins++;
      blue.losses++;
    } else {
      blue.wins++;
      red.losses++;
    }

    red.ipponTotal += m.redScore.ippon;
    blue.ipponTotal += m.blueScore.ippon;
    red.wazaariTotal += m.redScore.wazaari;
    blue.wazaariTotal += m.blueScore.wazaari;
    // "Чистые очки" — приближённый показатель: ippon=10, wazaari=7, yuko=5, shido=−1
    const score = (s: RRMatchResult["redScore"]) =>
      s.ippon * 10 + s.wazaari * 7 + (s.yuko ?? 0) * 5 - s.shido;
    red.netPoints += score(m.redScore) - score(m.blueScore);
    blue.netPoints += score(m.blueScore) - score(m.redScore);
  }

  const list = Array.from(stats.values());

  // Сортируем с учётом тай-брейкеров
  list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;

    // Тай-брейкер 1: личная встреча
    const direct = matches.find(
      (m) =>
        (m.redAthleteId === a.athleteId && m.blueAthleteId === b.athleteId) ||
        (m.redAthleteId === b.athleteId && m.blueAthleteId === a.athleteId),
    );
    if (direct && direct.winnerId) {
      if (direct.winnerId === a.athleteId) return -1;
      if (direct.winnerId === b.athleteId) return 1;
    }

    // Тай-брейкер 2: Ippon
    if (b.ipponTotal !== a.ipponTotal) return b.ipponTotal - a.ipponTotal;
    // Тай-брейкер 3: Waza-ari
    if (b.wazaariTotal !== a.wazaariTotal) return b.wazaariTotal - a.wazaariTotal;
    // Тай-брейкер 4: разница очков
    if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints;
    // Тай-брейкер 5: жребий — здесь стабильный порядок по id
    return a.athleteId.localeCompare(b.athleteId);
  });

  // Назначаем места
  list.forEach((s, idx) => (s.place = idx + 1));
  return list;
}
