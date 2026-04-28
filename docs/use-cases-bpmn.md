# A'lochi Platform — Use Case BPMN Diagrammalari

> **Notation:** 🟢 Start event | 🔴 End event | ◆ Gateway (XOR) | ◆◆ Parallel gateway | [ ] Task | (( )) Subprocess

---

## 1. O'quvchi Dars Bajarish

```mermaid
flowchart TD
    START([🟢 O'quvchi kirdi]) --> CHECK_BLOCK{O'quvchi\nbloklanganmi?}
    CHECK_BLOCK -- Ha --> BLOCKED([🔴 Kirish rad etildi\nBloklangan xabar])
    CHECK_BLOCK -- Yo'q --> CHECK_PAY{To'lov\nmuddati o'tdimi?}
    CHECK_PAY -- Ha --> AUTO_BLOCK([🔴 Avtomatik bloklash])
    CHECK_PAY -- Yo'q --> LOAD_LESSON[Dars yuklanadi]

    LOAD_LESSON --> WATCH_VIDEO[Video ko'rish\nTezlashtirish mumkin emas]
    WATCH_VIDEO --> VIDEO_DONE{Video\ntugadimi?}
    VIDEO_DONE -- Yo'q --> WATCH_VIDEO
    VIDEO_DONE -- Ha --> CHECK_MCQ{MCQ test\nyoqilganmi?}

    CHECK_MCQ -- Ha --> DO_MCQ[MCQ Test\n10 savol]
    CHECK_MCQ -- Yo'q --> CHECK_SORT{So'z tartib\nyoqilganmi?}
    DO_MCQ --> CHECK_SORT

    CHECK_SORT -- Ha --> DO_SORT[So'zlarni tartibga\nsol]
    CHECK_SORT -- Yo'q --> CHECK_VOCAB{Lug'at\nyoqilganmi?}
    DO_SORT --> CHECK_VOCAB

    CHECK_VOCAB -- Ha --> DO_VOCAB[Lug'at topshirish\nOg'zaki]
    CHECK_VOCAB -- Yo'q --> CHECK_AI{AI Tutor\nyoqilganmi?}
    DO_VOCAB --> CHECK_AI

    CHECK_AI -- Ha --> DO_AI[AI Tutor\nSavol-Javob]
    CHECK_AI -- Yo'q --> CHECK_CAM{Kamera\nyoqilganmi?}
    DO_AI --> CHECK_CAM

    CHECK_CAM -- Ha --> CAMERA[Kamera orqali\ntopshirish]
    CHECK_CAM -- Yo'q --> CALC_XP[XP hisoblanadi\n+N×10 XP]
    CAMERA --> CALC_XP

    CALC_XP --> UPDATE_STREAK[Streak yangilanadi]
    UPDATE_STREAK --> FEED_EVENT[Lentaga voqea\nyoziladi]
    FEED_EVENT --> CHECK_CERT{Sertifikat\nshartlari bajarilganmi?}
    CHECK_CERT -- Ha --> ISSUE_CERT[Sertifikat beriladi]
    CHECK_CERT -- Yo'q --> NEXT_LESSON{Keyingi dars\nbormi?}
    ISSUE_CERT --> NEXT_LESSON
    NEXT_LESSON -- Ha --> UNLOCK[Keyingi dars ochiladi]
    NEXT_LESSON -- Yo'q --> COURSE_DONE([🔴 Kurs tugadi])
    UNLOCK --> END_LESSON([🔴 Dars tugadi])
```

---

## 2. Ogohlantirish va Bloklash Tizimi

```mermaid
flowchart TD
    START([🟢 Ogohlantirish berish]) --> ACTOR{Kim bermoqda?}
    ACTOR -- Filadmin --> SCOPE_FIL[O'z filiali\no'quvchisi]
    ACTOR -- Superadmin --> SCOPE_SA[Istalgan filial\no'quvchisi]
    SCOPE_FIL --> SELECT_TYPE[Tur tanlash:\nDarsga tayyorlanmagan\nVazifa bajarilmagan\nIntizom\nBoshqa]
    SCOPE_SA --> SELECT_TYPE
    SELECT_TYPE --> ENTER_REASON[Sabab maydoni\nmajburiy to'ldiriladi]
    ENTER_REASON --> SAVE_WARN[Ogohlantirish saqlanadi]
    SAVE_WARN --> COUNT{Ogohlantirish\nsoni?}

    COUNT -- 1-ogohlantirish --> NOTIFY_1[O'quvchiga in-app\nxabar]
    NOTIFY_1 --> TELEGRAM_1[Ota-onaga Telegram\nxabar]
    TELEGRAM_1 --> END1([🔴 Jarayon tugadi])

    COUNT -- 2-ogohlantirish --> TELEGRAM_2[Ota-onaga Telegram\nxabar]
    TELEGRAM_2 --> NOTIFY_MENTOR[Mentorga xabar]
    NOTIFY_MENTOR --> END2([🔴 Jarayon tugadi])

    COUNT -- 3-ogohlantirish --> AUTO_BLOCK[Profil avtomatik\nbloklandi]
    AUTO_BLOCK --> TELEGRAM_3[Ota-onaga Telegram\nxabar]
    TELEGRAM_3 --> ALERT_ADMIN[Filadmin + Superadmin\nalert]
    ALERT_ADMIN --> WAIT_PAYMENT{Blokdan\nchiqarish?}
    WAIT_PAYMENT -- Filadmin blokdan chiqaradi --> UNBLOCK[Blok olib tashlandi]
    UNBLOCK --> END3([🔴 Jarayon tugadi])
    WAIT_PAYMENT -- Kutish --> WAIT_PAYMENT
```

