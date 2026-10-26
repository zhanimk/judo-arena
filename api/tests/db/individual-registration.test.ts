import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  db,
  cleanup,
  closeConnections,
  makeAdmin,
  makeAthlete,
  makeCategory,
  makeTournament,
  requireDb,
  trackId,
} from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";
import { registerIndividual } from "../../src/services/individual-registration.service.js";
import {
  getApplication,
  submit,
  approve,
  markPaymentPaid,
  removeEntry,
} from "../../src/services/application.service.js";
import {
  createCategory,
  updateCategory,
  updateTournament,
} from "../../src/services/tournament.service.js";
vi.mock("../../src/services/email.service.js", () => ({
  sendEmail: vi.fn(),
  applicationApprovedHtml: vi.fn(),
  applicationRejectedHtml: vi.fn(),
}));
vi.mock("../../src/services/notification.service.js", () => ({
  broadcast: vi.fn(),
}));
beforeAll(requireDb);
afterEach(cleanup);
afterAll(async () => {
  await prisma.$disconnect();
  await closeConnections();
});

async function setup({ fee = 0, child = false } = {}) {
  const admin = await makeAdmin();
  const t = await makeTournament(admin.id, { status: "REGISTRATION_OPEN" });
  await db.tournament.update({
    where: { id: t.id },
    data: {
      audience: child ? "CHILD" : "MIXED",
      selfRegistrationEnabled: !child,
      entryFeeKzt: fee,
    },
  });
  const cat = await makeCategory(t.id);
  const athlete = await makeAthlete();
  await db.user.update({
    where: { id: athlete.id },
    data: { gender: "MALE", weightKg: 65 },
  });
  return { admin, t, cat, athlete };
}
async function trackApplication(id: string) {
  trackId("application", id);
  for (const e of await db.applicationEntry.findMany({
    where: { applicationId: id },
  }))
    trackId("applicationEntry", e.id);
}

