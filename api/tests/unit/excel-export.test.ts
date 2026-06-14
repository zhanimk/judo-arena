import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    tournament: { findUnique: vi.fn() },
    applicationEntry: { findMany: vi.fn() },
    ratingEntry: { findMany: vi.fn() },
    match: { findMany: vi.fn() },
  },
}));

import { prisma } from "../../src/lib/prisma.js";
import { exportTournamentExcel } from "../../src/services/excel-export.service.js";

describe("exportTournamentExcel", () => {
  it("creates a valid three-sheet XLSX package with escaped data", async () => {
    vi.mocked(prisma.tournament.findUnique).mockResolvedValue({
      id: "t-1",
      name: { kk: "Judo & Arena" },
      startDate: new Date("2026-06-09T00:00:00Z"),
      categories: [],
    } as never);
    vi.mocked(prisma.applicationEntry.findMany).mockResolvedValue([
      {
        athlete: {
          surname: "Сәрсенов",
          name: "Әли <A>",
          surnameLatin: "Sarsenov",
          nameLatin: "Ali",
          gender: "MALE",
          dateOfBirth: new Date("2005-01-01T00:00:00Z"),
          weightKg: 73,
          beltRank: "BLACK",
          club: { name: { kk: "Алматы" }, city: "Алматы" },
        },
        category: {
          gender: "MALE",
          ageMin: 18,
          ageMax: 99,
          weightMin: 66,
          weightMax: 73,
        },
        weighInStatus: "PASSED",
      },
    ] as never);
    vi.mocked(prisma.ratingEntry.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.match.findMany).mockResolvedValue([] as never);

    const buffer = await exportTournamentExcel("t-1");
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file("xl/workbook.xml")).not.toBeNull();
    expect(zip.file("xl/styles.xml")).not.toBeNull();
    expect(zip.file("xl/worksheets/sheet1.xml")).not.toBeNull();
    expect(zip.file("xl/worksheets/sheet2.xml")).not.toBeNull();
    expect(zip.file("xl/worksheets/sheet3.xml")).not.toBeNull();

    const workbook = await zip.file("xl/workbook.xml")!.async("string");
    const participants = await zip
      .file("xl/worksheets/sheet1.xml")!
      .async("string");
    expect(workbook).toContain("Қатысушылар");
    expect(participants).toContain("Judo &amp; Arena");
    expect(participants).toContain("Әли &lt;A&gt;");
    expect(participants).toContain('autoFilter ref="A2:L3"');
  });
});