---

## 3. To'lov Jarayoni

```mermaid
flowchart TD
    START([🟢 Oy boshi]) --> SA_SET[Superadmin to'lov\nmuddatini belgilaydi\nboshlanish + tugash sana]
    SA_SET --> DEADLINE_PASS{Muddat\no'tdimi?}
    DEADLINE_PASS -- Yo'q --> WAIT[Kutish]
    WAIT --> DEADLINE_PASS
    DEADLINE_PASS -- Ha --> CHECK_PAID{O'quvchi\nto'ladimi?}
    CHECK_PAID -- Ha --> OK([🔴 Hech narsa yo'q])
    CHECK_PAID -- Yo'q --> AUTO_BLOCK[Profil avtomatik\nbloklandi]

    AUTO_BLOCK --> PARENT_NOTIF[Ota-onaga\nxabar]
    PARENT_NOTIF --> FILADMIN_ACTS{Filadmin\nto'lovni qabul qiladi}

    FILADMIN_ACTS --> MARK_PAID[To'lov qabul qilindi\nbelgilanadi]
    MARK_PAID --> SCHEDULE[Keyingi kuni 00:00\nblok olib tashlanadi]
    SCHEDULE --> MIDNIGHT[Cron job ishga\ntushadi]
    MIDNIGHT --> UNBLOCK[O'quvchi blokdan\nchiqarildi]
    UNBLOCK --> END([🔴 Jarayon tugadi])
```

---

## 4. Delegatsiya Jarayoni

```mermaid
flowchart TD
    START([🟢 Delegatsiya yaratish]) --> CHECK_ACTIVE{Oluvchida faol\ndelegatsiya bormi?}
    CHECK_ACTIVE -- Ha --> REJECT_CREATE([🔴 Ruxsat berilmadi\nAllaqachon faol delegatsiya])
    CHECK_ACTIVE -- Yo'q --> FILL_FORM[Beruvchi to'ldiradi:\nOluvchi · Vakolatlar\nMuddat · Sabab majburiy]
    FILL_FORM --> SEND_NOTIF[Oluvchiga\nnotification]
    SEND_NOTIF --> RECIPIENT_DECIDES{Oluvchi\njavob beradi}

    RECIPIENT_DECIDES -- Qabul qildi --> ACTIVATE[Delegatsiya faollashdi]
    RECIPIENT_DECIDES -- Rad etdi --> REASON_REQUIRED[Sabab majburiy\nkiritiladi]
    REASON_REQUIRED --> NOTIFY_GIVER[Beruvchiga\nxabar ketadi]
    NOTIFY_GIVER --> END_RAD([🔴 Delegatsiya kuchga\nkirmadi])

    ACTIVATE --> AUDIT_LOG[Audit log: yaratildi]
    AUDIT_LOG --> DELEGATE_ACTS{Delegat\nvakolat ishlatadi?}

    DELEGATE_ACTS -- Ha --> LOG_ACTION[Har bir amal\naudit logga yoziladi]
    LOG_ACTION --> CHECK_EXPIRE{Muddat\ntugadimi?}
    DELEGATE_ACTS -- Yo'q --> CHECK_EXPIRE
    DELEGATE_ACTS -- Bekor qilish --> CANCEL_REASON[Sabab majburiy]
    CANCEL_REASON --> DEACTIVATE[Delegatsiya bekor]
    DEACTIVATE --> END_CANCEL([🔴 Bekor qilindi])

    CHECK_EXPIRE -- Yo'q --> DELEGATE_ACTS
    CHECK_EXPIRE -- Ha --> AUTO_EXPIRE[Cron job:\ndelegatsiya tugadi]
    AUTO_EXPIRE --> AUDIT_EXPIRE[Audit log:\nmuddat tugadi]
    AUDIT_EXPIRE --> END_EXPIRE([🔴 Delegatsiya yakunlandi])
```

