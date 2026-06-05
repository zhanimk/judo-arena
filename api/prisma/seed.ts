/**
 * Demo seed for Judo-Arena.
 *
 * Creates a ready-to-review tournament flow:
 * - demo accounts for ADMIN / COACH / ATHLETE
 * - 4 clubs with coaches
 * - 67 athletes split into four categories: 4 round-robin, 8 pools, 15 SE, 40 SE
 * - paid and approved club applications
 * - passed weigh-in entries
 * - generated brackets and tatami assignment
 *
 * Run:
 *   cd api
 *   npx prisma db seed
 *
 * Demo password for every account:
 *   password123
 */

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
const TOURNAMENT_ID = "demo-complete-flow-2026";
const ENTRY_FEE_KZT = 5000;

const CLUBS = [
  {
    id: "club-demo-almaty",
    shortName: "almaty-demo",
    city: "Алматы",
    name: { ru: "Алматы Демо", kk: "Алматы Демо", en: "Almaty Demo" },
    coach: {
      email: "coach.almaty@judo-arena.kz",
      name: "Қанат",
      surname: "Серіков",
    },
  },
  {
    id: "club-demo-astana",
    shortName: "astana-demo",
    city: "Астана",
    name: { ru: "Астана Демо", kk: "Астана Демо", en: "Astana Demo" },
    coach: {
      email: "coach.astana@judo-arena.kz",
      name: "Дамир",
      surname: "Жұмабек",
    },
  },
  {
    id: "club-demo-karaganda",
    shortName: "karaganda-demo",
    city: "Қарағанды",
    name: { ru: "Караганда Демо", kk: "Қарағанды Демо", en: "Karaganda Demo" },
    coach: {
      email: "coach.karaganda@judo-arena.kz",
      name: "Бауыржан",
      surname: "Темірлан",
    },
  },
  {
    id: "club-demo-shymkent",
    shortName: "shymkent-demo",
    city: "Шымкент",
    name: { ru: "Шымкент Демо", kk: "Шымкент Демо", en: "Shymkent Demo" },
    coach: {
      email: "coach.shymkent@judo-arena.kz",
      name: "Ержан",
      surname: "Сейітжан",
    },
  },
];

const CATEGORIES = [
  {
    id: "cat-demo-round-robin-4",
    name: {
      ru: "Демо круговая: девочки -52 кг",
      kk: "Демо айналым: қыздар -52 кг",
      en: "Demo round-robin: girls -52 kg",
    },
    gender: Gender.FEMALE,
    ageMin: 10,
    ageMax: 13,
    weightMin: 44.01,
    weightMax: 52,
    matchDurationSec: 180,
    format: BracketFormat.ROUND_ROBIN,
  },
  {
    id: "cat-demo-se-15",
    name: {
      ru: "Демо сетка: юноши -60 кг (15)",
      kk: "Демо тор: ұлдар -60 кг (15)",
      en: "Demo bracket: boys -60 kg (15)",
    },
    gender: Gender.MALE,
    ageMin: 14,
    ageMax: 17,
    weightMin: 55.01,
    weightMax: 60,
    matchDurationSec: 240,
    format: BracketFormat.SE_IJF,
  },
  {
    id: "cat-demo-pools-8",
    name: {
      ru: "Демо пулы A/B: юноши -55 кг (8)",
      kk: "Демо пулдар A/B: ұлдар -55 кг (8)",
      en: "Demo pools A/B: boys -55 kg (8)",
    },
    gender: Gender.MALE,
    ageMin: 14,
    ageMax: 17,
    weightMin: 50.01,
    weightMax: 55,
    matchDurationSec: 240,
    format: BracketFormat.SE_IJF,
  },
  {
    id: "cat-demo-se-40",
    name: {
      ru: "Демо сетка: юноши -66 кг (40)",
      kk: "Демо тор: ұлдар -66 кг (40)",
      en: "Demo bracket: boys -66 kg (40)",
    },
    gender: Gender.MALE,
    ageMin: 14,
    ageMax: 17,
    weightMin: 60.01,
    weightMax: 66,
    matchDurationSec: 240,
    format: BracketFormat.SE_IJF,
  },
];

