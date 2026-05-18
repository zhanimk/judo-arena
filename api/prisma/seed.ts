/**
 * Seed-скрипт для Judo-Arena
 *
 * Засевает БД реалистичными тестовыми данными:
 *   • 1 ADMIN
 *   • 4 клуба (Almaty Judo Club, Astana Pro, Tigers Karaganda, Shymkent Warriors)
 *   • 4 COACH (по одному на клуб)
 *   • 32 ATHLETE (по 8 на клуб, разный пол/возраст/вес)
 *   • 1 турнир "Алматы Кубогі 2026" со статусом REGISTRATION_OPEN
 *   • 4 категории (мужские/женские, два возрастных диапазона)
 *   • SystemConfig с шкалой очков
 *
 * Запуск:
 *   cd api
 *   npx prisma db seed
 *
 * Безопасно запускать многократно — использует upsert.
 */

import { PrismaClient, UserRole, Gender, Locale, TournamentStatus, BracketFormat } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ============================================================
// КОНФИГ ДАННЫХ
// ============================================================

const PASSWORD = "password123"; // Один пароль для всех тестовых аккаунтов — удобно для демо

const CLUBS = [
  {
    shortName: "almaty-judo",
    name: { ru: "Алматинский клуб дзюдо", kk: "Алматы дзюдо клубы", en: "Almaty Judo Club" },
    city: "Алматы",
    coach: { name: "Қанат", surname: "Серіков", email: "coach.almaty@judo-arena.kz" },
  },
  {
    shortName: "astana-pro",
    name: { ru: "Астана Про", kk: "Астана Про", en: "Astana Pro" },
    city: "Астана",
    coach: { name: "Дамир", surname: "Жұмабек", email: "coach.astana@judo-arena.kz" },
  },
  {
    shortName: "tigers-karaganda",
    name: { ru: "Тигры Караганды", kk: "Қарағанды жолбарыстары", en: "Tigers Karaganda" },
    city: "Қарағанды",
    coach: { name: "Бауыржан", surname: "Темірлан", email: "coach.karaganda@judo-arena.kz" },
  },
  {
    shortName: "shymkent-warriors",
    name: { ru: "Воины Шымкента", kk: "Шымкент жауынгерлері", en: "Shymkent Warriors" },
    city: "Шымкент",
    coach: { name: "Ержан", surname: "Сейітжан", email: "coach.shymkent@judo-arena.kz" },
  },
];

// 8 имён+фамилий на каждый клуб (4 мужских, 4 женских)
const ATHLETE_NAMES = {
  male: [
    { name: "Әлихан", surname: "Сәрсенов" },
    { name: "Нұрбол", surname: "Қайратұлы" },
    { name: "Дастан", surname: "Нұрлан" },
    { name: "Санжар", surname: "Бекзат" },
    { name: "Руслан", surname: "Олжас" },
    { name: "Мирас", surname: "Ержан" },
    { name: "Тимур", surname: "Алмас" },
    { name: "Айдар", surname: "Бахыт" },
  ],
  female: [
    { name: "Айгерім", surname: "Бекова" },
    { name: "Жанна", surname: "Серікқызы" },
    { name: "Динара", surname: "Қанатқызы" },
    { name: "Алия", surname: "Бағдат" },
    { name: "Камила", surname: "Ержанқызы" },
    { name: "Сабина", surname: "Талғат" },
    { name: "Меруерт", surname: "Айдар" },
    { name: "Назгүл", surname: "Дәурен" },
  ],
};

// Распределение по весовым категориям (по 2 спортсмена на категорию в клубе)
const WEIGHT_DISTRIBUTION_M = [60, 66, 73, 81, 90, 100, 60, 73];
const WEIGHT_DISTRIBUTION_F = [48, 52, 57, 63, 70, 78, 52, 63];

const TOURNAMENT = {
  name: {
    ru: "Кубок Алматы 2026",
    kk: "Алматы кубогі 2026",
    en: "Almaty Cup 2026",
  },
  description: {
    ru: "Открытый кубок города Алматы по дзюдо среди юниоров и взрослых.",
    kk: "Алматы қаласының ашық дзюдо кубогі — жастар мен ересектер арасында.",
    en: "Almaty City Open Judo Cup — juniors and seniors.",
  },
  location: "Дворец Спорта им. Балуана Шолака",
  city: "Алматы",
  // Через 10 дней после посева
  startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
  tatamiCount: 4,
};

