/**
 * Seeding: посев участников с разделением одноклубников.
 *
 * Алгоритм:
 *   1. Fisher-Yates shuffle (детерминированный с seed для воспроизводимости).
 *   2. Эвристика: жадно расставляем по слотам так, чтобы одноклубники
 *      попадали в РАЗНЫЕ четверти / половины сетки (минимизируем шанс
 *      ранней встречи).
 */

export interface Seedable {
  id: string;
  clubId: string | null;
}

/** Создать ГПСЧ с детерминированным seed (LCG алгоритм). */
function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function fisherYatesShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Расставить участников по слотам сетки с разделением одноклубников.
 *
 * @param athletes  список участников с clubId
 * @param size      размер сетки (степень двойки: 4, 8, 16, 32, 64)
 * @param seed      seed для ГПСЧ (для воспроизводимости — кладём в БД)
 * @returns         массив длины size: slot → athleteId | null (null = BYE)
 */
export function seedAthletes(athletes: Seedable[], size: number, seed: number): (string | null)[] {
  if (athletes.length > size) {
    throw new Error(`Слишком много участников (${athletes.length}) для сетки размера ${size}`);
  }

  const rng = createRng(seed);
  // Группировка по клубу
  const byClub = new Map<string | null, Seedable[]>();
  for (const a of athletes) {
    const key = a.clubId;
    if (!byClub.has(key)) byClub.set(key, []);
    byClub.get(key)!.push(a);
  }
  // Перемешиваем участников внутри каждого клуба
  for (const [k, list] of byClub.entries()) {
    byClub.set(k, fisherYatesShuffle(list, rng));
  }

  // Сортируем клубы по размеру (большие первыми — им сложнее развести)
  const clubBuckets = Array.from(byClub.entries()).sort((a, b) => b[1].length - a[1].length);

  // Стратегия размещения: чередуем "четверти" сетки.
  // Для size=8 четверти это слоты [0,1] [2,3] [4,5] [6,7]
  // Для size=16: [0..3] [4..7] [8..11] [12..15]
  // Для size=4: [0,1] [2,3] (две половины, четвертей нет)
  const quartersCount = size <= 4 ? 2 : 4;
  const quarterSize = size / quartersCount;
  const quarters: ((string | null) | undefined)[][] = Array.from({ length: quartersCount }, () => []);

  // Раунд-робин по четвертям, начиная с самого крупного клуба
  for (const [, athletesOfClub] of clubBuckets) {
    // Стартуем со случайной четверти, чтобы не было всегда одной и той же
    const startQ = Math.floor(rng() * quartersCount);
    for (let i = 0; i < athletesOfClub.length; i++) {
      // Выбираем четверть с наименьшим числом этого клуба и в которой ещё есть место
      let bestQ = -1;
      let bestScore = Infinity;
      for (let off = 0; off < quartersCount; off++) {
        const q = (startQ + off) % quartersCount;
        if (quarters[q]!.length >= quarterSize) continue;
        const sameClubCount = quarters[q]!.filter(
          (x) => x !== null && x !== undefined && athletesOfClub.find((a) => a.id === x),
        ).length;
        const score = sameClubCount * 100 + quarters[q]!.length;
        if (score < bestScore) {
          bestScore = score;
          bestQ = q;
        }
      }
      if (bestQ === -1) {
        throw new Error("Не удалось разместить участника — нет свободных слотов");
      }
      quarters[bestQ]!.push(athletesOfClub[i]!.id);
    }
  }

  // Дополняем BYE
  for (const q of quarters) {
    while (q!.length < quarterSize) q!.push(null);
  }

  // Внутри четверти — перемешиваем порядок, чтобы BYE не были в начале/конце
  const result: (string | null)[] = [];
  for (const q of quarters) {
    const shuffled = fisherYatesShuffle(q!.slice(), rng);
    result.push(...(shuffled as (string | null)[]));
  }

  return result;
}

/** Ближайшая степень двойки ≥ n (минимум 2). */
export function nextPowerOfTwo(n: number): number {
  if (n <= 2) return 2;
  let p = 2;
  while (p < n) p *= 2;
  return p;
}