describe("independent and manual registration on PostgreSQL", () => {
  it.each(["ADULT", "MIXED"] as const)(
    "registers an adult without a club and enforces owner access (%s)",
    async (audience) => {
      const { t, cat, athlete } = await setup();
      await db.tournament.update({ where: { id: t.id }, data: { audience } });
      const app = await registerIndividual(athlete.id, t.id, cat.id);
      await trackApplication(app.id);
      expect(app).toMatchObject({
        clubId: null,
        applicantId: athlete.id,
        source: "SELF",
        status: "SUBMITTED",
        paymentStatus: "NOT_REQUIRED",
      });
      expect(app.entries[0].weighInStatus).toBe("PENDING");
      await expect(getApplication(athlete.id, app.id)).resolves.toMatchObject({
        id: app.id,
      });
      const other = await makeAthlete();
      await expect(getApplication(other.id, app.id)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    },
  );
  it("rejects child self-registration, including U23-style sporting eligibility", async () => {
    const { t, cat, athlete } = await setup();
    await db.user.update({
      where: { id: athlete.id },
      data: { dateOfBirth: new Date("2012-01-01") },
    });
    await db.category.update({
      where: { id: cat.id },
      data: { ageMin: 12, ageMax: 22 },
    });
    await expect(
      registerIndividual(athlete.id, t.id, cat.id),
    ).rejects.toMatchObject({ code: "ADULT_REQUIRED" });
    await db.tournament.update({
      where: { id: t.id },
      data: { audience: "CHILD", selfRegistrationEnabled: true },
    });
    await expect(
      registerIndividual(athlete.id, t.id, cat.id),
    ).rejects.toMatchObject({ code: "SELF_REGISTRATION_DISABLED" });
  });
  it("allows administrator manual children, without payment or weigh-in bypass", async () => {
    const { admin, t, cat, athlete } = await setup({ child: true, fee: 5000 });
    await db.user.update({
      where: { id: athlete.id },
      data: { dateOfBirth: new Date("2012-01-01") },
    });
    await db.category.update({
      where: { id: cat.id },
      data: { ageMin: 4, ageMax: 17 },
    });
    const app = await registerIndividual(admin.id, t.id, cat.id, {
      athleteId: athlete.id,
    });
    await trackApplication(app.id);
    expect(app).toMatchObject({
      source: "ADMIN",
      status: "SUBMITTED",
      paymentStatus: "PENDING",
      paymentAmountKzt: 5000,
    });
    await expect(approve(admin.id, app.id)).rejects.toMatchObject({
      code: "PAYMENT_REQUIRED",
    });
    await expect(
      removeEntry(athlete.id, app.id, app.entries[0].id),
    ).rejects.toMatchObject({ code: "LOCKED" });
    await markPaymentPaid(admin.id, app.id);
    await expect(approve(admin.id, app.id)).resolves.toMatchObject({
      status: "APPROVED",
    });
    expect(
      (
        await db.applicationEntry.findUniqueOrThrow({
          where: { id: app.entries[0].id },
        })
      ).weighInStatus,
    ).toBe("PENDING");
  });
  it("keeps a paid adult application draft until payment confirmation and submission", async () => {
    const { admin, t, cat, athlete } = await setup({ fee: 3000 });
    const app = await registerIndividual(athlete.id, t.id, cat.id);
    await trackApplication(app.id);
    expect(app.status).toBe("DRAFT");
    await expect(submit(athlete.id, app.id)).rejects.toMatchObject({
      code: "PAYMENT_REQUIRED",
    });
    await markPaymentPaid(admin.id, app.id);
    await expect(submit(athlete.id, app.id)).resolves.toMatchObject({
      status: "SUBMITTED",
    });
  });
  it("allows only one concurrent individual entry", async () => {
    const { t, cat, athlete } = await setup();
    const results = await Promise.allSettled([
      registerIndividual(athlete.id, t.id, cat.id),
      registerIndividual(athlete.id, t.id, cat.id),
    ]);
    const apps = await db.application.findMany({
      where: { tournamentId: t.id },
    });
    for (const a of apps) await trackApplication(a.id);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.applicationEntry.count({
        where: { athleteId: athlete.id, categoryId: cat.id },
      }),
    ).toBe(1);
  });
  it("creates an unaffiliated manual participant and rolls back a duplicate email", async () => {
    const { admin, t, cat, athlete } = await setup();
    const participant = {
      name: "Manual",
      surname: "Participant",
      gender: "MALE" as const,
      dateOfBirth: new Date("2000-01-01"),
      weightKg: 65,
    };
    const app = await registerIndividual(admin.id, t.id, cat.id, {
      participant,
    });
    await trackApplication(app.id);
    trackId("user", app.applicantId!);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: app.applicantId! } }))
        .clubId,
    ).toBeNull();
    await expect(
      registerIndividual(admin.id, t.id, cat.id, {
        participant: { ...participant, email: athlete.email },
      }),
    ).rejects.toMatchObject({ code: "REGISTRATION_CONFLICT" });
    expect(await db.application.count({ where: { tournamentId: t.id } })).toBe(
      1,
    );
  });
  it("blocks deadline, disabled methods and gender mismatch", async () => {
    const { admin, t, cat, athlete } = await setup();
    await db.tournament.update({
      where: { id: t.id },
      data: { selfRegistrationEnabled: false },
    });
    await expect(
      registerIndividual(athlete.id, t.id, cat.id),
    ).rejects.toMatchObject({ code: "SELF_REGISTRATION_DISABLED" });
    await db.tournament.update({
      where: { id: t.id },
      data: {
        selfRegistrationEnabled: true,
        applicationDeadline: new Date("2020-01-01"),
      },
    });
    await expect(
      registerIndividual(athlete.id, t.id, cat.id),
    ).rejects.toMatchObject({ code: "DEADLINE_PASSED" });
    await db.user.update({
      where: { id: athlete.id },
      data: { gender: "FEMALE" },
    });
    await expect(
      registerIndividual(admin.id, t.id, cat.id, { athleteId: athlete.id }),
    ).rejects.toMatchObject({ code: "GENDER_MISMATCH" });
  });
  it("rechecks administrator settings for an existing adult draft", async () => {
    const { t, cat, athlete } = await setup({ fee: 1000 });
    const app = await registerIndividual(athlete.id, t.id, cat.id);
    await trackApplication(app.id);
    await db.tournament.update({
      where: { id: t.id },
      data: { selfRegistrationEnabled: false },
    });
    await expect(submit(athlete.id, app.id)).rejects.toMatchObject({
      code: "REGISTRATION_METHOD_DISABLED",
    });
  });
  it("allows an adult to correct an entry before approval", async () => {
    const { t, cat, athlete } = await setup();
    const app = await registerIndividual(athlete.id, t.id, cat.id);
    await trackApplication(app.id);
    await removeEntry(athlete.id, app.id, app.entries[0].id);
    expect(
      (await db.application.findUniqueOrThrow({ where: { id: app.id } }))
        .status,
    ).toBe("DRAFT");
    const corrected = await registerIndividual(athlete.id, t.id, cat.id);
    await trackApplication(corrected.id);
    expect(corrected.status).toBe("SUBMITTED");
    expect(corrected.entries).toHaveLength(1);
  });
  it("rejects manual entries after a category draw exists", async () => {
    const { admin, t, cat, athlete } = await setup();
    const bracket = await db.bracket.create({
      data: {
        tournamentId: t.id,
        categoryId: cat.id,
        format: "SE_IJF",
        size: 4,
      },
    });
    trackId("bracket", bracket.id);
    await expect(
      registerIndividual(admin.id, t.id, cat.id, { athleteId: athlete.id }),
    ).rejects.toMatchObject({ code: "BRACKET_EXISTS" });
    expect(await db.application.count({ where: { tournamentId: t.id } })).toBe(
      0,
    );
  });
  it("freezes category birth years when tournament dates change", async () => {
    const admin = await makeAdmin();
    const t = await makeTournament(admin.id, {
      startDate: new Date("2027-06-01"),
      endDate: new Date("2027-06-02"),
    });
    const cat = await createCategory(t.id, {
      gender: "FEMALE",
      ageMin: 18,
      ageMax: 22,
      weightMin: 0,
      weightMax: 63,
      matchDurationSec: 240,
      goldenScoreSec: 0,
      format: "SE_IJF",
      allowYuko: false,
    });
    trackId("category", cat.id);
    expect(cat).toMatchObject({ birthYearMin: 2005, birthYearMax: 2009 });
    await updateTournament(t.id, {
      startDate: new Date("2028-06-01"),
      endDate: new Date("2028-06-02"),
    });
    expect(await updateCategory(cat.id, { weightMax: 70 })).toMatchObject({
      birthYearMin: 2005,
      birthYearMax: 2009,
    });
    await expect(updateCategory(cat.id, { ageMin: 30 })).rejects.toMatchObject({
      code: "INVALID_RANGE",
    });
  });
});
