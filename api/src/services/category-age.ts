/** Sporting age uses the tournament's calendar year; saved bounds never roll over. */
export function tournamentYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Almaty",
      year: "numeric",
    }).format(date),
  );
}

export function birthYearBounds(
  category: {
    ageMin: number;
    ageMax: number;
    birthYearMin?: number | null;
    birthYearMax?: number | null;
  },
  startDate: Date,
) {
  const year = tournamentYear(startDate);
  return {
    birthYearMin: category.birthYearMin ?? year - category.ageMax,
    birthYearMax: category.birthYearMax ?? year - category.ageMin,
  };
}

export function fitsBirthYears(
  dob: Date | null,
  category: Parameters<typeof birthYearBounds>[0],
  startDate: Date,
): boolean {
  if (!dob) return false;
  const { birthYearMin, birthYearMax } = birthYearBounds(category, startDate);
  const year = dob.getUTCFullYear();
  return year >= birthYearMin && year <= birthYearMax;
}

/** Independent registration requires 18 completed years, separate from sporting age. */
export function isAdult(dob: Date | null, now = new Date()): boolean {
  if (!dob || dob > now) return false;
  const threshold = new Date(
    Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()),
  );
  return dob <= threshold;
}