---

## 5. 1v1 Duel Jarayoni

```mermaid
flowchart TD
    START([🟢 Duelga chaqirish]) --> CHECK_FRIEND{Do'stlar\nro'yxatidami?}
    CHECK_FRIEND -- Yo'q --> END_NO([🔴 Ruxsat yo'q])
    CHECK_FRIEND -- Ha --> CHECK_ACTIVE{Oluvchida faol\nduel bormi?}
    CHECK_ACTIVE -- Ha --> END_BUSY([🔴 Hozir duel o'ynay olmaydi])
    CHECK_ACTIVE -- Yo'q --> SEND_CHALLENGE[WebSocket:\nduel:challenged\n24 soat vaqt]

    SEND_CHALLENGE --> B_DECIDES{Oluvchi\njavob beradi}
    B_DECIDES -- Rad etdi --> END_DECLINE([🔴 Duel rad etildi])
    B_DECIDES -- Qabul qildi --> CREATE_DUEL[Duel yaratiladi\n10 ta MCQ savol]

    CREATE_DUEL --> A_SOLVES[O'quvchi A\nyechadi]
    CREATE_DUEL --> B_SOLVES[O'quvchi B\nyechadi]

    A_SOLVES --> WAIT_RESULT{24 soat\nyo ikkalasi yechdi}
    B_SOLVES --> WAIT_RESULT

    WAIT_RESULT --> CALC[Ball hisoblanadi\nTo'g'ri + tezlik bonus]
    CALC --> WINNER{G'olib\naniqlandi}
    WINNER --> WINNER_XP[G'olib: +150 XP\nDuel G'olibi badge]
    WINNER --> LOSER_XP[Yutqazgan: +30 XP\nIshtirok uchun]
    WINNER_XP --> FEED[Lentaga:\nSardor Jasurni duelda yendi!\n8/10 vs 6/10]
    LOSER_XP --> FEED
    FEED --> WS_RESULT[WebSocket:\nduel:result\nikkala o'quvchiga]
    WS_RESULT --> END([🔴 Duel tugadi])
```

---

## 6. Do'stlik So'rovi (13+ Yosh Tekshiruvi)

```mermaid
flowchart TD
    START([🟢 Do'st qo'shish so'rovi]) --> AUTO_CHECK{Bir xil\nguruhdami?}
    AUTO_CHECK -- Ha --> AUTO_FRIEND[Avtomatik do'st\nguruh tuzilganda]
    AUTO_FRIEND --> END_AUTO([🔴 Do'st bo'ldi])

    AUTO_CHECK -- Yo'q --> AGE_CHECK{Yuboruvchi\nyoshi 13+?}
    AGE_CHECK -- Yo'q --> END_AGE([🔴 Bloklanadi\nFaqat guruh darajasi])
    AGE_CHECK -- Ha --> SAME_BRANCH{Bir xil\nfilialdami?}
    SAME_BRANCH -- Yo'q --> END_BRANCH([🔴 Ruxsat yo'q\nFilial darajasida emas])
    SAME_BRANCH -- Ha --> SEND_REQUEST[So'rov yuboriladi]

    SEND_REQUEST --> NOTIF[Oluvchiga notification:\nX do'st bo'lishni\nso'ramoqda]
    NOTIF --> RECIPIENT{Oluvchi\njavob beradi}
    RECIPIENT -- Qabul qildi --> ADD_FRIEND[Filial do'stlari\nro'yxatiga qo'shildi]
    RECIPIENT -- Rad etdi --> END_REJECT([🔴 So'rov rad etildi])
    ADD_FRIEND --> ENABLE_DUEL[Duelga chaqirish\nmumkin bo'ladi]
    ENABLE_DUEL --> END_ACCEPT([🔴 Do'st qo'shildi])
```

---

## 7. Xodim Davomat (Face ID)

```mermaid
flowchart TD
    START([🟢 Xodim keldi]) --> KIOSK[Kiosk ekraniga\nyuzini ko'rsatadi]
    KIOSK --> FACE_SCAN[Face ID skanerlash]
    FACE_SCAN --> MATCH{Yuz\ntanilganmi?}
    MATCH -- Yo'q --> MANUAL[Qo'lda kiritish:\nXodim ismi tanlaydi]
    MANUAL --> LOG_MANUAL[Davomat yoziladi\n'qo'lda' belgisi bilan]
    MATCH -- Ha --> LOG_AUTO[Davomat avtomatik\nyoziladi]

    LOG_AUTO --> LATE_CHECK{Kechikdimi?}
    LOG_MANUAL --> LATE_CHECK
    LATE_CHECK -- Ha --> FLAG_LATE[Kechikish belgisi\nFiliadminga alert]
    LATE_CHECK -- Yo'q --> KPI_UPDATE[KPI yangilanadi\nXodim profili]
    FLAG_LATE --> KPI_UPDATE
    KPI_UPDATE --> END([🔴 Jarayon tugadi])
```

