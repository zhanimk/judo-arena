const fs = require('fs');

function updateLang(lang, additions) {
  const file = `src/locales/${lang}/common.json`;
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  if (!data['2fa']) data['2fa'] = {};
  Object.assign(data['2fa'], additions);
  
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

updateLang('ru', {
  "title": "2FA — Двухфакторная аутентификация",
  "status_on": "2FA включена",
  "status_off": "2FA отключена",
  "btn_enable": "Включить 2FA",
  "btn_disable": "Отключить 2FA",
  "scan_qr": "Отсканируйте QR-код в Google Authenticator или Authy:",
  "secret_key": "Ключ",
  "enter_code": "Введите 6-значный код из приложения",
  "enter_code_disable": "Введите код для продолжения",
  "invalid_code": "Неверный код",
  "enabled_success": "2FA успешно включена ✓",
  "disabled_success": "2FA отключена"
});

updateLang('kk', {
  "title": "2FA — Екі факторлы аутентификация",
  "status_on": "2FA қосылған",
  "status_off": "2FA өшірілген",
  "btn_enable": "2FA қосу",
  "btn_disable": "2FA өшіру",
  "scan_qr": "QR-кодты Google Authenticator немесе Authy қолданбасымен сканерлеңіз:",
  "secret_key": "Кілт",
  "enter_code": "Қолданбадан 6 санды кодты енгізіңіз",
  "enter_code_disable": "Жалғастыру үшін кодты енгізіңіз",
  "invalid_code": "Код қате",
  "enabled_success": "2FA қосылды ✓",
  "disabled_success": "2FA өшірілді"
});

console.log('Translations added successfully.');
