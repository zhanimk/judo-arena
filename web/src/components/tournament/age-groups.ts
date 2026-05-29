export interface AgeGroupPreset {
  key: string;
  labelKk: string;
  labelRu: string;
  ageMin: number;
  ageMax: number;
  matchDurationSec: number;
  goldenScoreSec: number;
  weights: { MALE: number[]; FEMALE: number[] };
}

export const AGE_GROUPS: AgeGroupPreset[] = [
  {
    key: "u11",
    labelKk: "Мектеп жасы (U11)",
    labelRu: "Школьники (U11)",
    ageMin: 9, ageMax: 11,
    matchDurationSec: 60, goldenScoreSec: 30,
    weights: {
      MALE:   [26, 30, 34, 38, 42, 46, 50, 55, Infinity],
      FEMALE: [24, 27, 30, 34, 38, 42, 46, Infinity],
    },
  },
  {
    key: "u13",
    labelKk: "Кіші жасөспірімдер (U13)",
    labelRu: "Мл. юноши (U13)",
    ageMin: 11, ageMax: 13,
    matchDurationSec: 90, goldenScoreSec: 45,
    weights: {
      MALE:   [30, 34, 38, 42, 46, 50, 55, 60, Infinity],
      FEMALE: [27, 30, 34, 38, 42, 46, 50, Infinity],
    },
  },
  {
    key: "u15",
    labelKk: "Жасөспірімдер (U15)",
    labelRu: "Кадеты (U15)",
    ageMin: 13, ageMax: 15,
    matchDurationSec: 120, goldenScoreSec: 60,
    weights: {
      MALE:   [34, 38, 42, 46, 50, 55, 60, 66, 73, Infinity],
      FEMALE: [30, 34, 38, 42, 46, 52, 57, 63, Infinity],
    },
  },
  {
    key: "u17",
    labelKk: "Жасөспірімдер (U17)",
    labelRu: "Юноши (U17)",
    ageMin: 15, ageMax: 17,
    matchDurationSec: 180, goldenScoreSec: 90,
    weights: {
      MALE:   [46, 50, 55, 60, 66, 73, 81, 90, Infinity],
      FEMALE: [40, 44, 48, 52, 57, 63, 70, Infinity],
    },
  },
  {
    key: "u21",
    labelKk: "Жас ересектер (U21)",
    labelRu: "Юниоры (U21)",
    ageMin: 18, ageMax: 20,
    matchDurationSec: 240, goldenScoreSec: 0,
    weights: {
      MALE:   [60, 66, 73, 81, 90, 100, Infinity],
      FEMALE: [48, 52, 57, 63, 70, 78, Infinity],
    },
  },
  {
    key: "senior",
    labelKk: "Ересектер",
    labelRu: "Взрослые",
    ageMin: 18, ageMax: 99,
    matchDurationSec: 240, goldenScoreSec: 0,
    weights: {
      MALE:   [60, 66, 73, 81, 90, 100, Infinity],
      FEMALE: [48, 52, 57, 63, 70, 78, Infinity],
    },
  },
  {
    key: "masters",
    labelKk: "Ардагерлер",
    labelRu: "Ветераны",
    ageMin: 30, ageMax: 99,
    matchDurationSec: 180, goldenScoreSec: 90,
    weights: {
      MALE:   [60, 66, 73, 81, 90, 100, Infinity],
      FEMALE: [48, 52, 57, 63, 70, 78, Infinity],
    },
  },
];

export function wRange(prev: number, curr: number): { min: number; max: number } {
  return { min: prev, max: curr === Infinity ? 999 : curr };
}

export function wLabel(min: number, max: number): string {
  if (max >= 999) return `+${Math.floor(min)}`;
  return `-${max}`;
}

export function buildWeightCategories(
  preset: AgeGroupPreset,
  gender: "MALE" | "FEMALE",
  tournamentYear: number,
) {
  const weights = preset.weights[gender];
  const gStr = gender === "MALE" ? "Ер" : "Қыз";
  return weights.map((w, i) => {
    const { min, max } = wRange(i === 0 ? 0 : weights[i - 1], w);
    const label = wLabel(min, max);
    const birthFrom = tournamentYear - preset.ageMax;
    const birthTo   = tournamentYear - preset.ageMin;
    return {
      name: {
        kk: `${preset.labelKk} ${gStr} ${label} кг`,
        ru: `${preset.labelRu} ${gender === "MALE" ? "Муж" : "Жен"} ${label} кг`,
      },
      gender,
      ageMin:  preset.ageMin,
      ageMax:  preset.ageMax,
      weightMin: min,
      weightMax: max,
      matchDurationSec: preset.matchDurationSec,
      goldenScoreSec:   preset.goldenScoreSec,
      format: "SE_IJF",
      _birthRange: `${birthFrom}–${birthTo} жж.`,
    };
  });
}