const CATEGORIES = [
  // Мужские
  {
    name: { ru: "Мужчины −73 кг", kk: "Ер адамдар −73 кг", en: "Men −73 kg" },
    gender: Gender.MALE,
    ageMin: 18,
    ageMax: 35,
    weightMin: 66.01,
    weightMax: 73.0,
    matchDurationSec: 240,
    format: BracketFormat.SE_IJF,
  },
  {
    name: { ru: "Мужчины −81 кг", kk: "Ер адамдар −81 кг", en: "Men −81 kg" },
    gender: Gender.MALE,
    ageMin: 18,
    ageMax: 35,
    weightMin: 73.01,
    weightMax: 81.0,
    matchDurationSec: 240,
    format: BracketFormat.SE_IJF,
  },
  // Женские
  {
    name: { ru: "Женщины −57 кг", kk: "Әйелдер −57 кг", en: "Women −57 kg" },
    gender: Gender.FEMALE,
    ageMin: 18,
    ageMax: 35,
    weightMin: 52.01,
    weightMax: 57.0,
    matchDurationSec: 240,
    format: BracketFormat.ROUND_ROBIN, // Круговая — попробуем оба формата
  },
  {
    name: { ru: "Женщины −63 кг", kk: "Әйелдер −63 кг", en: "Women −63 kg" },
    gender: Gender.FEMALE,
    ageMin: 18,
    ageMax: 35,
    weightMin: 57.01,
    weightMax: 63.0,
    matchDurationSec: 240,
    format: BracketFormat.SE_IJF,
  },
];

// ============================================================
// УТИЛИТЫ
// ============================================================

function randomBirthDate(ageMin = 18, ageMax = 30): Date {
  const age = Math.floor(Math.random() * (ageMax - ageMin + 1)) + ageMin;
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(Math.floor(Math.random() * 12));
  d.setDate(Math.floor(Math.random() * 28) + 1);
  return d;
}

