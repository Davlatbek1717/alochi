/**
 * Centralised API error message registry — all user-facing error strings
 * in 3 locales.  Services call translateError(key, locale) instead of
 * hardcoding Uzbek strings so the same error travels to the browser in
 * the language the user's browser advertised.
 */
export const API_ERRORS = {
  login_failed:          { uz: "Login yoki parol noto'g'ri",                    en: "Invalid credentials",                 ru: "Неверный логин или пароль" },
  blocked_warning:       { uz: "Profil bloklangan (ogohlantirishlar)",          en: "Account blocked (warnings)",          ru: "Аккаунт заблокирован (предупреждения)" },
  blocked_payment:       { uz: "To'lov amalga oshirilmagan",                   en: "Payment overdue",                     ru: "Задолженность по оплате" },
  profile_blocked:       { uz: "Profilingiz bloklangan",                       en: "Your account is blocked",             ru: "Ваш аккаунт заблокирован" },
  refresh_invalid:       { uz: "Refresh token yaroqsiz",                       en: "Refresh token invalid or expired",    ru: "Refresh токен недействителен или истёк" },
  multiple_tenants:      { uz: "Bir xil login bir nechta markazda topildi. Iltimos, markaz nomini kiriting.", en: "Login found in multiple organizations. Please specify your center.", ru: "Логин найден в нескольких организациях. Укажите центр." },
  tenant_not_found:      { uz: "Tenant topilmadi",                             en: "Organization not found",              ru: "Организация не найдена" },
  user_not_found:        { uz: "Foydalanuvchi topilmadi",                      en: "User not found",                      ru: "Пользователь не найден" },
  duplicate_login:       { uz: "Bu login allaqachon mavjud",                   en: "This login is already taken",         ru: "Этот логин уже занят" },
  lesson_not_found:      { uz: "Dars topilmadi",                               en: "Lesson not found",                    ru: "Урок не найден" },
  exam_not_found:        { uz: "Imtihon topilmadi",                            en: "Exam not found",                      ru: "Экзамен не найден" },
  template_not_found:    { uz: "Shablon topilmadi",                            en: "Template not found",                  ru: "Шаблон не найден" },
  branding_not_found:    { uz: "Tenant topilmadi",                             en: "Organization not found",              ru: "Организация не найдена" },
  order_conflict:        { uz: "Bu tartib raqami allaqachon mavjud",           en: "This order number is already in use", ru: "Этот порядковый номер уже используется" },
  no_questions:          { uz: "Bu darsda baholanadigan savollar mavjud emas", en: "No gradable questions in this lesson", ru: "В этом уроке нет оцениваемых вопросов" },
  not_enough_questions:  { uz: "Duel uchun yetarli savol topilmadi (kamida 10 ta kerak)", en: "Not enough questions for a duel (min 10 needed)", ru: "Недостаточно вопросов для дуэли (нужно минимум 10)" },
  no_shared_lessons:     { uz: "Umumiy bajarilgan dars topilmadi — duel uchun kamida 1 ta kerak", en: "No shared completed lessons — at least 1 needed for a duel", ru: "Нет общих пройденных уроков — нужен хотя бы 1 для дуэли" },
  too_many_active_duels: { uz: "Bir vaqtda faqat 2 ta faol duel bo'lishi mumkin", en: "Max 2 active duels at a time",      ru: "Максимум 2 активные дуэли одновременно" },
  forbidden:             { uz: "Ruxsat yo'q",                                  en: "Access forbidden",                    ru: "Доступ запрещён" },
  progress_exists:       { uz: "Darsda o'quvchi progressi bor. O'chirib bo'lmaydi.", en: "Students have progress on this lesson. Cannot delete.", ru: "У учеников есть прогресс по уроку. Удаление невозможно." },
  setting_key_invalid:   { uz: "Noma'lum sozlama kalitlari",                  en: "Unknown settings keys",               ru: "Неизвестные ключи настроек" },
  exam_already_done:     { uz: "Imtihon allaqachon yakunlangan",              en: "Exam already completed",              ru: "Экзамен уже завершён" },
  student_not_found:     { uz: "O'quvchi topilmadi",                          en: "Student not found",                   ru: "Ученик не найден" },
  parent_not_linked:     { uz: "Ota-ona Telegram ulanmagan",                  en: "Parent Telegram not linked",          ru: "Telegram родителя не подключён" },
  face_not_enrolled:     { uz: "Yuz ro'yxatdan o'tmagan",                    en: "Face not enrolled",                   ru: "Лицо не зарегистрировано" },
} as const;

export type ErrorKey = keyof typeof API_ERRORS;
type SupportedLocale = 'uz' | 'en' | 'ru';

/**
 * Pure translation function — no DI, no request scope, no side effects.
 * Call it anywhere with a key + locale string.
 *
 * Falls back to Uzbek when locale is unknown or key is missing.
 */
export function translateError(key: ErrorKey, locale = 'uz'): string {
  const entry = API_ERRORS[key];
  if (!entry) return key;
  const loc = (['uz', 'en', 'ru'].includes(locale) ? locale : 'uz') as SupportedLocale;
  return entry[loc];
}

/** Extract a 2-char locale code from an Accept-Language header value. */
export function localeFromHeader(acceptLanguage: string | undefined): string {
  if (!acceptLanguage) return 'uz';
  const lang = acceptLanguage.split(',')[0].trim().slice(0, 2).toLowerCase();
  return ['uz', 'en', 'ru'].includes(lang) ? lang : 'uz';
}
