# 🐳 Docker Desktop — установка для Judo-Arena

Жанетта, Docker — это инструмент который запускает PostgreSQL и Redis на твоём компьютере "в коробке" — не нужно устанавливать БД отдельно, всё работает через одну команду. Это профессиональный стандарт.

## Шаг 1. Скачать Docker Desktop

**Windows:**
1. Зайди на https://www.docker.com/products/docker-desktop/
2. Кнопка **"Download for Windows — AMD64"** (для большинства ноутбуков).
3. Запусти `Docker Desktop Installer.exe`.
4. На первом экране **поставь обе галочки**:
   - ✅ Use WSL 2 instead of Hyper-V (recommended)
   - ✅ Add shortcut to desktop
5. Нажимай Next до конца, перезагрузи компьютер если попросит.

**Mac (если у тебя Mac):**
1. На той же странице выбери **Mac with Apple Chip** (для M1/M2/M3) или **Mac with Intel chip**.
2. Скачай `.dmg`, открой, перетащи Docker в Applications.
3. Запусти Docker из Applications.

## Шаг 2. Запустить Docker Desktop

- В трее (правый нижний угол на Windows, правый верх на Mac) появится **значок кита** 🐳.
- Первый запуск может занять 1-2 минуты — нужно дождаться когда кит перестанет анимироваться и станет статичным = Docker готов.
- В Docker Desktop появится окно — можно его свернуть. Главное чтобы кит был в трее.

## Шаг 3. Проверить что всё работает

Открой терминал (PowerShell на Windows, Terminal на Mac):

```bash
docker --version
docker compose version
```

Должны показаться номера версий, например:
```
Docker version 26.1.4, build ...
Docker Compose version v2.27.1
```

Если выдаёт "command not found" — Docker Desktop не запущен или нужна перезагрузка.

## Шаг 4. Тест-запуск (необязательно, но полезно)

```bash
docker run hello-world
```

Если увидишь сообщение "Hello from Docker!" — всё установлено правильно. 🎉

## ❓ Если возникли проблемы

### Windows: "WSL 2 installation is incomplete"
1. Открой PowerShell от имени Администратора.
2. Выполни: `wsl --install`
3. Перезагрузись.
4. Запусти Docker Desktop ещё раз.

### Windows: "Virtualization is not enabled"
Нужно включить виртуализацию в BIOS. Это сложнее — напиши мне, я подскажу по модели твоего ноутбука. Альтернатива — Docker может работать без WSL на старых системах, но медленнее.

### Mac: "Permission denied"
- Открой System Preferences → Privacy & Security → разреши Docker.

## 🎯 Что будет дальше

Когда Docker установлен и кит в трее — ты пишешь мне "Docker готов", и я в одной команде запускаю PostgreSQL + Redis + Mailpit (тестовый почтовик). Через 30 секунд у тебя будет работающая база данных, которую видно в pgAdmin и в Prisma Studio.

Никаких ручных настроек Postgres, паролей, портов — всё уже прописано в `docker-compose.yml`, который я подготовил.

## 💾 Сколько места займёт

- Docker Desktop сам по себе: ~3 ГБ.
- Образы Postgres + Redis + Mailpit: ~500 МБ.
- Данные твоей БД (для дипломного проекта): меньше 100 МБ.
- **Итого: ~4 ГБ**.

Когда защитишь диплом, можно удалить Docker Desktop через "Установка и удаление программ" и освободить место.