const FIRST_NAMES_M = [
  "Алихан",
  "Нурбол",
  "Дастан",
  "Санжар",
  "Руслан",
  "Мирас",
  "Тимур",
  "Айдар",
  "Ержан",
  "Самат",
  "Ануар",
  "Бекзат",
  "Алмас",
  "Марат",
  "Серик",
  "Ерасыл",
];
const FIRST_NAMES_F = [
  "Айгерим",
  "Жанна",
  "Динара",
  "Алия",
  "Камила",
  "Сабина",
];
const SURNAMES = [
  "Сарсенов",
  "Кайратулы",
  "Нурлан",
  "Бекзат",
  "Олжас",
  "Ержан",
  "Алмас",
  "Бахыт",
  "Мусин",
  "Байсалов",
  "Сейитов",
  "Рыскали",
  "Нуртаев",
  "Оразов",
  "Жексенбеков",
  "Дюсупов",
];

type DemoAthlete = {
  email: string;
  name: string;
  surname: string;
  gender: Gender;
  clubId: string;
  categoryId: string;
  dateOfBirth: Date;
  weightKg: number;
};

function birthDateForAge(age: number): Date {
  const date = new Date("2026-01-15T09:00:00.000Z");
  date.setUTCFullYear(date.getUTCFullYear() - age);
  return date;
}

function athleteEmail(
  categoryCode: string,
  index: number,
  clubShortName: string,
) {
  return `${categoryCode}.${String(index + 1).padStart(2, "0")}@${clubShortName}.demo.judo-arena.kz`;
}

function makeAthletes(): DemoAthlete[] {
  const athletes: DemoAthlete[] = [];

  // 4 round-robin athletes from one club on purpose, so same-club matches are visible.
  for (let i = 0; i < 4; i++) {
    const club = CLUBS[0]!;
    athletes.push({
      email: athleteEmail("rr", i, club.shortName),
      name: FIRST_NAMES_F[i]!,
      surname: SURNAMES[i]!,
      gender: Gender.FEMALE,
      clubId: club.id,
      categoryId: CATEGORIES[0]!.id,
      dateOfBirth: birthDateForAge(12),
      weightKg: 49 + (i % 2),
    });
  }

  for (let i = 0; i < 15; i++) {
    const club = CLUBS[i % CLUBS.length]!;
    athletes.push({
      email: athleteEmail("se15", i, club.shortName),
      name: FIRST_NAMES_M[i % FIRST_NAMES_M.length]!,
      surname: SURNAMES[(i + 3) % SURNAMES.length]!,
      gender: Gender.MALE,
      clubId: club.id,
      categoryId: CATEGORIES[1]!.id,
      dateOfBirth: birthDateForAge(15),
      weightKg: 58 + (i % 3) * 0.5,
    });
  }

  for (let i = 0; i < 8; i++) {
    const club = CLUBS[i % CLUBS.length]!;
    athletes.push({
      email: athleteEmail("pool8", i, club.shortName),
      name: FIRST_NAMES_M[(i + 9) % FIRST_NAMES_M.length]!,
      surname: SURNAMES[(i + 11) % SURNAMES.length]!,
      gender: Gender.MALE,
      clubId: club.id,
      categoryId: CATEGORIES[2]!.id,
      dateOfBirth: birthDateForAge(15),
      weightKg: 53 + (i % 4) * 0.3,
    });
  }

  for (let i = 0; i < 40; i++) {
    const club = CLUBS[i % CLUBS.length]!;
    athletes.push({
      email: athleteEmail("se40", i, club.shortName),
      name: FIRST_NAMES_M[(i + 5) % FIRST_NAMES_M.length]!,
      surname: SURNAMES[(i + 7) % SURNAMES.length]!,
      gender: Gender.MALE,
      clubId: club.id,
      categoryId: CATEGORIES[3]!.id,
      dateOfBirth: birthDateForAge(16),
      weightKg: 63 + (i % 5) * 0.4,
    });
  }

  return athletes;
}

