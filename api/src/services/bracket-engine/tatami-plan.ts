export type TatamiPlanGender = "MALE" | "FEMALE";

export interface TatamiPlanMatch {
  id: string;
  bracketSection: string | null;
  round: number;
  position: number;
}

export interface TatamiPlanCategory {
  bracketId: string;
  categoryId: string;
  gender: TatamiPlanGender;
  ageMin: number;
  ageMax: number;
  weightMin: number;
  weightMax: number;
  matches: TatamiPlanMatch[];
}

export interface TatamiAssignment {
  matchId: string;
  tatamiNumber: number;
  queuePosition: number;
}

export interface TatamiLoad {
  tatamiNumber: number;
  matches: number;
  categories: number;
}

export interface TatamiCategoryPlacement {
  bracketId: string;
  categoryId: string;
  tatamiNumber: number;
  matches: number;
}

export function planTatamiAssignments(categories: TatamiPlanCategory[], tatamiCount: number) {
  const safeTatamiCount = Math.max(1, Math.floor(tatamiCount || 1));
  const loads: TatamiLoad[] = Array.from({ length: safeTatamiCount }, (_, index) => ({
    tatamiNumber: index + 1,
    matches: 0,
    categories: 0,
  }));
  const placements: TatamiCategoryPlacement[] = [];
  const assignments: TatamiAssignment[] = [];

  const orderedCategories = [...categories]
    .filter((category) => category.matches.length > 0)
    .sort(compareCategories);

  for (const category of orderedCategories) {
    const load = [...loads].sort((a, b) => a.matches - b.matches || a.categories - b.categories || a.tatamiNumber - b.tatamiNumber)[0]!;
    const orderedMatches = [...category.matches].sort(compareMatches);

    load.categories += 1;
    placements.push({
      bracketId: category.bracketId,
      categoryId: category.categoryId,
      tatamiNumber: load.tatamiNumber,
      matches: orderedMatches.length,
    });

    for (const match of orderedMatches) {
      load.matches += 1;
      assignments.push({
        matchId: match.id,
        tatamiNumber: load.tatamiNumber,
        queuePosition: load.matches,
      });
    }
  }

  return { assignments, loads, categories: placements };
}

export function compareCategories(a: TatamiPlanCategory, b: TatamiPlanCategory): number {
  return (
    a.ageMin - b.ageMin ||
    a.ageMax - b.ageMax ||
    genderOrder(a.gender) - genderOrder(b.gender) ||
    a.weightMin - b.weightMin ||
    a.weightMax - b.weightMax
  );
}

export function compareMatches(a: TatamiPlanMatch, b: TatamiPlanMatch): number {
  return (
    sectionOrder(a.bracketSection) - sectionOrder(b.bracketSection) ||
    a.round - b.round ||
    a.position - b.position
  );
}

function genderOrder(gender: TatamiPlanGender): number {
  return gender === "MALE" ? 1 : 2;
}

function sectionOrder(section: string | null): number {
  const order: Record<string, number> = {
    main: 1,
    repechage: 2,
    bronze1: 3,
    bronze2: 3,
    final: 4,
  };
  return section ? order[section] ?? 9 : 9;
}
