import {
  ApplicationStatus,
  BracketFormat,
  ClubRole,
  Gender,
  Locale,
  MatchStatus,
  PaymentStatus,
  PrismaClient,
  TournamentStatus,
  UserDocumentType,
  UserRole,
  WeighInStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { prepareTournamentDraw } from "../src/services/bracket.service.js";

const prisma = new PrismaClient();
const PASSWORD = "password123";
const TOURNAMENT_ID = "mega-stress-test-2026";
const ENTRY_FEE_KZT = 5000;
const NUMBER_OF_CLUBS = 30;
const NUMBER_OF_ATHLETES = 1000;

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const FIRST_NAMES = ["Alikhan", "Nurbol", "Aigerim", "Zhanar", "Timur", "Ruslan", "Sanjar", "Aruzhan", "Dinara", "Miras"];
const SURNAMES = ["Sarsenov", "Kairatuly", "Nurlanov", "Bekzatov", "Aliev", "Zhumabekov", "Temirlanov"];

async function cleanDemoTournament() {
  const tId = TOURNAMENT_ID;
  await prisma.matchEvent.deleteMany({ where: { match: { tournamentId: tId } } });
  await prisma.judgeSession.deleteMany({ where: { match: { tournamentId: tId } } });
  await prisma.tatamiSession.deleteMany({ where: { tournamentId: tId } });
  await prisma.ratingEntry.deleteMany({ where: { tournamentId: tId } });
  await prisma.match.deleteMany({ where: { tournamentId: tId } });
  await prisma.bracket.deleteMany({ where: { tournamentId: tId } });
  await prisma.applicationEntry.deleteMany({ where: { application: { tournamentId: tId } } });
  await prisma.application.deleteMany({ where: { tournamentId: tId } });
  await prisma.category.deleteMany({ where: { tournamentId: tId } });
  await prisma.tournament.deleteMany({ where: { id: tId } });
  
  await prisma.user.deleteMany({ where: { email: { contains: "mega" } } });
  
  // Clean old demo tournament too
  const oldTId = "demo-complete-flow-2026";
  await prisma.matchEvent.deleteMany({ where: { match: { tournamentId: oldTId } } });
  await prisma.judgeSession.deleteMany({ where: { match: { tournamentId: oldTId } } });
  await prisma.tatamiSession.deleteMany({ where: { tournamentId: oldTId } });
  await prisma.ratingEntry.deleteMany({ where: { tournamentId: oldTId } });
  await prisma.match.deleteMany({ where: { tournamentId: oldTId } });
  await prisma.bracket.deleteMany({ where: { tournamentId: oldTId } });
  await prisma.applicationEntry.deleteMany({ where: { application: { tournamentId: oldTId } } });
  await prisma.application.deleteMany({ where: { tournamentId: oldTId } });
  await prisma.category.deleteMany({ where: { tournamentId: oldTId } });
  await prisma.tournament.deleteMany({ where: { id: oldTId } });
}

async function main() {
  console.log("Starting STRESS TEST mega seed...");
  await cleanDemoTournament();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.user.findUnique({ where: { email: "admin@judo-arena.kz" } });

  console.log("Creating 30 clubs...");
  const clubs = [];
  for (let i = 0; i < NUMBER_OF_CLUBS; i++) {
    const coachEmail = `coach.mega.${i}@judo-arena.kz`;
    const coach = await prisma.user.upsert({
      where: { email: coachEmail },
      update: { passwordHash, role: UserRole.COACH, isActive: true },
      create: {
        email: coachEmail,
        passwordHash,
        role: UserRole.COACH,
        name: `Coach${i}`,
        surname: "Mega",
        preferredLocale: Locale.ru,
        isActive: true,
      },
    });

    const clubId = `club-mega-${i}`;
    const club = await prisma.club.upsert({
      where: { id: clubId },
      update: { isActive: true },
      create: {
        id: clubId,
        name: { ru: `Mega Club ${i}` },
        shortName: `mega-${i}`,
        city: "Almaty",
        country: "KZ",
        createdById: coach.id,
      },
    });
    
    await prisma.user.update({
      where: { id: coach.id },
      data: { clubId: club.id, clubRole: ClubRole.OWNER },
    });
    clubs.push(club);
  }

  const tournament = await prisma.tournament.create({
    data: {
      id: TOURNAMENT_ID,
      name: { ru: "СТРЕСС ТЕСТ: 1000+ УЧАСТНИКОВ" },
      description: { ru: "Мега-турнир для проверки защиты и нагрузки" },
      location: "Mega Arena",
      city: "Алматы",
      startDate: new Date("2026-07-01T04:00:00.000Z"),
      endDate: new Date("2026-07-01T14:00:00.000Z"),
      applicationDeadline: new Date("2026-06-30T18:00:00.000Z"),
      status: TournamentStatus.REGISTRATION_CLOSED,
      tatamiCount: 15,
      entryFeeKzt: ENTRY_FEE_KZT,
      isFeatured: true,
      createdById: admin!.id,
    },
  });

  const CATEGORIES = [
    { id: "stress-cat-rr-4", name: { ru: "Девочки -52 кг (Круговая 4)" }, g: Gender.FEMALE, format: BracketFormat.ROUND_ROBIN, count: 4 },
    { id: "stress-cat-se-15", name: { ru: "Юноши -55 кг (SE 15)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 15 },
    { id: "stress-cat-se-60", name: { ru: "Юноши -60 кг (SE 60)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 60 },
    { id: "stress-cat-se-120", name: { ru: "Юноши -66 кг (SE 120)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 120 },
    { id: "stress-cat-se-100-1", name: { ru: "Абсолют Часть 1 (SE 100)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 100 },
    { id: "stress-cat-se-100-2", name: { ru: "Абсолют Часть 2 (SE 100)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 100 },
    { id: "stress-cat-se-100-3", name: { ru: "Абсолют Часть 3 (SE 100)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 100 },
    { id: "stress-cat-se-100-4", name: { ru: "Абсолют Часть 4 (SE 100)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 100 },
    { id: "stress-cat-se-100-5", name: { ru: "Абсолют Часть 5 (SE 100)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 100 },
    { id: "stress-cat-se-100-6", name: { ru: "Абсолют Часть 6 (SE 100)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 100 },
    { id: "stress-cat-se-100-7", name: { ru: "Абсолют Часть 7 (SE 101)" }, g: Gender.MALE, format: BracketFormat.SE_IJF, count: 101 },
  ];

  for (const cat of CATEGORIES) {
    await prisma.category.create({
      data: {
        id: cat.id,
        tournamentId: tournament.id,
        name: cat.name,
        gender: cat.g,
        ageMin: 10, ageMax: 20,
        weightMin: 0, weightMax: 100,
        matchDurationSec: 180,
        format: cat.format,
      },
    });
  }

  console.log(`Generating ${NUMBER_OF_ATHLETES} athletes...`);
  const applicationsByClub = new Map();
  for (const club of clubs) {
    const app = await prisma.application.create({
      data: {
        tournamentId: tournament.id,
        clubId: club.id,
        status: ApplicationStatus.APPROVED,
        notes: "Stress Test Auto",
        submittedAt: new Date(),
        reviewedAt: new Date(),
        paymentStatus: PaymentStatus.PAID,
        paymentAmountKzt: 0,
        paidAt: new Date(),
      },
    });
    applicationsByClub.set(club.id, app.id);
  }

  // Create athletes in batches
  for (const cat of CATEGORIES) {
    console.log(`Category: ${cat.name.ru} (${cat.count} athletes)`);
    const batchSize = 100;
    for (let i = 0; i < cat.count; i += batchSize) {
      const chunk = Math.min(batchSize, cat.count - i);
      const userPayloads = [];
      const entryPayloads = [];
      for (let j = 0; j < chunk; j++) {
        const id = nanoid();
        const email = `mega.${cat.id}.${i+j}@stress.judo-arena.kz`;
        const club = randomElement(clubs);
        const age = cat.ageMin ? cat.ageMin + 1 : 20;
        const dob = new Date(new Date().getFullYear() - age, 0, 1);
        userPayloads.push({
          id,
          email,
          passwordHash,
          role: UserRole.ATHLETE,
          name: "Спортсмен",
          surname: `Стресс ${i + j}`,
          gender: cat.g,
          dateOfBirth: dob,
          weightKg: cat.weightMax >= 999 ? 120 : (cat.weightMax - 1),
          clubId: club.id,
          isActive: true,
        });
        entryPayloads.push({
          applicationId: applicationsByClub.get(club.id),
          athleteId: id,
          categoryId: cat.id,
          weighInStatus: WeighInStatus.PASSED,
          actualWeightKg: cat.weightMax >= 999 ? 120 : (cat.weightMax - 1),
          weighedAt: new Date(),
          weighedById: admin!.id,
        });
      }
      await prisma.user.createMany({ data: userPayloads });
      await prisma.applicationEntry.createMany({ data: entryPayloads });
    }
  }

  console.log("Preparing draw for 1000+ athletes...");
  const drawResult = await prepareTournamentDraw(admin!.id, tournament.id);

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { status: TournamentStatus.IN_PROGRESS },
  });

  for (let tatamiNumber = 1; tatamiNumber <= tournament.tatamiCount; tatamiNumber++) {
    await prisma.tatamiSession.create({
      data: {
        token: `mega-tatami-${tatamiNumber}-${nanoid(8)}`,
        tournamentId: tournament.id,
        tatamiNumber,
        judgeName: `Mega Judge ${tatamiNumber}`,
        createdById: admin!.id,
        expiresAt: new Date("2026-07-02T04:00:00.000Z"),
      },
    });
  }

  const counts = await prisma.$transaction([
    prisma.application.count({ where: { tournamentId: tournament.id } }),
    prisma.bracket.count({ where: { tournamentId: tournament.id } }),
    prisma.match.count({ where: { tournamentId: tournament.id, status: MatchStatus.PENDING } }),
  ]);

  console.log("\nMEGA SEED COMPLETE!");
  console.log(`Tournament: ${tournament.id}`);
  console.log(`Matches pending: ${counts[2]}`);
  console.log(`Tatami distribution: ${JSON.stringify(drawResult.tatami.loads)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