async function cleanDemoTournament() {
  const tournament = await prisma.tournament.findUnique({
    where: { id: TOURNAMENT_ID },
  });
  if (!tournament) return;

  await prisma.matchEvent.deleteMany({
    where: { match: { tournamentId: TOURNAMENT_ID } },
  });
  await prisma.judgeSession.deleteMany({
    where: { match: { tournamentId: TOURNAMENT_ID } },
  });
  await prisma.tatamiSession.deleteMany({
    where: { tournamentId: TOURNAMENT_ID },
  });
  await prisma.ratingEntry.deleteMany({
    where: { tournamentId: TOURNAMENT_ID },
  });
  await prisma.match.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  await prisma.bracket.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  await prisma.applicationEntry.deleteMany({
    where: { application: { tournamentId: TOURNAMENT_ID } },
  });
  await prisma.application.deleteMany({
    where: { tournamentId: TOURNAMENT_ID },
  });
  await prisma.category.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  await prisma.tournament.delete({ where: { id: TOURNAMENT_ID } });
}

async function main() {
  console.log("Starting Judo-Arena demo seed...");

  await cleanDemoTournament();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  const admin = await prisma.user.upsert({
    where: { email: "admin@judo-arena.kz" },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      preferredLocale: Locale.ru,
    },
    create: {
      email: "admin@judo-arena.kz",
      passwordHash,
      role: UserRole.ADMIN,
      name: "Алия",
      surname: "Калиева",
      nameLatin: "Aliya",
      surnameLatin: "Kalieva",
      preferredLocale: Locale.ru,
      isActive: true,
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: "ratingPoints" },
    update: {
      value: {
        place1: 100,
        place2: 80,
        place3: 50,
        place3Loss: 30,
        place7Repechage: 15,
        participation: 0,
        ipponBonus: 0,
      },
      updatedBy: admin.id,
    },
    create: {
      key: "ratingPoints",
      value: {
        place1: 100,
        place2: 80,
        place3: 50,
        place3Loss: 30,
        place7Repechage: 15,
        participation: 0,
        ipponBonus: 0,
      },
      updatedBy: admin.id,
    },
  });

  for (const clubData of CLUBS) {
    const coach = await prisma.user.upsert({
      where: { email: clubData.coach.email },
      update: {
        passwordHash,
        role: UserRole.COACH,
        name: clubData.coach.name,
        surname: clubData.coach.surname,
        preferredLocale: Locale.ru,
        isActive: true,
      },
      create: {
        email: clubData.coach.email,
        passwordHash,
        role: UserRole.COACH,
        name: clubData.coach.name,
        surname: clubData.coach.surname,
        nameLatin: clubData.coach.name,
        surnameLatin: clubData.coach.surname,
        preferredLocale: Locale.ru,
        isActive: true,
      },
    });

    const club = await prisma.club.upsert({
      where: { id: clubData.id },
      update: {
        name: clubData.name,
        shortName: clubData.shortName,
        city: clubData.city,
        country: "KZ",
        isActive: true,
        isBlocked: false,
      },
      create: {
        id: clubData.id,
        name: clubData.name,
        shortName: clubData.shortName,
        city: clubData.city,
        country: "KZ",
        createdById: coach.id,
      },
    });

    await prisma.user.update({
      where: { id: coach.id },
      data: {
        clubId: club.id,
        clubRole: ClubRole.OWNER,
        avatarUrl: `/uploads/demo/coach-${clubData.shortName}.png`,
      },
    });

    await prisma.userDocument.upsert({
      where: {
        userId_type: { userId: coach.id, type: UserDocumentType.COACH_ID },
      },
      update: {
        url: `/uploads/demo/coach-id-${clubData.shortName}.pdf`,
        originalName: `coach-id-${clubData.shortName}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 124000,
        uploadedById: coach.id,
      },
      create: {
        userId: coach.id,
        type: UserDocumentType.COACH_ID,
        url: `/uploads/demo/coach-id-${clubData.shortName}.pdf`,
        originalName: `coach-id-${clubData.shortName}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 124000,
        uploadedById: coach.id,
      },
    });
  }

  const tournament = await prisma.tournament.create({
    data: {
      id: TOURNAMENT_ID,
      name: {
        ru: "Демо турнир: полный процесс",
        kk: "Демо турнир: толық процесс",
        en: "Demo tournament: full flow",
      },
      description: {
        ru: "Готовый тест: регистрация, заявки, Kaspi-оплата, допуск, сетки и табло.",
        kk: "Дайын тест: тіркеу, өтінімдер, Kaspi төлемі, рұқсат, торлар және табло.",
        en: "Ready test: registration, applications, Kaspi payment, approval, brackets and scoreboard.",
      },
      location: "Judo Arena Demo Hall",
      city: "Алматы",
      startDate: new Date("2026-06-10T04:00:00.000Z"),
      endDate: new Date("2026-06-10T14:00:00.000Z"),
      applicationDeadline: new Date("2026-06-09T18:00:00.000Z"),
      mapUrl: "https://2gis.kz/almaty/search/Judo%20Arena",
      weighInLocation: "Зал взвешивания A",
      weighInStart: new Date("2026-06-10T02:00:00.000Z"),
      weighInEnd: new Date("2026-06-10T03:30:00.000Z"),
      status: TournamentStatus.REGISTRATION_CLOSED,
      tatamiCount: 4,
      primaryLocale: Locale.ru,
      entryFeeKzt: ENTRY_FEE_KZT,
      kaspiPaymentUrl:
        "https://kaspi.kz/pay/judo-arena?amount={amount}&order={orderId}&comment={comment}",
      isFeatured: true,
      createdById: admin.id,
    },
  });

  for (const category of CATEGORIES) {
    await prisma.category.create({
      data: {
        id: category.id,
        tournamentId: tournament.id,
        name: category.name,
        gender: category.gender,
        ageMin: category.ageMin,
        ageMax: category.ageMax,
        weightMin: category.weightMin,
        weightMax: category.weightMax,
        matchDurationSec: category.matchDurationSec,
        format: category.format,
        allowYuko: true,
      },
    });
  }

  const athletes = makeAthletes();
  const usersByEmail = new Map<string, string>();
  for (const athlete of athletes) {
    const user = await prisma.user.upsert({
      where: { email: athlete.email },
      update: {
        passwordHash,
        role: UserRole.ATHLETE,
        name: athlete.name,
        surname: athlete.surname,
        gender: athlete.gender,
        dateOfBirth: athlete.dateOfBirth,
        weightKg: athlete.weightKg,
        beltRank: "3 КЮ",
        preferredLocale: Locale.ru,
        isActive: true,
        clubId: athlete.clubId,
        clubRole: null,
        avatarUrl: `/uploads/demo/athlete-${athlete.email.split("@")[0]}.png`,
      },
      create: {
        email: athlete.email,
        passwordHash,
        role: UserRole.ATHLETE,
        name: athlete.name,
        surname: athlete.surname,
        nameLatin: athlete.name,
        surnameLatin: athlete.surname,
        gender: athlete.gender,
        dateOfBirth: athlete.dateOfBirth,
        weightKg: athlete.weightKg,
        beltRank: "3 КЮ",
        preferredLocale: Locale.ru,
        isActive: true,
        clubId: athlete.clubId,
        avatarUrl: `/uploads/demo/athlete-${athlete.email.split("@")[0]}.png`,
      },
    });
    usersByEmail.set(athlete.email, user.id);

    await prisma.userDocument.upsert({
      where: {
        userId_type: {
          userId: user.id,
          type: UserDocumentType.BIRTH_CERTIFICATE,
        },
      },
      update: {
        url: `/uploads/demo/birth-${user.id}.pdf`,
        originalName: "birth-certificate.pdf",
        mimeType: "application/pdf",
        sizeBytes: 98000,
        uploadedById: user.id,
      },
      create: {
        userId: user.id,
        type: UserDocumentType.BIRTH_CERTIFICATE,
        url: `/uploads/demo/birth-${user.id}.pdf`,
        originalName: "birth-certificate.pdf",
        mimeType: "application/pdf",
        sizeBytes: 98000,
        uploadedById: user.id,
      },
    });
    await prisma.userDocument.upsert({
      where: {
        userId_type: {
          userId: user.id,
          type: UserDocumentType.STUDY_CERTIFICATE,
        },
      },
      update: {
        url: `/uploads/demo/study-${user.id}.pdf`,
        originalName: "study-certificate.pdf",
        mimeType: "application/pdf",
        sizeBytes: 87000,
        uploadedById: user.id,
      },
      create: {
        userId: user.id,
        type: UserDocumentType.STUDY_CERTIFICATE,
        url: `/uploads/demo/study-${user.id}.pdf`,
        originalName: "study-certificate.pdf",
        mimeType: "application/pdf",
        sizeBytes: 87000,
        uploadedById: user.id,
      },
    });
  }

  const athletesByClub = new Map<string, DemoAthlete[]>();
  for (const athlete of athletes) {
    athletesByClub.set(athlete.clubId, [
      ...(athletesByClub.get(athlete.clubId) ?? []),
      athlete,
    ]);
  }

  for (const [clubId, clubAthletes] of athletesByClub.entries()) {
    const paymentAmountKzt = clubAthletes.length * ENTRY_FEE_KZT;
    const application = await prisma.application.create({
      data: {
        tournamentId: tournament.id,
        clubId,
        status: ApplicationStatus.APPROVED,
        notes: "Demo: заявка сформирована, оплачена и одобрена",
        submittedAt: now,
        reviewedAt: now,
        reviewerNotes: "Demo approved",
        paymentStatus: PaymentStatus.PAID,
        paymentAmountKzt,
        paymentProvider: "KASPI",
        paymentReference: `DEMO-${clubId.toUpperCase()}-${Date.now()}`,
        paymentUrl: `https://kaspi.kz/pay/judo-arena?amount=${paymentAmountKzt}`,
        paidAt: now,
      },
    });

    for (const athlete of clubAthletes) {
      await prisma.applicationEntry.create({
        data: {
          applicationId: application.id,
          athleteId: usersByEmail.get(athlete.email)!,
          categoryId: athlete.categoryId,
          weighInStatus: WeighInStatus.PASSED,
          actualWeightKg: athlete.weightKg,
          weighInNotes: "Demo: документы проверены, вес пройден",
          weighedAt: now,
          weighedById: admin.id,
        },
      });
    }
  }

  const drawResult = await prepareTournamentDraw(admin.id, tournament.id);

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { status: TournamentStatus.IN_PROGRESS },
  });

  for (let tatamiNumber = 1; tatamiNumber <= 4; tatamiNumber++) {
    await prisma.tatamiSession.create({
      data: {
        token: `demo-tatami-${tatamiNumber}-${nanoid(8)}`,
        tournamentId: tournament.id,
        tatamiNumber,
        judgeName: `Demo Judge ${tatamiNumber}`,
        createdById: admin.id,
        expiresAt: new Date("2026-06-11T04:00:00.000Z"),
      },
    });
  }

  const counts = await prisma.$transaction([
    prisma.user.count({
      where: {
        role: UserRole.ATHLETE,
        email: { contains: ".demo.judo-arena.kz" },
      },
    }),
    prisma.application.count({ where: { tournamentId: tournament.id } }),
    prisma.bracket.count({ where: { tournamentId: tournament.id } }),
    prisma.match.count({
      where: { tournamentId: tournament.id, status: MatchStatus.PENDING },
    }),
  ]);

  console.log("\nDemo seed complete.");
  console.log(`Tournament: ${tournament.id}`);
  console.log(
    `Athletes: ${counts[0]}, applications: ${counts[1]}, brackets: ${counts[2]}, pending matches: ${counts[3]}`,
  );
  console.log(
    `Tatami distribution: ${JSON.stringify(drawResult.tatami.loads)}`,
  );
  console.log("\nDemo accounts, password: password123");
  console.log("ADMIN:   admin@judo-arena.kz");
  console.log("COACH:   coach.almaty@judo-arena.kz");
  console.log("ATHLETE: rr.01@almaty-demo.demo.judo-arena.kz");
  console.log(`Scoreboard: /live-wall/${tournament.id}`);
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