---

## 8. Guruh Challenge (7 Kunlik)

```mermaid
flowchart TD
    START([🟢 Challenge boshlanishi]) --> CREATE[Guruh A vs Guruh B\n7 kunlik challenge yaratiladi]
    CREATE --> NOTIFY_ALL[Ikki guruhdagi\nbarcha o'quvchilarga xabar]

    NOTIFY_ALL --> DAILY{Har kun}
    DAILY --> STUDENTS_EARN[O'quvchilar dars o'tib\nXP to'playdi]
    STUDENTS_EARN --> GROUP_XP[Guruh umumiy XP\nyangilanadi]
    GROUP_XP --> WIDGET_UPDATE[Chat sahifasidagi\nwidget yangilanadi]
    WIDGET_UPDATE --> DAY_CHECK{7 kun\ntugadimi?}
    DAY_CHECK -- Yo'q --> DAILY
    DAY_CHECK -- Ha --> FINAL_SCORE[Yakuniy ball\nhisoblanadi]

    FINAL_SCORE --> WINNER{G'olib guruh}
    WINNER --> WINNER_BONUS[G'olib guruh:\nhar a'zoga +200 XP]
    WINNER --> LOSER_BONUS[Yutqazgan guruh:\nhar a'zoga +50 XP]
    WINNER_BONUS --> FEED_EVENT[Lentaga\nelon]
    LOSER_BONUS --> FEED_EVENT
    FEED_EVENT --> END([🔴 Challenge tugadi])
```

---

## 9. Keyword Moderatsiya (Chat)

```mermaid
flowchart TD
    START([🟢 O'quvchi xabar yozadi]) --> CHAT_SEND[Xabar yuboriladi\nWebSocket: chat:send]
    CHAT_SEND --> KEYWORD_CHECK{Taqiqlangan\nkalit so'z bormi?}
    KEYWORD_CHECK -- Yo'q --> BROADCAST[Guruh chatiga\nxabar yetadi]
    BROADCAST --> END_OK([🔴 Xabar yuborildi])

    KEYWORD_CHECK -- Ha --> BLOCK_MSG[Xabar bloklanadi\nFaqat yuborganga xato]
    BLOCK_MSG --> LOG_VIOLATION[Qayd yoziladi\nMentor ko'rishi uchun]
    LOG_VIOLATION --> MENTOR_REVIEW{Mentor ko'radi}
    MENTOR_REVIEW -- Ogohlantirish beradi --> WARN_FLOW[Ogohlantirish\njarayoniga o'tadi]
    MENTOR_REVIEW -- E'tiborsiz qoldiradi --> END_IGNORE([🔴 Jarayon tugadi])
    WARN_FLOW --> END_WARN([🔴 Ogohlantirish berildi])

    subgraph Superadmin_Keywords[Superadmin: Keyword Boshqaruvi]
        KW_ADD[Kalit so'z qo'shish\nTenant bo'yicha]
        KW_DEL[Kalit so'z o'chirish]
        KW_CACHE[DB dan cache\nyangilanadi - onModuleInit]
    end
```

---

## 10. Sertifikat Berish

```mermaid
flowchart TD
    START([🟢 O'quvchi sertifikat shartlarini\nbajaradi]) --> CHECK_TYPE{Sertifikat\nturi}

    CHECK_TYPE -- Bronze --> B_CHECK{Shartlar:\n30 kun streak\nYOKI 100 dars}
    CHECK_TYPE -- Silver --> S_CHECK{Shartlar:\n60 kun streak\nYOKI 200 dars}
    CHECK_TYPE -- Gold --> G_CHECK{Shartlar:\n90 kun streak\nYOKI 300 dars}

    B_CHECK -- Bajarildi --> ISSUE[Sertifikat yaratiladi\nUUID + sana + o'quvchi]
    S_CHECK -- Bajarildi --> ISSUE
    G_CHECK -- Bajarildi --> ISSUE

    ISSUE --> VIRTUAL_CITY[Virtual shahar\nyangisi ochiladi]
    ISSUE --> FEED[Lentaga:\nMalika Gold sertifikat oldi!]
    ISSUE --> TELEGRAM_PARENT[Ota-onaga\nTelegram tabrik]
    ISSUE --> MANAGER_GIFT{Manager\nsovg'a belgilaydi?}
    MANAGER_GIFT -- Ha --> GIFT_LOG[Sovg'a yoziladi\nKPI ga +bal]
    MANAGER_GIFT -- Yo'q --> END_CERT([🔴 Sertifikat berildi])
    GIFT_LOG --> END_CERT
```
