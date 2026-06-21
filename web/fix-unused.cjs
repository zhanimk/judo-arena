const fs = require('fs');

function fixAdminClubsId() {
  const file = 'web/src/routes/admin.clubs.$id.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/, FileText/, '');
  content = content.replace(/function docTypeLabel.*?\n}/s, '');
  fs.writeFileSync(file, content);
}

function fixAdminClubs() {
  const file = 'web/src/routes/admin.clubs.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/,\n\s*User/, '');
  content = content.replace(/function docTypeLabel.*?\n}/s, '');
  fs.writeFileSync(file, content);
}

function fixAdminUsersId() {
  const file = 'web/src/routes/admin.users.$id.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\s*ExternalLink,\n\s*FileText,\n/, '\n');
  content = content.replace(/, type UserDocument /, ' ');
  fs.writeFileSync(file, content);
}

function fixAdminUsers() {
  const file = 'web/src/routes/admin.users.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\s*ChevronLeft,\n\s*ChevronRight,\n\s*Download,\n\s*FileText,\n/, '\n');
  content = content.replace(/,\n\s*ZoomIn/, '');
  content = content.replace(/, type UserDocument/, '');
  content = content.replace(/function documentTypeLabel.*?\n}/s, '');
  fs.writeFileSync(file, content);
}

function fixAthleteProfile() {
  const file = 'web/src/routes/athlete.profile.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/function localeLabel.*?\n}/s, '');
  fs.writeFileSync(file, content);
}

function fixCoachAthletesId() {
  const file = 'web/src/routes/coach.athletes.$id.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/FileText, /, '');
  content = content.replace(/, type UserDocument /, ' ');
  content = content.replace(/function docLabel.*?\n}/s, '');
  fs.writeFileSync(file, content);
}

function fixCoachOnboarding() {
  const file = 'web/src/routes/coach.onboarding.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/,\n\s*Upload/, '');
  fs.writeFileSync(file, content);
}

fixAdminClubsId();
fixAdminClubs();
fixAdminUsersId();
fixAdminUsers();
fixAthleteProfile();
fixCoachAthletesId();
fixCoachOnboarding();
console.log('Fixed unused variables');
