# A'lochi UAT Smoke Checklist (15 min)

## Pre-conditions
- DB seeded with superadmin (login: superadmin / password: Test1234!)
- Test tenant + branch + sample lessons
- Test student with `parentTelegramId`

## 1. Superadmin (3 min)
- [ ] Login as superadmin
- [ ] Create new tenant via /superadmin/tenants/new
- [ ] See it in /superadmin/tenants list
- [ ] Edit tenant (name change)
- [ ] Disable tenant; verify users cascade to inactive
- [ ] Settings: change warningBlockLimit
- [ ] View analytics 8-tab dashboard, all tabs render
- [ ] /superadmin/churn shows ML metrics block

## 2. Filadmin (3 min)
- [ ] Login as filadmin
- [ ] Mark staff attendance (face ID kiosk)
- [ ] Award KPI to staff member
- [ ] See "Recent awards" strip on KPI page
- [ ] Block student via 3rd warning

## 3. Mentor (2 min)
- [ ] Login as mentor
- [ ] View group page
- [ ] Set status: green for student
- [ ] Open student detail; click "Telegram parent"
- [ ] Verify status chips render

## 4. Student/Tester (3 min)
- [ ] Login as student
- [ ] XP bar, streak, daily quests, status, certificates strip render
- [ ] Open lesson; AI Tutor responds
- [ ] Verify "Bugungi dars" CTA
- [ ] Login as tester; verify pixel-clone dashboard
- [ ] /tester/lessons/current resolves to next lesson
- [ ] /tester/exam-queue still works

## 5. Telegram bot (2 min)
- [ ] /bugun, /statistika, /streak, /rating, /vazifalar — all respond

## 6. PWA (2 min)
- [ ] Install on Android Chrome (or iOS Safari instructions)
- [ ] Force offline; offline page shows reload button
- [ ] /api/** NOT cached (network error, not stale)
- [ ] Login page NOT cached (logout shows clean login)
