/**
 * Full-Scale Seed — 10 clubs, 10 coaches, 400 athletes, 1 tournament, 14 categories
 * Run: cd api && npx tsx prisma/seed-400.ts
 * Uses bcrypt cost 6 (fast for testing)
 */

import { PrismaClient, UserRole, Gender, Locale, BracketFormat, TournamentStatus, ClubRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const HASH = await bcrypt.hash("password123", 6); // cost=6 for speed
const ADMIN_ID = "cmp5mxkcr0000qp5coabicnfq"; // admin@judo-arena.kz

const CITIES = ["Алматы","Астана","Қарағанды","Шымкент","Атырау","Павлодар","Тараз","Өскемен","Актау","Орал"];

const MALE_NAMES = [
  ["Әлихан","Сәрсенов","Alikhan","Sarsenov"],["Нұрбол","Қайратұлы","Nurbol","Kairatuly"],
  ["Дастан","Нұрлан","Dastan","Nurlan"],["Санжар","Бекзат","Sanzhar","Bekzat"],
  ["Руслан","Олжас","Ruslan","Olzhas"],["Мирас","Ержан","Miras","Yerzhan"],
  ["Тимур","Алмас","Timur","Almas"],["Айдар","Бахыт","Aidar","Bakhyt"],
  ["Арман","Дүйсебек","Arman","Duisebek"],["Ерлан","Мамыт","Yerlan","Mamyt"],
  ["Сейіт","Болат","Seyt","Bolat"],["Данияр","Жаксыбек","Daniyar","Zhaksybek"],
  ["Бекзат","Жарылғасын","Bekzat","Zharylgasyn"],["Нурдаулет","Тасым","Nurdaulet","Tasym"],
  ["Алибек","Жолдас","Alibek","Zholdas"],["Марат","Ахмет","Marat","Akhmet"],
  ["Жандос","Балтабек","Zhandos","Baltabek"],["Берік","Тоқтар","Berik","Toktar"],
  ["Султан","Нұртай","Sultan","Nurtay"],["Азамат","Рысқали","Azamat","Ryskali"],
];
const FEMALE_NAMES = [
  ["Айгерім","Бекова","Aigerim","Bekova"],["Жанна","Серікқызы","Zhanna","Serikkzyzy"],
  ["Динара","Қанатқызы","Dinara","Kanatkzyzy"],["Алия","Бағдат","Aliya","Bagdat"],
  ["Камила","Ержанқызы","Kamila","Yerzhankzyzy"],["Сабина","Талғат","Sabina","Talgat"],
  ["Меруерт","Айдар","Meruert","Aidar"],["Назгүл","Дәурен","Nazgul","Dauren"],
  ["Жұлдыз","Нұрлан","Zhuldyz","Nurlan"],["Гүлназ","Серік","Gulnaz","Serik"],
  ["Томирис","Батыр","Tomiris","Batyr"],["Айсана","Тілеу","Aisana","Tileu"],
  ["Ботагөз","Сарсен","Botagoz","Sarsen"],["Зарина","Кенже","Zarina","Kenzhe"],
  ["Арайлым","Нәби","Arailym","Nabi"],["Медина","Ілия","Medina","Iliya"],
  ["Аружан","Шынтай","Aruzhan","Shyntai"],["Зейнеп","Ахмет","Zeynep","Akhmet"],
  ["Дильназ","Мұхтар","Dilnaz","Mukhtar"],["Лейла","Бекенов","Leyla","Bekenov"],
];

// Male IJF categories with weight ranges for athlete creation
const MALE_CATS = [
  { gender: Gender.MALE, wMin: 52, wMax: 59.9, catWeightMin: 0,    catWeightMax: 60.0 },
  { gender: Gender.MALE, wMin: 61, wMax: 65.9, catWeightMin: 60.01, catWeightMax: 66.0 },
  { gender: Gender.MALE, wMin: 67, wMax: 72.9, catWeightMin: 66.01, catWeightMax: 73.0 },
  { gender: Gender.MALE, wMin: 74, wMax: 80.9, catWeightMin: 73.01, catWeightMax: 81.0 },
  { gender: Gender.MALE, wMin: 82, wMax: 89.9, catWeightMin: 81.01, catWeightMax: 90.0 },
  { gender: Gender.MALE, wMin: 91, wMax: 99.9, catWeightMin: 90.01, catWeightMax: 100.0 },
  { gender: Gender.MALE, wMin: 101,wMax: 130,  catWeightMin: 100.01,catWeightMax: 200.0 },
];
const FEMALE_CATS = [
  { gender: Gender.FEMALE, wMin: 42, wMax: 47.9, catWeightMin: 0,    catWeightMax: 48.0 },
  { gender: Gender.FEMALE, wMin: 49, wMax: 51.9, catWeightMin: 48.01, catWeightMax: 52.0 },
  { gender: Gender.FEMALE, wMin: 53, wMax: 56.9, catWeightMin: 52.01, catWeightMax: 57.0 },
  { gender: Gender.FEMALE, wMin: 58, wMax: 62.9, catWeightMin: 57.01, catWeightMax: 63.0 },
  { gender: Gender.FEMALE, wMin: 64, wMax: 69.9, catWeightMin: 63.01, catWeightMax: 70.0 },
  { gender: Gender.FEMALE, wMin: 71, wMax: 77.9, catWeightMin: 70.01, catWeightMax: 78.0 },
  { gender: Gender.FEMALE, wMin: 79, wMax: 105,  catWeightMin: 78.01, catWeightMax: 200.0 },
];

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function dob(ageMin = 18, ageMax = 32): Date {
  const age = Math.floor(Math.random() * (ageMax - ageMin + 1)) + ageMin;
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(Math.floor(Math.random() * 12));
  d.setDate(Math.floor(Math.random() * 28) + 1);
  return d;
}

async function main() {
  console.log("\n🥋 FULL-SCALE SEED — 10 clubs · 400 athletes · 14 categories\n");

  // ── 1. Create clubs ────────────────────────────────────────────────────────
  const clubs: any[] = [];
  for (let i = 0; i < 10; i++) {
    const city = CITIES[i];
    const club = await prisma.club.upsert({
      where: { id: `fulltest-club-${i}` },
      create: {
        id: `fulltest-club-${i}`,
        name: { ru: `${city} Дзюдо Клубы`, kk: `${city} Дзюдо Клубы` },
        city, country: "KZ", shortName: `FT${i+1}`,
        createdById: ADMIN_ID,
      },
      update: { city },
    });
    clubs.push(club);
    process.stdout.write(`  Club ${i+1}/10: ${city}\r`);
  }
  console.log(`\n✓ Clubs: ${clubs.length}`);

  // ── 2. Create coaches ──────────────────────────────────────────────────────
  const coaches: any[] = [];
  for (let i = 0; i < 10; i++) {
    const email = `ft.coach${i+1}@judo-arena.kz`;
    const coach = await prisma.user.upsert({
      where: { email },
      create: {
        email, passwordHash: HASH, role: UserRole.COACH,
        name: "Тренер", surname: `ФТ${i+1}`,
        nameLatin: "Coach", surnameLatin: `FT${i+1}`,
        clubId: clubs[i].id, clubRole: ClubRole.OWNER, isActive: true, preferredLocale: Locale.kk,
      },
      update: { clubId: clubs[i].id, clubRole: ClubRole.OWNER },
    });
    coaches.push(coach);
  }
  console.log(`✓ Coaches: ${coaches.length}`);

  // ── 3. Create 400 athletes ─────────────────────────────────────────────────
  // 20 male + 20 female per club (3+3+3+3+3+2+3 per gender across 7 cats)
  const M_DIST = [3,3,3,3,3,2,3]; // 20 total males per club
  const F_DIST = [3,3,3,3,3,3,2]; // 20 total females per club
  const athletesByClub: Record<string, {id: string; mCatIdx?: number; fCatIdx?: number}[]> = {};
  let totalAthletes = 0;

  for (let ci = 0; ci < 10; ci++) {
    const club = clubs[ci];
    const clubAthletes: any[] = [];

    let mi = 0;
    for (let catI = 0; catI < 7; catI++) {
      const mcat = MALE_CATS[catI];
      for (let k = 0; k < M_DIST[catI]; k++) {
        const nm = MALE_NAMES[(ci * 20 + mi) % MALE_NAMES.length];
        const email = `ft.m${ci}-${mi}@judo-arena.kz`;
        const a = await prisma.user.upsert({
          where: { email },
          create: {
            email, passwordHash: HASH, role: UserRole.ATHLETE,
            name: nm[0], surname: nm[1], nameLatin: nm[2], surnameLatin: nm[3],
            gender: Gender.MALE, dateOfBirth: dob(),
            weightKg: rand(mcat.wMin, mcat.wMax),
            clubId: club.id, isActive: true, preferredLocale: Locale.kk,
          },
          update: { clubId: club.id, weightKg: rand(mcat.wMin, mcat.wMax) },
        });
        clubAthletes.push({ id: a.id, gender: "MALE", catIdx: catI });
        mi++; totalAthletes++;
      }
    }

    let fi = 0;
    for (let catI = 0; catI < 7; catI++) {
      const fcat = FEMALE_CATS[catI];
      for (let k = 0; k < F_DIST[catI]; k++) {
        const nf = FEMALE_NAMES[(ci * 20 + fi) % FEMALE_NAMES.length];
        const email = `ft.f${ci}-${fi}@judo-arena.kz`;
        const a = await prisma.user.upsert({
          where: { email },
          create: {
            email, passwordHash: HASH, role: UserRole.ATHLETE,
            name: nf[0], surname: nf[1], nameLatin: nf[2], surnameLatin: nf[3],
            gender: Gender.FEMALE, dateOfBirth: dob(),
            weightKg: rand(fcat.wMin, fcat.wMax),
            clubId: club.id, isActive: true, preferredLocale: Locale.kk,
          },
          update: { clubId: club.id, weightKg: rand(fcat.wMin, fcat.wMax) },
        });
        clubAthletes.push({ id: a.id, gender: "FEMALE", catIdx: 7 + catI });
        fi++; totalAthletes++;
      }
    }

    athletesByClub[club.id] = clubAthletes;
    process.stdout.write(`  Club ${ci+1}/10: ${clubAthletes.length} athletes (total: ${totalAthletes})\r`);
  }
  console.log(`\n✓ Athletes: ${totalAthletes}/400`);

  // ── 4. Create tournament ───────────────────────────────────────────────────
  const startDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const endDate   = new Date(Date.now() + 32 * 24 * 3600 * 1000);
  const deadline  = new Date(Date.now() + 25 * 24 * 3600 * 1000);

  const tournament = await prisma.tournament.upsert({
    where: { id: "fulltest-championship-2026" },
    create: {
      id: "fulltest-championship-2026",
      name: { ru: "Чемпионат Казахстана 2026 (FullTest)", kk: "Қазақстан чемпионаты 2026 (FullTest)" },
      description: { ru: "Полномасштабный тест 400 спортсменов, 14 категорий" },
      location: "Спорткомплекс Балуан Шолак", city: "Алматы",
      startDate, endDate, applicationDeadline: deadline,
      tatamiCount: 6, status: TournamentStatus.REGISTRATION_OPEN,
      createdById: ADMIN_ID,
    },
    update: { status: TournamentStatus.REGISTRATION_OPEN, applicationDeadline: deadline },
  });
  console.log(`✓ Tournament: ${tournament.id}`);

  // ── 5. Create 14 categories ────────────────────────────────────────────────
  const catDefs = [
    { name:{ru:"Мужчины −60 кг",kk:"Ер −60 кг"}, g:"MALE",   wMin:0,    wMax:60.0,  ageMin:18, ageMax:35 },
    { name:{ru:"Мужчины −66 кг",kk:"Ер −66 кг"}, g:"MALE",   wMin:60.01,wMax:66.0,  ageMin:18, ageMax:35 },
    { name:{ru:"Мужчины −73 кг",kk:"Ер −73 кг"}, g:"MALE",   wMin:66.01,wMax:73.0,  ageMin:18, ageMax:35 },
    { name:{ru:"Мужчины −81 кг",kk:"Ер −81 кг"}, g:"MALE",   wMin:73.01,wMax:81.0,  ageMin:18, ageMax:35 },
    { name:{ru:"Мужчины −90 кг",kk:"Ер −90 кг"}, g:"MALE",   wMin:81.01,wMax:90.0,  ageMin:18, ageMax:35 },
    { name:{ru:"Мужчины −100 кг",kk:"Ер −100 кг"},g:"MALE",  wMin:90.01,wMax:100.0, ageMin:18, ageMax:35 },
    { name:{ru:"Мужчины +100 кг",kk:"Ер +100 кг"},g:"MALE",  wMin:100.01,wMax:200.0,ageMin:18, ageMax:35 },
    { name:{ru:"Женщины −48 кг",kk:"Әйел −48 кг"}, g:"FEMALE",wMin:0,   wMax:48.0,  ageMin:18, ageMax:35 },
    { name:{ru:"Женщины −52 кг",kk:"Әйел −52 кг"}, g:"FEMALE",wMin:48.01,wMax:52.0, ageMin:18, ageMax:35 },
    { name:{ru:"Женщины −57 кг",kk:"Әйел −57 кг"}, g:"FEMALE",wMin:52.01,wMax:57.0, ageMin:18, ageMax:35 },
    { name:{ru:"Женщины −63 кг",kk:"Әйел −63 кг"}, g:"FEMALE",wMin:57.01,wMax:63.0, ageMin:18, ageMax:35 },
    { name:{ru:"Женщины −70 кг",kk:"Әйел −70 кг"}, g:"FEMALE",wMin:63.01,wMax:70.0, ageMin:18, ageMax:35 },
    { name:{ru:"Женщины −78 кг",kk:"Әйел −78 кг"}, g:"FEMALE",wMin:70.01,wMax:78.0, ageMin:18, ageMax:35 },
    { name:{ru:"Женщины +78 кг",kk:"Әйел +78 кг"}, g:"FEMALE",wMin:78.01,wMax:200.0,ageMin:18, ageMax:35 },
  ];

  const catIds: string[] = [];
  for (let i = 0; i < catDefs.length; i++) {
    const d = catDefs[i];
    const catId = `fulltest-cat-${i}`;
    const cat = await prisma.category.upsert({
      where: { id: catId },
      create: {
        id: catId,
        tournamentId: tournament.id,
        name: d.name,
        gender: d.g as Gender,
        ageMin: d.ageMin, ageMax: d.ageMax,
        weightMin: d.wMin, weightMax: d.wMax,
        matchDurationSec: 240,
        format: BracketFormat.SE_IJF,
      },
      update: {},
    });
    catIds.push(cat.id);
  }
  console.log(`✓ Categories: ${catIds.length}/14`);

  // ── 6. Create applications + entries ──────────────────────────────────────
  let totalEntries = 0;
  let entryErrors = 0;
  const appIds: Record<string, string> = {}; // clubId → applicationId

  for (let ci = 0; ci < 10; ci++) {
    const club = clubs[ci];
    const coach = coaches[ci];
    const clubAthletes = athletesByClub[club.id] ?? [];

    // Create application
    const appId = `fulltest-app-${ci}`;
    // Application has unique constraint on (tournamentId, clubId)
    const app = await prisma.application.upsert({
      where: { tournamentId_clubId: { tournamentId: tournament.id, clubId: club.id } },
      create: {
        tournamentId: tournament.id,
        clubId: club.id,
        status: "DRAFT",
      },
      update: { status: "DRAFT" },
    });
    const _appId = app.id; // keep for entries
    appIds[club.id] = app.id;

    // Delete old entries for this app
    await prisma.applicationEntry.deleteMany({ where: { applicationId: app.id } });

    // Add entries
    for (const athl of clubAthletes) {
      const catId = catIds[athl.catIdx];
      if (!catId) continue;
      try {
        await prisma.applicationEntry.create({
          data: { applicationId: app.id, athleteId: athl.id, categoryId: catId },
        });
        totalEntries++;
      } catch {
        entryErrors++;
      }
    }

    // Submit application
    await prisma.application.update({
      where: { id: app.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    process.stdout.write(`  Club ${ci+1}/10: ${clubAthletes.length} entries\r`);
  }
  console.log(`\n✓ Applications submitted: 10 clubs, ${totalEntries} entries (${entryErrors} entry errors)`);

  // ── 7. Approve all applications ────────────────────────────────────────────
  await prisma.application.updateMany({
    where: { tournamentId: tournament.id },
    data: { status: "APPROVED" },
  });
  console.log("✓ All applications approved");

  // ── 8. Summary ────────────────────────────────────────────────────────────
  const counts = await prisma.$transaction([
    prisma.user.count({ where: { role: "ATHLETE", email: { startsWith: "ft." } } }),
    prisma.user.count({ where: { role: "COACH",   email: { startsWith: "ft." } } }),
    prisma.applicationEntry.count({ where: { application: { tournamentId: tournament.id } } }),
  ]);

  console.log(`
╔════════════════════════════════════════════╗
║  Full-Scale Seed Complete                  ║
╠════════════════════════════════════════════╣
║  Athletes:    ${String(counts[0]).padEnd(28)}║
║  Coaches:     ${String(counts[1]).padEnd(28)}║
║  Entries:     ${String(counts[2]).padEnd(28)}║
║  Tournament:  fulltest-championship-2026   ║
╠════════════════════════════════════════════╣
║  Next: python3 test-fullscale.py --flow    ║
╚════════════════════════════════════════════╝
`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
