const fs = require("fs");
const path = require("path");

const locales = ["ru", "kk", "en"];

const newStrings = {
  ru: {
    admin: {
      broadcast_new_desc:
        "Отправка мгновенного PUSH-уведомления и сообщения на платформе.",
      audience: "Аудитория",
      target_all: "Всем пользователям",
      target_role: "Определенной роли",
      target_club: "Определенному клубу",
      select_role: "Выберите роль",
      role_athlete: "Спортсмены",
      role_coach: "Тренеры",
      role_admin: "Администраторы",
      select_club: "Выберите клуб",
      select_club_placeholder: "-- Выберите клуб --",
      title_label: "Заголовок",
      title_placeholder: "Важное объявление",
      body_label: "Текст уведомления",
      body_placeholder: "Введите текст рассылки...",
      send_broadcast: "Отправить рассылку",
    },
  },
  kk: {
    admin: {
      broadcast_new_desc: "Платформада PUSH-хабарлама және хат жіберу.",
      audience: "Аудитория",
      target_all: "Барлық пайдаланушыларға",
      target_role: "Белгілі бір рөлге",
      target_club: "Белгілі бір клубқа",
      select_role: "Рөлді таңдаңыз",
      role_athlete: "Спортшылар",
      role_coach: "Бапкерлер",
      role_admin: "Әкімшілер",
      select_club: "Клубты таңдаңыз",
      select_club_placeholder: "-- Клубты таңдаңыз --",
      title_label: "Тақырыбы",
      title_placeholder: "Маңызды хабарландыру",
      body_label: "Хабарлама мәтіні",
      body_placeholder: "Хабарлама мәтінін енгізіңіз...",
      send_broadcast: "Хабарлама жіберу",
    },
  },
  en: {
    admin: {
      broadcast_new_desc:
        "Send instant PUSH notification and platform message.",
      audience: "Audience",
      target_all: "All users",
      target_role: "Specific role",
      target_club: "Specific club",
      select_role: "Select role",
      role_athlete: "Athletes",
      role_coach: "Coaches",
      role_admin: "Administrators",
      select_club: "Select club",
      select_club_placeholder: "-- Select club --",
      title_label: "Title",
      title_placeholder: "Important announcement",
      body_label: "Notification text",
      body_placeholder: "Enter broadcast text...",
      send_broadcast: "Send broadcast",
    },
  },
};

locales.forEach((lang) => {
  const filePath = path.join(__dirname, "web/src/locales", lang, "common.json");
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (!data.admin) data.admin = {};
    Object.assign(data.admin, newStrings[lang].admin);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
    console.log(`Updated ${lang}/common.json`);
  }
});