function transliterate(text: string): string {
  // Простая транслитерация для nameLatin/surnameLatin
  const map: Record<string, string> = {
    А: "A", Ә: "A", Б: "B", В: "V", Г: "G", Ғ: "G", Д: "D", Е: "Ye", Ж: "Zh", З: "Z",
    И: "I", Й: "Y", К: "K", Қ: "Q", Л: "L", М: "M", Н: "N", Ң: "N", О: "O", Ө: "O",
    П: "P", Р: "R", С: "S", Т: "T", У: "U", Ү: "U", Ұ: "U", Ф: "F", Х: "Kh", Һ: "H",
    Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Sch", Ъ: "", Ы: "Y", І: "I", Ь: "", Э: "E", Ю: "Yu", Я: "Ya",
    а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "ye", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", ң: "n", о: "o", ө: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ү: "u", ұ: "u", ф: "f", х: "kh", һ: "h",
    ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", і: "i", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return text.split("").map((ch) => map[ch] ?? ch).join("");
}

// ============================================================
// SEED
// ============================================================

async function main() {
  console.log("🌱 Запуск seed для Judo-Arena...\n");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ---- 1. ADMIN ----
  const admin = await prisma.user.upsert({
    where: { email: "admin@judo-arena.kz" },
    update: {},
    create: {
      email: "admin@judo-arena.kz",
      passwordHash,
      role: UserRole.ADMIN,
      name: "Алия",
      surname: "Қалиева",
      nameLatin: "Aliya",
      surnameLatin: "Kalieva",
      preferredLocale: Locale.kk,
      isActive: true,
    },
  });
  console.log(`✓ ADMIN создан: ${admin.email}`);

  // ---- 2. SystemConfig ----
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
    },
  });
  console.log("✓ SystemConfig.ratingPoints загружен (100/80/50/30/15)");

  // ---- 3. КЛУБЫ + ТРЕНЕРЫ + СПОРТСМЕНЫ ----
  const clubs = [];
  for (let clubIdx = 0; clubIdx < CLUBS.length; clubIdx++) {
    const c = CLUBS[clubIdx]!;

    // Тренер
    const coach = await prisma.user.upsert({
      where: { email: c.coach.email },
      update: {},
      create: {
        email: c.coach.email,
        passwordHash,
        role: UserRole.COACH,
        name: c.coach.name,
        surname: c.coach.surname,
        nameLatin: transliterate(c.coach.name),
        surnameLatin: transliterate(c.coach.surname),
        preferredLocale: Locale.kk,
        isActive: true,
      },
    });

    // Клуб
    const club = await prisma.club.upsert({
      where: { id: `club-${c.shortName}` },
      update: {},
      create: {
        id: `club-${c.shortName}`,
        name: c.name,
        shortName: c.shortName,
        city: c.city,
        country: "KZ",
        createdById: coach.id,
      },
    });

    // Привязать тренера к клубу
    await prisma.user.update({
      where: { id: coach.id },
      data: { clubId: club.id },
    });

    // 4 мужчины + 4 женщины (по одному из каждого имени с поправкой по клубу)
    for (let i = 0; i < 4; i++) {
      const m = ATHLETE_NAMES.male[(clubIdx * 4 + i) % ATHLETE_NAMES.male.length]!;
      const email = `m${clubIdx}-${i}@${c.shortName}.judo-arena.kz`;
      const weight = WEIGHT_DISTRIBUTION_M[(clubIdx * 4 + i) % WEIGHT_DISTRIBUTION_M.length]!;
      await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash,
          role: UserRole.ATHLETE,
          name: m.name,
          surname: m.surname,
          nameLatin: transliterate(m.name),
          surnameLatin: transliterate(m.surname),
          gender: Gender.MALE,
          dateOfBirth: randomBirthDate(18, 28),
          weightKg: weight,
          beltRank: ["3 kyu", "2 kyu", "1 kyu", "1 dan"][Math.floor(Math.random() * 4)],
          preferredLocale: Locale.kk,
          clubId: club.id,
        },
      });

      const f = ATHLETE_NAMES.female[(clubIdx * 4 + i) % ATHLETE_NAMES.female.length]!;
      const femaleEmail = `f${clubIdx}-${i}@${c.shortName}.judo-arena.kz`;
      const femaleWeight = WEIGHT_DISTRIBUTION_F[(clubIdx * 4 + i) % WEIGHT_DISTRIBUTION_F.length]!;
      await prisma.user.upsert({
        where: { email: femaleEmail },
        update: {},
        create: {
          email: femaleEmail,
          passwordHash,
          role: UserRole.ATHLETE,
          name: f.name,
          surname: f.surname,
          nameLatin: transliterate(f.name),
          surnameLatin: transliterate(f.surname),
          gender: Gender.FEMALE,
          dateOfBirth: randomBirthDate(18, 28),
          weightKg: femaleWeight,
          beltRank: ["3 kyu", "2 kyu", "1 kyu", "1 dan"][Math.floor(Math.random() * 4)],
          preferredLocale: Locale.kk,
          clubId: club.id,
        },
      });
    }

    clubs.push(club);
    console.log(`✓ Клуб «${(c.name as any).kk}» (${c.city}): тренер + 8 спортсменов`);
  }

  // ---- 4. ТУРНИР + КАТЕГОРИИ ----
  const tournament = await prisma.tournament.upsert({
    where: { id: "tournament-almaty-cup-2026" },
    update: {},
    create: {
      id: "tournament-almaty-cup-2026",
      name: TOURNAMENT.name,
      description: TOURNAMENT.description,
      location: TOURNAMENT.location,
      city: TOURNAMENT.city,
      startDate: TOURNAMENT.startDate,
      endDate: TOURNAMENT.endDate,
      status: TournamentStatus.REGISTRATION_OPEN,
      tatamiCount: TOURNAMENT.tatamiCount,
      primaryLocale: Locale.kk,
      createdById: admin.id,
    },
  });
  console.log(`✓ Турнир: «${(TOURNAMENT.name as any).kk}» (статус REGISTRATION_OPEN)`);

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i]!;
    await prisma.category.upsert({
      where: { id: `cat-${tournament.id}-${i}` },
      update: {},
      create: {
        id: `cat-${tournament.id}-${i}`,
        tournamentId: tournament.id,
        name: cat.name,
        gender: cat.gender,
        ageMin: cat.ageMin,
        ageMax: cat.ageMax,
        weightMin: cat.weightMin,
        weightMax: cat.weightMax,
        matchDurationSec: cat.matchDurationSec,
        format: cat.format,
      },
    });
    console.log(`  ✓ Категория: ${(cat.name as any).kk} [${cat.format}]`);
  }

  console.log("\n🎉 Seed успешно завершён!\n");
  console.log("📋 Учётные данные для входа (пароль одинаковый — password123):");
  console.log("  • ADMIN:    admin@judo-arena.kz");
  console.log("  • COACH-ы:  coach.almaty@judo-arena.kz, coach.astana@judo-arena.kz, и т.д.");
  console.log("  • ATHLETE-ы: m0-0@almaty-judo.judo-arena.kz, f0-0@almaty-judo.judo-arena.kz, ...");
  console.log("\nОткрой Prisma Studio (npx prisma studio) и посмотри что получилось.");
}

main()
  .catch((e) => {
    console.error("❌ Seed упал:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
